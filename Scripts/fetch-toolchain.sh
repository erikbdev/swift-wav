#!/usr/bin/env bash
# Downloads the precompiled swift-toolchain-wasm release artifacts
# (https://github.com/tothambrus11/swift-toolchain-wasm) that let the browser
# editor compile and run Swift in-process via WASI.
#
# Kept gzipped on disk: Server.swift serves them as-is with
# `Content-Encoding: gzip`, so the browser transfers ~74MB instead of ~300MB
# and transparently inflates them — no client-side decompression needed.
#
# Artifacts are pinned to a specific release tag (not `latest`) so a rebuild
# upstream can't silently change what ships. Bump TAG deliberately.
#
# Apache-2.0 license (matching upstream LLVM/Swift). See:
# https://github.com/tothambrus11/swift-toolchain-wasm/blob/main/LICENSE
set -euo pipefail

TAG="swift-6.3.3-wasm"
BASE_URL="https://github.com/erikbdev/swift-toolchain-wasm/releases/download/${TAG}"
DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Public/toolchain"

FILES=(
  "swift-frontend.wasm"
  "swift-frontend.wasm.gz"
  "swift-ide-test.wasm"
  "swift-ide-test.wasm.gz"
  "wasm-ld.wasm"
  "wasm-ld.wasm.gz"
  "swift-sysroot-core.tar"
  "swift-sysroot-core.tar.gz"
)

mkdir -p "$DEST_DIR"

for name in "${FILES[@]}"; do
  f="$DEST_DIR/$name"
  gz="$DEST_DIR/$name.gz"

  if [[ -f "$f" ]]; then
    echo "== $name already present, skipping"
    continue
  fi

  echo "== fetching $name"
  curl -fL --progress-bar -o "$f" "$BASE_URL/$name"

  echo "== $name ready ($(du -h "$gz" | cut -f1))"
done

echo "Toolchain artifacts are in $DEST_DIR"
