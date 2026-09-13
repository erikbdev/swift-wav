public protocol Sound {
  associatedtype Body: Sound

  @ContentBuilder
  var body: Self.Body { get }
}

extension Never: Sound {}
extension EmptyContent: Sound {}
extension TupleContent: Sound where repeat each T: Sound {}
extension _ConditionalContent: Sound where T: Sound, S: Sound {}
extension _ArrayContent: Sound where T: Sound {}
extension _OptionalContent: Sound where T: Sound {}
