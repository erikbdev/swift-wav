// Compiles and runs Swift source entirely in-browser using the precompiled
// swift-toolchain-wasm artifacts (swift-frontend.wasm + wasm-ld.wasm) driven
// over WASI, with the sysroot mounted from a plain tar archive.
//
// Runs in a Worker because compiling/linking these modules is slow enough to
// jank the main thread. See docs/consuming.md in
// https://github.com/tothambrus11/swift-toolchain-wasm for the argv this
// mirrors (there is no on-wasm driver: WASI can't spawn processes, so the
// embedder replays swiftc's argv by hand).

import { WASI, File, Directory, OpenFile, ConsoleStdout, PreopenDirectory } from "https://esm.sh/@bjorn3/browser_wasi_shim@0.4.2";

const TOOLCHAIN_BASE = "/toolchain";

/** @type {Promise<WebAssembly.Module> | null} */
let frontendModulePromise = null;
/** @type {Promise<WebAssembly.Module> | null} */
let linkerModulePromise = null;
/** @type {Promise<Directory> | null} */
let sysrootPromise = null;

// ---------- Download progress ----------
//
// The server sends precompressed Brotli (with gzip/raw fallbacks) using
// Content-Encoding. Fetch transparently decodes the response before this
// worker sees it, so there is no client-side decompressor here. Encoded
// Content-Length is not a valid total for the decoded stream; the UI therefore
// treats progress for encoded responses as indeterminate.

/** @type {Map<string, {loaded: number, total: number}>} */
const downloadProgress = new Map();

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
 * Fetches a toolchain artifact, reporting cumulative decoded-byte progress
 * across all in-flight fetches, and returns a Response with `contentType` set
 * (needed for WebAssembly.compileStreaming).
 */
async function fetchToolchainWithProgress(url, onProgress, contentType) {
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
      const { done, value: value_1 } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      downloadProgress.get(url).loaded += value_1.byteLength;
      reportDownloadProgress(onProgress);
      controller.enqueue(value_1);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(trackedStream, contentType ? { headers: { "Content-Type": contentType } } : undefined);
}

function compileModuleOnce(getPromise, setPromise, url, onProgress) {
  if (getPromise()) return getPromise();
  const promise = fetchToolchainWithProgress(url, onProgress, "application/wasm")
    .then((res) => WebAssembly.compileStreaming(res))
    .catch((err) => {
      setPromise(null);
      throw err;
    });
  setPromise(promise);
  return promise;
}

function getFrontendModule(onProgress) {
  return compileModuleOnce(
    () => frontendModulePromise,
    (p) => (frontendModulePromise = p),
    `${TOOLCHAIN_BASE}/swift-frontend.wasm`,
    onProgress
  );
}

function getLinkerModule(onProgress) {
  return compileModuleOnce(
    () => linkerModulePromise,
    (p) => (linkerModulePromise = p),
    `${TOOLCHAIN_BASE}/wasm-ld.wasm`,
    onProgress
  );
}

// ---------- Minimal ustar/GNU-tar reader ----------
//
// Just enough to unpack swift-sysroot-core.tar into an in-memory Directory
// tree: regular files ('0'/'\0'), directories ('5'), and GNU long-name
// entries ('L') for paths over the 100-byte ustar field. PAX extended
// headers ('x'/'g') are skipped rather than parsed — the sysroot tarball is
// built by GNU tar, which uses 'L' for long names, not PAX.

function readCString(view, offset, length) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
  const nul = bytes.indexOf(0);
  return new TextDecoder().decode(nul === -1 ? bytes : bytes.subarray(0, nul));
}

function readOctal(view, offset, length) {
  const str = readCString(view, offset, length).trim();
  return str.length ? parseInt(str, 8) : 0;
}

function mkdirp(root, parts) {
  let dir = root;
  for (const part of parts) {
    if (part === "") continue;
    let next = dir.contents.get(part);
    if (next === undefined) {
      next = new Directory(new Map());
      next.parent = dir;
      dir.contents.set(part, next);
    } else if (!(next instanceof Directory)) {
      throw new Error(`tar: '${part}' is both a file and a directory`);
    }
    dir = next;
  }
  return dir;
}

// GNU tar entries in the sysroot archive are written as "./a/b/c" — drop the
// leading "." component along with empty ones, or every path ends up nested
// under a spurious "." directory.
function pathParts(path) {
  return path.split("/").filter((p) => p !== "" && p !== ".");
}

function putFile(root, path, data) {
  const parts = pathParts(path);
  const name = parts.pop();
  const dir = mkdirp(root, parts);
  dir.contents.set(name, new File(data));
}

/** Parses a tar ArrayBuffer into a Directory tree rooted at "/". */
function untar(buffer) {
  const root = new Directory(new Map());
  let offset = 0;
  let pendingLongName = null;

  while (offset + 512 <= buffer.byteLength) {
    const header = new DataView(buffer, offset, 512);
    // A block of all zero bytes marks the end of the archive.
    if (new Uint8Array(buffer, offset, 512).every((b) => b === 0)) break;

    let name = readCString(header, 0, 100);
    const size = readOctal(header, 124, 12);
    const typeflag = String.fromCharCode(header.getUint8(156)) || "0";
    const prefix = readCString(header, 345, 155);
    if (prefix) name = `${prefix}/${name}`;

    const dataStart = offset + 512;
    const dataLen = size;
    offset = dataStart + Math.ceil(dataLen / 512) * 512;

    if (typeflag === "L") {
      // GNU long name: payload is the real name of the *next* entry.
      pendingLongName = new TextDecoder()
        .decode(new Uint8Array(buffer, dataStart, dataLen))
        .replace(/\0+$/, "");
      continue;
    }
    if (pendingLongName) {
      name = pendingLongName;
      pendingLongName = null;
    }
    if (!name) continue;

    if (typeflag === "5") {
      mkdirp(root, pathParts(name));
    } else if (typeflag === "0" || typeflag === "\0" || typeflag === "") {
      const data = buffer.slice(dataStart, dataStart + dataLen);
      putFile(root, name.replace(/\/+$/, ""), data);
    }
    // Symlinks ('2'), PAX headers ('x'/'g') and other exotic types aren't
    // needed by this sysroot and are skipped.
  }

  return root;
}

function getSysroot(onProgress) {
  if (!sysrootPromise) {
    sysrootPromise = fetchToolchainWithProgress(`${TOOLCHAIN_BASE}/swift-sysroot-core.tar`, onProgress)
      .then((res) => res.arrayBuffer())
      .then((buf) => untar(buf))
      .catch((err) => {
        sysrootPromise = null;
        throw err;
      });
  }
  return sysrootPromise;
}

// ---------- Running a WASI command module to completion ----------

function makeLineSink(onLine) {
  return ConsoleStdout.lineBuffered(onLine);
}

/**
 * Instantiates and runs `module` as a WASI command with the given argv and
 * preopens, returning its exit code plus captured stdout/stderr lines.
 */
async function runWasiCommand(module, argv, preopens) {
  const stdout = [];
  const stderr = [];
  const fds = [
    new OpenFile(new File([])),
    makeLineSink((line) => stdout.push(line)),
    makeLineSink((line) => stderr.push(line)),
    ...preopens,
  ];
  const wasi = new WASI(argv, [], fds, { debug: false });

  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  let exitCode = 0;
  try {
    exitCode = wasi.start(instance);
  } catch (err) {
    // WASIProcExit is how `exit()`/`_start` returning is surfaced by some
    // builds; anything else is a genuine trap.
    if (err && typeof err.code === "number") {
      exitCode = err.code;
    } else {
      stderr.push(`[trap] ${err && err.message ? err.message : err}`);
      exitCode = 1;
    }
  }

  return { exitCode, stdout, stderr };
}

// ---------- The compile -> link -> run pipeline ----------

/**
 * Compiles a single Swift file to a WASI executable and runs it.
 *
 * Only the active file is compiled — the frontend's "primary file" model
 * needs one -frontend invocation *per* source file when there's more than
 * one (each emitting its own .o, all sharing type-checking context), which
 * this pipeline doesn't do. Cross-file editor projects aren't supported yet.
 *
 * @param {Record<string,string>} files workspace files (only `primaryFile`'s
 *   content is actually compiled; the rest are ignored for now)
 * @param {string} primaryFile the file to compile and run
 */
async function compileAndRun(files, primaryFile, log, onProgress) {
  const [frontendModule, linkerModule, sysroot] = await Promise.all([
    getFrontendModule(onProgress),
    getLinkerModule(onProgress),
    getSysroot(onProgress),
  ]);

  const build = new Directory(new Map());
  build.contents.set(primaryFile, new File(new TextEncoder().encode(files[primaryFile] ?? "")));

  const sysrootPreopen = () => new PreopenDirectory("/sysroot", sysroot.contents);
  const buildPreopen = () => new PreopenDirectory("/build", build.contents);

  // 1. swift-frontend: compile the source to an object file.
  log("compiling...");
  const frontendArgv = [
    "swift-frontend",
    "-frontend",
    "-c",
    `/build/${primaryFile}`,
    "-target",
    "wasm32-unknown-wasip1",
    "-disable-objc-interop",
    "-sdk",
    "/sysroot/wasi-sysroot",
    "-resource-dir",
    "/sysroot/swift/lib/swift_static",
    "-use-static-resource-dir",
    "-no-color-diagnostics",
    "-empty-abi-descriptor",
    // The Clang modules the stdlib depends on (SwiftShims, wasi-libc's own
    // modules) aren't prebuilt, so ask ClangImporter to build them itself,
    // into a scratch dir under our writable /build preopen.
    "-Xcc",
    "-fimplicit-module-maps",
    "-Xcc",
    "-fmodules-cache-path=/build/module-cache",
    "-module-name",
    "main",
    "-o",
    "/build/main.o",
  ];

  const frontendResult = await runWasiCommand(frontendModule, frontendArgv, [sysrootPreopen(), buildPreopen()]);
  if (frontendResult.exitCode !== 0 || !build.contents.has("main.o")) {
    return {
      stage: "compile",
      ok: false,
      diagnostics: frontendResult.stderr,
      stdout: frontendResult.stdout,
    };
  }

  // 2. wasm-ld: link the object file against the wasm32-wasip1 stdlib.
  log("linking...");
  const linkerArgv = [
    "wasm-ld",
    "-m",
    "wasm32",
    "-L/sysroot/swift/lib/swift_static/wasi",
    "-L/sysroot/wasi-sysroot/lib/wasm32-wasip1",
    "/sysroot/wasi-sysroot/lib/wasm32-wasip1/crt1-command.o",
    "/sysroot/swift/lib/swift_static/wasi/wasm32/swiftrt.o",
    "/build/main.o",
    "-lswiftSwiftOnoneSupport",
    "-lswiftCore",
    "-lswift_Concurrency",
    "-lswift_StringProcessing",
    "-lswift_RegexParser",
    "-ldl",
    "-lc++",
    "-lc++abi",
    "-lm",
    "-lwasi-emulated-mman",
    "-lwasi-emulated-signal",
    "-lwasi-emulated-process-clocks",
    "--error-limit=0",
    "--threads=1",
    "--global-base=4096",
    "--table-base=4096",
    "-z",
    "stack-size=131072",
    "-lc",
    "/sysroot/swift/lib/swift_static/clang/lib/wasip1/libclang_rt.builtins-wasm32.a",
    "-o",
    "/build/program.wasm",
  ];

  const linkResult = await runWasiCommand(linkerModule, linkerArgv, [sysrootPreopen(), buildPreopen()]);
  const programFile = build.contents.get("program.wasm");
  if (linkResult.exitCode !== 0 || !(programFile instanceof File)) {
    return {
      stage: "link",
      ok: false,
      diagnostics: linkResult.stderr,
      stdout: linkResult.stdout,
    };
  }

  // 3. Run the freshly linked program itself.
  log("running...");
  const programModule = await WebAssembly.compile(programFile.data);
  const runResult = await runWasiCommand(programModule, ["program"], []);

  return {
    stage: "run",
    ok: runResult.exitCode === 0,
    exitCode: runResult.exitCode,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    diagnostics: [...frontendResult.stderr, ...linkResult.stderr],
  };
}

/** Downloads + compiles the three toolchain artifacts so a later `compile` is instant. */
async function preloadToolchain(onProgress) {
  await Promise.all([getFrontendModule(onProgress), getLinkerModule(onProgress), getSysroot(onProgress)]);
}

// ---------- Message protocol ----------

self.onmessage = async (event) => {
  const { id, type } = event.data;

  if (type === "preload") {
    const onProgress = (loaded, total) => self.postMessage({ id, type: "preload-progress", loaded, total });
    try {
      await preloadToolchain(onProgress);
      self.postMessage({ id, type: "preload-done", ok: true });
    } catch (err) {
      self.postMessage({ id, type: "preload-done", ok: false, error: String((err && err.message) || err) });
    }
    return;
  }

  if (type !== "compile") return;

  const { files, primaryFile } = event.data;
  const log = (message) => self.postMessage({ id, type: "progress", message });
  const onProgress = (loaded, total) => self.postMessage({ id, type: "download-progress", loaded, total });

  try {
    const result = await compileAndRun(files, primaryFile, log, onProgress);
    self.postMessage({ id, type: "result", ...result });
  } catch (err) {
    self.postMessage({
      id,
      type: "result",
      ok: false,
      stage: "internal",
      diagnostics: [String((err && err.stack) || err)],
    });
  }
};
