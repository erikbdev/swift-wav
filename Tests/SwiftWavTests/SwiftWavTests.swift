import Testing

@testable import SwiftWav

@Test func example() async throws {
  struct SandstormSong: Song {
    var body: some Timeline {
      Track {
        Sample("kick.wav")
      }
    }
  }
}
