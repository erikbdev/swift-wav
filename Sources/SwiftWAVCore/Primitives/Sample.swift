public struct Sample: Sound {
  public var body: Never {
    bodyFatalError(Never.self)
  }

  public init(_ name: String) {

  }
}
