import ArgumentParser
import Hummingbird
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
    var logger = Logger(label: "swift-wav-server")

    if let logLevel = envVars.get("LOG_LEVEL", as: Logger.Level.self) {
      logger.logLevel = logLevel
    } else {
      #if DEBUG
        logger.logLevel = .debug
      #endif
    }

    // Middlewares

    router.addMiddleware {
      #if DEBUG
        CORSMiddleware(allowOrigin: .all)
        TracingMiddleware()
      #endif

      #if DEBUG
        let publicFilesPath = "Public/static"
      #else
        let publicFilesPath = "dist"
      #endif

      let cacheControl = "public, max-age=31536000, immutable"
      let variants: [PrecompressedFile.Variant] = [.br, .gzip]
      PrecompressedFileMiddleware(
        files: [
          "/toolchain/swift-ide-test.wasm": .init(
            contentType: "application/wasm",
            cacheControl: cacheControl,
            variants: variants
          ),
          "/toolchain/swift-frontend.wasm": .init(
            contentType: "application/wasm",
            cacheControl: cacheControl,
            variants: [.br, .gzip]
          ),
          "/toolchain/wasm-ld.wasm": .init(
            contentType: "application/wasm",
            cacheControl: cacheControl,
            variants: [.br, .gzip]
          ),
          "/toolchain/swift-sysroot-core.tar": .init(
            contentType: "application/x-tar",
            cacheControl: cacheControl,
            variants: [.br, .gzip]
          ),
          "/toolchain/libSwiftWAV.tar": .init(
            contentType: "application/x-tar",
            cacheControl: cacheControl,
            variants: [.br, .gzip]
          ),
        ],
      ) {
        FileMiddleware(
          publicFilesPath,
          searchForIndexHtml: true,
        )
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
