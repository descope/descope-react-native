import { useEffect, type RefObject } from 'react'
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native'
import type { DescopeSession } from '../../types'
import type { Sdk, SdkLogger } from '../core/sdk'
import { computeRefreshDelay, isTokenExpired, performRefresh, TRANSIENT_BACKOFF_MS, type RefreshAttempt } from './autoRefresh'
import { persistSession } from './persist'

type Args = {
  sdk?: Sdk
  session?: DescopeSession
  setSession: React.Dispatch<React.SetStateAction<DescopeSession | undefined>>
  projectId: string
  logger?: SdkLogger
  inFlightRefresh: RefObject<boolean>
  sessionRef: RefObject<DescopeSession | undefined>
  disabled?: boolean
}

/**
 * Background auto-refresh of the active session. Owns a single rolling setTimeout
 * keyed off the current session JWT's expiration, paused on background and
 * re-armed on foreground.
 */
const useSessionAutoRefresh = ({ sdk, session, setSession, projectId, logger, inFlightRefresh, sessionRef, disabled }: Args): void => {
  useEffect(() => {
    if (disabled || !sdk || !session) return undefined
    if (isTokenExpired(session.refreshJwt)) {
      logger?.log('refresh JWT is expired, not scheduling auto-refresh')
      return undefined
    }

    let timerId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const clearTimer = () => {
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
    }

    const handleResult = async (result: RefreshAttempt) => {
      switch (result.kind) {
        case 'fresh': {
          // re-check after performRefresh's await: a manageSession or clearSession
          // could have replaced the active session between performRefresh's internal
          // isStillCurrent check and us getting here
          if (cancelled || sessionRef.current !== session) {
            logger?.debug('discarding refresh result, active session changed mid-flight')
            return
          }
          try {
            await persistSession(projectId, result.session)
          } catch (e) {
            logger?.error('failed to persist refreshed session', e as Error)
          }
          if (cancelled || sessionRef.current !== session) {
            logger?.debug('discarding refresh result, active session changed during persist')
            return
          }
          logger?.log('auto-refresh succeeded')
          setSession(result.session)
          return
        }
        case 'transient':
          logger?.log(`auto-refresh hit a transient error, retrying in ${TRANSIENT_BACKOFF_MS}ms`)
          schedule(TRANSIENT_BACKOFF_MS)
          return
        case 'fatal':
          logger?.error('auto-refresh stopped, server rejected refresh')
          return
        case 'noop':
          logger?.debug('auto-refresh stopped, refresh JWT no longer usable')
          return
        case 'unchanged':
          return
      }
    }

    const runRefresh = async () => {
      // timer fired, reset so `timerId !== null` keeps meaning "a timer is pending"
      timerId = null
      if (cancelled) return
      if (AppState.currentState !== 'active') {
        logger?.debug(`auto-refresh tick skipped, app state is '${String(AppState.currentState)}'`)
        return
      }
      if (inFlightRefresh.current) {
        // a manual refresh holds the mutex; reschedule so we don't go silent if it fails
        logger?.debug(`auto-refresh tick skipped, a refresh is already in flight, retrying in ${TRANSIENT_BACKOFF_MS}ms`)
        schedule(TRANSIENT_BACKOFF_MS)
        return
      }
      const captured = sessionRef.current
      if (!captured || captured !== session) return
      inFlightRefresh.current = true
      try {
        const result = await performRefresh(sdk, captured, () => !cancelled && sessionRef.current === captured, logger)
        await handleResult(result)
      } finally {
        inFlightRefresh.current = false
      }
    }

    const schedule = (delay: number) => {
      clearTimer()
      const safeDelay = Math.max(0, delay)
      logger?.debug(`scheduling auto-refresh in ${safeDelay}ms`)
      timerId = setTimeout(runRefresh, safeDelay)
    }

    const armFromCurrentSession = () => {
      const current = sessionRef.current
      if (!current) return
      const delay = computeRefreshDelay(current.sessionJwt)
      if (delay === null) {
        logger?.log('could not determine session expiration, not scheduling auto-refresh')
        return
      }
      schedule(delay)
    }

    if (AppState.currentState === 'active') {
      armFromCurrentSession()
    } else {
      logger?.debug(`auto-refresh idle, app state is '${String(AppState.currentState)}'`)
    }

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'background') {
        if (timerId !== null) {
          logger?.debug('pausing auto-refresh, app moved to background')
          clearTimer()
        }
      } else if (state === 'active') {
        if (timerId === null) armFromCurrentSession()
      }
      // 'inactive' (iOS) is transient, leave the timer alone
    }

    const sub: NativeEventSubscription = AppState.addEventListener('change', onAppStateChange)

    return () => {
      cancelled = true
      sub.remove()
      clearTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSession/projectId/logger/inFlightRefresh are stable
  }, [sdk, session, disabled])
}

export default useSessionAutoRefresh
