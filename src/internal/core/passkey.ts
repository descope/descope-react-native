import type { DescopePasskey } from '../../types'
import DescopeReactNative from '../modules/descopeModule'
import type { CoreSdk } from './sdk'

export const createPasskey = (sdk: CoreSdk): DescopePasskey => ({
  isSupported: () => DescopeReactNative.passkeySupported(),

  signUp: async (loginId: string, name: string) => {
    const origin = await DescopeReactNative.passkeyOrigin()
    const start = await sdk.webauthn.signUp.start(loginId, origin, name)
    if (!start.ok || !start.data) return { ...start, data: undefined }
    const response = await DescopeReactNative.passkeyCreate(start.data.options)
    return sdk.webauthn.signUp.finish(start.data.transactionId, response)
  },

  signIn: async (loginId: string) => {
    const origin = await DescopeReactNative.passkeyOrigin()
    const start = await sdk.webauthn.signIn.start(loginId, origin)
    if (!start.ok || !start.data) return { ...start, data: undefined }
    const response = await DescopeReactNative.passkeyAuthenticate(start.data.options)
    return sdk.webauthn.signIn.finish(start.data.transactionId, response)
  },

  signUpOrIn: async (loginId: string) => {
    const origin = await DescopeReactNative.passkeyOrigin()
    const start = await sdk.webauthn.signUpOrIn.start(loginId, origin)
    if (!start.ok || !start.data) return { ...start, data: undefined }
    const { transactionId, options, create } = start.data
    // there is no signUpOrIn finish endpoint, the create flag decides which one applies
    if (create) {
      return sdk.webauthn.signUp.finish(transactionId, await DescopeReactNative.passkeyCreate(options))
    }
    return sdk.webauthn.signIn.finish(transactionId, await DescopeReactNative.passkeyAuthenticate(options))
  },

  add: async (loginId: string, refreshJwt: string) => {
    const origin = await DescopeReactNative.passkeyOrigin()
    const start = await sdk.webauthn.update.start(loginId, origin, refreshJwt)
    if (!start.ok || !start.data) return { ...start, data: undefined }
    const response = await DescopeReactNative.passkeyCreate(start.data.options)
    return sdk.webauthn.update.finish(start.data.transactionId, response)
  },
})
