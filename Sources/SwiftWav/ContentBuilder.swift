@resultBuilder
public enum ContentBuilder {}

public struct EmptyContent {
  public typealias Body = Never

  public var body: Never { fatalError("tried to access body of type `Never`") }
}

extension EmptyContent: Sound {}

public struct _TupleContent<each T> {
  let content: (repeat each T)

  public var body: Never { fatalError("tried to access body of type `Never`") }
}

extension _TupleContent: Sound where repeat each T: Sound {}

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

extension _ConditionalContent: Sound where T: Sound, S: Sound {}
