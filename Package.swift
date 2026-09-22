// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
  name: "swift-wav",
  platforms: [.macOS(.v14)],
  products: [
    .library(
      name: "SwiftWAV",
      targets: ["SwiftWAV"]
    )
  ],
  dependencies: [
    .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.4.0"),
    .package(url: "https://github.com/hummingbird-project/hummingbird.git", from: "2.25.0"),
  ],
  targets: [
    .target(name: "SwiftWAVCore"),
    .target(name: "SwiftWAVEngine"),
    .target(name: "SwiftWAV", dependencies: ["SwiftWAVCore", "SwiftWAVEngine"]),
    .executableTarget(
      name: "SwiftWAVServer",
      dependencies: [
        .product(name: "ArgumentParser", package: "swift-argument-parser"),
        .product(name: "Hummingbird", package: "hummingbird"),
        .product(name: "HummingbirdRouter", package: "hummingbird"),
      ]
    ),
    .testTarget(
      name: "SwiftWAVCoreTests",
      dependencies: ["SwiftWAVCore"]
    ),
  ]
)
