import Hummingbird

struct ServerRoutingMiddleware<Context: RequestContext>: RouterMiddleware {
  func handle(_ request: Request, context: Context, next: (Request, Context) async throws -> Response) async throws -> Response {
    try await next(request, context)
  }
}
