public struct EmptyContent {
  public typealias Body = Never

  public var body: Never { fatalError("tried to access body of type `Never`") }
}
