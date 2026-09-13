public struct Track<T: Sound>: Timeline {
  let content: T

  public var body: Never { fatalError("Tried to access `body` of type Never") }

  public init(@ContentBuilder content: () -> T) {
    self.content = content()
  }
}
