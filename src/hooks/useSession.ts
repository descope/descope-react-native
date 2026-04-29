import { useMemo, useRef } from 'react'
import type { JWTResponse, UserResponse } from '@descope/core-js-sdk'
import useContext from '../internal/hooks/useContext'
import DescopeReactNative from '../internal/modules/descopeModule'
import type { DescopeSession, DescopeSessionManager } from '../types'
import { millisecondsUntilExpiration, performRefresh, REFRESH_THRESHOLD_MS } from '../internal/session/autoRefresh'
import { persistSession } from '../internal/session/persist'
import { clearCurrentSession, setCurrentTokens, setCurrentUser } from '../helpers'

const useSession = (): DescopeSessionManager => {
  const { sdk, logger, projectId, session, setSession, isSessionLoading, inFlightRefresh } = useContext()
  if (!sdk) throw new Error('This hook requires the AuthProvider component to be initialized with a project ID')

  // when the sdk initializes, we want the return value of "isSessionLoading" to be true immediately
  // (and not only when receiving an update from the context)
  const isLoading = useRef(isSessionLoading)

  // we want this to happen before returning a value so we are using "useMemo" and not "useEffect"
  useMemo(() => {
    isLoading.current = isSessionLoading
  }, [isSessionLoading])

  const manageSession = async (jwtResponse?: JWTResponse) => {
    if (!jwtResponse) throw new Error(`Cannot manage an undefined JWTResponse`)
    if (!jwtResponse.refreshJwt) throw new Error('Cannot manage a session without a refresh JWT')
    if (!jwtResponse.user) throw new Error(`Cannot manage JWTResponse without user`)

    logger?.log('managing new session')
    const updatedSession: DescopeSession = {
      sessionJwt: jwtResponse.sessionJwt,
      refreshJwt: jwtResponse.refreshJwt,
      user: jwtResponse.user,
    }
    await persistSession(projectId, updatedSession)
    setSession(updatedSession)
  }

  const updateTokens = async (sessionJwt: string, refreshJwt: string) => {
    if (session) {
      logger?.log('updating current session with new tokens')
      const updatedSession = { ...session, sessionJwt, refreshJwt: refreshJwt || session.refreshJwt }
      await DescopeReactNative.saveItem(projectId, JSON.stringify(updatedSession))
      setCurrentTokens(updatedSession.sessionJwt, updatedSession.refreshJwt)
      setSession(updatedSession)
    } else {
      logger?.warn(`update tokens called but there's no current session - make sure to call this function within the component lifecycle`)
    }
  }

  const clearSession = async () => {
    logger?.log('clearing current session')
    await DescopeReactNative.removeItem(projectId)
    clearCurrentSession()
    setSession(undefined)
  }

  const updateUser = async (userResponse: UserResponse) => {
    if (session) {
      logger?.log('updating current session user')
      const updatedSession = { ...session, user: userResponse }
      await DescopeReactNative.saveItem(projectId, JSON.stringify(updatedSession))
      setCurrentUser(updatedSession.user)
      setSession(updatedSession)
    }
  }

  const refreshSessionIfAboutToExpire = async () => {
    if (!session) {
      logger?.log("can't refresh session - no active session")
      return session
    }
    if (!session.refreshJwt) {
      logger?.log("can't refresh session - no refresh JWT")
      return session
    }
    if (millisecondsUntilExpiration(session.sessionJwt) > REFRESH_THRESHOLD_MS) {
      logger?.log('session is valid')
      return session
    }
    if (inFlightRefresh.current) {
      logger?.log('a refresh is already in flight, returning current session')
      return session
    }
    inFlightRefresh.current = true
    try {
      const result = await performRefresh(sdk, session, () => true, logger)
      if (result.kind === 'fresh') {
        try {
          await persistSession(projectId, result.session)
        } catch (e) {
          logger?.error('failed to persist refreshed session', e as Error)
        }
        setSession(result.session)
        logger?.log('manual refresh succeeded')
        return result.session
      }
      return session
    } finally {
      inFlightRefresh.current = false
    }
  }

  return { session, manageSession, refreshSessionIfAboutToExpire, clearSession, updateTokens, updateUser, isSessionLoading: isLoading.current }
}

export default useSession
