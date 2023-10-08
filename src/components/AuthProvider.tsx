import React, { useEffect, useMemo, useState, type FC } from 'react'
import { createSdk, type SdkConfig } from '../internal/core/sdk'
import Context from '../internal/hooks/Context'
import DescopeReactNative from '../internal/modules/descopeModule'
import type { DescopeSession } from '../types'

type Props = Pick<SdkConfig[0], 'projectId' | 'baseUrl' | 'logger' | 'fetch'> & { children?: JSX.Element }
const AuthProvider: FC<Props> = ({ projectId, baseUrl, logger, fetch, children }) => {
  const [session, setSession] = useState<DescopeSession>()

  const sdk = useMemo(() => {
    return createSdk({ projectId, baseUrl, logger, fetch })
  }, [projectId, baseUrl, logger, fetch])

  // clear session if the sdk changes
  useEffect(() => {
    return () => {
      setSession(undefined)
    }
  }, [projectId])

  // load session on first load
  useEffect(() => {
    logger?.log('searching for persisted session')
    DescopeReactNative.loadItem(projectId)
      .then((loaded) => {
        if (loaded?.length) {
          logger?.log('persisted session found')
          const parsed = JSON.parse(loaded) as DescopeSession
          setSession(parsed)
        } else {
          logger?.log('no persisted session found')
          setSession(undefined)
        }
      })
      .catch((e) => {
        logger?.error('failed to search for persisted session', e)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const context = useMemo(
    () => ({
      sdk: sdk,
      logger: logger,
      projectId: projectId,
      session,
      setSession,
    }),
    [sdk, logger, projectId, session, setSession],
  )

  return <Context.Provider value={context}>{children}</Context.Provider>
}

export default AuthProvider
