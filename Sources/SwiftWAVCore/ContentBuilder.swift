@resultBuilder
public enum ContentBuilder {
  public static func buildBlock() -> EmptyContent {
    EmptyContent()
  }

  public static func buildBlock<T>(_ content: T) -> T {
    content
  }

  public static func buildBlock<T, each S>(_ content: T, _ rest: repeat each S) -> TupleContent<T, repeat each S> {
    TupleContent<T, repeat each S>((content, repeat each rest))
  }

  public static func buildEither<T, S>(first content: T) -> _ConditionalContent<T, S> {
    _ConditionalContent(content: .trueContent(content))
  }

  public static func buildEither<T, S>(second content: S) -> _ConditionalContent<T, S> {
    _ConditionalContent(content: .falseContent(content))
  }

  public static func buildArray<T>(_ content: [T]) -> _ArrayContent<T> {
    _ArrayContent<T>(content: content)
  }

  public static func buildOptional<T>(_ content: T?) -> _OptionalContent<T> {
    _OptionalContent<T>(content)
  }

  public static func buildExpression<T>(_ content: T) -> T {
    content
  }
}

public struct TupleContent<each T> {
  public var body: Never {
    accessNeverBodyFatalError(Never.self)
  }

  let content: (repeat each T)

  public init(_ content: (repeat each T)) {
    self.content = (repeat each content)
  }
}

public struct _ConditionalContent<T, S> {
  enum Content {
    case trueContent(T)
    case falseContent(S)
  }

  public var body: Never {
    accessNeverBodyFatalError(Self.self)
  }

  let content: Content
}

public struct _ArrayContent<T> {
  let content: [T]

  public var body: Never {
    accessNeverBodyFatalError(Self.self)
  }
}

public struct _OptionalContent<T> {
  let content: T?

  public var body: Never {
    accessNeverBodyFatalError(Self.self)
  }

  init(_ content: T?) {
    if let content = content as? _OptionalContent<T> {
      self = content
    } else {
      self.content = content
    }
  }
}
