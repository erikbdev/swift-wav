import { onBeforeUnmount, onMounted, type Ref } from "vue";
import { EditorView } from "@codemirror/view";
import { createSwiftEditorState, revealProblem } from "../utils/swift-editor";
import type { CompletionItem } from "../types";

interface UseCodeMirrorOptions {
	host: Ref<HTMLElement | null>;
	getDocument: () => string;
	onChange: (value: string) => void;
	requestCompletions: (position: number) => Promise<CompletionItem[]>;
}

/**
 * Owns CodeMirror's imperative lifecycle inside a Vue component.
 *
 * The DOM node is created by the component template; this composable is the
 * only place that creates, replaces, focuses, or destroys an EditorView.
 */
export function useCodeMirror(options: UseCodeMirrorOptions) {
	let view: EditorView | null = null;

	function destroy() {
		if (!view) return;

		// Clear the browser's native selection before destroying the view.
		// Safari can deliver a queued selectionchange after the DOM view has
		// been removed, which can leave CodeMirror with an invalid text leaf.
		view.contentDOM.blur();
		const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
		if (selection?.anchorNode && options.host.value?.contains(selection.anchorNode)) {
			selection.removeAllRanges();
		}
		view.destroy();
		view = null;
	}

	function mount() {
		if (!options.host.value) return;
		destroy();
		options.host.value.replaceChildren();
		const state = createSwiftEditorState({
			document: options.getDocument(),
			onChange: options.onChange,
			requestCompletions: options.requestCompletions,
		});
		view = new EditorView({ state, parent: options.host.value });
	}

	function setDocument(document: string) {
		if (!view) return;
		if (view.state.doc.toString() === document) return;

		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: document },
		});
	}

	function getDocument(): string {
		return view?.state.doc.toString() ?? "";
	}

	function reveal(problem: { line: number | null; column: number | null }) {
		revealProblem(view, problem);
	}

	onMounted(mount);
	onBeforeUnmount(destroy);

	return { setDocument, getDocument, reveal };
}
