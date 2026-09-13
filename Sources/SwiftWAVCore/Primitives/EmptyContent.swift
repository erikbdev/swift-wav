public struct EmptyContent {
  public var body: Never {
    accessNeverBodyFatalError(Self.self)
  }

  public init() {}
}
