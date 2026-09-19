export type Problem = {
  severity: string;
  file: string;
  line: number | null;
  column: number | null;
  message: string;
};

export type Diagnostic = {
  file: string;
  line: number;
  position: number;
  severity: string;
  title: string;
  snippet: string;
};

export type OutputLine = {
  text: string;
  kind: string;
};

export type Workspace = {
  files: Record<string, string>;
  active: string;
};

export type WorkspaceSnapshot = {
  files: Record<string, string>;
  primaryFile: string;
};
