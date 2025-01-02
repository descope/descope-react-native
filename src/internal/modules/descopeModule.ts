import { NativeModules } from 'react-native'

type PrepFlowResponse = {
  codeChallenge: string
  codeVerifier: string
}

const { DescopeReactNative } = NativeModules
interface DescopeNative {
  prepFlow(): Promise<PrepFlowResponse>
  startFlow(flowUrl: string, deepLinkUrl: string, backupCustomScheme: string, codeChallenge: string): Promise<string>
  resumeFlow(flowUrl: string, incomingUrl: string): Promise<void>
  loadItem(key: string): Promise<string>
  saveItem(key: string, value: string): Promise<string>
  removeItem(key: string): Promise<string>
}
export default DescopeReactNative as DescopeNative
