import UIKit
import CryptoKit
import AuthenticationServices

private let redirectScheme = "descopeauth"
private let redirectURL = "\(redirectScheme)://flow"

@objc(DescopeReactNative)
class DescopeReactNative: NSObject {
    
    private let keychainStore = KeychainStore()
    private let defaultContextProvider = DefaultContextProvider()
    private var sessions: [ASWebAuthenticationSession] = []
    private var codeVerifier: String?
    private var resolve: RCTPromiseResolveBlock?
    private var reject: RCTPromiseRejectBlock?
    
    // Flow
    
    @objc(startFlow:withDeepLinkURL:withResolver:withRejecter:)
    func startFlow(_ flowURL: String, deepLinkURL: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard !flowURL.isEmpty else { return reject("empty_url", "'flowURL' is required when calling startFlow", nil) }
        self.resolve = resolve
        self.reject = reject
        
        do {
            let (initialURL, codeVerifier) = try prepareInitialRequest(for: flowURL)
            self.codeVerifier = codeVerifier
            DispatchQueue.main.async {
                self.startFlow(initialURL)
            }
        } catch {
            reject("flow_setup", "Flow setup failed", error)
        }
    }
    
    @objc(resumeFlow:withIncomingURL:withResolver:withRejecter:)
    func resumeFlow(_ flowURL: String, incomingURL: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        guard let redirectURL = URL(string: incomingURL), let pendingComponents = URLComponents(url: redirectURL, resolvingAgainstBaseURL: false) else { return reject("flow_resume", "'incomingURL' is malformed", nil) }
        guard let url = URL(string: flowURL), var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return reject("flow_resume", "unable to construct resuming url", nil) }
        components.queryItems = components.queryItems ?? []
        for item in pendingComponents.queryItems ?? [] {
            components.queryItems?.append(item)
        }
        
        guard let resumeURL = components.url else { return reject("flow_resume", "unable to construct resuming url params", nil) }
        
        DispatchQueue.main.async {
            self.startFlow(resumeURL)
        }
        resolve(nil)
    }
    
    @MainActor
    private func startFlow(_ url: URL) {
        guard defaultContextProvider.findKeyWindow() != nil else {
            reject?("flow_failed", "unable to find key window", nil)
            return
        }
        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: redirectScheme) { [self] callbackURL, error in
            if let error {
                switch error {
                case ASWebAuthenticationSessionError.canceledLogin:
                    reject?("flow_canceled", "Authentication canceled by user", nil)
                    cleanUp()
                    return
                case ASWebAuthenticationSessionError.presentationContextInvalid,
                    ASWebAuthenticationSessionError.presentationContextNotProvided:
                    // not handled for now
                    fallthrough
                default:
                    reject?("flow_failed", "Flow failed unexpectedly", nil)
                    cleanUp()
                    return
                }
            }
            resolve?(["codeVerifier": codeVerifier, "callbackUrl": callbackURL?.absoluteString ?? ""])
            cleanUp()
        }
        session.prefersEphemeralWebBrowserSession = true
        session.presentationContextProvider = defaultContextProvider
        sessions += [session]
        session.start()
    }
    
    @MainActor
    private func cleanUp() {
        for session in sessions {
            session.cancel()
        }
        sessions = []
        codeVerifier = nil
        resolve = nil
        reject = nil
    }
    
    // Storage
    
    @objc(loadItem:withResolver:withRejecter:)
    private func loadItem(key: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        guard !key.isEmpty else { return reject("missing_key", "'key' is required for loadItem", nil) }
        guard let data = keychainStore.loadItem(key: key) else { return resolve("") }
        let value = String(bytes: data, encoding: .utf8)
        resolve(value)
    }
    
    @objc(saveItem:withValue:withResolver:withRejecter:)
    private func saveItem(key: String, value: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        guard !key.isEmpty else { return reject("missing_key", "'key' is required for saveItem", nil) }
        keychainStore.saveItem(key: key, data: Data(value.utf8))
        resolve(key)
    }
    
    @objc(removeItem:withResolver:withRejecter:)
    private func removeItem(key: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        guard !key.isEmpty else { return reject("missing_key", "'key' is required for removeItem", nil) }
        keychainStore.removeItem(key: key)
        resolve(key)
    }
}

// Internal

private extension Data {
    init?(randomBytesCount count: Int) {
        var bytes = [Int8](repeating: 0, count: count)
        guard SecRandomCopyBytes(kSecRandomDefault, count, &bytes) == errSecSuccess else { return nil }
        self = Data(bytes: bytes, count: count)
    }
    
    func base64URLEncodedString(options: Data.Base64EncodingOptions = []) -> String {
        return base64EncodedString(options: options)
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private func prepareInitialRequest(for flowURL: String) throws -> (url: URL, codeVerifier: String) {
    guard let randomBytes = Data(randomBytesCount: 32) else { throw DescopeError.flowFailed("Error generating random bytes") }
    let hashedBytes = Data(SHA256.hash(data: randomBytes))
    
    let codeVerifier = randomBytes.base64URLEncodedString()
    let codeChallenge = hashedBytes.base64URLEncodedString()
    
    guard let url = URL(string: flowURL) else { throw DescopeError.flowFailed("Invalid flow URL") }
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { throw DescopeError.flowFailed("Malformed flow URL") }
    components.queryItems = components.queryItems ?? []
    components.queryItems?.append(URLQueryItem(name: "ra-callback", value: redirectURL))
    components.queryItems?.append(URLQueryItem(name: "ra-challenge", value: codeChallenge))
    components.queryItems?.append(URLQueryItem(name: "ra-initiator", value: "ios"))
    
    guard let initialURL = components.url else { throw DescopeError.flowFailed("Failed to create flow URL") }
    
    return (initialURL, codeVerifier)
}

private class DefaultContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func findKeyWindow() -> UIWindow? {
        let scene = UIApplication.shared.connectedScenes
            .filter { $0.activationState == .foregroundActive }
            .compactMap { $0 as? UIWindowScene }
            .first
        
        let window = scene?.windows
            .first { $0.isKeyWindow }
        
        return window
    }
    
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return ASPresentationAnchor()
    }
}

enum DescopeError: Error {
    case flowFailed(String)
}

private class KeychainStore {
    public func loadItem(key: String) -> Data? {
        var query = queryForItem(key: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        
        var value: AnyObject?
        SecItemCopyMatching(query as CFDictionary, &value)
        return value as? Data
    }
    
    public func saveItem(key: String, data: Data) {
        let values: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]

        let query = queryForItem(key: key)
        let result = SecItemCopyMatching(query as CFDictionary, nil)
        if result == errSecSuccess {
            SecItemUpdate(query as CFDictionary, values as CFDictionary)
        } else if result == errSecItemNotFound {
            let merged = query.merging(values, uniquingKeysWith: { $1 })
            SecItemAdd(merged as CFDictionary, nil)
        }
    }
    
    public func removeItem(key: String) {
        let query = queryForItem(key: key)
        SecItemDelete(query as CFDictionary)
    }
    
    private func queryForItem(key: String) -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.descope.ReactNative",
            kSecAttrLabel as String: "DescopeSession",
            kSecAttrAccount as String: key,
        ]
    }
}
