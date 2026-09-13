public protocol Song {
  associatedtype Body: Timeline

  var configuration: Configuration { get }

  @ContentBuilder
  var body: Body { get }
}

extension Song where Body == Never {
  public var body: Body {
    fatalError("Tried to access '\(Self.self)' but has no body.")
  }
}

extension Song {
  public var configuration: Configuration {
    Configuration(tempo: 120 / 4)
  }
}

public struct Configuration: Hashable, Sendable {
  public let tempo: Double

  public init(tempo: Double) {
    self.tempo = tempo
  }
}
