import createCoreSdk, { type ExtendedResponse } from '@descope/core-js-sdk'
import { Platform } from 'react-native'
import { version } from '../../../package.json'

export type Sdk = ReturnType<typeof createSdk>
export type SdkLogger = Parameters<typeof createCoreSdk>[0]['logger']
export type SdkConfig = Parameters<typeof createCoreSdk>

export const createSdk = (...config: SdkConfig) => {
  if (config[0]) {
    // set base headers
    config[0].baseHeaders = baseHeaders
    // set parse cookie logic for iOS and Android
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      if (!config[0].hooks) config[0].hooks = {}
      config[0].hooks.transformResponse = parseCookies
    }
  }
  return createCoreSdk(...config)
}

const parseCookies = async (mutableResponse: ExtendedResponse) => {
  const resp = await mutableResponse.json()
  const sessionName = resp.sessionCookieName || 'DS'
  const refreshName = resp.cookieName || 'DSR'
  if (mutableResponse.cookies[sessionName]) {
    resp.sessionJwt = mutableResponse.cookies[sessionName]
  }
  if (mutableResponse.cookies[refreshName]) {
    resp.refreshJwt = mutableResponse.cookies[refreshName]
  }
  return mutableResponse
}

const baseHeaders = {
  'x-descope-sdk-name': 'reactnative',
  'x-descope-sdk-version': version,
}
