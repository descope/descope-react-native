import { computeRefreshDelay, getTokenExpirationDate, isTokenExpired, MAX_TIMEOUT_MS, millisecondsUntilExpiration, performRefresh, REFRESH_THRESHOLD_MS } from '../src/internal/session/autoRefresh'
import type { Sdk } from '../src/internal/core/sdk'
import type { DescopeSession } from '../src/types'

const NOW = 1_700_000_000_000 // arbitrary fixed instant

const makeJwtWithExp = (expSeconds: number) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64')
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64')
  return `${header}.${payload}.signature`
}

const session = (overrides: Partial<DescopeSession> = {}): DescopeSession => ({
  sessionJwt: makeJwtWithExp(Math.floor(NOW / 1000) + 3600),
  refreshJwt: makeJwtWithExp(Math.floor(NOW / 1000) + 7 * 86400),
  user: { userId: 'u1', loginIds: [] } as unknown as DescopeSession['user'],
  ...overrides,
})

const fakeSdk = (refresh: jest.Mock): Sdk => ({ refresh }) as unknown as Sdk

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('autoRefresh helpers', () => {
  describe('getTokenExpirationDate', () => {
    it('extracts exp from a well-formed JWT', () => {
      const exp = Math.floor(NOW / 1000) + 600
      expect(getTokenExpirationDate(makeJwtWithExp(exp))?.getTime()).toBe(exp * 1000)
    })

    it('returns undefined for malformed tokens', () => {
      expect(getTokenExpirationDate('')).toBeUndefined()
      expect(getTokenExpirationDate('not-a-jwt')).toBeUndefined()
      expect(getTokenExpirationDate('header.payload')).toBeUndefined()
    })

    it('returns undefined when exp is missing or non-numeric', () => {
      const noExp = `${Buffer.from('{}').toString('base64')}.${Buffer.from('{}').toString('base64')}.sig`
      expect(getTokenExpirationDate(noExp)).toBeUndefined()
    })
  })

  describe('isTokenExpired', () => {
    it('returns true for an exp in the past', () => {
      expect(isTokenExpired(makeJwtWithExp(Math.floor(NOW / 1000) - 1))).toBe(true)
    })

    it('returns false for an exp in the future', () => {
      expect(isTokenExpired(makeJwtWithExp(Math.floor(NOW / 1000) + 60))).toBe(false)
    })

    it('returns false for an unparseable token (do not assume expired)', () => {
      expect(isTokenExpired('garbage')).toBe(false)
    })
  })

  describe('millisecondsUntilExpiration', () => {
    it('returns positive for valid future tokens', () => {
      expect(millisecondsUntilExpiration(makeJwtWithExp(Math.floor(NOW / 1000) + 60))).toBe(60_000)
    })

    it('returns negative for expired tokens', () => {
      expect(millisecondsUntilExpiration(makeJwtWithExp(Math.floor(NOW / 1000) - 30))).toBeLessThan(0)
    })

    it('returns 0 for unparseable tokens', () => {
      expect(millisecondsUntilExpiration('garbage')).toBe(0)
    })
  })

  describe('computeRefreshDelay', () => {
    it('returns null for unparseable tokens', () => {
      expect(computeRefreshDelay('garbage')).toBeNull()
    })

    it('returns 0 when the session is already within the refresh threshold', () => {
      expect(computeRefreshDelay(makeJwtWithExp(Math.floor(NOW / 1000) + 30))).toBe(0)
    })

    it('returns 0 when the session is already past expiration', () => {
      expect(computeRefreshDelay(makeJwtWithExp(Math.floor(NOW / 1000) - 5))).toBe(0)
    })

    it('returns the time until threshold for a healthy session', () => {
      const expSeconds = Math.floor(NOW / 1000) + 600 // 10 minutes ahead
      const expectedDelay = 600_000 - REFRESH_THRESHOLD_MS // (600s − 60s) in ms
      expect(computeRefreshDelay(makeJwtWithExp(expSeconds))).toBe(expectedDelay)
    })

    it('caps very long delays at MAX_TIMEOUT_MS', () => {
      // 60 days from now, far past the 2^31 ms cap
      const expSeconds = Math.floor(NOW / 1000) + 60 * 86400
      expect(computeRefreshDelay(makeJwtWithExp(expSeconds))).toBe(MAX_TIMEOUT_MS)
    })
  })

  describe('performRefresh', () => {
    it('returns noop when refresh JWT is missing', async () => {
      const sdk = fakeSdk(jest.fn())
      const result = await performRefresh(sdk, session({ refreshJwt: '' }), () => true)
      expect(result.kind).toBe('noop')
      expect(sdk.refresh).not.toHaveBeenCalled()
    })

    it('returns noop when refresh JWT is expired', async () => {
      const expiredRefresh = makeJwtWithExp(Math.floor(NOW / 1000) - 60)
      const sdk = fakeSdk(jest.fn())
      const result = await performRefresh(sdk, session({ refreshJwt: expiredRefresh }), () => true)
      expect(result.kind).toBe('noop')
      expect(sdk.refresh).not.toHaveBeenCalled()
    })

    it('returns fresh with a new session when refresh succeeds', async () => {
      const newSessionJwt = makeJwtWithExp(Math.floor(NOW / 1000) + 7200)
      const newRefreshJwt = makeJwtWithExp(Math.floor(NOW / 1000) + 14 * 86400)
      const sdk = fakeSdk(
        jest.fn().mockResolvedValue({
          ok: true,
          data: { sessionJwt: newSessionJwt, refreshJwt: newRefreshJwt },
        }),
      )
      const current = session()
      const result = await performRefresh(sdk, current, () => true)
      expect(result).toEqual({
        kind: 'fresh',
        session: { ...current, sessionJwt: newSessionJwt, refreshJwt: newRefreshJwt },
      })
    })

    it('keeps the existing refresh JWT when the response omits one', async () => {
      const newSessionJwt = makeJwtWithExp(Math.floor(NOW / 1000) + 7200)
      const sdk = fakeSdk(
        jest.fn().mockResolvedValue({
          ok: true,
          data: { sessionJwt: newSessionJwt },
        }),
      )
      const current = session()
      const result = await performRefresh(sdk, current, () => true)
      if (result.kind !== 'fresh') throw new Error(`expected fresh, got ${result.kind}`)
      expect(result.session.refreshJwt).toBe(current.refreshJwt)
    })

    it('returns transient when sdk.refresh throws', async () => {
      const sdk = fakeSdk(jest.fn().mockRejectedValue(new Error('Network request failed')))
      const result = await performRefresh(sdk, session(), () => true)
      expect(result.kind).toBe('transient')
    })

    it('returns fatal when the server rejects the refresh', async () => {
      const sdk = fakeSdk(
        jest.fn().mockResolvedValue({
          ok: false,
          error: { errorCode: 'E061102', errorDescription: 'Invalid refresh token' },
        }),
      )
      const result = await performRefresh(sdk, session(), () => true)
      expect(result.kind).toBe('fatal')
    })

    it('returns unchanged when the active session changed mid-flight', async () => {
      const newSessionJwt = makeJwtWithExp(Math.floor(NOW / 1000) + 7200)
      const sdk = fakeSdk(
        jest.fn().mockResolvedValue({
          ok: true,
          data: { sessionJwt: newSessionJwt },
        }),
      )
      const result = await performRefresh(sdk, session(), () => false)
      expect(result.kind).toBe('unchanged')
    })
  })
})
