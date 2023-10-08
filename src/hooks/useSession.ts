import type { JWTResponse, UserResponse } from '@descope/core-js-sdk'
import useContext from '../internal/hooks/useContext'
import DescopeReactNative from '../internal/modules/descopeModule'
import type { DescopeSession, DescopeSessionManager } from '../types'
import { tokenExpirationWithinThreshold } from '../internal/core/token'

// The amount of time (ms) to trigger the refresh before session expires
const REFRESH_THRESHOLD = 60 * 1000 // 1 minute

const useSession = (): DescopeSessionManager => {
  const { sdk, logger, projectId, session, setSession } = useContext()
  if (!sdk) throw new Error('This hook requires the AuthProvider component to be initialized with a project ID')

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
    setSession(updatedSession)
  }

  const updateTokens = async (sessionJwt: string, refreshJwt: string) => {
    if (session) {
      logger?.log('updating current session with new tokens')
      const updateSession = { ...session, sessionJwt, refreshJwt }
      await DescopeReactNative.saveItem(projectId, JSON.stringify(updateSession))
      setSession(updateSession)
    }
  }

  const clearSession = async () => {
    logger?.log('clearing current session')
    await DescopeReactNative.removeItem(projectId)
    setSession(undefined)
  }

  const updateUser = async (userResponse: UserResponse) => {
    if (session) {
      logger?.log('updating current session user')
      const updatedSession = { ...session, user: userResponse }
      await DescopeReactNative.saveItem(projectId, JSON.stringify(updatedSession))
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
        refreshJwt: refreshJwt && refreshJwt !== '' ? refreshJwt : session.refreshJwt,
        user: session.user,
      }
      await DescopeReactNative.saveItem(projectId, JSON.stringify(updatedSession))
      setSession(updatedSession)
      return updatedSession
    }
    return session
  }

  return { session, manageSession, refreshSessionIfAboutToExpire, clearSession, updateTokens, updateUser }
}

export default useSession
