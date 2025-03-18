
import Foundation

#if os(iOS)
private let osName = "iOS"
private let osSysctl = "hw.machine"
#else
private let osName = "macOS"
private let osSysctl = "hw.model"
#endif

/// Creates a user agent string with details about the system, operating system,
/// host application, and the SDK itself.
func makeUserAgent() -> String {
    var string = sdkProduct()
    if let sdkComment = sdkComment() {
        string += " "
        string += sdkComment
    }
    if let appProduct = appProduct() {
        string += " "
        string += appProduct
    }
    return string
}

/// Ensures user agent string doesn't have any unexpected characters
private func escape(_ str: String) -> String {
    return str.replacingOccurrences(of: "[^0-9a-zA-Z .,_-]", with: "_", options: .regularExpression)
}

/// Returns details about the SDK
private func sdkProduct() -> String {
    return "\(DescopeSDK.name)/\(DescopeSDK.version)"
}

/// Returns details about the host application that uses the SDK
private func appProduct() -> String? {
    guard let appName = Bundle.main.object(forInfoDictionaryKey: kCFBundleNameKey as String) as? String else { return nil }
    let appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
    let appBuild = Bundle.main.object(forInfoDictionaryKey: kCFBundleVersionKey as String) as? String ?? "0"
    return "\(appName)/\(appVersion).\(appBuild)"
}

/// Combines the system and operating system info into one comment fragment
private func sdkComment() -> String? {
    let info = [osInfo(), systemInfo()].compactMap { $0 }
    let merged = info.map(escape).joined(separator: "; ")
    guard !merged.isEmpty else { return nil }
    return "(" + merged + ")"
}

/// Returns the name and version of the operating system
private func osInfo() -> String? {
    let ver = ProcessInfo.processInfo.operatingSystemVersion
    return "\(osName) \(ver.majorVersion).\(ver.minorVersion).\(ver.patchVersion)"
}

/// Returns the system model, for example, "MacBookPro18,4" or "iPhone13,4"
private func systemInfo() -> String? {
    #if targetEnvironment(simulator)
    return "Simulator"
    #else
    // get the size of the value first
    var size = 0
    guard sysctlbyname(osSysctl, nil, &size, nil, 0) == 0, size > 0 else { return nil }
    
    // create an appropriately sized array and call again to retrieve the value
    var chars = [CChar](repeating: 0, count: size)
    guard sysctlbyname(osSysctl, &chars, &size, nil, 0) == 0 else { return nil }
    
    return String(utf8String: chars)
    #endif
}
