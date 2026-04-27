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
    
    private var hostSession: DescopeSession?

    func setup() {
        delegate = self
    }
    
    // RN Interface
    
    @objc func setDeepLink(_ deepLink: NSString) {
        let url = URL(string: deepLink as String) ?? URL(string: "invalid://")!
        Descope.handleURL(url)
    }
    

    @objc func setSession(_ session: NSDictionary?) {
        guard let session, let sessionJwt = session["sessionJwt"] as? String, let refreshJwt = session["refreshJwt"] as? String, !sessionJwt.isEmpty, !refreshJwt.isEmpty else {
            hostSession = nil
            return
        }
        // User object is owned by RN layer, and is not used by the native flow.
        // To avoid unnecessary complexity of mapping the user object to the native layer, a placeholder user is used instead.
        hostSession = try? DescopeSession(sessionJwt: sessionJwt, refreshJwt: refreshJwt, user: .placeholder)
    }

    @objc func setFlowOptions(_ options: NSDictionary) {
        guard let url = options["url"] as? String else { return }
        guard let sdkVersion = options["sdkVersion"] as? String else { return }
        let descopeFlow = DescopeFlow(url: url)
        if let oauthNativeProvder = options["iosOAuthNativeProvider"] as? String {
            descopeFlow.oauthNativeProvider = OAuthProvider(stringLiteral: oauthNativeProvder)
        }
        if let magicLinkRedirect = options["magicLinkRedirect"] as? String {
            descopeFlow.magicLinkRedirect = magicLinkRedirect
        }
        descopeFlow.hooks = [
            .runJavaScript(on: .loaded, code: """
                window.descopeBridge.hostInfo.sdkName = 'reactnative'
                window.descopeBridge.hostInfo.sdkVersion = '\(sdkVersion)'
            """),
        ]
        descopeFlow.sessionProvider = { [weak self] in self?.hostSession }
        start(flow: descopeFlow)
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
        UIApplication.shared.open(url)
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
