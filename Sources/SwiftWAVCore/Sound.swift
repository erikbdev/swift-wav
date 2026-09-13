public protocol Sound {
  associatedtype Body: Sound

  @ContentBuilder
  var body: Self.Body { get }
}

extension Sound where Body == Never {
  public var body: Body {
    fatalError("Tried to access '\(Self.self)' but has no body.")
  }
}

extension Never: Sound {}
extension EmptyContent: Sound {}
extension TupleContent: Sound where repeat each T: Sound {}
extension _ConditionalContent: Sound where T: Sound, S: Sound {}
