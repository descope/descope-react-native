import UIKit

@objc(DescopeFlowViewManager)
class DescopeFlowViewManager: RCTViewManager {
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func view() -> UIView! {
        let view = DescopeFlowViewWrapper()
        view.setup()
        return view
    }
    
}

class DescopeFlowViewWrapper: DescopeFlowView, DescopeFlowViewDelegate {
    
    func setup() {
        delegate = self
    }
    
    // RN Interface
    
    @objc func setDeepLink(_ deepLink: NSString) {
        let url = URL(string: deepLink as String) ?? URL(string: "invalid://")!
        Descope.handleURL(url)
    }
    
    @objc func setFlowOptions(_ options: NSDictionary) {
        guard let url = options["url"] as? String else { return }
        let descopeFlow = DescopeFlow(url: url)
        if let oauthNativeProvder = options["iosOAuthNativeProvider"] as? String {
            descopeFlow.oauthNativeProvider = OAuthProvider(stringLiteral: oauthNativeProvder)
        }
        if let magicLinkRedirect = options["magicLinkRedirect"] as? String {
            descopeFlow.magicLinkRedirect = magicLinkRedirect
        }
        
        start(flow: DescopeFlow(url: url))
    }
    
    @objc var onFlowReady: RCTBubblingEventBlock?
    
    @objc var onFlowSuccess: RCTBubblingEventBlock?
    
    @objc var onFlowError: RCTBubblingEventBlock?
    
    // DescopeFlowViewDelegate
    
    func flowViewDidUpdateState(_ flowView: DescopeFlowView, to state: DescopeFlowState, from previous: DescopeFlowState) {
        // currently not implemented
    }
    
    func flowViewDidBecomeReady(_ flowView: DescopeFlowView) {
        onFlowReady?([:])
    }
    
    func flowViewDidInterceptNavigation(_ flowView: DescopeFlowView, url: URL, external: Bool) {
        // currently not implemented
    }
    
    func flowViewDidFail(_ flowView: DescopeFlowView, error: DescopeError) {
        var errorInfo: [String: Any] = [
            "errorCode": error.code,
            "errorDescription": error.desc,
        ]
        if let message = error.message {
            errorInfo["errorMessage"] = message
        }
        onFlowError?(errorInfo)
    }
    
    func flowViewDidFinish(_ flowView: DescopeFlowView, response: AuthenticationResponse) {
        guard let encodedObject = try? JSONEncoder().encode(response), let encoded = String(bytes: encodedObject, encoding: .utf8) else { return }
        onFlowSuccess?(["response": encoded])
    }
    
}
