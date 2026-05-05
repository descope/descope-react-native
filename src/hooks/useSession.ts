import { useMemo, useRef } from 'react'
import type { JWTResponse, UserResponse } from '@descope/core-js-sdk'
import useContext from '../internal/hooks/useContext'
import DescopeReactNative from '../internal/modules/descopeModule'
import type { DescopeSession, DescopeSessionManager } from '../types'
import { tokenExpirationWithinThreshold } from '../internal/core/token'
import { clearCurrentSession, setCurrentTokens, setCurrentUser } from '../helpers'

// The amount of time (ms) to trigger the refresh before session expires
const REFRESH_THRESHOLD = 60 * 1000 // 1 minute

const useSession = (): DescopeSessionManager => {
  const { sdk, logger, projectId, session, setSession, isSessionLoading } = useContext()
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
    await DescopeReactNative.saveItem(projectId, JSON.stringify(updatedSession))
    setCurrentTokens(updatedSession.sessionJwt, updatedSession.refreshJwt)
    setCurrentUser(updatedSession.user)
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
    if (!session || session.refreshJwt === '') {
      logger?.warn("can't refresh session without a valid refresh token")
      return session
    }
    if (tokenExpirationWithinThreshold(session.sessionJwt, REFRESH_THRESHOLD)) {
      logger?.log('session is valid')
      return session
    }
    logger?.log('session JWT about to expire, refreshing...')
    const resp = await sdk.refresh(session.refreshJwt)
    if (resp.data) {
      const { sessionJwt, refreshJwt } = resp.data
      const updatedSession = {
        sessionJwt,
        refreshJwt: refreshJwt || session.refreshJwt,
        user: session.user,
      }
      await DescopeReactNative.saveItem(projectId, JSON.stringify(updatedSession))
      setCurrentTokens(updatedSession.sessionJwt, updatedSession.refreshJwt)
      setSession(updatedSession)
      return updatedSession
    }
    return session
  }

  return { session, manageSession, refreshSessionIfAboutToExpire, clearSession, updateTokens, updateUser, isSessionLoading: isLoading.current }
}

export default useSession
