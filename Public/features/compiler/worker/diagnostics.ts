import type { Diagnostic } from "../types";

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
export function parseDiagnostics(lines: string[]): Diagnostic[] {
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
