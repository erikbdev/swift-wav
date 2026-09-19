// Worker host for the precompiled swift-toolchain-wasm artifacts
// (swift-frontend.wasm, wasm-ld.wasm, swift-ide-test.wasm) driven over WASI,
// with the sysroot mounted from a plain tar archive. See
// https://github.com/tothambrus11/swift-toolchain-wasm's docs/consuming.md
// for the argv this mirrors — there is no on-wasm driver, since WASI can't
// spawn processes, so the embedder replays swiftc's argv by hand.
//
// Also owns fetching those artifacts in the first place (with cumulative
// download progress and once-only memoization) — nothing outside this file
// needs any of that, so it isn't split into a separate module.
//
// Runs in a Worker because compiling/linking these modules is slow enough to
// jank the main thread.

import { Directory, File, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import { untar } from "./tar";
import { runWasiCommand } from "./wasi-run";
import { memoize } from "../utils/memoize";

export type SourceFiles = Record<string, string>;

export type CompilerResult = {
  stage?: string;
  diagnostics?: string[];
  stdout?: string[];
  stderr?: string[];
  exitCode?: number;
  error?: unknown;
};

export type CompletionItem = {
  label: string;
  detail: string;
  kind: string;
};

export type WorkerRequest =
  | { id: number; type: "preload" }
  | { id: number; type: "compile"; files: SourceFiles; primaryFile: string }
  | { id: number; type: "complete"; files: SourceFiles; primaryFile: string; offset: number };

export type WorkerResponse =
  | { id: number; type: "preload"; progress?: number; error?: unknown }
  | ({ id: number; type: "compile" } & CompilerResult)
  | {
      id: number;
      type: "complete";
      items?: CompletionItem[];
      diagnostics?: string[];
      error?: unknown;
    };

/** The terminal response `type` a given request `type` resolves with. */
export type ResultTypeFor<T extends WorkerRequest["type"]> = T extends "preload" ? "preload" : T extends "compile" ? "compile" : "complete";

interface CompletionResult {
  items: CompletionItem[];
  diagnostics: string[];
}

interface SwiftCompiler {
  compileAndRun: (files: SourceFiles, primaryFile: string, log: (message: string) => void) => Promise<CompilerResult>;
  complete: (files: SourceFiles, primaryFile: string, offset: number, log: (message: string) => void, onIdeTestProgress?: (loaded: number, total: number) => void) => Promise<CompletionResult>;
}

const TOOLCHAIN_BASE = "/toolchain";

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

// ---------- Fetching toolchain assets ----------

const downloadProgress = new Map<string, { loaded: number; total: number }>();

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
async function fetchWithProgress(url: string, contentType?: string): Promise<Response> {
  const reportProgress = () => {
    let loaded = 0;
    let total = 0;
    for (const entry of downloadProgress.values()) {
      loaded += entry.loaded;
      total += entry.total;
    }
    post({ id: -1, type: "preload", progress: loaded / total });
  };

  downloadProgress.set(url, { loaded: 0, total: 0 });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetching ${url} failed: ${res.status}`);
  const total = res.headers.has("content-encoding") ? 0 : Number(res.headers.get("content-length")) || 0;
  downloadProgress.set(url, { loaded: 0, total });
  reportProgress();
  if (!res.body) throw new Error(`fetching ${url} returned an empty body`);

  const reader = res.body.getReader();
  const trackedStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const progress = downloadProgress.get(url);
      if (progress) progress.loaded += value.byteLength;
      reportProgress();
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(trackedStream, contentType ? { headers: { "Content-Type": contentType } } : undefined);
}

// ---------- Toolchain artifacts: fetched + compiled once, then shared ----------

const frontendModule = memoize(() => WebAssembly.compileStreaming(fetchWithProgress(`${TOOLCHAIN_BASE}/swift-frontend.wasm`)));
const linkerModule = memoize(() => WebAssembly.compileStreaming(fetchWithProgress(`${TOOLCHAIN_BASE}/wasm-ld.wasm`)));
const ideTestModule = memoize(() => WebAssembly.compileStreaming(fetchWithProgress(`${TOOLCHAIN_BASE}/swift-ide-test.wasm`)));
const sysrootModule = memoize(() =>
  fetchWithProgress(`${TOOLCHAIN_BASE}/swift-sysroot-core.tar`)
    .then((r) => r.arrayBuffer())
    .then(untar),
);

/** Common `-frontend`-family flags shared by swift-frontend and swift-ide-test. */
function commonFrontendArgs(): string[] {
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

// ---------- Multi-file workspaces ----------

type Layout = { diskFiles: Map<string, string>; entryName: string } | { error: string };

/**
 * Maps a workspace's `files` onto the on-disk names swift-frontend and
 * swift-ide-test will see, choosing which one is the module's entry point.
 *
 * Swift only allows top-level statements (a bare `print(...)`, etc.) in
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
 * @param files workspace files, keyed by tab name
 * @param primaryFile the active tab; the module's entry point
 */
function layoutInputs(files: SourceFiles, primaryFile: string): Layout {
  const names = Object.keys(files);
  const entryName = names.length > 1 && primaryFile !== "main.swift" ? "main.swift" : primaryFile;

  if (entryName !== primaryFile && names.includes(entryName)) {
    return {
      error: `'main.swift' is reserved for whichever file is active when a workspace has more than one file, ` + `but '${entryName}' isn't active right now. Rename it or switch to it before running.`,
    };
  }

  const diskFiles = new Map<string, string>();
  for (const name of names) {
    diskFiles.set(name === primaryFile ? entryName : name, files[name] ?? "");
  }
  return { diskFiles, entryName };
}

// ---------- Code completion parsing ----------

const COMPLETION_TOKEN = "COMPLETE";

/**
 * Parses swift-ide-test's `-code-completion` stdout. Each result line looks
 * like:
 *   Decl[InstanceMethod]/CurrModule:   foo([#(x): Int#])[#Void#]; name=foo(:)
 * padded so the description starts at column 36 (see
 * CodeCompletionResult::printPrefix). The description block runs up to the
 * first "; name=" field, which is always emitted (and always last, since
 * comments/sourcetext aren't requested here).
 */
function parseCompletionResults(stdoutLines: string[]): CompletionItem[] {
  // Maps a "Decl[InstanceMethod]", "Keyword[func]", "Pattern/Local", etc.
  // kind tag (see CodeCompletionResult::printPrefix in the Swift compiler)
  // to a coarse CodeMirror-style completion type, used for icons/filtering.
  function completionKindFor(tag: string): string {
    if (tag.startsWith("Keyword")) return "keyword";
    if (tag.startsWith("Decl[Module]")) return "namespace";
    if (/\[(Class|Actor)\]/.test(tag)) return "class";
    if (/\[(Struct|Enum|Protocol|TypeAlias|AssociatedType|GenericTypeParam)\]/.test(tag)) return "type";
    if (tag.includes("[EnumElement]")) return "enum";
    if (/\[(InstanceMethod|StaticMethod|FreeFunction|Constructor|Destructor|.*OperatorFunction)\]/.test(tag)) return "function";
    if (/\[(InstanceVar|StaticVar|LocalVar|GlobalVar)\]/.test(tag)) return "variable";
    return "text";
  }

  // Turns a completion string like "foo([#(x): Int#])[#Void#]" into readable
  // text by dropping swift-ide-test's placeholder/result-type delimiters
  // ("[#" ... "#]"), giving "foo((x): Int)Void".
  function stripCompletionMarkup(text: string): string {
    return text.replace(/\[#/g, "").replace(/#\]/g, "");
  }

  const text = stdoutLines.join("\n");
  const beginIdx = text.indexOf("Begin completions");
  if (beginIdx === -1) return [];
  const endIdx = text.indexOf("End completions", beginIdx);
  const block = text.slice(beginIdx, endIdx === -1 ? undefined : endIdx);

  const items: CompletionItem[] = [];
  const seen = new Set<string>();
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

// ---------- Boot: assemble the downloaded artifacts into a SwiftCompiler ----------
// const compiler = /

/**
 * One boot, whoever asks — this runs once, and every request shares its
 * promise (or its settled instance) instead of repeating a ~350MB download
 * and compile.
 *
 * `discard` additionally lets a request evict a *resolved* instance mid-life:
 * called when a request against it throws rather than merely returning a
 * failing result — `runWasiCommand` already turns the ordinary case (the
 * user's program errors or fails to compile) into a nonzero exit code, so
 * anything that reaches here as a thrown value means something about the
 * instance itself broke. The one piece of state a SwiftCompiler carries
 * between requests is its ClangImporter module cache, and a broken instance
 * is exactly what a corrupt cache would look like: rebuilding costs the
 * multi-second module-cache warmup again, which is the right price for not
 * answering every request after it out of a poisoned cache.
 */
const swiftCompiler = memoize(async (): Promise<SwiftCompiler> => {
  const [frontend, linker, sysroot] = await Promise.all([frontendModule(), linkerModule(), sysrootModule()]);

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

  return {
    // Compiles every file in the workspace as one module (whole-module
    // optimization is implicit whenever swift-frontend is given more than
    // one input and no `-primary-file`) and runs the result.
    compileAndRun: async (files, primaryFile, log) => {
      try {
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
        const frontendArgv = (extraArgs: string[]) => [
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

        let frontendResult = await runWasiCommand(frontend, frontendArgv([]), [sysrootPreopen(), moduleCachePreopen(), buildPreopen()]);

        // An `@main`-attributed entry point and bare top-level statements
        // (`print(...)` outside any declaration) are mutually exclusive per
        // invocation: the latter is only legal in a file the frontend treats
        // as eligible for top-level code — which `-parse-as-library` turns
        // off, and whose absence is what makes `@main` legal in the first
        // place. Since which style a given workspace uses isn't known up
        // front, the default (no flag) attempt is tried first, and this
        // specific diagnostic — the only symptom an `@main` type produces
        // under it — is what triggers the one retry with `-parse-as-library`
        // added, rather than compiling twice unconditionally.
        if (frontendResult.stderr.some((line) => line.includes("cannot be used in a module that contains top-level code"))) {
          build.contents.delete("main.o");
          frontendResult = await runWasiCommand(frontend, frontendArgv(["-parse-as-library"]), [sysrootPreopen(), moduleCachePreopen(), buildPreopen()]);
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

        const linkResult = await runWasiCommand(linker, linkerArgv, [sysrootPreopen(), buildPreopen()]);
        const programFile = build.contents.get("program.wasm");
        if (linkResult.exitCode !== 0 || !(programFile instanceof File)) {
          return {
            stage: "link",
            exitCode: linkResult.exitCode,
            diagnostics: linkResult.stderr,
            stdout: linkResult.stdout,
            stderr: linkResult.stderr,
          };
        }

        // 3. Run the freshly linked program itself.
        log("running...");
        const programModule = await WebAssembly.compile(programFile.data as BufferSource);
        const runResult = await runWasiCommand(programModule, ["program"], []);

        return {
          stage: "run",
          exitCode: runResult.exitCode,
          stdout: runResult.stdout,
          stderr: runResult.stderr,
          diagnostics: [...frontendResult.stderr, ...linkResult.stderr],
        };
      } catch (e) {
        swiftCompiler.discard();
        throw e;
      }
    },

    // Runs swift-ide-test's `-code-completion` at `offset` (a UTF-8 byte
    // offset into `files[primaryFile]`), with every other workspace file
    // loaded alongside it so completion sees declarations from the whole
    // module, and returns the parsed completion list.
    complete: async (files, primaryFile, offset, log, onIdeTestProgress) => {
      try {
        const ideTest = await ideTestModule();

        const layout = layoutInputs(files, primaryFile);
        if ("error" in layout) {
          return { items: [], diagnostics: [layout.error] };
        }
        const { diskFiles, entryName } = layout;

        const source = files[primaryFile] ?? "";
        const bytes = new TextEncoder().encode(source);
        const clampedOffset = Math.max(0, Math.min(offset, bytes.length));
        const withToken = new TextDecoder().decode(bytes.subarray(0, clampedOffset)) + `#^${COMPLETION_TOKEN}^#` + new TextDecoder().decode(bytes.subarray(clampedOffset));

        const build = new Directory(new Map());
        for (const [name, content] of diskFiles) {
          build.contents.set(name, new File(new TextEncoder().encode(name === entryName ? withToken : content)));
        }
        const buildPreopen = () => new PreopenDirectory("/build", build.contents);

        log("completing...");
        // -source-filename is the file the token lives in; the rest of the
        // module is given positionally so declarations in other files are
        // in scope too.
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

        const result = await runWasiCommand(ideTest, argv, [sysrootPreopen(), moduleCachePreopen(), buildPreopen()]);
        return { items: parseCompletionResults(result.stdout), diagnostics: result.stderr };
      } catch (e) {
        swiftCompiler.discard();
        throw e;
      }
    },
  } satisfies SwiftCompiler;
});

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case "preload": {
      try {
        await swiftCompiler();
        post({ id: msg.id, type: msg.type, progress: 1.0 });
      } catch (e) {
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    case "complete": {
      try {
        const compiler = await swiftCompiler();
        const { items, diagnostics } = await compiler.complete(
          msg.files,
          msg.primaryFile,
          msg.offset,
          () => {},
          () => {},
        );
        post({ id: msg.id, type: msg.type, items, diagnostics });
      } catch (e) {
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    case "compile": {
      try {
        const compiler = await swiftCompiler();
        const result = await compiler.compileAndRun(msg.files, msg.primaryFile, () => {});
        post({ id: msg.id, type: msg.type, ...result });
      } catch (e) {
        post({
          id: msg.id,
          type: msg.type,
          error: e,
        });
      }
      break;
    }

    default:
      msg satisfies never;
  }
});
