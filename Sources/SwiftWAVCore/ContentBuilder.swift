@resultBuilder
public enum ContentBuilder {
  public static func buildBlock() -> EmptyContent {
    EmptyContent()
  }

  public static func buildBlock<T>(_ component: T) -> T {
    component
  }

  public static func buildBlock<each T>(_ component: repeat each T) -> TupleContent<repeat each T> {
    TupleContent<repeat each T>(content: (repeat each component))
  }

  public static func buildEither<T, S>(first component: T) -> _ConditionalContent<T, S> {
    _ConditionalContent(trueContent: component)
  }

  public static func buildEither<T, S>(second component: S) -> _ConditionalContent<T, S> {
    _ConditionalContent(falseContent: component)
  }
}

public struct TupleContent<each T> {
  public var body: Never {
    bodyFatalError(Never.self)
  }

  let content: (repeat each T)
}

public struct _ConditionalContent<T, S> {
  enum Conditional {
    case trueContent(T)
    case falseContent(S)
  }

  public var body: Never {
    bodyFatalError(Never.self)
  }

  let conditional: Conditional

  init(trueContent: T) {
    self.conditional = .trueContent(trueContent)
  }

  init(falseContent: S) {
    self.conditional = .falseContent(falseContent)
  }
}
