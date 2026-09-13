import Testing

@testable import SwiftWAVCore

@Test func example() async throws {
  struct SandstormSong: Song {
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
