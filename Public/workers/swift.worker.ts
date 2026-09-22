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

export type CompletionItem = {
  label: string;
  detail: string;
  kind: string;
};

export type Diagnostic = {
  file: string | null;
  line: number | null;
  column: number | null;
  severity: "error" | "warning" | "note";
  message: string;
};

export type WorkerRequest =
  | { id: number; type: "preload" }
  | { id: number; type: "compile"; files: SourceFiles; primaryFile: string }
  | { id: number; type: "complete"; files: SourceFiles; primaryFile: string; offset: number };

export type WorkerResponse =
  | { id: number; type: "preload"; progress?: number; error?: unknown }
  | { id: number; type: "compile"; stage?: string; stdout?: string[]; diagnostics?: Diagnostic[]; exitCode?: number; error?: unknown }
  | { id: number; type: "complete"; items?: CompletionItem[]; diagnostics?: Diagnostic[]; error?: unknown };

/** The terminal response `type` a given request `type` resolves with. */
export type ResultTypeFor<T extends WorkerRequest["type"]> = T extends "preload" ? "preload" : T extends "compile" ? "compile" : "complete";

const TOOLCHAIN_BASE = "/toolchain";

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

// ---------- Fetching toolchain assets ----------

const TOOLCHAIN_ASSET_COUNT = 4;
const DOWNLOAD_PROGRESS_WEIGHT = 0.8;
const SETUP_PROGRESS = 0.95;
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
          post({
            id: -1,
            type: "preload",
            progress: Math.min(
              (completedDownloads.size / TOOLCHAIN_ASSET_COUNT) * DOWNLOAD_PROGRESS_WEIGHT,
              DOWNLOAD_PROGRESS_WEIGHT,
            ),
          });
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

// ---------- Toolchain artifacts: fetched + compiled once, then shared ----------

const frontendModule = memoize(() => WebAssembly.compileStreaming(fetchWithProgress(`${TOOLCHAIN_BASE}/swift-frontend.wasm`, "application/wasm")));
const linkerModule = memoize(() => WebAssembly.compileStreaming(fetchWithProgress(`${TOOLCHAIN_BASE}/wasm-ld.wasm`, "application/wasm")));
const ideTestModule = memoize(() => WebAssembly.compileStreaming(fetchWithProgress(`${TOOLCHAIN_BASE}/swift-ide-test.wasm`, "application/wasm")));
const sysrootModule = memoize(() =>
  fetchWithProgress(`${TOOLCHAIN_BASE}/swift-sysroot-core.tar`)
    .then((r) => r.arrayBuffer())
    .then(untar),
);

/** Common `-frontend`-family flags shared by swift-frontend and swift-ide-test. */
const commonFrontendArgs = [
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

// ---------- Diagnostic parsing ----------

// Matches swift-frontend/clang-style diagnostic lines, e.g.:
//   /build/main.swift:5:3: error: unknown type name 'uint3d_t'
const DIAGNOSTIC_LINE = /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.*)$/;

/**
 * Parses a tool's raw stderr lines into structured diagnostics. Lines that
 * open a new `file:line:col: severity: message` diagnostic start a fresh
 * entry (including "note:" follow-ups, which surface as their own
 * diagnostic); any other line (source snippet, caret, fix-it) is folded into
 * the message of whichever diagnostic precedes it. Falls back to a single
 * error diagnostic carrying the whole blob when nothing matches the format,
 * since tools like wasm-ld don't emit file:line:col diagnostics.
 */
function parseDiagnostics(lines: string[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const rawLine of lines) {
    const match = rawLine.match(DIAGNOSTIC_LINE);
    if (match) {
      const [, file, line, column, severity, message] = match;
      diagnostics.push({
        file: file.replace(/^\/build\//, ""),
        line: Number(line),
        column: Number(column),
        severity: severity as Diagnostic["severity"],
        message,
      });
      continue;
    }

    const current = diagnostics.at(-1);
    if (current && rawLine.trim()) current.message += `\n${rawLine}`;
  }

  if (!diagnostics.length && lines.some((line) => line.trim())) {
    diagnostics.push({
      file: null,
      line: null,
      column: null,
      severity: "error",
      message: lines.join("\n"),
    });
  }

  return diagnostics;
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

const swiftCompiler = memoize(async () => {
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
    async run(files: SourceFiles) {
      try {
        const buildDir = new Map();
        for (const [name, content] of Object.entries(files)) {
          buildDir.set(name, new File(new TextEncoder().encode(content)));
        }

        const buildPreopen = () => new PreopenDirectory("/build", buildDir);

        let frontendResult = await runWasiCommand(
          frontend,
          [
            "swift-frontend",
            "-frontend",
            "-c",
            ...(Object.keys(files).includes("main.swift") ? [] : ["-parse-as-library"]),
            ...commonFrontendArgs,
            "-use-static-resource-dir",
            "-no-color-diagnostics",
            "-empty-abi-descriptor",
            ...[...buildDir.keys()].map((n) => `/build/${n}`),
            "-o",
            "/build/main.o",
          ],
          [sysrootPreopen(), moduleCachePreopen(), buildPreopen()],
        );
        console.log("[swift-frontend] stdout:", frontendResult.stdout, "stderr:", frontendResult.stderr);

        if (frontendResult.exitCode !== 0) {
          return {
            stage: "frontend",
            exitCode: frontendResult.exitCode,
            diagnostics: parseDiagnostics(frontendResult.stderr),
          };
        }

        // The frontend can still emit warnings/notes on success; carry them
        // through so a clean compile doesn't silently drop them.
        const frontendDiagnostics = parseDiagnostics(frontendResult.stderr);

        // 2. wasm-ld: link the object file against the wasm32-wasip1 stdlib
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
          "/build/main.wasm",
        ];

        const linkResult = await runWasiCommand(linker, linkerArgv, [sysrootPreopen(), buildPreopen()]);
        console.log("[wasm-ld] stdout:", linkResult.stdout, "stderr:", linkResult.stderr);
        const programFile = buildDir.get("main.wasm");
        if (linkResult.exitCode !== 0 || !(programFile instanceof File)) {
          return {
            stage: "linker",
            exitCode: linkResult.exitCode,
            diagnostics: [...frontendDiagnostics, ...parseDiagnostics(linkResult.stderr)],
          };
        }

        // 3. Run the freshly linked program itself. Its stdout is the
        // program's own output, not a diagnostic; its stderr only becomes a
        // diagnostic when the run actually fails (a trap or non-zero exit),
        // since a well-behaved program is free to write to stderr as output.
        const programModule = await WebAssembly.compile(programFile.data as BufferSource);
        const runResult = await runWasiCommand(programModule, ["main"], []);
        console.log("[program] stdout:", runResult.stdout, "stderr: ", runResult.stderr);

        return {
          stage: "run",
          exitCode: runResult.exitCode,
          stdout: runResult.stdout,
          diagnostics: runResult.exitCode === 0 ? frontendDiagnostics : [...frontendDiagnostics, ...parseDiagnostics(runResult.stderr)],
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
    async autocomplete(files: SourceFiles, activeFile: string, offset: number) {
      try {
        const ideTest = await ideTestModule();

        const buildDir = new Map();
        for (let [name, content] of Object.entries(files)) {
          if (name === activeFile) {
            const bytes = new TextEncoder().encode(content);
            const clampedOffset = Math.max(0, Math.min(offset, bytes.length));
            content = new TextDecoder().decode(bytes.subarray(0, clampedOffset)) + `#^${COMPLETION_TOKEN}^#` + new TextDecoder().decode(bytes.subarray(clampedOffset));
          }
          buildDir.set(name, new File(new TextEncoder().encode(content)));
        }

        const buildPreopen = () => new PreopenDirectory("/build", buildDir);

        // -source-filename is the file the token lives in; the rest of the
        // module is given positionally so declarations in other files are
        // in scope too.
        const argv = [
          "swift-ide-test",
          "-code-completion",
          "-source-filename",
          `/build/${activeFile}`,
          `-code-completion-token=${COMPLETION_TOKEN}`,
          ...[...buildDir.keys()].flatMap((n) => (n === activeFile ? [] : [`/build/${n}`])),
          ...commonFrontendArgs,
        ];

        const result = await runWasiCommand(ideTest, argv, [sysrootPreopen(), moduleCachePreopen(), buildPreopen()]);
        console.log("[swift-ide-test] stdout:", result.stdout, "stderr:", result.stderr);
        // return { items: parseCompletionResults(result.stdout), diagnostics: result.stderr };
        return {
          items: parseCompletionResults(result.stdout),
          diagnostics: [],
        };
      } catch (e) {
        swiftCompiler.discard();
        throw e;
      }
    },
  };
});

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case "preload": {
      try {
        await swiftCompiler();
        post({ id: -1, type: msg.type, progress: SETUP_PROGRESS });
        post({ id: msg.id, type: msg.type, progress: 1.0 });
      } catch (e) {
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    case "complete": {
      try {
        const compiler = await swiftCompiler();
        const { items, diagnostics } = await compiler.autocomplete(msg.files, msg.primaryFile, msg.offset);
        post({ id: msg.id, type: msg.type, items, diagnostics });
      } catch (e) {
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    case "compile": {
      try {
        const compiler = await swiftCompiler();
        const result = await compiler.run(msg.files);
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
