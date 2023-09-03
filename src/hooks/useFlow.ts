import { transformResponse, type JWTResponse, type SdkResponse } from '@descope/core-js-sdk'
import { useCallback, useState } from 'react'
import { Platform } from 'react-native'
import type { Sdk } from '../internal/core/sdk'
import useContext from '../internal/hooks/useContext'
import DescopeReactNative from '../internal/modules/descopeModule'
import type { DescopeFlow } from '../types'
import useDescope from './useDescope'

const useFlow = (): DescopeFlow => {
  const { logger } = useContext()
  const sdk = useDescope()

  const [currentFlowUrl, setCurrentFlowUrl] = useState<string>()
  const [currentCodeVerifier, setCurrentCodeVerifier] = useState<string>()
  const [pendingFlowResolution, setPendingFlowResolution] = useState<{
    resolve: (value: SdkResponse<JWTResponse> | PromiseLike<SdkResponse<JWTResponse>>) => void
    reject: (reason?: any) => void
  }>()

  const start = useCallback(
    async (flowUrl: string, deepLinkUrl?: string) => {
      logger?.log('starting flow')
      setCurrentFlowUrl(flowUrl)
      const resp = await DescopeReactNative.startFlow(flowUrl, deepLinkUrl || '')
      if (Platform.OS === 'ios') {
        return exchangeForJwtResponse(sdk, resp.codeVerifier, resp.callbackUrl)
      }

      // On Android we need to exchange after the redirect has completed
      // pendingCodeVerifier = resp.codeVerifier
      setCurrentCodeVerifier(resp.codeVerifier)
      const promise = new Promise<SdkResponse<JWTResponse>>((resolve, reject) => {
        setPendingFlowResolution({ resolve, reject })
      })
      return promise
    },
    [setCurrentFlowUrl, setCurrentCodeVerifier, setPendingFlowResolution],
  )

  const resume = useCallback(
    async (incomingUrl: string) => {
      logger?.log('resuming flow')
      if (!currentFlowUrl) return pendingFlowResolution?.reject('no ongoing flow waiting to resume')
      await DescopeReactNative.resumeFlow(currentFlowUrl, incomingUrl)
    },
    [currentFlowUrl],
  )

  const exchange = useCallback(
    async (incomingUrl: string) => {
      if (!currentCodeVerifier) return pendingFlowResolution?.reject('no ongoing flow waiting to exchange')

      try {
        logger?.log('exchanging flow code for JWTs')
        const resp = await exchangeForJwtResponse(sdk, currentCodeVerifier, incomingUrl)
        pendingFlowResolution?.resolve(resp)
      } catch (e) {
        logger?.error('flow exchange failed', e)
        pendingFlowResolution?.reject(e)
      }

      // clear state
      setCurrentFlowUrl(undefined)
      setCurrentCodeVerifier(undefined)
      setPendingFlowResolution(undefined)
    },
    [currentCodeVerifier, pendingFlowResolution],
  )

  return { start, resume, exchange }
}

const exchangeForJwtResponse = async (sdk: Sdk, codeVerifier: string, callbackUrl: string): Promise<SdkResponse<JWTResponse>> => {
  const code = codeFromUrl(callbackUrl)
  if (code === '') throw new Error('Missing code parameter from callback URL')
  return transformResponse(sdk.httpClient.post('/v1/flow/exchange', { authorizationCode: code, codeVerifier }))
}

const codeFromUrl = (urlString: string) => {
  const codeParam = 'code='
  if (!urlString.includes(codeParam)) return ''
  const codeStart = urlString.indexOf(codeParam) + codeParam.length
  var codeEnd = urlString.indexOf('&', codeStart)
  codeEnd = codeEnd === -1 ? urlString.length : codeEnd
  return urlString.substring(codeStart, codeEnd)
}

export default useFlow
