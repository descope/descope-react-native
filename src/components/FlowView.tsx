import React, { useCallback } from 'react'
import { requireNativeComponent, type HostComponent, type ViewStyle } from 'react-native'
import type { FlowOptions } from '../types'
import type { JWTResponse } from '@descope/core-js-sdk'

// TODO: Document this
type DescopeFlowView = {
  onFlowReady: (event: any) => unknown
  onFlowSuccess: (event: any) => unknown
  onFlowError: (event: any) => unknown
}

const DescopeFlowView = requireNativeComponent('DescopeFlowView') as HostComponent<DescopeFlowView>

export default function FlowView(props: { flowOptions: FlowOptions; deepLink?: string; style?: ViewStyle; onReady?: () => unknown; onSuccess?: (jwtResponse: JWTResponse) => {}; onError?: (error: string) => {} }) {
  const onReadyCb = useCallback(() => {
    props.onReady?.()
  }, [props.onReady])

  const onSuccessHook = useCallback(
    (event: any) => {
      const rawResponse = JSON.parse(event.nativeEvent.response)
      const jwtResponse = rawResponse as JWTResponse
      jwtResponse.sessionJwt = jwtResponse.sessionJwt ?? rawResponse.sessionToken
      jwtResponse.refreshJwt = jwtResponse.refreshJwt ?? rawResponse.refreshToken
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
  return <DescopeFlowView {...props} onFlowReady={onReadyCb} onFlowSuccess={onSuccessHook} onFlowError={onErrorCb} />
}
