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

    // Serve the precompressed toolchain variant the browser supports.
    let toolchainFileIO = FileIO()
    let toolchainFiles: [(route: String, contentType: String)] = [
      ("swift-ide-test.wasm", "application/wasm"),
      ("swift-frontend.wasm", "application/wasm"),
      ("wasm-ld.wasm", "application/wasm"),
      ("swift-sysroot-core.tar", "application/x-tar"),
    ]
    for file in toolchainFiles {
      router.get("/toolchain/\(file.route)") { request, context in
        let acceptEncoding = (request.headers[.acceptEncoding] ?? "").lowercased()
        let encoding: String?
        let suffix: String
        if acceptEncoding.contains("br") {
          encoding = "br"
          suffix = ".br"
        } else if acceptEncoding.contains("gzip") {
          encoding = "gzip"
          suffix = ".gz"
        } else {
          encoding = nil
          suffix = ""
        }

        let body = try await toolchainFileIO.loadFile(
          path: "Public/toolchain/\(file.route)\(suffix)",
          context: context
        )
        var headers: HTTPFields = [
          .contentType: file.contentType,
          .cacheControl: "public, max-age=31536000, immutable",
          .vary: "Accept-Encoding",
        ]
        if let encoding {
          headers[.contentEncoding] = encoding
        }

        return Response(
          status: .ok,
          headers: headers,
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
