public protocol Timeline {
  associatedtype Body: Sound

  var body: Body { get }
}

extension Timeline where Body == Never {
  public var body: Body {
    fatalError("Tried to access '\(Self.self)' but has no body.")
  }
}

extension Never: Timeline {}
extension EmptyContent: Timeline {}
extension TupleContent: Timeline where repeat each T: Timeline {}
extension _ConditionalContent: Timeline where T: Timeline, S: Timeline {}
