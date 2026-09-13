@resultBuilder
public enum ContentBuilder {
  public static func buildBlock() -> EmptyContent {
    EmptyContent()
  }

  public static func buildBlock<T>(_ component: T) -> T {
    component
  }

  public static func buildBlock<each T>(_ component: repeat each T) -> _TupleContent<repeat each T> {
    _TupleContent<repeat each T>(content: (repeat each component))
  }

  public static func buildEither<T, S>(first component: T) -> _ConditionalContent<T, S> {
    _ConditionalContent(trueContent: component)
  }

  public static func buildEither<T, S>(second component: S) -> _ConditionalContent<T, S> {
    _ConditionalContent(falseContent: component)
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
