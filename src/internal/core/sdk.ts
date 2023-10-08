import createCoreSdk from '@descope/core-js-sdk'
import { version } from '../../../package.json'

export type Sdk = ReturnType<typeof createSdk>
export type SdkLogger = Parameters<typeof createCoreSdk>[0]['logger']
export type SdkConfig = Parameters<typeof createCoreSdk>

export const createSdk = (...config: SdkConfig) => {
  config?.[0] && (config[0].baseHeaders = baseHeaders)
  return createCoreSdk(...config)
}

const baseHeaders = {
  'x-descope-sdk-name': 'reactnative',
  'x-descope-sdk-version': version,
}
