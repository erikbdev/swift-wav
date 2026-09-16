// Fetching this project's precompiled swift-toolchain-wasm artifacts, with
// cumulative download progress across every in-flight fetch and a boot-once
// memoizer: two requests for the same artifact (e.g. a Run and a completion
// racing each other) share one download and one WebAssembly.compile rather
// than repeating either.

/** @type {Map<string, {loaded: number, total: number}>} */
const downloadProgress = new Map();

/** @param {(loaded: number, total: number) => void} onProgress */
function reportDownloadProgress(onProgress) {
  if (!onProgress) return;
  let loaded = 0;
  let total = 0;
  for (const entry of downloadProgress.values()) {
    loaded += entry.loaded;
    total += entry.total;
  }
  onProgress(loaded, total);
}

/**
 * Fetches `url`, reporting cumulative decoded-byte progress across every
 * in-flight fetch made through this function, and returns a Response with
 * `contentType` set (needed for WebAssembly.compileStreaming).
 *
 * The server sends these precompressed (gzip, per Content-Encoding); fetch
 * transparently decodes before this ever sees a byte, so a compressed
 * response's Content-Length isn't a valid decoded total, and progress for it
 * is reported as indeterminate (0 total) rather than lied about.
 */
/**
 * @param {string} url
 * @param {(loaded: number, total: number) => void} onProgress
 * @param {string} [contentType]
 * @returns {Promise<Response>}
 */
export async function fetchWithProgress(url, onProgress, contentType) {
  downloadProgress.set(url, { loaded: 0, total: 0 });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetching ${url} failed: ${res.status}`);
  const total = res.headers.has("content-encoding") ? 0 : Number(res.headers.get("content-length")) || 0;
  downloadProgress.set(url, { loaded: 0, total });
  reportDownloadProgress(onProgress);
  if (!res.body) throw new Error(`fetching ${url} returned an empty body`);

  const reader = res.body.getReader();
  const trackedStream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const progress = downloadProgress.get(url);
      if (progress) progress.loaded += value.byteLength;
      reportDownloadProgress(onProgress);
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(trackedStream, contentType ? { headers: { "Content-Type": contentType } } : undefined);
}

/**
 * Wraps an async `load` so that concurrent or repeated calls share one
 * in-flight (or settled) promise instead of redoing the work. A rejection
 * clears the memo, so the *next* call retries instead of replaying the same
 * failure forever; a resolved memo ignores whatever `onProgress` a later
 * caller passes, since there is nothing left to report progress on.
 */
/**
 * @param {(onProgress: any) => Promise<any>} load
 * @returns {(onProgress: any) => Promise<any>}
 */
export function bootOnce(load) {
  /** @type {Promise<any>|null} */
  let promise = null;
  return (onProgress) => {
    if (!promise) {
      promise = load(onProgress).catch((err) => {
        promise = null;
        throw err;
      });
    }
    return promise;
  };
}

/** @param {string} url */
export function moduleLoader(url) {
  return bootOnce(async (onProgress) => {
    const res = await fetchWithProgress(url, onProgress, "application/wasm");
    return WebAssembly.compileStreaming(res);
  });
}
