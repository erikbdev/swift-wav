public struct Track<T: Sound>: Timeline {
  public var body: Never {
    bodyFatalError(Never.self)
  }

  let content: T

  public init(@ContentBuilder content: () -> T) {
    self.content = content()
  }
}
