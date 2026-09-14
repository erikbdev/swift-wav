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
