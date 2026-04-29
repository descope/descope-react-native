import { decode } from 'base-64'
import type { DescopeSession } from '../../types'
import type { Sdk, SdkLogger } from '../core/sdk'

export const REFRESH_THRESHOLD_MS = 60 * 1000
export const TRANSIENT_BACKOFF_MS = 30 * 1000

// setTimeout stores its delay as a 32-bit signed integer; larger values fire immediately
export const MAX_TIMEOUT_MS = 2_147_483_647

export const getTokenExpirationDate = (token: string): Date | undefined => {
  if (!token) return undefined
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return undefined
  try {
    const claims = JSON.parse(decode(parts[1])) as { exp?: number }
    if (typeof claims.exp === 'number') {
      return new Date(claims.exp * 1000)
    }
  } catch {}
  return undefined
}

export const millisecondsUntilExpiration = (token: string): number => {
  const expiration = getTokenExpirationDate(token)
  return expiration ? expiration.getTime() - Date.now() : 0
}

export const isTokenExpired = (token: string): boolean => {
  const expiration = getTokenExpirationDate(token)
  return expiration ? expiration.getTime() <= Date.now() : false
}

/**
 * Ms to wait before refreshing the given session JWT, capped at MAX_TIMEOUT_MS.
 * Returns 0 when the JWT is already within the refresh threshold, or null when
 * the JWT cannot be parsed.
 */
export const computeRefreshDelay = (sessionJwt: string): number | null => {
  const expiration = getTokenExpirationDate(sessionJwt)
  if (!expiration) return null
  const delay = expiration.getTime() - Date.now() - REFRESH_THRESHOLD_MS
  if (delay <= 0) return 0
  return Math.min(delay, MAX_TIMEOUT_MS)
}

export type RefreshAttempt = { kind: 'noop' } | { kind: 'fresh'; session: DescopeSession } | { kind: 'unchanged' } | { kind: 'transient' } | { kind: 'fatal' }

/**
 * Calls sdk.refresh and classifies the outcome. Persistence is left to the caller.
 * The returned `kind` is `noop` for inputs that aren't refreshable, `fresh` on
 * success, `unchanged` when the active session was replaced mid-flight (drop
 * the result), `transient` for likely-network throws (caller may retry), or
 * `fatal` when the server rejected the refresh JWT (caller should stop scheduling).
 */
export const performRefresh = async (sdk: Sdk, current: DescopeSession, isStillCurrent: () => boolean, logger?: SdkLogger): Promise<RefreshAttempt> => {
  if (!current.refreshJwt) {
    logger?.log('skipping refresh, no refresh JWT on session')
    return { kind: 'noop' }
  }
  if (isTokenExpired(current.refreshJwt)) {
    logger?.log('skipping refresh, refresh JWT is expired')
    return { kind: 'noop' }
  }
  logger?.log('refreshing session JWT')
  let resp
  try {
    resp = await sdk.refresh(current.refreshJwt)
  } catch (e) {
    logger?.log('refresh attempt failed transiently: ' + describeError(e))
    return { kind: 'transient' }
  }
  if (!isStillCurrent()) {
    logger?.log('discarding refresh result, active session changed mid-flight')
    return { kind: 'unchanged' }
  }
  if (resp.ok && resp.data) {
    logger?.debug('refresh response received')
    const sessionJwt = resp.data.sessionJwt
    const refreshJwt = resp.data.refreshJwt || current.refreshJwt
    return {
      kind: 'fresh',
      session: { ...current, sessionJwt, refreshJwt },
    }
  }
  logger?.error('refresh rejected by server: ' + (resp.error?.errorCode ?? 'unknown'))
  return { kind: 'fatal' }
}

const describeError = (e: unknown): string => {
  if (e instanceof Error) return e.message
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}
