@resultBuilder
public enum ContentBuilder {
  public static func buildBlock() -> EmptyContent {
    EmptyContent()
  }
}

public struct _TupleContent<each T> {
  let content: (repeat each T)

  public var body: Never { fatalError("tried to access body of type `Never`") }
}

public struct _ConditionalContent<T, S> {
  enum Conditional {
    case `true`(T)
    case `false`(S)
  }

  let conditional: Conditional

  public var body: Never { fatalError("tried to access body of type `Never`") }

  init(trueContent: T) {
    self.conditional = .`true`(trueContent)
  }

  init(falseContent: S) {
    self.conditional = .`false`(falseContent)
  }
}
