// Runs a compiled WASI command module (swift-frontend, wasm-ld, swift-ide-test,
// or the user's own linked program) to completion, capturing its stdout and
// stderr as line arrays instead of letting them hit the console.

import { WASI, ConsoleStdout, File, OpenFile, type Fd } from "@bjorn3/browser_wasi_shim";

export interface WasiCommandResult {
  exitCode: number;
  stdout: string[];
  stderr: string[];
}

export async function runWasiCommand(module: WebAssembly.Module, argv: string[], preopens: Fd[]): Promise<WasiCommandResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fds: Fd[] = [new OpenFile(new File([])), ConsoleStdout.lineBuffered((line) => stdout.push(line)), ConsoleStdout.lineBuffered((line) => stderr.push(line)), ...preopens];
  const wasi = new WASI(argv, [], fds, { debug: false });

  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  let exitCode = 0;
  try {
    exitCode = wasi.start(instance as unknown as { exports: { memory: WebAssembly.Memory; _start: () => unknown } });
  } catch (err) {
    const error = err as { code?: number; message?: string } | undefined;
    // WASIProcExit is how `exit()`/`_start` returning is surfaced by some
    // builds; anything else is a genuine trap.
    if (error && typeof error.code === "number") {
      exitCode = error.code;
    } else {
      stderr.push(`[trap] ${error && error.message ? error.message : error}`);
      exitCode = 1;
    }
  }

  return { exitCode, stdout, stderr };
}
