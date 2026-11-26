import CryptoKit
import ExpoModulesCore
import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// A failure reading or flagging a file, surfaced to JS as a rejected promise.
private struct OnDeviceAiFileError: Error, LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

public class OnDeviceAiModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OnDeviceAi")

    Function("appleAvailability") { () -> String in
      return OnDeviceAiModule.availabilityName()
    }

    Function("appleSupportsLocale") { (languageTag: String) -> Bool in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return SystemLanguageModel.default.supportsLocale(Locale(identifier: languageTag))
      }
      #endif
      return false
    }

    Function("storageDirectory") { () -> String in
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let directory = documents.appendingPathComponent("local-ai", isDirectory: true)
      var value = directory.absoluteString
      if value.hasSuffix("/") {
        value.removeLast()
      }
      return value
    }

    // Off the shared module queue: hashing hundreds of MB must not hold up other native calls.
    AsyncFunction("sha256File") { (path: String) throws -> String in
      let url = OnDeviceAiModule.fileURL(path)
      let handle: FileHandle
      do {
        handle = try FileHandle(forReadingFrom: url)
      } catch {
        throw OnDeviceAiFileError(message: "Cannot open \(url.lastPathComponent): \(error.localizedDescription)")
      }
      defer { try? handle.close() }

      var hasher = SHA256()
      while true {
        let chunk: Data? = try autoreleasepool { try handle.read(upToCount: 1 << 20) }
        guard let data = chunk, !data.isEmpty else {
          break
        }
        hasher.update(data: data)
      }
      return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }.runOnQueue(DispatchQueue.global(qos: .utility))

    AsyncFunction("setExcludedFromBackup") { (path: String) throws -> Bool in
      var url = OnDeviceAiModule.fileURL(path)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
      return true
    }.runOnQueue(DispatchQueue.global(qos: .utility))
  }

  /// JS usually passes `file://` URIs (what expo-file-system uses), though plain paths also work.
  private static func fileURL(_ pathOrUri: String) -> URL {
    if pathOrUri.hasPrefix("file://") {
      if let url = URL(string: pathOrUri), url.isFileURL {
        return url
      }
      var stripped = String(pathOrUri.dropFirst("file://".count))
      if stripped.hasPrefix("localhost/") {
        stripped = String(stripped.dropFirst("localhost".count))
      }
      return URL(fileURLWithPath: stripped.removingPercentEncoding ?? stripped)
    }
    return URL(fileURLWithPath: pathOrUri)
  }

  private static func availabilityName() -> String {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      switch SystemLanguageModel.default.availability {
      case .available:
        return "available"
      case .unavailable(let reason):
        switch reason {
        case .deviceNotEligible:
          return "deviceNotEligible"
        case .appleIntelligenceNotEnabled:
          return "appleIntelligenceNotEnabled"
        case .modelNotReady:
          return "modelNotReady"
        @unknown default:
          return "unknown"
        }
      @unknown default:
        return "unknown"
      }
    }
    #endif
    return "unsupportedOs"
  }
}
