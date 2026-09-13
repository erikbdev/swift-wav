public struct Sample: Sound {
  public var body: Never {
    accessNeverBodyFatalError(Self.self)
  }

  public init(_ name: String) {

  }
}
