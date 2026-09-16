// Runs a compiled WASI command module (swift-frontend, wasm-ld, swift-ide-test,
// or the user's own linked program) to completion, capturing its stdout and
// stderr as line arrays instead of letting them hit the console.

import { WASI, ConsoleStdout, File, OpenFile } from "@bjorn3/browser_wasi_shim";

/**
 * @param {WebAssembly.Module} module
 * @param {string[]} argv
 * @param {any[]} preopens
 * @returns {Promise<{exitCode: number, stdout: string[], stderr: string[]}>}
 */
export async function runWasiCommand(module, argv, preopens) {
  /** @type {string[]} */
  const stdout = [];
  /** @type {string[]} */
  const stderr = [];
  const fds = [
    new OpenFile(new File([])),
    ConsoleStdout.lineBuffered((line) => stdout.push(line)),
    ConsoleStdout.lineBuffered((line) => stderr.push(line)),
    ...preopens,
  ];
  const wasi = new WASI(argv, [], fds, { debug: false });

  /** @type {WebAssembly.Instance} */
  const instance = /** @type {WebAssembly.Instance} */ (await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
  }));

  let exitCode = 0;
  try {
    exitCode = wasi.start(/** @type {any} */ (instance));
  } catch (err) {
    /** @type {any} */
    const error = err;
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
