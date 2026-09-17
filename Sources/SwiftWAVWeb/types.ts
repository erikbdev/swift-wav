export type Problem = {
  severity: string;
  file: string;
  line: number | null;
  column: number | null;
  message: string;
};

export type OutputLine = {
  text: string;
  kind: string;
};

export type CompletionItem = {
  label: string;
  detail: string;
  kind: string;
};

export type CompilerResult = {
  ok: boolean;
  stage?: string;
  diagnostics?: string[];
  stdout?: string[];
  stderr?: string[];
  exitCode?: number;
};

export type Workspace = {
  files: Record<string, string>;
  active: string;
};

export type WorkspaceSnapshot = {
  files: Record<string, string>;
  primaryFile: string;
};
