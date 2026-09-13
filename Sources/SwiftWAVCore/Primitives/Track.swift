public struct Track<T: Sound>: Timeline {
  public var body: Never {
    bodyFatalError(Never.self)
  }

  let content: T

  public init(_ name: String? = nil, @ContentBuilder content: () -> T) {
    self.content = content()
  }
}
