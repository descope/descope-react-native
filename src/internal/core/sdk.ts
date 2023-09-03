import createCoreSdk from '@descope/core-js-sdk'
import { version } from '../../../package.json'
import type { DescopeConfig } from '../../types'

export type Sdk = ReturnType<typeof createSdk>
export type SdkLogger = Parameters<typeof createCoreSdk>[0]['logger']
export type SdkFetch = Parameters<typeof createCoreSdk>[0]['fetch']

export const createSdk = (config: DescopeConfig) => createCoreSdk({ ...config, baseHeaders })

const baseHeaders = {
  'x-descope-sdk-name': 'reactnative',
  'x-descope-sdk-version': version,
}
