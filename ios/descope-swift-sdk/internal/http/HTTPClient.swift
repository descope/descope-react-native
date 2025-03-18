
import Foundation

class HTTPClient {
    let baseURL: String
    let logger: DescopeLogger?
    let networkClient: DescopeNetworkClient
    
    init(baseURL: String, logger: DescopeLogger?, networkClient: DescopeNetworkClient?) {
        self.baseURL = baseURL
        self.logger = logger
        self.networkClient = networkClient ?? DefaultNetworkClient()
    }
    
    // Convenience response functions

    final func get<T: JSONResponse>(_ route: String, headers: [String: String] = [:], params: [String: String?] = [:]) async throws -> T {
        let (data, response) = try await get(route, headers: headers, params: params)
        return try decodeJSON(data: data, response: response)
    }
    
    final func post<T: JSONResponse>(_ route: String, headers: [String: String] = [:], params: [String: String?] = [:], body: [String: Any?] = [:]) async throws -> T {
        let (data, response) = try await post(route, headers: headers, params: params, body: body)
        return try decodeJSON(data: data, response: response)
    }
    
    // Convenience data functions
    
    @discardableResult
    final func get(_ route: String, headers: [String: String] = [:], params: [String: String?] = [:]) async throws -> (Data, HTTPURLResponse) {
        return try await call(route, method: "GET", headers: headers, params: params, body: nil)
    }
    
    @discardableResult
    final func post(_ route: String, headers: [String: String] = [:], params: [String: String?] = [:], body: [String: Any?] = [:]) async throws -> (Data, HTTPURLResponse) {
        return try await call(route, method: "POST", headers: headers, params: params, body: encodeJSON(body))
    }
    
    // Override points
    
    var basePath: String {
        return "/"
    }
    
    var defaultHeaders: [String: String] {
        return [:]
    }
    
    var defaultTimeout: TimeInterval {
        return 15
    }
    
    func errorForResponseData(_ data: Data) -> Error? {
        return nil
    }
    
    // Private
    
    private func call(_ route: String, method: String, headers: [String: String], params: [String: String?], body: Data?) async throws -> (Data, HTTPURLResponse) {
        let request = try makeRequest(route: route, method: method, headers: headers, params: params, body: body)
        logger(.info, "Starting network call", request.url)
        #if DEBUG
        if let body = request.httpBody, let requestBody = String(bytes: body, encoding: .utf8) {
            logger(.debug, "Sending request body", requestBody)
        }
        #endif
        
        let (data, response) = try await sendRequest(request)
        
        guard let response = response as? HTTPURLResponse else { throw DescopeError(httpError: .invalidResponse) }
        #if DEBUG
        if let responseBody = String(bytes: data, encoding: .utf8) {
            logger(.debug, "Received response body", responseBody)
        }
        #endif
        
        if let error = DescopeError(httpStatusCode: response.statusCode) {
            if let responseError = errorForResponseData(data) {
                logger(.info, "Network call failed with server error", request.url, responseError)
                throw responseError
            }
            logger(.info, "Network call failed with http error", request.url, error)
            throw error
        }
        
        logger(.info, "Network call finished", request.url)
        return (data, response)
    }
    
    private func makeRequest(route: String, method: String, headers: [String: String], params: [String: String?], body: Data?) throws -> URLRequest {
        let url = try makeURL(route: route, params: params)
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: defaultTimeout)
        request.httpMethod = method
        request.httpBody = body
        for (key, value) in mergeHeaders(headers, with: defaultHeaders, for: request) {
            request.setValue(value, forHTTPHeaderField: key)
        }
        return request
    }
    
    private func makeURL(route: String, params: [String: String?]) throws -> URL {
        guard var url = URL(string: baseURL) else { throw DescopeError(httpError: .invalidRoute) }
        url.appendPathComponent(basePath, isDirectory: false)
        url.appendPathComponent(route, isDirectory: false)
        guard var components = URLComponents(string: url.absoluteString) else { throw DescopeError(httpError: .invalidRoute) }
        if case let params = params.compacted(), !params.isEmpty {
            components.queryItems = params.map(URLQueryItem.init)
        }
        guard let url = components.url else { throw DescopeError(httpError: .invalidRoute) }
        return url
    }
    
    private func sendRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await networkClient.call(request: request)
        } catch {
            logger(.error, "Network call failed with network error", request.url, error)
            throw DescopeError.networkError.with(cause: error)
        }
    }
}

// JSON Response

protocol JSONResponse: Decodable {
    mutating func setValues(from data: Data, response: HTTPURLResponse) throws
}

extension JSONResponse {
    mutating func setValues(from data: Data, response: HTTPURLResponse) throws {
        // nothing by default
    }
}

private func decodeJSON<T: JSONResponse>(data: Data, response: HTTPURLResponse) throws -> T {
    do {
        var val = try JSONDecoder().decode(T.self, from: data)
        try val.setValues(from: data, response: response)
        return val
    } catch {
        throw DescopeError.decodeError.with(cause: error)
    }
}

// JSON Request

private func encodeJSON(_ body: [String: Any?]) throws -> Data {
    do {
        let compact = body.compacted()
        let data = try JSONSerialization.data(withJSONObject: compact, options: [])
        return data
    } catch {
        throw DescopeError.encodeError.with(cause: error)
    }
}

private extension Dictionary {
    func compacted<T>() -> Dictionary<Key, T> where Value == T? {
        return compactMapValues { value in
            if let dict = value as? Self {
                return dict.compacted() as? T
            }
            return value
        }
    }
}

// HTTP Headers

private let userAgent = makeUserAgent()

private func mergeHeaders(_ headers: [String: String], with defaults: [String: String], for request: URLRequest) -> [String: String] {
    var result = request.allHTTPHeaderFields ?? [:]
    result["User-Agent"] = userAgent
    if request.httpBody != nil {
        result["Content-Type"] = "application/json"
    }
    result.merge(defaults, uniquingKeysWith: { $1 })
    result.merge(headers, uniquingKeysWith: { $1 })
    return result
}

// Network

private final class DefaultNetworkClient: DescopeNetworkClient {
    private let session = makeURLSession()
    
    deinit {
        session.finishTasksAndInvalidate()
    }
    
    func call(request: URLRequest) async throws -> (Data, URLResponse) {
        return try await session.data(for: request)
    }
}

private func makeURLSession() -> URLSession {
    #if DEBUG
    return URLSession(configuration: URLSessionConfiguration.default, delegate: CerificateErrorIgnorer(), delegateQueue: nil)
    #else
    return URLSession(configuration: URLSessionConfiguration.default, delegate: nil, delegateQueue: nil)
    #endif
}

#if DEBUG
private final class CerificateErrorIgnorer: NSObject, URLSessionDelegate {
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        guard let trust = challenge.protectionSpace.serverTrust else { return (.performDefaultHandling, nil) }
        return (.useCredential, URLCredential(trust: trust))
    }
}
#endif
