// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
  name: "swift-wav",
  products: [
    .library(
      name: "SwiftWAVCore",
      targets: ["SwiftWAVCore"]
    )
  ],
  dependencies: [
    .package(url: "https://github.com/hummingbird-project/hummingbird.git", from: "2.25.0")
  ],
  targets: [
    .target(name: "SwiftWAVCore"),
    .executableTarget(
      name: "SwiftWAVWeb",
      dependencies: [
        .product(name: "Hummingbird", package: "hummingbird")
      ]
    ),
    .testTarget(
      name: "SwiftWAVCoreTests",
      dependencies: ["SwiftWAVCore"]
    ),
  ]
)
