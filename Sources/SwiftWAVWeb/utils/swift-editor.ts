import { EditorState } from "@codemirror/state";
import {
	EditorView,
	keymap,
	lineNumbers,
	highlightActiveLine,
	highlightActiveLineGutter,
	drawSelection,
	dropCursor,
	highlightSpecialChars,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { swift } from "@fazelstudio/codemirror-lang-swift";
import { tags as t } from "@lezer/highlight";
import type { CompletionItem } from "../types";

// Warm near-black studio theme: bg-1 editor surface, orange-red accent,
// JetBrains Mono, matching the rest of the app's chrome.
const studioHighlight = HighlightStyle.define([
	{ tag: t.keyword, color: "#ff6b45" },
	{ tag: t.controlKeyword, color: "#ff6b45" },
	{ tag: t.definitionKeyword, color: "#ff6b45" },
	{ tag: t.string, color: "#46c07e" },
	{ tag: t.comment, color: "#5f5c55", fontStyle: "italic" },
	{ tag: t.number, color: "#a884f0" },
	{ tag: t.bool, color: "#a884f0" },
	{ tag: t.typeName, color: "#4aa3e8" },
	{ tag: t.className, color: "#4aa3e8" },
	{ tag: t.function(t.variableName), color: "#d6a04a" },
	{ tag: t.propertyName, color: "#d6a04a" },
	{ tag: t.operator, color: "#a6a29a" },
	{ tag: t.punctuation, color: "#85817a" },
	{ tag: t.attributeName, color: "#a884f0" },
]);

const studioTheme = EditorView.theme(
	{
		"&": {
			color: "#edece7",
			backgroundColor: "#161514",
			height: "100%",
			fontSize: "12.5px",
		},
		".cm-content": { caretColor: "#ff855f", fontFamily: "var(--mono)", padding: "12px 0" },
		".cm-cursor": { borderLeft: "2px solid #ff855f" },
		".cm-dropCursor": { borderLeft: "2px solid #ff855f" },
		"&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
			backgroundColor: "rgba(255, 107, 69, 0.22)",
		},
		".cm-activeLine": { backgroundColor: "rgba(255, 244, 230, 0.035)" },
		".cm-activeLineGutter": { backgroundColor: "rgba(255, 244, 230, 0.035)" },
		".cm-gutters": {
			backgroundColor: "#161514",
			color: "#5f5c55",
			border: "none",
		},
		".cm-scroller": { fontFamily: "var(--mono)" },
	},
	{ dark: true }
);

/**
 * Creates the CodeMirror completion source for Swift.
 *
 * Completion is kept outside the component so the editor remains focused on
 * rendering and document changes while the compiler composable owns the
 * worker request.
 */
function swiftCompletionSource(requestCompletions: (position: number) => Promise<CompletionItem[]>) {
	return async (context: CompletionContext): Promise<CompletionResult | null> => {
		const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
		if (!word && !context.explicit) return null;
		if (word && word.from === word.to && !context.explicit) return null;

		let items: CompletionItem[];
		try {
			items = await requestCompletions(context.pos);
		} catch {
			return null;
		}
		if (!items.length) return null;

		return {
			from: word ? word.from : context.pos,
			options: items.map((item) => ({
				label: item.label,
				detail: item.detail,
				type: item.kind,
			})),
			validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
		};
	};
}

interface CreateSwiftEditorStateOptions {
	document: string;
	onChange: (value: string) => void;
	requestCompletions: (position: number) => Promise<CompletionItem[]>;
}

export function createSwiftEditorState(options: CreateSwiftEditorStateOptions): EditorState {
	return EditorState.create({
		doc: options.document,
		extensions: [
			history(),
			lineNumbers(),
			highlightSpecialChars(),
			drawSelection(),
			dropCursor(),
			highlightActiveLine(),
			highlightActiveLineGutter(),
			keymap.of([
				...defaultKeymap,
				...historyKeymap,
				{
					key: "Tab",
					run: (target) => {
						target.dispatch(target.state.replaceSelection("  "));
						return true;
					},
				},
			]),
			swift(),
			autocompletion({ override: [swiftCompletionSource(options.requestCompletions)] }),
			syntaxHighlighting(studioHighlight),
			studioTheme,
			EditorView.updateListener.of((update) => {
				if (update.docChanged) options.onChange(update.state.doc.toString());
			}),
		],
	});
}

export function revealProblem(
	view: EditorView | null,
	problem: { line: number | null; column: number | null }
): void {
	if (!view || !problem.line) return;

	const lineNumber = Math.min(Math.max(problem.line, 1), view.state.doc.lines);
	const line = view.state.doc.line(lineNumber);
	const position = Math.min(line.from + Math.max((problem.column ?? 1) - 1, 0), line.to);
	view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
	view.focus();
}
