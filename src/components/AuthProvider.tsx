import React, { useEffect, useMemo, useState, type FC } from 'react'
import { createSdk } from '../internal/core/sdk'
import Context from '../internal/hooks/Context'
import DescopeReactNative from '../internal/modules/descopeModule'
import type { DescopeConfig, DescopeSession } from '../types'

const AuthProvider: FC<{ config: DescopeConfig; children?: JSX.Element }> = ({ config, children }) => {
  const [session, setSession] = useState<DescopeSession>()

  const sdk = useMemo(() => {
    return createSdk(config)
  }, [config])

  // clear session if the sdk changes
  useEffect(() => {
    return () => {
      setSession(undefined)
    }
  }, [config.projectId])

  // load session on first load
  useEffect(() => {
    config.logger?.log('searching for persisted session')
    DescopeReactNative.loadItem(config.projectId)
      .then((loaded) => {
        if (loaded?.length) {
          config.logger?.log('persisted session found')
          const parsed = JSON.parse(loaded) as DescopeSession
          setSession(parsed)
        } else {
          config.logger?.log('no persisted session found')
          setSession(undefined)
        }
      })
      .catch((e) => {
        config.logger?.error('failed to search for persisted session', e)
      })
  }, [config.projectId])

  const context = useMemo(
    () => ({
      sdk: sdk,
      logger: config.logger,
      projectId: config.projectId,
      session,
      setSession,
    }),
    [sdk, config.logger, config.projectId, session, setSession],
  )

  return <Context.Provider value={context}>{children}</Context.Provider>
}

export default AuthProvider
