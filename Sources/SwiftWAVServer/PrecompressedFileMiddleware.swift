import HTTPTypes
import Hummingbird

/// Wraps Hummingbird's own `FileMiddleware` to serve the browser's preferred precompressed
/// variant (.br/.gz) for a fixed set of paths, tagging the response with
/// the right Content-Type/Content-Encoding/Cache-Control (Hummingbird's
/// built-in media-type table doesn't know `.wasm`/`.tar`, so those need
/// setting explicitly regardless of which FileMiddleware serves them).
struct PrecompressedFileMiddleware<Context: RequestContext, Provider: FileProvider>: RouterMiddleware
where Provider.FileAttributes: FileMiddlewareFileAttributes {
  struct FileEncoderOption {
    var path: String?  // custom path
    var encoder: String
    var encoderExt: String
  }

  let inner: FileMiddleware<Context, Provider>
  let encodingsToUse: [String: [String]]
  let cacheControl: String

  init(
    contentTypes: [String: String] = [:],
    cacheControl: String,
    fileMiddleware: () -> FileMiddleware<Context, Provider>
  ) {
    self.inner = fileMiddleware()
    self.encodingsToUse = [:]
    // self.acceptEncodings = acceptEncodings
    self.cacheControl = cacheControl
  }

  func handle(_ request: Request, context: Context, next: (Request, Context) async throws -> Response) async throws -> Response {
    guard let availableEncodings = encodingsToUse[request.uri.path], !availableEncodings.isEmpty else {
      return try await inner.handle(request, context: context, next: next)
    }

    let acceptEncodings = (request.headers[.acceptEncoding] ?? "").lowercased()
      .split(separator: ",")
      .map { String($0) }

    for encoding in acceptEncodings where availableEncodings.contains(encoding.lowercased()) {
      do {
        var head = request.head
        // TODO: edit path
        var response = try await inner.handle(request, context: context, next: next)
        response.headers[.contentEncoding] = encoding
        response.headers[.vary] = "Accept-Encoding"
        //     response.headers[.contentType] = contentType
        //     response.headers[.contentEncoding] = encoding
        //     response.headers[.vary] = "Accept-Encoding"
        //     response.headers[.cacheControl] = cacheControl
        return response
      } catch let e as HTTPError where e.status == .notFound {
        continue
      }
    }

    return try await inner.handle(request, context: context, next: next)
  }
}
