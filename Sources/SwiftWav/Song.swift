public protocol Song {
  associatedtype Body: Sound

  var configuration: Configuration { get }

  @ContentBuilder
  var body: Body { get }
}

extension Song {
  public var configuration: Configuration {
    Configuration(tempo: 120)
  }
}

public struct Configuration: Hashable, Sendable {
  public let tempo: UInt

  public init(tempo: UInt) {
    self.tempo = tempo
  }
}