// Runs a compiled WASI command module (swift-frontend, wasm-ld, swift-ide-test,
// or the user's own linked program) to completion, capturing its stdout and
// stderr as line arrays instead of letting them hit the console.

import { WASI, ConsoleStdout, File, OpenFile } from "https://esm.sh/@bjorn3/browser_wasi_shim@0.4.2";

/**
 * Instantiates and runs `module` as a WASI command with the given argv and
 * preopens, returning its exit code plus captured stdout/stderr lines.
 */
export async function runWasiCommand(module, argv, preopens) {
  const stdout = [];
  const stderr = [];
  const fds = [
    new OpenFile(new File([])),
    ConsoleStdout.lineBuffered((line) => stdout.push(line)),
    ConsoleStdout.lineBuffered((line) => stderr.push(line)),
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
