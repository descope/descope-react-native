import type { DescopeSession } from '../../types'
import { setCurrentTokens, setCurrentUser } from '../../helpers'
import DescopeReactNative from '../modules/descopeModule'

/** Writes to secure storage and updates the global token/user holders. setSession is left to the caller. */
export const persistSession = async (projectId: string, session: DescopeSession): Promise<void> => {
  await DescopeReactNative.saveItem(projectId, JSON.stringify(session))
  setCurrentTokens(session.sessionJwt, session.refreshJwt)
  setCurrentUser(session.user)
}
