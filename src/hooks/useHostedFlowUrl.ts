import useDescopeContext from '../internal/hooks/useContext'

/**
 * Creates a URL for a flow hosted on Descope's Flow hosting service.
 *
 * Note: This hook is only applicable when using Descope's Flow hosting service.
 * If you host your own flows, construct the URL manually and pass it to FlowView instead.
 *
 * @param flowId The flow ID.
 * @returns The URL for the hosted flow.
 */
export default function useHostedFlowUrl(flowId: string): string {
  const { sdk, projectId } = useDescopeContext()
  if (!sdk) {
    throw new Error('useHostedFlowUrl must be used within a DescopeProvider')
  }
  return sdk.httpClient.buildUrl(`login/${projectId}`, { platform: 'mobile', wide: 'true', flow: flowId })
}
