import { decode } from 'base-64'

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
