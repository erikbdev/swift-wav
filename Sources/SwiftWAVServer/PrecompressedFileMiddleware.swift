import Foundation
import HTTPTypes
import Hummingbird

struct PrecompressedFile: Sendable {
  struct Variant: Sendable {
    let path: String?
    let contentEncoding: String
    let fileExtension: String

    init(path: String? = nil, contentEncoding: String, fileExtension: String) {
      self.path = path
      self.contentEncoding = contentEncoding
      self.fileExtension = fileExtension
    }

    static let br = Self(contentEncoding: "br", fileExtension: "br")
    static let gzip = Self(contentEncoding: "gzip", fileExtension: "gz")
  }

  let contentType: String
  let cacheControl: String?
  let variants: [Variant]

  init(contentType: String, cacheControl: String? = nil, variants: [Variant]) {
    self.contentType = contentType
    self.cacheControl = cacheControl
    self.variants = variants
  }
}

/// Wraps Hummingbird's own `FileMiddleware` to serve a browser-compatible
/// precompressed variant for a fixed set of paths.
struct PrecompressedFileMiddleware<Context: RequestContext, Provider: FileProvider>: RouterMiddleware
where Provider.FileAttributes: FileMiddlewareFileAttributes {
  let fileMiddleware: FileMiddleware<Context, Provider>
  let files: [String: PrecompressedFile]

  init(
    files: [String: PrecompressedFile],
    fileMiddleware: () -> FileMiddleware<Context, Provider>
  ) {
    self.fileMiddleware = fileMiddleware()
    self.files = files
  }

  func handle(
    _ request: Request,
    context: Context,
    next: (Request, Context) async throws -> Response
  ) async throws -> Response {
    guard request.method == .get || request.method == .head, let file = files[request.uri.path], !file.variants.isEmpty else {
      return try await fileMiddleware.handle(request, context: context, next: next)
    }

    let acceptedEncodings = Self.parseAcceptEncoding(request.headers[.acceptEncoding])
    let candidates = file.variants
      .enumerated()
      .compactMap { index, variant -> (index: Int, variant: PrecompressedFile.Variant, quality: Double)? in
        let quality = acceptedEncodings[variant.contentEncoding] ?? acceptedEncodings["*"] ?? 0
        return quality > 0 ? (index: index, variant: variant, quality: quality) : nil
      }
      .sorted {
        if $0.quality != $1.quality {
          return $0.quality > $1.quality
        }
        return $0.index < $1.index
      }

    for candidate in candidates {
      var variantHead = request.head
      variantHead.path = candidate.variant.path ?? "\(request.uri.path).\(candidate.variant.fileExtension)"
      let variantRequest = Request(head: variantHead, body: request.body)

      do {
        // A variant probe must only look for a file. Calling the real `next`
        // here could execute the route once for every candidate.
        var response = try await fileMiddleware.handle(
          variantRequest,
          context: context
        ) { _, _ in
          throw HTTPError(.notFound)
        }

        if response.headers[.contentType] == nil {
          response.headers[.contentType] = file.contentType
        }
        if response.headers[.cacheControl] == nil, let cacheControl = file.cacheControl {
          response.headers[.cacheControl] = cacheControl
        }
        response.headers[.contentEncoding] = candidate.variant.contentEncoding

        if let existing = response.headers[.vary] {
          let containsAcceptEncoding =
            existing
            .split(separator: ",")
            .contains {
              $0.trimmingCharacters(in: .whitespacesAndNewlines)
                .caseInsensitiveCompare("Accept-Encoding") == .orderedSame
            }
          if existing != "*", !containsAcceptEncoding {
            response.headers[.vary] = "\(existing), Accept-Encoding"
          }
        } else {
          response.headers[.vary] = "Accept-Encoding"
        }

        return response
      } catch let error as any HTTPResponseError where error.status == .notFound {
        continue
      }
    }

    var response = try await fileMiddleware.handle(request, context: context, next: next)

    if response.headers[.contentType] == nil {
      response.headers[.contentType] = file.contentType
    }

    if response.headers[.cacheControl] == nil, let cacheControl = file.cacheControl {
      response.headers[.cacheControl] = cacheControl
    }

    if let existing = response.headers[.vary] {
      let containsAcceptEncoding = existing.split(separator: ",").contains {
        $0.trimmingCharacters(in: .whitespacesAndNewlines)
          .caseInsensitiveCompare("Accept-Encoding") == .orderedSame
      }
      if existing != "*", !containsAcceptEncoding {
        response.headers[.vary] = "\(existing), Accept-Encoding"
      }
    } else {
      response.headers[.vary] = "Accept-Encoding"
    }

    return response
  }

  private static func parseAcceptEncoding(_ header: String?) -> [String: Double] {
    guard let header else { return [:] }

    var qualities: [String: Double] = [:]
    for item in header.split(separator: ",", omittingEmptySubsequences: true) {
      let parts = item.split(separator: ";", omittingEmptySubsequences: true)
      let name = parts[0]
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      guard !name.isEmpty else { continue }

      var quality = 1.0
      var valid = true
      for parameter in parts.dropFirst() {
        let pair = parameter.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
        guard pair.count == 2 else { continue }
        let key = pair[0]
          .trimmingCharacters(in: .whitespacesAndNewlines)
          .lowercased()
        guard key == "q" else { continue }

        guard
          let parsedQuality = Double(
            pair[1].trimmingCharacters(in: .whitespacesAndNewlines)
          ),
          (0...1).contains(parsedQuality)
        else {
          valid = false
          break
        }
        quality = parsedQuality
      }

      if valid {
        qualities[name] = quality
      }
    }
    return qualities
  }
}
