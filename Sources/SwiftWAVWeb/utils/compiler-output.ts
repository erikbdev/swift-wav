import type { OutputLine, Problem } from "../types";
import type { CompilerResult } from "../workers/swift.worker";

export function problemFromLine(line: string): Problem | null {
  const text = String(line).trim();
  if (!text) return null;

  const match = text.match(/^(.*?):(\d+):(\d+):\s*(error|warning):\s*(.*)$/i);
  if (match) {
    return {
      severity: match[4].toLowerCase(),
      file: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
      message: match[5],
    };
  }

  const bareMatch = text.match(/^(error|warning):\s*(.*)$/i);
  if (bareMatch) {
    return {
      severity: bareMatch[1].toLowerCase(),
      file: "Swift",
      line: null,
      column: null,
      message: bareMatch[2],
    };
  }

  if (text.startsWith("[trap]")) {
    return {
      severity: "error",
      file: "runtime",
      line: null,
      column: null,
      message: text.slice(6).trim(),
    };
  }

  return null;
}

export function problemsFromResult(data: CompilerResult): Problem[] {
  const lines = [...(data.diagnostics ?? []), ...(data.stderr ?? [])].flatMap((line) => String(line).split("\n"));
  const seen = new Set<string>();
  const parsed: Problem[] = [];

  for (const line of lines) {
    const problem = problemFromLine(line);
    if (!problem) continue;

    const key = `${problem.severity}:${problem.file}:${problem.line}:${problem.column}:${problem.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      parsed.push(problem);
    }
  }

  if (!parsed.length) {
    parsed.push({
      severity: "error",
      file: "Swift",
      line: null,
      column: null,
      message: `Compilation failed at ${data.stage ?? "an unknown stage"}.`,
    });
  }

  return parsed;
}

export function outputFromResult(data: CompilerResult): OutputLine[] {
  const lines: OutputLine[] = [];

  const appendLines = (values: string[] | undefined, kind: string) => {
    for (const value of values ?? []) {
      for (const text of String(value).split("\n")) lines.push({ text, kind });
    }
  };

  appendLines(data.stdout, "stdout");
  appendLines(data.stderr, "stderr");
  if (!lines.length) {
    lines.push({
      text: data.exitCode === 0 ? "Program produced no output." : `Run failed at ${data.stage ?? "an unknown stage"}.`,
      kind: "status",
    });
  }

  return lines;
}

export function problemLocation(problem: Problem): string {
  return problem.line ? `${problem.file}:${problem.line}:${problem.column}` : problem.file;
}

export function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
