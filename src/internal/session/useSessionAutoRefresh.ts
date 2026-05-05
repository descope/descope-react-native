import { useEffect } from 'react'
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native'
import type { DescopeSession } from '../../types'
import type { Sdk, SdkLogger } from '../core/sdk'
import { setCurrentTokens } from '../../helpers'
import DescopeReactNative from '../modules/descopeModule'
import { getTokenExpiration } from '../core/token'

// trigger the refresh when the session JWT has this much time or less remaining
const REFRESH_THRESHOLD_MS = 60 * 1000

// retry delay after a refresh attempt fails with a transient (network) error
const TRANSIENT_BACKOFF_MS = 30 * 1000

// setTimeout stores its delay as a 32-bit signed integer; larger values fire immediately
const MAX_TIMEOUT_MS = 2_147_483_647

const isTokenExpired = (token: string): boolean => {
  const exp = getTokenExpiration(token)
  return exp ? exp.getTime() <= Date.now() : false
}

const computeRefreshDelay = (sessionJwt: string): number | null => {
  const exp = getTokenExpiration(sessionJwt)
  if (!exp) return null
  const delay = exp.getTime() - Date.now() - REFRESH_THRESHOLD_MS
  if (delay <= 0) return 0
  return Math.min(delay, MAX_TIMEOUT_MS)
}

type Args = {
  sdk?: Sdk
  session?: DescopeSession
  setSession: React.Dispatch<React.SetStateAction<DescopeSession | undefined>>
  projectId: string
  logger?: SdkLogger
  disabled?: boolean
}

/**
 * Background auto-refresh of the active session. Owns a single rolling setTimeout
 * keyed off the current session JWT's expiration, paused on background and
 * started on foreground.
 */
const useSessionAutoRefresh = ({ sdk, session, setSession, projectId, logger, disabled }: Args): void => {
  useEffect(() => {
    if (disabled || !sdk || !session) return undefined
    if (isTokenExpired(session.refreshJwt)) {
      logger?.log('refresh JWT is expired, not scheduling auto-refresh')
      return undefined
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const stop = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const start = () => {
      const delay = computeRefreshDelay(session.sessionJwt)
      if (delay === null) {
        logger?.log('could not determine session expiration, not scheduling auto-refresh')
        return
      }
      stop()
      if (delay === 0) {
        refresh()
      } else {
        logger?.debug(`scheduling auto-refresh in ${delay}ms`)
        timer = setTimeout(refresh, delay)
      }
    }

    const refresh = async () => {
      timer = null
      try {
        logger?.log('refreshing session JWT')
        const resp = await sdk.refresh(session.refreshJwt)
        if (cancelled) return
        if (resp.ok && resp.data) {
          const updated: DescopeSession = {
            ...session,
            sessionJwt: resp.data.sessionJwt,
            refreshJwt: resp.data.refreshJwt || session.refreshJwt,
          }
          await DescopeReactNative.saveItem(projectId, JSON.stringify(updated))
          if (cancelled) return
          setCurrentTokens(updated.sessionJwt, updated.refreshJwt)
          setSession(updated)
          logger?.log('auto-refresh succeeded')
        } else {
          logger?.error('refresh rejected by server: ' + (resp.error?.errorCode ?? 'unknown'))
        }
      } catch (e) {
        if (cancelled) return
        logger?.log(`auto-refresh failed, retrying in ${TRANSIENT_BACKOFF_MS}ms: ${e instanceof Error ? e.message : String(e)}`)
        timer = setTimeout(refresh, TRANSIENT_BACKOFF_MS)
      }
    }

    if (AppState.currentState === 'active') start()

    const sub: NativeEventSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background') {
        if (timer !== null) {
          logger?.debug('pausing auto-refresh, app moved to background')
          stop()
        }
      } else if (state === 'active' && timer === null) {
        start()
      }
      // 'inactive' (iOS) is transient, leave the timer alone
    })

    return () => {
      cancelled = true
      sub.remove()
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSession/projectId/logger are stable
  }, [sdk, session, disabled])
}

export default useSessionAutoRefresh
