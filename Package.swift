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
  targets: [
    .target(name: "SwiftWAVCore"),
    .testTarget(
      name: "SwiftWAVCoreTests",
      dependencies: ["SwiftWAVCore"]
    ),
  ]
)
