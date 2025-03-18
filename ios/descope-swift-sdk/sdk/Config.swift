
import Foundation

/// The configuration of the Descope SDK.
public struct DescopeConfig {
    /// The id of the Descope project.
    public var projectId: String = ""
    
    /// An optional override for the base URL of the Descope server.
    public var baseURL: String?

    /// An optional object to handle logging in the Descope SDK.
    ///
    /// The default value of this property is `nil` and thus logging will be completely
    /// disabled. During development if you encounter any issues you can create an
    /// instance of the ``DescopeLogger`` class to enable logging.
    ///
    ///     Descope.setup(projectId: "...") { config in
    ///         config.logger = DescopeLogger()
    ///     }
    ///
    /// If your application uses some logging framework or third party service you can forward
    /// the Descope SDK log messages to it by creating a new subclass of ``DescopeLogger`` and
    /// overriding the `output` method.
    public var logger: DescopeLogger?

    /// An optional object to override how HTTP requests are performed.
    ///
    /// The default value of this property is always `nil`, and the SDK uses its own
    /// internal `URLSession` object to perform HTTP requests.
    ///
    /// This property can be useful to test code that uses the Descope SDK without any
    /// network requests actually taking place. In most other cases there shouldn't be
    /// any need to use it.
    public var networkClient: DescopeNetworkClient?
}

/// The ``DescopeLogger`` class can be used to customize logging functionality in the Descope SDK.
///
/// The default behavior is for log messages to be written to the standard output using
/// the `print()` function.
///
/// You can also customize how logging functions in the Descope SDK by creating a subclass
/// of ``DescopeLogger`` and overriding the ``output(level:message:debug:)`` method. See the
/// documentation for that method for more details.
///
/// - Important: Runtime values such as request bodies or responses are only included
///     in log messages when the SDK is compiled in debug mode. Even with a custom subclass
///     of ``DescopeLogger``, when the SDK is compiled for release the log messages will only
///     contain constant strings.
open class DescopeLogger {
    /// The severity of a log message.
    public enum Level: Int {
        case error, info, debug
    }
    
    /// The maximum log level that should be printed.
    public let level: Level
    
    /// Creates a new ``DescopeLogger`` object.
    public init(level: Level = .debug) {
        self.level = level
    }

    /// Formats the log message and prints it.
    ///
    /// Override this method to customize how to handle log messages from the Descope SDK.
    ///
    /// - Parameters:
    ///   - level: The log level of the message.
    ///   - message: This parameter is guaranteed to be a constant compile-time string, so
    ///     you can assume it doesn't contain private user data or secrets and that it can
    ///     be sent to whatever logging target or service you use.
    ///   - debug: This array has runtime values that might be useful when debugging
    ///     issues with the Descope SDK. Since it might contain sensitive information
    ///     its contents are only provided in `debug` builds. In `release` builds it
    ///     is always an empty array.
    open func output(level: Level, message: StaticString, debug: [Any]) {
        var text = "[\(DescopeSDK.name)] \(message)"
        if !debug.isEmpty {
            text += " (" + debug.map { String(describing: $0) }.joined(separator: ", ") + ")"
        }
        print(text)
    }
    
    /// Called by other code in the Descope SDK to output log messages.
    public func log(_ level: Level, _ message: StaticString, _ values: Any?...) {
        guard level.rawValue <= self.level.rawValue else { return }
        #if DEBUG
        output(level: level, message: message, debug: values.compactMap { $0 })
        #else
        output(level: level, message: message, debug: [])
        #endif
    }
}

/// The ``DescopeNetworkClient`` protocol can be used to override how HTTP requests
/// are performed by the SDK when calling the Descope server.
///
/// Your code should implement the ``call(request:)`` method and either return the
/// appropriate HTTP response values or throw an error.
///
/// For example, when testing code that uses the Descope SDK we might want to make
/// sure no network requests are actually made. A simple `DescopeNetworkClient`
/// implementation that always throws an error might look like this:
///
///     class FailingNetworkClient: DescopeNetworkClient {
///         var error: DescopeError = .networkError
///
///         func call(request: URLRequest) async throws -> (Data, URLResponse) {
///             throw error
///         }
///     }
///
/// The method signature is intentionally identical to the `data(for:)` method
/// in `URLSession`, so if for example all we want is for network requests made by
/// the Descope SDK to use the same `URLSession` instance we use elsewhere we can
/// use code such as this:
///
///     let descopeSDK = DescopeSDK(projectId: "...") { config in
///         config.networkClient = AppNetworkClient(session: appSession)
///     }
///
///     // ... elsewhere
///
///     class AppNetworkClient: DescopeNetworkClient {
///         let session: URLSession
///
///         init(_ session: URLSession) {
///             self.session = session
///         }
///
///         func call(request: URLRequest) async throws -> (Data, URLResponse) {
///             return try await session.data(for: request)
///         }
///     }
public protocol DescopeNetworkClient: Sendable {
    /// Loads data using a `URLRequest` and returns the `data` and `response`.
    ///
    /// - Note: The code that calls this function expects the response object to be an
    ///     instance of the `HTTPURLResponse` class and will throw an error if it's not.
    ///     This isn't reflected in the function signature to keep this simple to use
    ///     and aligned with the types in the `data(for:)` method in `URLSession`.
    func call(request: URLRequest) async throws -> (Data, URLResponse)
}
