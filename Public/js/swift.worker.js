// Worker host for the precompiled swift-toolchain-wasm artifacts
// (swift-frontend.wasm, wasm-ld.wasm, swift-ide-test.wasm) driven over WASI,
// with the sysroot mounted from a plain tar archive. See
// https://github.com/tothambrus11/swift-toolchain-wasm's docs/consuming.md
// for the argv this mirrors — there is no on-wasm driver, since WASI can't
// spawn processes, so the embedder replays swiftc's argv by hand.
//
// Runs in a Worker because compiling/linking these modules is slow enough to
// jank the main thread.

import { Directory, File, PreopenDirectory } from "https://esm.sh/@bjorn3/browser_wasi_shim@0.4.2";
import { untar } from "./tar.js";
import { runWasiCommand } from "./wasi-run.js";
import { bootOnce, fetchWithProgress, moduleLoader } from "./toolchain-assets.js";

const TOOLCHAIN_BASE = "/toolchain";

// ---------- Message protocol ----------
//
// Request: { id, type: "preload" }
//        | { id, type: "compile", files, primaryFile }
//        | { id, type: "complete", files, primaryFile, offset }
//
// Response, always echoing the request's `id`:
//   preload  -> "preload-progress" { loaded, total } * , then "preload-done" { ok, error? }
//   compile  -> "progress" { message } | "download-progress" { loaded, total } * ,
//               then "result" { ok, stage, diagnostics?, stdout?, stderr?, exitCode? }
//   complete -> "progress" { message } | "download-progress" { loaded, total } * ,
//               then "completion-result" { ok, items, diagnostics?, error? }

const post = (msg) => self.postMessage(msg);

// ---------- Toolchain artifacts: fetched + compiled once, then shared ----------

const getFrontendModule = moduleLoader(`${TOOLCHAIN_BASE}/swift-frontend.wasm`);
const getLinkerModule = moduleLoader(`${TOOLCHAIN_BASE}/wasm-ld.wasm`);

// swift-ide-test drives the same completion machinery SourceKit exposes to
// editors, as a standalone CLI. It's a separate ~150MB module from
// swift-frontend, so it's fetched lazily on the first completion request
// rather than as part of the Run preload.
const getIdeTestModule = moduleLoader(`${TOOLCHAIN_BASE}/swift-ide-test.wasm`);

const getSysroot = bootOnce(async (onProgress) => {
  const res = await fetchWithProgress(`${TOOLCHAIN_BASE}/swift-sysroot-core.tar`, onProgress);
  const buf = await res.arrayBuffer();
  return untar(buf);
});

/** Common `-frontend`-family flags shared by swift-frontend and swift-ide-test. */
function commonFrontendArgs() {
  return [
    "-target",
    "wasm32-unknown-wasip1",
    "-disable-objc-interop",
    "-sdk",
    "/sysroot/wasi-sysroot",
    "-resource-dir",
    "/sysroot/swift/lib/swift_static",
    // The Clang modules the stdlib depends on aren't prebuilt, so ask
    // ClangImporter to build them itself, into the shared /module-cache
    // preopen a SwiftCompiler mounts below.
    "-Xcc",
    "-fimplicit-module-maps",
    "-Xcc",
    "-fmodules-cache-path=/module-cache",
    "-module-name",
    "main",
  ];
}

// ---------- Boot: assemble the downloaded artifacts into a SwiftCompiler ----------

/**
 * One boot, whoever asks.
 *
 * The promise is what's shared, not its result: a second request arriving
 * before instantiation finished would otherwise start a second download and
 * compile of ~350MB of WebAssembly.
 */
let booting = null;
const boot = (onProgress) => (booting ??= instantiate(onProgress));

/** The instance `booting` resolved to, while it's still fit to be asked. */
let live = null;

/**
 * Throws `compiler` away, so the next request rebuilds a fresh instance.
 *
 * Called when a request against `compiler` throws rather than merely
 * returning a failing result — `runWasiCommand` already turns the ordinary
 * case (the user's program errors or fails to compile) into a nonzero exit
 * code, so anything that reaches here as a thrown value means something
 * about the *instance* broke. The one piece of state a SwiftCompiler carries
 * between requests is its ClangImporter module cache, and a broken instance
 * is exactly what a corrupt cache would look like: rebuilding costs the
 * multi-second module-cache warmup again, which is the right price for not
 * answering every request after it out of a poisoned cache.
 *
 * Does nothing if `compiler` is not the current instance, so two requests
 * failing together discard one instance rather than two.
 */
function discard(compiler) {
  if (live !== compiler) return;
  live = null;
  booting = null;
}

/**
 * Downloads the toolchain and assembles it into a `SwiftCompiler`.
 *
 * Call through `boot`, never directly.
 */
async function instantiate(onProgress) {
  const [frontendModule, linkerModule, sysroot] = await Promise.all([
    getFrontendModule(onProgress),
    getLinkerModule(onProgress),
    getSysroot(onProgress),
  ]);

  /**
   * The Clang module cache (SwiftShims, wasi-libc's own modules) that
   * ClangImporter builds on first use. It depends only on the sysroot and
   * target — never on user source — so it's mounted from one Directory kept
   * for the life of this compiler instance and shared by every request
   * against it, rather than rebuilt from scratch (a multi-second cost) on
   * every keystroke's completion request.
   */
  const moduleCache = new Directory(new Map());

  const sysrootPreopen = () => new PreopenDirectory("/sysroot", sysroot.contents);
  const moduleCachePreopen = () => new PreopenDirectory("/module-cache", moduleCache.contents);

  /** @type {SwiftCompiler} */
  const compiler = {
    compileAndRun: async (files, primaryFile, log) => {
      try {
        return await compileAndRun(frontendModule, linkerModule, sysrootPreopen, moduleCachePreopen, files, primaryFile, log);
      } catch (e) {
        discard(compiler);
        throw e;
      }
    },
    complete: async (files, primaryFile, offset, log, onIdeTestProgress) => {
      try {
        const ideTestModule = await getIdeTestModule(onIdeTestProgress);
        return await completeAt(ideTestModule, sysrootPreopen, moduleCachePreopen, files, primaryFile, offset, log);
      } catch (e) {
        discard(compiler);
        throw e;
      }
    },
  };
  live = compiler;
  return compiler;
}

// ---------- Multi-file workspaces ----------

/**
 * Maps a workspace's `files` onto the on-disk names swift-frontend and
 * swift-ide-test will see, choosing which one is the module's entry point.
 *
 * Swift only allows top-level statements (a bare `print(...)`, etc.) in a
 * module made of more than one file when the file holding them is literally
 * named `main.swift`; a single-file module has no such restriction. Rather
 * than requiring every workspace to have a tab named exactly that, the
 * *active* tab — `primaryFile`, the one Run and completion both already
 * operate against — is always what ends up on disk as `main.swift` once
 * there's more than one file. It's the least surprising rule available:
 * "the file you're looking at is the entry point."
 *
 * Returns `{ error }` instead when some other tab is *also* literally named
 * `main.swift` while it isn't the active one — on-disk paths are unique, so
 * writing both under `main.swift` would silently discard one.
 *
 * @param {Record<string,string>} files workspace files, keyed by tab name
 * @param {string} primaryFile the active tab; the module's entry point
 * @returns {{diskFiles: Map<string,string>, entryName: string} | {error: string}}
 */
function layoutInputs(files, primaryFile) {
  const names = Object.keys(files);
  const entryName = names.length > 1 && primaryFile !== "main.swift" ? "main.swift" : primaryFile;

  if (entryName !== primaryFile && names.includes(entryName)) {
    return {
      error:
        `'main.swift' is reserved for whichever file is active when a workspace has more than one file, ` +
        `but '${entryName}' isn't active right now. Rename it or switch to it before running.`,
    };
  }

  const diskFiles = new Map();
  for (const name of names) {
    diskFiles.set(name === primaryFile ? entryName : name, files[name] ?? "");
  }
  return { diskFiles, entryName };
}

// ---------- The compile -> link -> run pipeline ----------

/**
 * Compiles every file in the workspace as one module (whole-module
 * optimization is implicit whenever swift-frontend is given more than one
 * input and no `-primary-file`) and runs the result.
 *
 * @param {Record<string,string>} files every workspace file, keyed by tab name
 * @param {string} primaryFile the active tab; see `layoutInputs`
 */
async function compileAndRun(frontendModule, linkerModule, sysrootPreopen, moduleCachePreopen, files, primaryFile, log) {
  const layout = layoutInputs(files, primaryFile);
  if ("error" in layout) {
    return { stage: "compile", ok: false, diagnostics: [layout.error], stdout: [] };
  }
  const { diskFiles } = layout;

  const build = new Directory(new Map());
  for (const [name, content] of diskFiles) {
    build.contents.set(name, new File(new TextEncoder().encode(content)));
  }
  const buildPreopen = () => new PreopenDirectory("/build", build.contents);

  // 1. swift-frontend: compile every file, together, to one object file.
  log("compiling...");
  const frontendArgv = (extraArgs) => [
    "swift-frontend",
    "-frontend",
    "-c",
    ...[...diskFiles.keys()].map((name) => `/build/${name}`),
    ...commonFrontendArgs(),
    ...extraArgs,
    "-use-static-resource-dir",
    "-no-color-diagnostics",
    "-empty-abi-descriptor",
    "-o",
    "/build/main.o",
  ];

  let frontendResult = await runWasiCommand(frontendModule, frontendArgv([]), [
    sysrootPreopen(),
    moduleCachePreopen(),
    buildPreopen(),
  ]);

  // An `@main`-attributed entry point and bare top-level statements
  // (`print(...)` outside any declaration) are mutually exclusive per
  // invocation: the latter is only legal in a file the frontend treats as
  // eligible for top-level code — which `-parse-as-library` turns off, and
  // whose absence is what makes `@main` legal in the first place. Since which
  // style a given workspace uses isn't known up front, the default (no flag)
  // attempt is tried first, and this specific diagnostic — the only symptom
  // an `@main` type produces under it — is what triggers the one retry with
  // `-parse-as-library` added, rather than compiling twice unconditionally.
  if (frontendResult.stderr.some((line) => line.includes("cannot be used in a module that contains top-level code"))) {
    build.contents.delete("main.o");
    frontendResult = await runWasiCommand(frontendModule, frontendArgv(["-parse-as-library"]), [
      sysrootPreopen(),
      moduleCachePreopen(),
      buildPreopen(),
    ]);
  }

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

// ---------- Code completion via swift-ide-test ----------

const COMPLETION_TOKEN = "COMPLETE";

// Maps a "Decl[InstanceMethod]", "Keyword[func]", "Pattern/Local", etc. kind
// tag (see CodeCompletionResult::printPrefix in the Swift compiler) to a
// coarse CodeMirror-style completion type, used for icons/filtering.
function completionKindFor(tag) {
  if (tag.startsWith("Keyword")) return "keyword";
  if (tag.startsWith("Decl[Module]")) return "namespace";
  if (/\[(Class|Actor)\]/.test(tag)) return "class";
  if (/\[(Struct|Enum|Protocol|TypeAlias|AssociatedType|GenericTypeParam)\]/.test(tag)) return "type";
  if (tag.includes("[EnumElement]")) return "enum";
  if (/\[(InstanceMethod|StaticMethod|FreeFunction|Constructor|Destructor|.*OperatorFunction)\]/.test(tag))
    return "function";
  if (/\[(InstanceVar|StaticVar|LocalVar|GlobalVar)\]/.test(tag)) return "variable";
  return "text";
}

// Turns a completion string like "foo([#(x): Int#])[#Void#]" into readable
// text by dropping swift-ide-test's placeholder/result-type delimiters
// ("[#" ... "#]"), giving "foo((x): Int)Void".
function stripCompletionMarkup(text) {
  return text.replace(/\[#/g, "").replace(/#\]/g, "");
}

/**
 * Parses swift-ide-test's `-code-completion` stdout. Each result line looks
 * like:
 *   Decl[InstanceMethod]/CurrModule:   foo([#(x): Int#])[#Void#]; name=foo(:)
 * padded so the description starts at column 36 (see
 * CodeCompletionResult::printPrefix). The description block runs up to the
 * first "; name=" field, which is always emitted (and always last, since
 * comments/sourcetext aren't requested here).
 */
function parseCompletionResults(stdoutLines) {
  const text = stdoutLines.join("\n");
  const beginIdx = text.indexOf("Begin completions");
  if (beginIdx === -1) return [];
  const endIdx = text.indexOf("End completions", beginIdx);
  const block = text.slice(beginIdx, endIdx === -1 ? undefined : endIdx);

  const items = [];
  const seen = new Set();
  for (const line of block.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const sepIdx = line.indexOf(": ");
    if (sepIdx === -1) continue;
    const tag = line.slice(0, sepIdx);
    const rest = line.slice(sepIdx + 2).replace(/^ +/, "");
    const nameIdx = rest.lastIndexOf("; name=");
    const completionText = nameIdx === -1 ? rest : rest.slice(0, nameIdx);
    const name = nameIdx === -1 ? completionText : rest.slice(nameIdx + "; name=".length).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    items.push({
      label: name,
      detail: stripCompletionMarkup(completionText),
      kind: completionKindFor(tag),
    });
  }
  return items;
}

/**
 * Runs swift-ide-test's `-code-completion` at `offset` (a UTF-8 byte offset
 * into `files[primaryFile]`), with every other workspace file loaded
 * alongside it so completion sees declarations from the whole module, and
 * returns the parsed completion list.
 *
 * @param {Record<string,string>} files every workspace file, keyed by tab name
 * @param {string} primaryFile the file `offset` is measured into; see `layoutInputs`
 */
async function completeAt(ideTestModule, sysrootPreopen, moduleCachePreopen, files, primaryFile, offset, log) {
  const layout = layoutInputs(files, primaryFile);
  if ("error" in layout) {
    return { items: [], diagnostics: [layout.error] };
  }
  const { diskFiles, entryName } = layout;

  const source = files[primaryFile] ?? "";
  const bytes = new TextEncoder().encode(source);
  const clampedOffset = Math.max(0, Math.min(offset, bytes.length));
  const withToken =
    new TextDecoder().decode(bytes.subarray(0, clampedOffset)) +
    `#^${COMPLETION_TOKEN}^#` +
    new TextDecoder().decode(bytes.subarray(clampedOffset));

  const build = new Directory(new Map());
  for (const [name, content] of diskFiles) {
    build.contents.set(name, new File(new TextEncoder().encode(name === entryName ? withToken : content)));
  }
  const buildPreopen = () => new PreopenDirectory("/build", build.contents);

  log("completing...");
  // -source-filename is the file the token lives in; the rest of the module
  // is given positionally so declarations in other files are in scope too.
  const otherFiles = [...diskFiles.keys()].filter((name) => name !== entryName);
  const argv = [
    "swift-ide-test",
    "-code-completion",
    "-source-filename",
    `/build/${entryName}`,
    `-code-completion-token=${COMPLETION_TOKEN}`,
    ...otherFiles.map((name) => `/build/${name}`),
    ...commonFrontendArgs(),
  ];

  const result = await runWasiCommand(ideTestModule, argv, [sysrootPreopen(), moduleCachePreopen(), buildPreopen()]);
  return { items: parseCompletionResults(result.stdout), diagnostics: result.stderr };
}

// ---------- Request dispatch ----------

const handlers = {
  async preload(msg) {
    const onProgress = (loaded, total) => post({ id: msg.id, type: "preload-progress", loaded, total });
    try {
      await boot(onProgress);
      post({ id: msg.id, type: "preload-done", ok: true });
    } catch (err) {
      post({ id: msg.id, type: "preload-done", ok: false, error: String((err && err.message) || err) });
    }
  },

  async complete(msg) {
    const { files, primaryFile, offset } = msg;
    const log = (message) => post({ id: msg.id, type: "progress", message });
    const onProgress = (loaded, total) => post({ id: msg.id, type: "download-progress", loaded, total });
    try {
      const compiler = await boot(onProgress);
      const { items, diagnostics } = await compiler.complete(files, primaryFile, offset, log, onProgress);
      post({ id: msg.id, type: "completion-result", ok: true, items, diagnostics });
    } catch (err) {
      post({
        id: msg.id,
        type: "completion-result",
        ok: false,
        items: [],
        error: String((err && err.stack) || err),
      });
    }
  },

  async compile(msg) {
    const { files, primaryFile } = msg;
    const log = (message) => post({ id: msg.id, type: "progress", message });
    const onProgress = (loaded, total) => post({ id: msg.id, type: "download-progress", loaded, total });
    try {
      const compiler = await boot(onProgress);
      const result = await compiler.compileAndRun(files, primaryFile, log);
      post({ id: msg.id, type: "result", ...result });
    } catch (err) {
      post({
        id: msg.id,
        type: "result",
        ok: false,
        stage: "internal",
        diagnostics: [String((err && err.stack) || err)],
      });
    }
  },
};

self.onmessage = (event) => {
  const handler = handlers[event.data.type];
  if (handler) void handler(event.data);
};
