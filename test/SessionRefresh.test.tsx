import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import createCoreSdk from '@descope/core-js-sdk'
import { AppState, type AppStateStatus } from 'react-native'
import { AuthProvider, useSession } from '../src'
import type { DescopeSessionManager } from '../src/types'
import DescopeReactNative from '../src/internal/modules/descopeModule'
import { REFRESH_THRESHOLD_MS, TRANSIENT_BACKOFF_MS } from '../src/internal/session/autoRefresh'

jest.mock('@descope/core-js-sdk', () => jest.fn())

jest.mock('../src/internal/modules/descopeModule', () => ({
  __esModule: true,
  default: {
    loadItem: jest.fn(),
    saveItem: jest.fn().mockResolvedValue(''),
    removeItem: jest.fn().mockResolvedValue(''),
    configureLogging: jest.fn().mockResolvedValue(undefined),
  },
}))

// avoid bringing up NativeEventEmitter against the mocked native module
jest.mock('../src/internal/modules/nativeLogBridge', () => ({
  setupNativeLogBridge: jest.fn(() => () => {}),
}))

const NOW = 1_700_000_000_000
const PROJECT = 'Pproject1234567890'

const makeJwt = (expSeconds: number) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64')
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64')
  return `${header}.${payload}.signature`
}

const makeSession = (sessionExpSeconds: number, refreshExpSeconds = Math.floor(NOW / 1000) + 7 * 86400) => ({
  sessionJwt: makeJwt(sessionExpSeconds),
  refreshJwt: makeJwt(refreshExpSeconds),
  user: { userId: 'u1', loginIds: [] },
})

let appStateListener: ((s: AppStateStatus) => void) | null = null

const setAppState = (state: AppStateStatus) => {
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true, writable: true })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  appStateListener = null
  ;(AppState.addEventListener as jest.Mock).mockImplementation((event: string, listener: any) => {
    if (event === 'change') {
      appStateListener = listener
    }
    return {
      remove: jest.fn(() => {
        appStateListener = null
      }),
    }
  })
  setAppState('active')
  ;(DescopeReactNative.saveItem as jest.Mock).mockClear()
  ;(DescopeReactNative.loadItem as jest.Mock).mockReset()
  ;(DescopeReactNative.removeItem as jest.Mock).mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

type Probe = { manager: DescopeSessionManager | null }

const ProbeComponent = ({ probe }: { probe: Probe }) => {
  probe.manager = useSession()
  return null
}

const mountAuthProvider = async (refresh: jest.Mock, initialSession: ReturnType<typeof makeSession> | null, props: { disableAutoRefresh?: boolean } = {}): Promise<Probe> => {
  ;(createCoreSdk as unknown as jest.Mock).mockReturnValue({ refresh })
  ;(DescopeReactNative.loadItem as jest.Mock).mockResolvedValue(initialSession ? JSON.stringify(initialSession) : null)

  const probe: Probe = { manager: null }
  await act(async () => {
    TestRenderer.create(
      <AuthProvider projectId={PROJECT} {...props}>
        <ProbeComponent probe={probe} />
      </AuthProvider>,
    )
    // flush the loadItem promise and its .finally setSessionLoading update
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  return probe
}

const advanceAndFlush = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useSessionAutoRefresh (via AuthProvider)', () => {
  it('schedules a refresh just before the session JWT expires', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600 // 10 minutes ahead
    const refresh = jest.fn().mockResolvedValue({
      ok: true,
      data: { sessionJwt: makeJwt(sessionExp + 600), refreshJwt: makeJwt(sessionExp + 7 * 86400) },
    })

    await mountAuthProvider(refresh, makeSession(sessionExp))

    await advanceAndFlush(600_000 - REFRESH_THRESHOLD_MS - 1000)
    expect(refresh).not.toHaveBeenCalled()

    await advanceAndFlush(2000)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(DescopeReactNative.saveItem).toHaveBeenCalled()
  })

  it('reschedules a fresh refresh after the previous one succeeds', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600
    const newSessionExpSeconds = Math.floor(NOW / 1000) + 1200
    const refresh = jest.fn().mockResolvedValue({
      ok: true,
      data: { sessionJwt: makeJwt(newSessionExpSeconds), refreshJwt: makeJwt(newSessionExpSeconds + 7 * 86400) },
    })

    await mountAuthProvider(refresh, makeSession(sessionExp))

    await advanceAndFlush(600_000 - REFRESH_THRESHOLD_MS + 100)
    expect(refresh).toHaveBeenCalledTimes(1)

    // advance past the original threshold; the next schedule is based on the new exp
    await advanceAndFlush(100_000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not schedule a refresh if the refresh JWT is already expired', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600
    const refresh = jest.fn()
    const expiredRefresh = Math.floor(NOW / 1000) - 60

    await mountAuthProvider(refresh, makeSession(sessionExp, expiredRefresh))

    await advanceAndFlush(600_000)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('pauses on background and re-arms with an immediate catch-up on active', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600
    const refresh = jest.fn().mockResolvedValue({
      ok: true,
      data: { sessionJwt: makeJwt(sessionExp + 600), refreshJwt: makeJwt(sessionExp + 7 * 86400) },
    })

    await mountAuthProvider(refresh, makeSession(sessionExp))

    setAppState('background')
    await act(async () => {
      appStateListener?.('background')
      await Promise.resolve()
    })

    // timer was paused on background, nothing fires
    await advanceAndFlush(600_000)
    expect(refresh).not.toHaveBeenCalled()

    setAppState('active')
    await act(async () => {
      appStateListener?.('active')
      await Promise.resolve()
    })
    await advanceAndFlush(0)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('leaves the timer alone on transient inactive state', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600
    const refresh = jest.fn().mockResolvedValue({
      ok: true,
      data: { sessionJwt: makeJwt(sessionExp + 600), refreshJwt: makeJwt(sessionExp + 7 * 86400) },
    })

    await mountAuthProvider(refresh, makeSession(sessionExp))

    await act(async () => {
      appStateListener?.('inactive')
      await Promise.resolve()
    })

    await advanceAndFlush(600_000 - REFRESH_THRESHOLD_MS + 100)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does nothing on AppState active when the session is healthy', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600
    const refresh = jest.fn()

    await mountAuthProvider(refresh, makeSession(sessionExp))

    await act(async () => {
      appStateListener?.('active')
      await Promise.resolve()
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('reschedules at TRANSIENT_BACKOFF_MS when refresh throws', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600
    const refresh = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValue({
        ok: true,
        data: { sessionJwt: makeJwt(sessionExp + 600), refreshJwt: makeJwt(sessionExp + 7 * 86400) },
      })

    await mountAuthProvider(refresh, makeSession(sessionExp))

    await advanceAndFlush(600_000 - REFRESH_THRESHOLD_MS + 100)
    expect(refresh).toHaveBeenCalledTimes(1)

    await advanceAndFlush(TRANSIENT_BACKOFF_MS - 1000)
    expect(refresh).toHaveBeenCalledTimes(1)

    await advanceAndFlush(2000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('does not reschedule when the server rejects the refresh', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600
    const refresh = jest.fn().mockResolvedValue({
      ok: false,
      error: { errorCode: 'E061102', errorDescription: 'Invalid refresh token' },
    })

    await mountAuthProvider(refresh, makeSession(sessionExp))

    await advanceAndFlush(600_000 - REFRESH_THRESHOLD_MS + 100)
    expect(refresh).toHaveBeenCalledTimes(1)

    await advanceAndFlush(60 * 60 * 1000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('disableAutoRefresh prop suppresses both timer and AppState listener', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600
    const refresh = jest.fn()

    await mountAuthProvider(refresh, makeSession(sessionExp), { disableAutoRefresh: true })

    await advanceAndFlush(600_000 + 60_000)
    expect(refresh).not.toHaveBeenCalled()
    expect(appStateListener).toBeNull()
  })

  it('arms a fresh timer from a session loaded after process kill (cold start)', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 30 // already inside the threshold
    const refresh = jest.fn().mockResolvedValue({
      ok: true,
      data: { sessionJwt: makeJwt(sessionExp + 600), refreshJwt: makeJwt(sessionExp + 7 * 86400) },
    })

    await mountAuthProvider(refresh, makeSession(sessionExp))

    await advanceAndFlush(0)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(DescopeReactNative.saveItem).toHaveBeenCalled()
  })

  it('shares the in-flight mutex between auto-refresh and manual refreshSessionIfAboutToExpire', async () => {
    const sessionExp = Math.floor(NOW / 1000) + 600
    let resolveRefresh: ((v: { ok: true; data: { sessionJwt: string; refreshJwt: string } }) => void) | undefined
    const refresh = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
    )

    const probe = await mountAuthProvider(refresh, makeSession(sessionExp))

    await advanceAndFlush(600_000 - REFRESH_THRESHOLD_MS + 100)
    expect(refresh).toHaveBeenCalledTimes(1)

    // manual call while auto-refresh is in-flight, mutex should bail
    await act(async () => {
      await probe.manager!.refreshSessionIfAboutToExpire()
    })
    expect(refresh).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveRefresh!({
        ok: true,
        data: { sessionJwt: makeJwt(sessionExp + 600), refreshJwt: makeJwt(sessionExp + 7 * 86400) },
      })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('drops the auto-refresh result when manageSession runs mid-flight', async () => {
    const sessionAExp = Math.floor(NOW / 1000) + 600
    const sessionBExp = Math.floor(NOW / 1000) + 7200
    const oldSessionJwtFromAutoRefresh = makeJwt(sessionAExp + 1000)

    let resolveRefresh: ((v: { ok: true; data: { sessionJwt: string; refreshJwt: string } }) => void) | undefined
    const refresh = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
    )

    const probe = await mountAuthProvider(refresh, makeSession(sessionAExp))

    await advanceAndFlush(600_000 - REFRESH_THRESHOLD_MS + 100)
    expect(refresh).toHaveBeenCalledTimes(1)

    const sessionBJwt = makeJwt(sessionBExp)
    const refreshBJwt = makeJwt(sessionBExp + 7 * 86400)
    await act(async () => {
      await probe.manager!.manageSession({
        sessionJwt: sessionBJwt,
        refreshJwt: refreshBJwt,
        user: { userId: 'u2', loginIds: [] },
      } as any)
    })
    expect(probe.manager!.session?.sessionJwt).toBe(sessionBJwt)

    // resolve the now-stale refresh of A, result should be discarded
    await act(async () => {
      resolveRefresh!({
        ok: true,
        data: { sessionJwt: oldSessionJwtFromAutoRefresh, refreshJwt: makeJwt(sessionAExp + 7 * 86400) },
      })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(probe.manager!.session?.sessionJwt).toBe(sessionBJwt)
  })

  it('does not recreate the SDK when logger or fetch prop identity changes', async () => {
    const refresh = jest.fn()
    ;(createCoreSdk as unknown as jest.Mock).mockClear()
    ;(createCoreSdk as unknown as jest.Mock).mockReturnValue({ refresh })
    ;(DescopeReactNative.loadItem as jest.Mock).mockResolvedValue(null)

    const makeLogger = () => ({ log: () => {}, debug: () => {}, warn: () => {}, error: () => {} })
    const makeFetch = () => () => Promise.resolve(new Response())

    let renderer!: ReturnType<typeof TestRenderer.create>
    await act(async () => {
      renderer = TestRenderer.create(
        <AuthProvider projectId={PROJECT} logger={makeLogger()} fetch={makeFetch() as unknown as typeof fetch}>
          {null}
        </AuthProvider>,
      )
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(createCoreSdk).toHaveBeenCalledTimes(1)

    // re-render with brand-new logger and fetch literals
    await act(async () => {
      renderer.update(
        <AuthProvider projectId={PROJECT} logger={makeLogger()} fetch={makeFetch() as unknown as typeof fetch}>
          {null}
        </AuthProvider>,
      )
      await Promise.resolve()
    })

    // SDK should not have been recreated despite the new prop identities
    expect(createCoreSdk).toHaveBeenCalledTimes(1)
  })
})
