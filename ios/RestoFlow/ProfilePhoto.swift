import Foundation
import UIKit
import ImageIO
import React

@objc(ProfilePhoto)
class ProfilePhoto: NSObject {
  private let worker = DispatchQueue(label: "com.restoflow.profile-photo", qos: .userInitiated)
  private let size = 256
  private let maxBytes = 64 * 1024
  @objc static func requiresMainQueueSetup() -> Bool { false }

  private func directory() throws -> URL {
    let url = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("profile-photos", isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  private func failure() -> NSError {
    NSError(domain: "ProfilePhoto", code: 1, userInfo: [NSLocalizedDescriptionKey: "The photo could not be prepared."])
  }

  @objc func prepare(_ uri: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    worker.async { [self] in
      do {
        guard let url = URL(string: uri), url.isFileURL,
              let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 1024,
                kCGImageSourceShouldCacheImmediately: true,
              ] as CFDictionary) else { throw failure() }
        let root = try directory()
        for old in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.contentModificationDateKey]) {
          if let modified = try old.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate,
             Date().timeIntervalSince(modified) > 24 * 60 * 60 {
            try? FileManager.default.removeItem(at: old)
          }
        }
        let image = UIImage(cgImage: thumbnail)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let edge = CGFloat(size)
        let square = UIGraphicsImageRenderer(size: CGSize(width: edge, height: edge), format: format).image { context in
          UIColor.white.setFill()
          context.fill(CGRect(x: 0, y: 0, width: edge, height: edge))
          let scale = edge / min(image.size.width, image.size.height)
          let width = image.size.width * scale, height = image.size.height * scale
          image.draw(in: CGRect(x: (edge - width) / 2, y: (edge - height) / 2, width: width, height: height))
        }
        var data: Data?
        for quality in [0.8, 0.7, 0.6, 0.5, 0.4] {
          data = square.jpegData(compressionQuality: CGFloat(quality))
          if let data, data.count <= maxBytes { break }
        }
        guard let data, !data.isEmpty, data.count <= maxBytes else { throw failure() }
        let destination = root.appendingPathComponent(UUID().uuidString + ".jpg")
        try data.write(to: destination, options: .atomic)
        resolve(["uri": destination.absoluteString, "type": "image/jpeg", "name": "profile.jpg",
                 "width": size, "height": size, "fileSize": data.count])
      } catch { reject("PROFILE_PHOTO", error.localizedDescription, error) }
    }
  }

  @objc func remove(_ uri: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    worker.async { [self] in
      do {
        guard let url = URL(string: uri), url.isFileURL,
              url.resolvingSymlinksInPath().deletingLastPathComponent() == (try directory()).resolvingSymlinksInPath() else { throw failure() }
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
        resolve(nil)
      } catch { reject("PROFILE_PHOTO", error.localizedDescription, error) }
    }
  }
}
