// Types shared by the compiler's UI side and its worker.

export type SourceFiles = Record<string, string>;

export type Diagnostic = {
  file: string | null;
  line: number | null;
  column: number | null;
  severity: "error" | "warning" | "note";
  message: string;
};

export type Output = {
  message: string;
  timestamp: number;
};

/** A code completion, shaped after SourceKit-LSP's completion items. */
export type CompletionItem = {
  /** The base name completions are matched against, e.g. "print" for "print(_:)". */
  name: string;
  /** The readable signature shown in the list, e.g. "print(items: Any...)". */
  label: string;
  /** The result type, e.g. "Void". */
  detail: string;
  kind: string;
  /** SourceKit-LSP-style semantic score; 1 is neutral, higher ranks first. */
  score: number;
  /**
   * The text to insert, with Xcode-style editor placeholders for arguments,
   * e.g. "print(<#T##items: Any...##Any#>)".
   */
  sourceText: string;
  /** How many characters before the completion point the insertion replaces, e.g. 1 to turn `.` into `?.`. */
  erase: number;
  /**
   * Whether `sourceText` closes a call whose `(` is already typed, so an
   * existing `)` right after the completion point should be replaced rather
   * than kept.
   */
  closesCall: boolean;
};

export type WorkerRequest =
  | { id: number; type: "preload" }
  | { id: number; type: "typecheck"; files: SourceFiles }
  | { id: number; type: "compile"; files: SourceFiles; primaryFile: string }
  | { id: number; type: "complete"; files: SourceFiles; primaryFile: string; offset: number };

export type WorkerResponse =
  | { id: number; type: "preload"; progress?: number; error?: unknown }
  | { id: number; type: "typecheck"; diagnostics?: Diagnostic[]; exitCode?: number; error?: unknown }
  | { id: number; type: "compile"; stage?: string; output?: Output[]; diagnostics?: Diagnostic[]; exitCode?: number; error?: unknown }
  | { id: number; type: "complete"; items?: CompletionItem[]; diagnostics?: Diagnostic[]; error?: unknown };

/** The response a given request `type` resolves with. */
export type ResponseFor<T extends WorkerRequest["type"]> = Extract<WorkerResponse, { type: T }>;
