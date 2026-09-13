public struct Pattern<T: Sound>: Sound {
  public var body: Never { fatalError("Tried to access `body` of type Never") }

  let content: T

  public init(@ContentBuilder content: () -> T) {
    self.content = content()
  }
}
