import React, { useEffect, useMemo, useRef, useState, type FC } from 'react'
import { createSdk, type SdkConfig, type SdkLogger } from '../internal/core/sdk'
import Context from '../internal/hooks/Context'
import DescopeReactNative from '../internal/modules/descopeModule'
import { setupNativeLogBridge } from '../internal/modules/nativeLogBridge'
import useSessionAutoRefresh from '../internal/session/useSessionAutoRefresh'
import type { DescopeSession } from '../types'
import { setCurrentTokens, setCurrentUser } from '../helpers'

type Props = Pick<SdkConfig[0], 'projectId' | 'baseUrl' | 'logger' | 'fetch'> & {
  /**
   * Disables the background auto-refresh of the active session. Defaults to
   * `false`. When `true`, refresh only happens via `refreshSessionIfAboutToExpire`.
   */
  disableAutoRefresh?: boolean
  children?: React.ReactNode
}
const AuthProvider: FC<Props> = ({ projectId, baseUrl, logger, fetch, disableAutoRefresh, children }) => {
  const [session, setSession] = useState<DescopeSession>()
  const [isSessionLoading, setSessionLoading] = useState<boolean>(true)

  // Stable wrappers around `logger` and `fetch` so prop identity changes (e.g.
  // inline literals on parent re-renders) don't invalidate the SDK memo or
  // churn the native log bridge. The wrappers always delegate to the latest
  // prop value via refs.
  const loggerRef = useRef(logger)
  const fetchRef = useRef(fetch)
  useEffect(() => {
    loggerRef.current = logger
  }, [logger])
  useEffect(() => {
    fetchRef.current = fetch
  }, [fetch])

  const stableLogger = useMemo<NonNullable<SdkLogger>>(
    () => ({
      log: (...args) => loggerRef.current?.log(...args),
      debug: (...args) => loggerRef.current?.debug(...args),
      warn: (...args) => loggerRef.current?.warn(...args),
      error: (...args) => loggerRef.current?.error(...args),
    }),
    [],
  )

  const stableFetch = useMemo<NonNullable<SdkConfig[0]['fetch']>>(() => (input, init) => (fetchRef.current ?? globalThis.fetch)(input, init), [])

  const sdk = useMemo(() => {
    return createSdk({ projectId, baseUrl, logger: stableLogger, fetch: stableFetch })
  }, [projectId, baseUrl, stableLogger, stableFetch])

  // set up native log bridge when logger is provided, keyed on whether one
  // exists at all so identity changes within "has a logger" don't churn it
  const hasLogger = !!logger
  useEffect(() => {
    if (!hasLogger) return
    return setupNativeLogBridge(stableLogger)
  }, [hasLogger, stableLogger])

  // clear session if the sdk changes
  useEffect(() => {
    return () => {
      setSession(undefined)
    }
  }, [projectId])

  // load session on first load
  useEffect(() => {
    stableLogger.log('searching for persisted session')
    DescopeReactNative.loadItem(projectId)
      .then((loaded) => {
        if (loaded?.length) {
          stableLogger.log('persisted session found')
          const parsed = JSON.parse(loaded) as DescopeSession
          setCurrentTokens(parsed.sessionJwt, parsed.refreshJwt)
          setCurrentUser(parsed.user)
          setSession(parsed)
        } else {
          stableLogger.log('no persisted session found')
          setSession(undefined)
        }
      })
      .catch((e) => {
        stableLogger.error('failed to search for persisted session', e)
      })
      .finally(() => {
        setSessionLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useSessionAutoRefresh({
    sdk,
    session,
    setSession,
    projectId,
    logger: stableLogger,
    disabled: disableAutoRefresh,
  })

  const context = useMemo(
    () => ({
      sdk: sdk,
      logger: stableLogger,
      projectId: projectId,
      session,
      setSession,
      isSessionLoading,
    }),
    [sdk, stableLogger, projectId, session, setSession, isSessionLoading],
  )

  return <Context.Provider value={context}>{children}</Context.Provider>
}

export default AuthProvider
