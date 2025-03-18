
import AuthenticationServices

extension DescopeSDK {
    static nonisolated(unsafe) let initial: DescopeSDK = DescopeSDK(projectId: "")
}

extension DescopeError {
    func with(desc: String) -> DescopeError {
        return DescopeError(code: code, desc: desc, message: message, cause: cause)
    }
    
    func with(message: String) -> DescopeError {
        return DescopeError(code: code, desc: desc, message: message, cause: cause)
    }
    
    func with(cause: Error) -> DescopeError {
        return DescopeError(code: code, desc: desc, message: message, cause: cause)
    }
}

extension DescopeLogger? {
    func callAsFunction(_ level: DescopeLogger.Level, _ message: StaticString, _ values: Any?...) {
        self?.log(level, message, values)
    }
}

extension Data {
    init?(base64URLEncoded base64URLString: String, options: Base64DecodingOptions = []) {
        var str = base64URLString.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        if str.count % 4 > 0 {
            str.append(String(repeating: "=", count: 4 - str.count % 4))
        }
        self.init(base64Encoded: str, options: options)
    }
    
    func base64URLEncodedString(options: Base64EncodingOptions = []) -> String {
        return base64EncodedString(options: options)
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

extension String {
    func javaScriptLiteralString() -> String {
        return "`" + replacingOccurrences(of: #"\"#, with: #"\\"#)
            .replacingOccurrences(of: #"$"#, with: #"\$"#)
            .replacingOccurrences(of: #"`"#, with: #"\`"#) + "`"
    }
}

class DefaultPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding, ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return presentationAnchor
    }
    
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return presentationAnchor
    }

    private var presentationAnchor: ASPresentationAnchor {
        #if os(iOS)
        return findKeyWindow() ?? ASPresentationAnchor()
        #else
        return ASPresentationAnchor()
        #endif
    }

    #if os(iOS) && canImport(React)
    func waitKeyWindow() async {
        for _ in 1...10 {
            guard findKeyWindow() == nil else { return }
            try? await Task.sleep(nanoseconds: 100 * NSEC_PER_MSEC)
        }
    }
    #endif

    #if os(iOS)
    private func findKeyWindow() -> UIWindow? {
        let scene = UIApplication.shared.connectedScenes
            .filter { $0.activationState == .foregroundActive }
            .compactMap { $0 as? UIWindowScene }
            .first

        let window = scene?.windows
            .first { $0.isKeyWindow }

        return window
    }
    #endif
}

class AuthorizationDelegate: NSObject, ASAuthorizationControllerDelegate {
    typealias Completion = (Result<ASAuthorization, Error>) -> Void

    var completion: Completion?

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        completion?(.success(authorization))
        completion = nil
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        completion?(.failure(error))
        completion = nil
    }
}

#if os(iOS) && canImport(React)
extension AuthenticationResponse: Codable {
    enum CodingKeys: String, CodingKey {
        case sessionToken = "sessionJwt"
        case refreshToken = "refreshJwt"
        case user
        case isFirstAuthentication
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        sessionToken = try Token(jwt: values.decode(String.self, forKey: .sessionToken))
        refreshToken = try Token(jwt: values.decode(String.self, forKey: .refreshToken))
        user = try values.decode(DescopeUser.self, forKey: .user)
        isFirstAuthentication = try values.decode(Bool.self, forKey: .isFirstAuthentication)
    }

    public func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(sessionToken.jwt, forKey: .sessionToken)
        try values.encode(refreshToken.jwt, forKey: .refreshToken)
        try values.encode(user, forKey: .user)
        try values.encode(isFirstAuthentication, forKey: .isFirstAuthentication)
    }
}
#endif
