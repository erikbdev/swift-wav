import { onBeforeUnmount, onMounted } from "vue";
import { EditorView } from "@codemirror/view";
import { createSwiftEditorState, revealProblem } from "../utils/swift-editor.js";

/**
 * Owns CodeMirror's imperative lifecycle inside a Vue component.
 *
 * The DOM node is created by the component template; this composable is the
 * only place that creates, replaces, focuses, or destroys an EditorView.
 *
 * @param {{host: {value: HTMLElement|null}, getDocument: () => string, onChange: (value: string) => void, requestCompletions: (position: number) => Promise<any[]>}} options
 */
export function useCodeMirror(options) {
	/** @type {any|null} */
	let view = null;

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

	/** @param {string} document */
	function setDocument(document) {
		if (!view) return;
		if (view.state.doc.toString() === document) return;

		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: document },
		});
	}

	function getDocument() {
		return view?.state.doc.toString() ?? "";
	}

	/** @param {{line: (number|null), column: (number|null)}} problem */
	function reveal(problem) {
		revealProblem(view, problem);
	}

	onMounted(mount);
	onBeforeUnmount(destroy);

	return { setDocument, getDocument, reveal };
}
