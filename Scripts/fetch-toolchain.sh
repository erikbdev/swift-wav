#!/usr/bin/env bash

# Downloads the precompiled swift-toolchain-wasm release artifacts
# (https://github.com/tothambrus11/swift-toolchain-wasm) that let the browser
# editor compile and run Swift in-process via WASI, then shrinks them in
# place for the web:
#
#   1. Strips DWARF debug info and the (much larger) wasm "name" custom
#      section from each .wasm tool via wasm-opt. Neither is needed to run
#      the module — they only symbolicate a trap's stack trace with real
#      function names, which only matters if the toolchain itself crashes
#      and someone is debugging *that*, not the user's Swift code (this
#      project's own diagnostics come from parsed stdout/stderr, never from
#      a wasm-level stack trace). Keep an unstripped copy of a release
#      elsewhere if that debugging need ever comes up.
#   2. Compresses every artifact (including the sysroot tar, which isn't
#      itself stripped — it holds prebuilt stdlib/module files, not
#      something wasm-opt operates on) into .gz and .br twins. Brotli beats
#      gzip on these by a wide margin (measured ~35-45% smaller at -q 11)
#      but is much slower to produce; that cost is paid once here, not per
#      request. Whatever serves these should pick the smallest twin the
#      client's Accept-Encoding supports and set Content-Encoding
#      accordingly (falls back to the plain file otherwise) — nothing wires
#      that negotiation up yet, so these twins currently sit unused.
#
# Artifacts are pinned to a specific release tag (not `latest`) so a rebuild
# upstream can't silently change what ships. Bump TAG deliberately.
#
# Safe to re-run: already-downloaded files are left alone, wasm-opt on an
# already-stripped file is a no-op, and the compressed twins are just
# regenerated from whatever's currently on disk.
#
# Apache-2.0 license (matching upstream LLVM/Swift). See:
# https://github.com/tothambrus11/swift-toolchain-wasm/blob/main/LICENSE

set -euo pipefail

TAG="swift-6.3.3-wasm"
BASE_URL="https://github.com/erikbdev/swift-toolchain-wasm/releases/download/${TAG}"
DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Public/static/toolchain"

WASM_FILES=(
  "swift-frontend.wasm"
  "swift-ide-test.wasm"
  "wasm-ld.wasm"
)

ALL_FILES=(
  "${WASM_FILES[@]}"
  "swift-sysroot-core.tar"
)

for tool in wasm-opt brotli gzip; do
  command -v "$tool" >/dev/null || {
    echo "error: $tool not found on PATH" >&2
    exit 1
  }
done

mkdir -p "$DEST_DIR"

for name in "${ALL_FILES[@]}"; do
  f="$DEST_DIR/$name"

  if [[ -f "$f" ]]; then
    echo "== $name already present, skipping download"
    continue
  fi

  echo "== fetching $name"
  curl -fL --progress-bar -o "$f" "$BASE_URL/$name"
done

for name in "${WASM_FILES[@]}"; do
  f="$DEST_DIR/$name"

  before=$(stat -c%s "$f")
  tmp="$f.stripped"
  wasm-opt --strip-debug --strip-producers -o "$tmp" "$f"
  mv "$tmp" "$f"
  after=$(stat -c%s "$f")
  echo "== $name stripped: $((before / 1024 / 1024))MiB -> $((after / 1024 / 1024))MiB"
done

for name in "${ALL_FILES[@]}"; do
  f="$DEST_DIR/$name"

  echo "== compressing $name"
  gzip -9 -f -k "$f"
  brotli -q 11 -f -o "$f.br" "$f"
  echo "   gz:  $(du -h "$f.gz" | cut -f1)"
  echo "   br:  $(du -h "$f.br" | cut -f1)"
done

echo "Toolchain artifacts are in $DEST_DIR"
