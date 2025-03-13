
final class Password: DescopePassword {
    let client: DescopeClient
    
    init(client: DescopeClient) {
        self.client = client
    }
    
    func signUp(loginId: String, password: String, details: SignUpDetails?) async throws -> AuthenticationResponse {
        return try await client.passwordSignUp(loginId: loginId, password: password, details: details).convert()
    }
    
    func signIn(loginId: String, password: String) async throws -> AuthenticationResponse {
        return try await client.passwordSignIn(loginId: loginId, password: password).convert()
    }
    
    func update(loginId: String, newPassword: String, refreshJwt: String) async throws {
        try await client.passwordUpdate(loginId: loginId, newPassword: newPassword, refreshJwt: refreshJwt)
    }
    
    func replace(loginId: String, oldPassword: String, newPassword: String) async throws -> AuthenticationResponse {
        try await client.passwordReplace(loginId: loginId, oldPassword: oldPassword, newPassword: newPassword).convert()
    }
    
    func sendReset(loginId: String, redirectURL: String?) async throws {
        try await client.passwordSendReset(loginId: loginId, redirectURL: redirectURL)
    }
    
    func getPolicy() async throws -> PasswordPolicyResponse {
        return try await client.passwordGetPolicy().convert()
    }
}

private extension DescopeClient.PasswordPolicyResponse {
    func convert() throws -> PasswordPolicyResponse {
        return PasswordPolicyResponse(minLength: minLength, lowercase: lowercase, uppercase: uppercase, number: number, nonAlphanumeric: nonAlphanumeric)
    }
}
