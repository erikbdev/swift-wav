import ArgumentParser
import Hummingbird
import HummingbirdElementary
import Logging

@main
struct Server: AsyncParsableCommand {
  @Option(name: .shortAndLong)
  var hostname = "127.0.0.1"

  @Option(name: .shortAndLong)
  var port = 8080

  func run() async throws {
    let envVars = try await Environment.dotEnv()
    let router = Router()
    var logger = Logger(label: "swift-wav-web-server")

    if let logLevel = envVars.get("LOG_LEVEL", as: Logger.Level.self) {
      logger.logLevel = logLevel
    } else {
      #if DEBUG
        logger.logLevel = .debug
      #endif
    }

    // Middlewares
    #if DEBUG
      router.addMiddleware {
        CORSMiddleware(allowOrigin: .all)
        TracingMiddleware()
      }
    #endif

    // Serves Public/ as static files (the compiler worker JS, etc).
    router.addMiddleware {
      FileMiddleware("Public")
    }

    // The swift-toolchain-wasm artifacts (fetched via
    // scripts/fetch-toolchain.sh) that the in-browser Swift compiler worker
    // fetches, kept gzipped on disk and streamed as-is: the browser
    // transfers ~74MB instead of ~300MB. No `Content-Encoding` header here
    // deliberately — the worker inflates these itself via
    // DecompressionStream so it can measure download progress against the
    // same wire-byte units as `Content-Length` (with transparent
    // Content-Encoding: gzip, fetch() hands JS already-inflated bytes,
    // which desyncs a byte-counted progress bar from the compressed total).
    // They're pinned to one release, so it's safe to cache for a long time.
    let toolchainFileIO = FileIO()
    let toolchainFiles: [(route: String, gzPath: String)] = [
      ("swift-frontend.wasm", "Public/toolchain/swift-frontend.wasm.gz"),
      ("wasm-ld.wasm", "Public/toolchain/wasm-ld.wasm.gz"),
      ("swift-sysroot-core.tar", "Public/toolchain/swift-sysroot-core.tar.gz"),
    ]
    for file in toolchainFiles {
      router.get("/toolchain/\(file.route)") { _, context in
        let body = try await toolchainFileIO.loadFile(path: file.gzPath, context: context)
        return Response(
          status: .ok,
          headers: [
            .contentType: "application/gzip",
            .cacheControl: "public, max-age=31536000, immutable",
          ],
          body: body
        )
      }
    }

    router.get("/") { _, _ in
      HTMLResponse {
        MainPage()
      }
    }

    // TODO: support h2c for h1/h2.
    let app = Application(
      router: router,
      configuration: ApplicationConfiguration(
        address: .hostname(self.hostname, port: self.port),
        serverName: "swift-wav"
      ),
      logger: logger
    )

    #if DEBUG
      let buildMode = "development"
    #else
      let buildMode = "release"
    #endif
    app.logger.info("Running server in '\(buildMode)' mode: http://\(self.hostname):\(self.port)")
    try await app.runService()
  }
}
