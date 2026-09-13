public protocol Sound {
  associatedtype Body: Sound

  @ContentBuilder
  var body: Self.Body { get }
}

extension Never: Sound {}
extension EmptyContent: Sound {}
extension _TupleContent: Sound where repeat each T: Sound {}
extension _ConditionalContent: Sound where T: Sound, S: Sound {}
