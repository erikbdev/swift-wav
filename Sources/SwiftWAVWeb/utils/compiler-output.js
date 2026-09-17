/**
 * @typedef {{severity: string, file: string, line: (number|null), column: (number|null), message: string}} Problem
 * @typedef {{text: string, kind: string}} OutputLine
 * @typedef {Record<string, any>} CompilerMessage
 */

/** @param {string} line @returns {Problem|null} */
export function problemFromLine(line) {
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

/** @param {CompilerMessage} data @returns {Problem[]} */
export function problemsFromResult(data) {
	const lines = [...(data.diagnostics ?? []), ...(data.stderr ?? [])].flatMap((line) =>
		String(line).split("\n")
	);
	const seen = new Set();
	/** @type {Problem[]} */
	const parsed = [];

	for (const line of lines) {
		const problem = problemFromLine(line);
		if (!problem) continue;

		const key = `${problem.severity}:${problem.file}:${problem.line}:${problem.column}:${problem.message}`;
		if (!seen.has(key)) {
			seen.add(key);
			parsed.push(problem);
		}
	}

	if (!parsed.length && !data.ok) {
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

/** @param {CompilerMessage} data @returns {OutputLine[]} */
export function outputFromResult(data) {
	/** @type {OutputLine[]} */
	const lines = [];

	/** @param {any[]|undefined} values @param {string} kind */
	const appendLines = (values, kind) => {
		for (const value of values ?? []) {
			for (const text of String(value).split("\n")) lines.push({ text, kind });
		}
	};

	appendLines(data.stdout, "stdout");
	appendLines(data.stderr, "stderr");
	if (!lines.length) {
		lines.push({
			text: data.ok ? "Program produced no output." : `Run failed at ${data.stage ?? "an unknown stage"}.`,
			kind: "status",
		});
	}

	return lines;
}

/** @param {Problem} problem @returns {string} */
export function problemLocation(problem) {
	return problem.line ? `${problem.file}:${problem.line}:${problem.column}` : problem.file;
}

/** @param {number} bytes @returns {string} */
export function formatMB(bytes) {
	return (bytes / (1024 * 1024)).toFixed(1);
}
