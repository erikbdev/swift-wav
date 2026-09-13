import Testing

@testable import SwiftWAVCore

@Test func example() async throws {
  struct CrabSong: Song {
    var body: some Timeline {
      Track("Drums") {
        Sample("kick-01.wav")
      }
      Track("Synth") {
        Sample("synth-01.wav")
      }
    }
  }
}
