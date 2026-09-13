public protocol Sound {
  associatedtype Body: Sound

  @ContentBuilder
  var body: Self.Body { get }
}

extension Never: Sound {}

/// `Sound` result builder
extension ContentBuilder {
  public static func buildBlock<S: Sound>(_ component: S) -> S {
    component
  }

  public static func buildBlock<each S: Sound>(_ component: repeat each S) -> _TupleContent<repeat each S> {
    _TupleContent<repeat each S>(content: (repeat each component))
  }

  public static func buildEither<T: Sound, S: Sound>(first component: T) -> _ConditionalContent<T, S> {
    _ConditionalContent(trueContent: component)
  }

  public static func buildEither<T: Sound, S: Sound>(second component: S) -> _ConditionalContent<T, S> {
    _ConditionalContent(falseContent: component)
  }
}

extension EmptyContent: Sound {}
extension _TupleContent: Sound where repeat each T: Sound {}
extension _ConditionalContent: Sound where T: Sound, S: Sound {}
