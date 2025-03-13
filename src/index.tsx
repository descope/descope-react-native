export { default as AuthProvider } from './components/AuthProvider'
export { default as FlowView } from './components/FlowView'
export { default as useDescope } from './hooks/useDescope'
export { default as useSession } from './hooks/useSession'

// deprecated
export { default as useFlow } from './hooks/useFlow'

export { getCurrentSessionToken, getCurrentRefreshToken, getCurrentUser } from './helpers'

export type { DescopeSession, DescopeSessionManager, DescopeFlow, FlowOptions, AndroidFlowOptions, iOSFlowOptions, DescopeError } from './types'
