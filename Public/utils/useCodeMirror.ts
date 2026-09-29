import { onBeforeUnmount, onMounted, type Ref } from "vue";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

interface UseCodeMirrorOptions {
  host: Ref<HTMLElement | null>;
  getFileId: () => string;
  getDocument: () => string;
  extensions: () => Extension[];
}

/**
 * Owns CodeMirror's imperative lifecycle inside a Vue component.
 *
 * The DOM node is created by the component template; this composable is the
 * only place that creates, replaces, focuses, or destroys an EditorView.
 */
export function useCodeMirror(options: UseCodeMirrorOptions) {
  let view: EditorView | null = null;
  let currentFileId: string | null = null;
  const states = new Map<string, EditorState>();

  function createState(document: string) {
    return EditorState.create({ doc: document, extensions: options.extensions() });
  }

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

    currentFileId = options.getFileId();
    const state = createState(options.getDocument());
    view = new EditorView({ state, parent: options.host.value });
  }

  function showFile(fileId: string, document: string) {
    if (!view) return;
    if (fileId === currentFileId) {
      if (view.state.doc.toString() !== document) view.setState(createState(document));
      return;
    }

    if (currentFileId) states.set(currentFileId, view.state);
    currentFileId = fileId;

    const saved = states.get(fileId);
    const state = saved?.doc.toString() === document ? saved : createState(document);
    view.setState(state);
  }

  function forgetFile(fileId: string) {
    states.delete(fileId);
    if (currentFileId === fileId) currentFileId = null;
  }

  function reveal(problem: { line: number | null; column: number | null }) {
    if (!view || !problem.line) return;

    const lineNumber = Math.min(Math.max(problem.line, 1), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    const position = Math.min(line.from + Math.max((problem.column ?? 1) - 1, 0), line.to);
    view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
    view.focus();
  }

  onMounted(mount);
  onBeforeUnmount(destroy);

  return { showFile, forgetFile, reveal };
}
