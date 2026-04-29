import type { RefObject } from 'react'
import type { DescopeSession } from '../types'
import type { Sdk, SdkLogger } from './core/sdk'

export interface DescopeContext {
  sdk?: Sdk
  logger?: SdkLogger
  projectId: string
  session?: DescopeSession
  setSession: React.Dispatch<React.SetStateAction<DescopeSession | undefined>>
  isSessionLoading: boolean
  // shared mutex between manual and background refresh
  inFlightRefresh: RefObject<boolean>
  // tracks the latest committed session so async paths can detect mid-flight replacement
  sessionRef: RefObject<DescopeSession | undefined>
}
