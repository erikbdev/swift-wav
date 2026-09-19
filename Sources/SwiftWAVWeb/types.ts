export type Workspace = {
  files: Record<string, string>;
  active: string;
};

export type WorkspaceSnapshot = {
  files: Record<string, string>;
  primaryFile: string;
};
