// Fetches the precompiled swift-toolchain-wasm artifacts (swift-frontend,
// wasm-ld, swift-ide-test, the sysroot, and libSwiftWAV), each once, and
// reports cumulative download progress.

import { memoize } from "./memoize";
import { untar } from "./tar";

const TOOLCHAIN_BASE = "/toolchain";

/** The four assets every compiler needs; swift-ide-test is fetched on first completion. */
const REQUIRED_DOWNLOADS = 4;

export type Toolchain = ReturnType<typeof fetchToolchains>;

export function fetchToolchains(onProgress: (progress: number) => void) {
  const completedDownloads = new Set<string>();

  /**
   * Fetches `url`, reports completion progress for the toolchain assets, and
   * returns a Response with `contentType` set (needed for WebAssembly.compileStreaming).
   */
  async function fetchWithProgress(url: string, contentType?: string): Promise<Response> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetching ${url} failed: ${res.status}`);
    if (!res.body) throw new Error(`fetching ${url} returned an empty body`);

    const reader = res.body.getReader();
    return new Response(
      new ReadableStream<Uint8Array>({
        async pull(controller) {
          const { done, value } = await reader.read();
          if (done) {
            completedDownloads.add(url);
            onProgress(Math.min(completedDownloads.size / REQUIRED_DOWNLOADS, 1.0));
            controller.close();
            return;
          }
          controller.enqueue(value);
        },
        cancel: (reason) => reader.cancel(reason),
      }),
      contentType ? { headers: { "Content-Type": contentType } } : undefined,
    );
  }

  const wasm = (name: string) => memoize(() => WebAssembly.compileStreaming(fetchWithProgress(`${TOOLCHAIN_BASE}/${name}`, "application/wasm")));
  const tar = (name: string) =>
    memoize(() =>
      fetchWithProgress(`${TOOLCHAIN_BASE}/${name}`)
        .then((r) => r.arrayBuffer())
        .then(untar),
    );

  return {
    frontend: wasm("swift-frontend.wasm"),
    linker: wasm("wasm-ld.wasm"),
    ideTest: wasm("swift-ide-test.wasm"),
    sysroot: tar("swift-sysroot-core.tar"),
    libSwiftWAV: tar("libSwiftWAV.tar"),
  };
}
