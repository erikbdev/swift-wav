public protocol Timeline {
  associatedtype Body: Sound

  var body: Body { get }
}

extension Never: Timeline {}
extension EmptyContent: Timeline {}
extension TupleContent: Timeline where repeat each T: Timeline {}
extension _ConditionalContent: Timeline where T: Timeline, S: Timeline {}
