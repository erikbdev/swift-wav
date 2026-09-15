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
BASE_URL="https://github.com/tothambrus11/swift-toolchain-wasm/releases/download/${TAG}"
DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Public/toolchain"

FILES=(
  "swift-frontend.wasm"
  "wasm-ld.wasm"
  "swift-sysroot-core.tar"
)

mkdir -p "$DEST_DIR"

for name in "${FILES[@]}"; do
  gz="$DEST_DIR/$name.gz"

  if [[ -f "$gz" ]]; then
    echo "== $name.gz already present, skipping"
    continue
  fi

  echo "== fetching $name.gz"
  curl -fL --progress-bar -o "$gz" "$BASE_URL/$name.gz"

  echo "== $name.gz ready ($(du -h "$gz" | cut -f1))"
done

echo "Toolchain artifacts are in $DEST_DIR"
