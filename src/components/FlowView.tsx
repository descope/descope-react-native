import React, { useCallback } from 'react'
import { requireNativeComponent, type HostComponent, type ViewStyle } from 'react-native'
import type { FlowOptions } from '../types'
import type { JWTResponse } from '@descope/core-js-sdk'

// TODO: Document this
type DescopeFlowView = {
  onReady: (event: any) => unknown
  onSuccess: (event: any) => unknown
  onError: (event: any) => unknown
}

const DescopeFlowView = requireNativeComponent('DescopeFlowView') as HostComponent<DescopeFlowView>

export default function FlowView(props: { flowOptions: FlowOptions; deepLink?: string; style?: ViewStyle; onReady?: () => unknown; onSuccess?: (jwtResponse: JWTResponse) => {}; onError?: (error: string) => {} }) {
  const onReadyCb = useCallback(() => {
    props.onReady?.()
  }, [props.onReady])

  const onSuccessHook = useCallback(
    (event: any) => {
      const cookieSessionJwts = event.nativeEvent.cookieSessionJwts as string[]
      const cookieRefreshJwts = event.nativeEvent.cookieRefreshJwts as string[]
      const jwtResponse = JSON.parse(event.nativeEvent.response) as JWTResponse
      // TODO: might want to parse the jwts to enforce project ID and support more than one jwt in the future
      if (!jwtResponse.sessionJwt && cookieSessionJwts.length > 0) {
        jwtResponse.sessionJwt = cookieSessionJwts[0]!
      }
      if (!jwtResponse.refreshJwt && cookieRefreshJwts.length > 0) {
        jwtResponse.refreshJwt = cookieRefreshJwts[0]
      }
      props.onSuccess?.(jwtResponse)
    },
    [props.onSuccess],
  )

  const onErrorCb = useCallback(
    (event: any) => {
      props.onError?.(event.nativeEvent.error)
    },
    [props.onError],
  )
  return <DescopeFlowView {...props} onReady={onReadyCb} onSuccess={onSuccessHook} onError={onErrorCb} />
}
