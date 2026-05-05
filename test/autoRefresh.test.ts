import { computeRefreshDelay, getTokenExpirationDate, isTokenExpired, MAX_TIMEOUT_MS, millisecondsUntilExpiration, REFRESH_THRESHOLD_MS } from '../src/internal/session/autoRefresh'

const NOW = 1_700_000_000_000

const makeJwtWithExp = (expSeconds: number) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64')
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64')
  return `${header}.${payload}.signature`
}

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

    it('returns false for an unparseable token', () => {
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
      const expSeconds = Math.floor(NOW / 1000) + 600
      const expectedDelay = 600_000 - REFRESH_THRESHOLD_MS
      expect(computeRefreshDelay(makeJwtWithExp(expSeconds))).toBe(expectedDelay)
    })

    it('caps very long delays at MAX_TIMEOUT_MS', () => {
      const expSeconds = Math.floor(NOW / 1000) + 60 * 86400
      expect(computeRefreshDelay(makeJwtWithExp(expSeconds))).toBe(MAX_TIMEOUT_MS)
    })
  })
})
