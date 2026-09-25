// Runs swift-frontend, wasm-ld, and swift-ide-test over WASI, with the
// sysroot mounted from a plain tar archive. See
// https://github.com/tothambrus11/swift-toolchain-wasm's docs/consuming.md
// for the argv this mirrors — there is no on-wasm driver, since WASI can't
// spawn processes, so the embedder replays swiftc's argv by hand.

import { Directory, File, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import { memoize } from "../../../utils/memoize";
import { runWasiCommand } from "../../../utils/wasi-run";
import type { SourceFiles } from "../types";
import { parseCompletionResults } from "./completion";
import { parseDiagnostics } from "./diagnostics";
import type { Toolchain } from "./toolchain";

const COMPLETION_TOKEN = "COMPLETE";

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
  "-I",
  "/lib",
];

export function createSwiftCompiler(toolchain: Toolchain) {
  const swiftCompiler = memoize(async () => {
    const [frontend, linker, sysroot, swiftwav] = await Promise.all([toolchain.frontend(), toolchain.linker(), toolchain.sysroot(), toolchain.libSwiftWAV()]);

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
    const swiftwavPreopen = () => new PreopenDirectory("/lib", swiftwav.contents);

    return {
      // Typecheck the complete workspace without linking or executing it.
      async typecheck(files: SourceFiles) {
        try {
          const buildDir = new Map();
          for (const [name, content] of Object.entries(files)) {
            buildDir.set(name, new File(new TextEncoder().encode(content)));
          }

          const buildPreopen = () => new PreopenDirectory("/build", buildDir);
          const result = await runWasiCommand(
            frontend,
            [
              "swift-frontend",
              "-frontend",
              "-typecheck",
              ...(Object.keys(files).includes("main.swift") ? [] : ["-parse-as-library"]),
              ...commonFrontendArgs,
              "-use-static-resource-dir",
              "-no-color-diagnostics",
              ...[...buildDir.keys()].map((name) => `/build/${name}`),
            ],
            [buildPreopen(), sysrootPreopen(), moduleCachePreopen(), swiftwavPreopen()],
          );
          return { exitCode: result.exitCode, diagnostics: parseDiagnostics(result.stderr) };
        } catch (e) {
          swiftCompiler.discard();
          throw e;
        }
      },

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
            [buildPreopen(), sysrootPreopen(), moduleCachePreopen(), swiftwavPreopen()],
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
            "-L/lib",
            "-lSwiftWAV",
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

          const linkResult = await runWasiCommand(linker, linkerArgv, [buildPreopen(), sysrootPreopen(), swiftwavPreopen()]);
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

          const timestamp = Date.now();
          return {
            stage: "run",
            exitCode: runResult.exitCode,
            output: runResult.stdout.map((message) => ({ message, timestamp })),
            diagnostics: runResult.exitCode === 0 ? frontendDiagnostics : [...frontendDiagnostics, ...parseDiagnostics(runResult.stderr)],
          };
        } catch (e) {
          swiftCompiler.discard();
          throw e;
        }
      },

      // Runs swift-ide-test's `-code-completion` at `offset` (a UTF-16 code
      // unit offset into `files[primaryFile]`, as CodeMirror positions are),
      // normally the start of the identifier being typed, with every other workspace file
      // loaded alongside it so completion sees declarations from the whole
      // module, and returns the parsed completion list.
      async autocomplete(files: SourceFiles, activeFile: string, offset: number) {
        try {
          const ideTest = await toolchain.ideTest();

          const buildDir = new Map();
          for (let [name, content] of Object.entries(files)) {
            if (name === activeFile) {
              const clampedOffset = Math.max(0, Math.min(offset, content.length));
              content = content.slice(0, clampedOffset) + `#^${COMPLETION_TOKEN}^#` + content.slice(clampedOffset);
              console.log(`[swift-ide-test] source (${name}):\n${content}`);
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
            "-code-completion-sourcetext",
            ...(Object.keys(files).includes("main.swift") ? [] : ["-parse-as-library"]),
            ...[...buildDir.keys()].flatMap((n) => (n === activeFile ? [] : [`/build/${n}`])),
            ...commonFrontendArgs,
          ];

          const result = await runWasiCommand(ideTest, argv, [buildPreopen(), sysrootPreopen(), moduleCachePreopen(), swiftwavPreopen()]);
          console.log("[swift-ide-test] stdout:", result.stdout, "stderr:", result.stderr);
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
  return swiftCompiler;
}
