
import Foundation

/// This protocol can be used to customize how a ``DescopeSessionManager`` object
/// stores the active ``DescopeSession`` between application launches.
@MainActor
public protocol DescopeSessionStorage: AnyObject {
    /// Called by the session manager when a new session is set or an
    /// existing session is updated.
    func saveSession(_ session: DescopeSession)
    
    /// Called by the session manager when it's initialized to load any
    /// existing session.
    func loadSession() -> DescopeSession?
    
    /// Called by the session manager when the `clearSession` function
    /// is called.
    func removeSession()
}

/// The default implementation of the ``DescopeSessionStorage`` protocol.
///
/// The ``SessionStorage`` class ensures that the ``DescopeSession`` is kept in
/// a secure manner in the device's keychain.
///
/// When running on iOS the keychain guarantees that the tokens are encrypted at
/// rest with an encryption key that only becomes available to the operating system
/// after the device is unlocked at least once following a device restart.
///
/// For your convenience, you can subclass the `SessionStorage.Store` class and
/// override the `loadItem`, `saveItem` and `removeItem` functions, then pass an
/// instance of that class to the initializer to create a ``SessionStorage`` object
/// that uses a different backing store.
public class SessionStorage: DescopeSessionStorage {
    public let projectId: String
    public let store: Store
    
    private var lastSaved: EncodedSession?

    public init(projectId: String, store: Store = .keychain) {
        self.projectId = projectId
        self.store = store
    }
    
    public func saveSession(_ session: DescopeSession) {
        let encoded = EncodedSession(sessionJwt: session.sessionJwt, refreshJwt: session.refreshJwt, user: session.user)
        guard lastSaved != encoded else { return }
        guard let data = try? JSONEncoder().encode(encoded) else { return }
        try? store.saveItem(key: projectId, data: data)
        lastSaved = encoded
    }
    
    public func loadSession() -> DescopeSession? {
        guard let data = try? store.loadItem(key: projectId) else { return nil }
        guard let encoded = try? JSONDecoder().decode(EncodedSession.self, from: data) else { return nil }
        let session = try? DescopeSession(sessionJwt: encoded.sessionJwt, refreshJwt: encoded.refreshJwt, user: encoded.user)
        lastSaved = encoded
        return session
    }
    
    public func removeSession() {
        lastSaved = nil
        try? store.removeItem(key: projectId)
    }
    
    /// A helper class that takes care of the actual storage of session data.
    ///
    /// The default function implementations in this class do nothing or return `nil`.
    @MainActor
    open class Store {
        open func loadItem(key: String) throws -> Data? {
            return nil
        }
        
        open func saveItem(key: String, data: Data) throws {
        }
        
        open func removeItem(key: String) throws {
        }
    }
    
    /// A helper struct for serializing the ``DescopeSession`` data.
    private struct EncodedSession: Codable, Equatable {
        var sessionJwt: String
        var refreshJwt: String
        var user: DescopeUser
    }
}

extension SessionStorage.Store {
    /// A store that does nothing.
    public static let none = SessionStorage.Store()

    /// A store that saves the session data to the keychain.
    public static let keychain = SessionStorage.KeychainStore()
}

extension SessionStorage {
    public class KeychainStore: Store {
        #if os(iOS)
        private let accessibility: String

        public override init() {
            self.accessibility = kSecAttrAccessibleAfterFirstUnlock as String
        }

        public init(accessibility: String) {
            self.accessibility = accessibility
        }
        #endif

        public override func loadItem(key: String) -> Data? {
            var query = queryForItem(key: key)
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            
            var value: AnyObject?
            SecItemCopyMatching(query as CFDictionary, &value)
            return value as? Data
        }
        
        public override func saveItem(key: String, data: Data) {
            var values: [String: Any] = [
                kSecValueData as String: data,
            ]
            
            #if os(macOS)
            values[kSecAttrAccess as String] = SecAccessCreateWithOwnerAndACL(getuid(), 0, SecAccessOwnerType(kSecUseOnlyUID), nil, nil)
            #else
            values[kSecAttrAccessible as String] = accessibility
            #endif

            let query = queryForItem(key: key)
            let result = SecItemCopyMatching(query as CFDictionary, nil)
            if result == errSecSuccess {
                SecItemUpdate(query as CFDictionary, values as CFDictionary)
            } else if result == errSecItemNotFound {
                let merged = query.merging(values, uniquingKeysWith: { $1 })
                SecItemAdd(merged as CFDictionary, nil)
            }
        }
        
        public override func removeItem(key: String) {
            let query = queryForItem(key: key)
            SecItemDelete(query as CFDictionary)
        }
        
        private func queryForItem(key: String) -> [String: Any] {
            return [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: "com.descope.DescopeKit",
                kSecAttrLabel as String: "DescopeSession",
                kSecAttrAccount as String: key,
            ]
        }
    }
}
