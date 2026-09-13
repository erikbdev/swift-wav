import Testing

@testable import SwiftWAVCore

@Test func example() async throws {
  struct CrabSong: Song {
    var body: some Timeline {
      Track("drums") {
        Sample("kick-01.wav")
      }
      Track("synth") {
        Sample("synth-01.wav")
      }
    }
  }
}
