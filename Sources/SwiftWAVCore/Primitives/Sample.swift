public struct Sample: Sound {
  public var body: Never { fatalError("Tried to access `body` of type Never") }

  public init(_ name: String) {

  }
}
