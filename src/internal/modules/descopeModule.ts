import { NativeModules } from 'react-native'

type StartFlowResponse = {
  codeVerifier: string
  callbackUrl: string
}

const { DescopeReactNative } = NativeModules
interface DescopeNative {
  startFlow(flowUrl: string, deepLinkUrl: string): Promise<StartFlowResponse>
  resumeFlow(flowUrl: string, incomingUrl: string): Promise<void>
  loadItem(key: string): Promise<string>
  saveItem(key: string, value: string): Promise<string>
  removeItem(key: string): Promise<string>
}
export default DescopeReactNative as DescopeNative
