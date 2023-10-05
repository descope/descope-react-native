import createCoreSdk from '@descope/core-js-sdk'
import { version } from '../../../package.json'

export type Sdk = ReturnType<typeof createSdk>
export type SdkLogger = Parameters<typeof createCoreSdk>[0]['logger']
export type SdkFetch = Parameters<typeof createCoreSdk>[0]['fetch']

export const createSdk = (projectId: string, baseUrl?: string, logger?: SdkLogger, fetch?: SdkFetch) => createCoreSdk({ projectId, baseUrl, logger, fetch, baseHeaders })

const baseHeaders = {
  'x-descope-sdk-name': 'reactnative',
  'x-descope-sdk-version': version,
}
