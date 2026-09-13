public struct EmptyContent {
  public var body: Never {
    bodyFatalError(Never.self)
  }

  public init() {

  }
}
