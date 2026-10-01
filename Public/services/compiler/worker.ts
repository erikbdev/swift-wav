import { Directory, PreopenDirectory, File } from "@bjorn3/browser_wasi_shim";
import type { WorkerRequest, WorkerResponse } from "../../types/compiler";
import { memoize } from "../../utils/memoize";
import { fetchToolchains } from "./toolchain";
import { runWASICommand } from "../../utils/wasi-run";
import { parseCompletionResults } from "./completion";
import { parseDiagnostics } from "./diagnostics";

const COMPLETION_TOKEN = "COMPLETE";

const commonFrontendArgs = [
  "-target",
  "wasm32-unknown-wasip1",
  "-disable-objc-interop",
  "-sdk",
  "/sysroot/wasi-sysroot",
  "-resource-dir",
  "/sysroot/swift/lib/swift_static",
  "-Xcc",
  "-fimplicit-module-maps",
  "-Xcc",
  "-fmodules-cache-path=/module-cache",
  "-module-name",
  "main",
  "-I",
  "/lib",
];

const toolchain = fetchToolchains((progress) => post({ id: -1, type: "preload", progress }));

const modules = memoize(async () => {
  try {
    const [frontend, ideTest, linker, sysroot, libSwiftWAV] = await Promise.all([toolchain.frontend(), toolchain.ideTest(), toolchain.linker(), toolchain.sysroot(), toolchain.libSwiftWAV()]);
    const moduleCache = new Directory(new Map());

    const sysrootPreopen = () => new PreopenDirectory("/sysroot", sysroot.contents);
    const moduleCachePreopen = () => new PreopenDirectory("/module-cache", moduleCache.contents);
    const libSwiftWAVPreopen = () => new PreopenDirectory("/lib", libSwiftWAV.contents);

    return {
      frontend,
      ideTest,
      linker,
      sysroot,
      libSwiftWAV,
      sysrootPreopen,
      moduleCachePreopen,
      libSwiftWAVPreopen,
    };
  } catch (e) {
    post({ id: -1, type: "preload", error: e });
    throw e;
  }
});

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case "preload": {
      try {
        await modules();
        post({ id: msg.id, type: msg.type, progress: 1.0 });
      } catch (e) {
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    case "codecompletion":
      {
        try {
          const { ideTest, sysrootPreopen, moduleCachePreopen, libSwiftWAVPreopen } = await modules();

          const buildDir = new Map();
          for (let [name, content] of Object.entries(msg.files)) {
            if (name === msg.primaryFile) {
              const clampedOffset = Math.max(0, Math.min(msg.offset, content.length));
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
            `/build/${msg.primaryFile}`,
            `-code-completion-token=${COMPLETION_TOKEN}`,
            "-code-completion-sourcetext",
            ...(Object.keys(msg.files).includes("main.swift") ? [] : ["-parse-as-library"]),
            ...[...buildDir.keys()].flatMap((n) => (n === msg.primaryFile ? [] : [`/build/${n}`])),
            ...commonFrontendArgs,
          ];

          const result = await runWASICommand(ideTest, argv, [buildPreopen(), sysrootPreopen(), moduleCachePreopen(), libSwiftWAVPreopen()]);
          console.log("[swift-ide-test] stdout:", result.stdout, "stderr:", result.stderr);

          post({ id: msg.id, type: msg.type, items: parseCompletionResults(result.stdout), diagnostics: [] });
        } catch (e) {
          modules.discard();
          post({ id: msg.id, type: msg.type, error: e });
        }
      }
      break;

    case "typecheck": {
      try {
        const { frontend, sysrootPreopen, moduleCachePreopen, libSwiftWAVPreopen } = await modules();
        const buildDir = new Map();
        for (const [name, content] of Object.entries(msg.files)) {
          buildDir.set(name, new File(new TextEncoder().encode(content)));
        }

        const buildPreopen = () => new PreopenDirectory("/build", buildDir);
        const result = await runWASICommand(
          frontend,
          [
            "swift-frontend",
            "-frontend",
            "-typecheck",
            ...(Object.keys(msg.files).includes("main.swift") ? [] : ["-parse-as-library"]),
            ...commonFrontendArgs,
            "-use-static-resource-dir",
            "-no-color-diagnostics",
            ...[...buildDir.keys()].map((name) => `/build/${name}`),
          ],
          [buildPreopen(), sysrootPreopen(), moduleCachePreopen(), libSwiftWAVPreopen()],
        );

        post({ id: msg.id, type: msg.type, exitCode: result.exitCode, diagnostics: parseDiagnostics(result.stderr) });
      } catch (e) {
        modules.discard();
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    case "compile": {
      try {
        // const compiler = await swiftCompiler();
        const { frontend, linker, sysroot, sysrootPreopen, moduleCachePreopen, libSwiftWAVPreopen } = await modules();

        const buildDir = new Map();
        for (const [name, content] of Object.entries(msg.files)) {
          buildDir.set(name, new File(new TextEncoder().encode(content)));
        }

        const buildPreopen = () => new PreopenDirectory("/build", buildDir);

        let frontendResult = await runWASICommand(
          frontend,
          [
            "swift-frontend",
            "-frontend",
            "-c",
            ...(Object.keys(msg.files).includes("main.swift") ? [] : ["-parse-as-library"]),
            ...commonFrontendArgs,
            "-use-static-resource-dir",
            "-no-color-diagnostics",
            "-empty-abi-descriptor",
            ...[...buildDir.keys()].map((n) => `/build/${n}`),
            "-o",
            "/build/main.o",
          ],
          [buildPreopen(), sysrootPreopen(), moduleCachePreopen(), libSwiftWAVPreopen()],
        );
        console.log("[swift-frontend] stdout:", frontendResult.stdout, "stderr:", frontendResult.stderr);

        if (frontendResult.exitCode !== 0) {
          post({
            id: msg.id,
            type: msg.type,
            stage: "frontend",
            exitCode: frontendResult.exitCode,
            diagnostics: parseDiagnostics(frontendResult.stderr),
          });
          return;
        }

        // The frontend can still emit warnings/notes on success; carry them
        // through so a clean compile doesn't silently drop them.
        const frontendDiagnostics = parseDiagnostics(frontendResult.stderr);

        const linkResult = await runWASICommand(
          linker,
          [
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
          ],
          [buildPreopen(), sysrootPreopen(), libSwiftWAVPreopen()],
        );
        console.log("[wasm-ld] stdout:", linkResult.stdout, "stderr:", linkResult.stderr);
        const programFile = buildDir.get("main.wasm");
        if (linkResult.exitCode !== 0 || !(programFile instanceof File)) {
          post({
            id: msg.id,
            type: msg.type,
            stage: "linker",
            exitCode: linkResult.exitCode,
            diagnostics: [...frontendDiagnostics, ...parseDiagnostics(linkResult.stderr)],
          });
          return;
        }

        // TODO: pass this program to useEngine (somehow?)

        // 3. Run the freshly linked program itself. Its stdout is the
        // program's own output, not a diagnostic; its stderr only becomes a
        // diagnostic when the run actually fails (a trap or non-zero exit),
        // since a well-behaved program is free to write to stderr as output.
        const programModule = await WebAssembly.compile(programFile.data as BufferSource);
        const runResult = await runWASICommand(programModule, ["main"], []);
        console.log("[program] stdout:", runResult.stdout, "stderr: ", runResult.stderr);

        const timestamp = Date.now();
        post({
          id: msg.id,
          type: msg.type,
          stage: "run",
          exitCode: runResult.exitCode,
          output: runResult.stdout.map((message) => ({ message, timestamp })),
          diagnostics: runResult.exitCode === 0 ? frontendDiagnostics : [...frontendDiagnostics, ...parseDiagnostics(runResult.stderr)],
        });
      } catch (e) {
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    default:
      msg satisfies never;
  }
});
