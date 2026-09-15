// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
  name: "swift-wav",
  platforms: [.macOS(.v14)],
  products: [
    .library(
      name: "SwiftWAVCore",
      targets: ["SwiftWAVCore"]
    )
  ],
  dependencies: [
    .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.4.0"),
    .package(url: "https://github.com/apple/swift-async-algorithms.git", from: "1.0.0"),
    .package(url: "https://github.com/apple/swift-log.git", from: "1.6.0"),
    .package(url: "https://github.com/apple/swift-nio", from: "2.0.0"),
    .package(url: "https://github.com/elementary-swift/elementary.git", from: "0.8.0"),
    .package(url: "https://github.com/hummingbird-project/hummingbird.git", from: "2.25.0"),
    .package(url: "https://github.com/hummingbird-community/hummingbird-elementary.git", from: "0.5.0"),
  ],
  targets: [
    .target(name: "SwiftWAVCore"),
    .executableTarget(
      name: "SwiftWAVWeb",
      dependencies: [
        .product(name: "ArgumentParser", package: "swift-argument-parser"),
        .product(name: "Elementary", package: "elementary"),
        .product(name: "Hummingbird", package: "hummingbird"),
        .product(name: "HummingbirdRouter", package: "hummingbird"),
        .product(name: "HummingbirdElementary", package: "hummingbird-elementary"),
      ]
    ),
    .testTarget(
      name: "SwiftWAVCoreTests",
      dependencies: ["SwiftWAVCore"]
    ),
  ]
)
