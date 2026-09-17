export interface Problem {
	severity: string;
	file: string;
	line: number | null;
	column: number | null;
	message: string;
}

export interface OutputLine {
	text: string;
	kind: string;
}

export interface CompletionItem {
	label: string;
	detail: string;
	kind: string;
}

export interface CompilerResult {
	ok: boolean;
	stage?: string;
	diagnostics?: string[];
	stdout?: string[];
	stderr?: string[];
	exitCode?: number;
}

export interface Workspace {
	files: Record<string, string>;
	active: string;
}

export interface WorkspaceSnapshot {
	files: Record<string, string>;
	primaryFile: string;
}
