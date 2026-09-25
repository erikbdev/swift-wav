import { onBeforeUnmount, onMounted, type Ref } from "vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, highlightSpecialChars } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { swift } from "@fazelstudio/codemirror-lang-swift";
import { tags as t } from "@lezer/highlight";
import type { CompletionItem } from "../workers/swift.worker";
import { rankCompletions } from "../utils/completionMatch";

const IDENTIFIER_BEFORE = /[A-Za-z_][A-Za-z0-9_]*/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Characters that open completions as soon as they're typed, before any
 * identifier follows: member access (`.`), call arguments (`(`), and
 * attributes and attached macros (`@`). `:`, `,`, and `[` are left out since
 * they're usually followed by a space or newline, where an open list would
 * swallow Enter.
 */
const TRIGGER_CHARACTERS = new Set([".", "(", "@"]);

const COMMENT_NODES = new Set(["LineComment", "BlockComment", "DocLineComment", "DocBlockComment"]);
const STRING_NODES = new Set(["String", "MultiLineStringToken", "RawStringToken"]);

/**
 * Whether `text` (a string literal from its opening quote up to the cursor)
 * ends inside an unclosed `\( ... )` interpolation. The Swift grammar lexes
 * string literals as single tokens, so interpolations have to be found by
 * hand.
 */
function endsInInterpolation(text: string): boolean {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (depth > 0) {
      if (char === "(") depth++;
      else if (char === ")") depth--;
    } else if (char === "\\") {
      // Raw strings interpolate with `\#(`, so skip any `#`s after the `\`.
      let next = i + 1;
      while (text[next] === "#") next++;
      if (text[next] === "(") depth = 1;
      i = next;
    }
  }
  return depth > 0;
}

/** Whether `pos` is inside a comment, or inside a string literal outside of an interpolation. */
function isInCommentOrString(state: EditorState, pos: number): boolean {
  let node = syntaxTree(state).resolveInner(pos, -1);
  while (true) {
    if (COMMENT_NODES.has(node.name)) return true;
    if (STRING_NODES.has(node.name)) return !endsInInterpolation(state.sliceDoc(node.from, pos));
    if (!node.parent) return false;
    node = node.parent;
  }
}

/**
 * Builds a completion result from the compiler's unfiltered `items` for the
 * completion point `from`, filtered and ranked against `typed` (the part of
 * the identifier already typed after `from`).
 *
 * Filtering is done here rather than by CodeMirror so matching follows
 * SourceKit-LSP's rules (prefix matches before fuzzy ones, word-start
 * bonuses), and `update` re-runs it on every keystroke within the same
 * identifier without going back to the compiler.
 */
function rankedCompletionResult(items: CompletionItem[], from: number, typed: string): CompletionResult {
  const matches = rankCompletions(items, typed, (item) => item.label);
  const ranges = new Map<Completion, readonly number[]>();
  const options = matches.map(({ item, ranges: matched }) => {
    const option: Completion = { label: item.label, detail: item.detail, type: item.kind };
    ranges.set(option, matched);
    return option;
  });

  return {
    from,
    options,
    filter: false,
    getMatch: (completion) => ranges.get(completion) ?? [],
    update: (_current, updatedFrom, _to, context) => {
      // An edit before the completion point invalidates the compiler's
      // results; otherwise refilter the same list against the new text.
      if (updatedFrom !== from) return null;
      const text = context.state.sliceDoc(from, context.pos);
      if (!IDENTIFIER.test(text)) return null;
      return rankedCompletionResult(items, from, text);
    },
  };
}

/**
 * Creates the CodeMirror completion source for Swift.
 *
 * Like SourceKit-LSP, completions are requested at the start of the
 * identifier being typed rather than at the cursor, so the compiler returns
 * everything valid at that point and the typed prefix is matched locally.
 * Typing one of `TRIGGER_CHARACTERS` also opens completions, at the cursor.
 * Typing in comments and strings (outside interpolations) doesn't.
 * The last response is cached by completion point, so retyping a word (e.g.
 * after backspacing over it) doesn't hit the compiler again.
 *
 * Completion is kept outside the component so the editor remains focused on
 * rendering and document changes while the compiler composable owns the
 * worker request.
 */
function swiftCompletionSource(requestCompletions: (position: number) => Promise<CompletionItem[]>) {
  let cache: { key: string; items: CompletionItem[] } | null = null;

  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const word = context.matchBefore(IDENTIFIER_BEFORE);
    if (!context.explicit) {
      const triggered = !word && TRIGGER_CHARACTERS.has(context.state.sliceDoc(context.pos - 1, context.pos));
      if (!word && !triggered) return null;
      if (isInCommentOrString(context.state, context.pos)) return null;
    }

    const from = word ? word.from : context.pos;
    const doc = context.state.doc;
    // The document around the completion point, minus the typed prefix,
    // determines what the compiler returns.
    const key = `${from}\u0000${doc.sliceString(0, from)}\u0000${doc.sliceString(context.pos)}`;

    let items: CompletionItem[];
    if (cache?.key === key) {
      items = cache.items;
    } else {
      try {
        items = await requestCompletions(from);
      } catch {
        return null;
      }
      cache = { key, items };
    }
    if (!items.length) return null;

    return rankedCompletionResult(items, from, context.state.sliceDoc(from, context.pos));
  };
}

interface CreateSwiftEditorStateOptions {
  document: string;
  onChange: (value: string) => void;
  requestCompletions: (position: number) => Promise<CompletionItem[]>;
}

function createSwiftEditorState(options: CreateSwiftEditorStateOptions): EditorState {
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

      // Syntax highlight
      syntaxHighlighting(
        HighlightStyle.define([
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
        ]),
      ),

      // Theme
      EditorView.theme(
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
        { dark: true },
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange(update.state.doc.toString());
      }),
    ],
  });
}

function revealProblem(view: EditorView | null, problem: { line: number | null; column: number | null }): void {
  if (!view || !problem.line) return;

  const lineNumber = Math.min(Math.max(problem.line, 1), view.state.doc.lines);
  const line = view.state.doc.line(lineNumber);
  const position = Math.min(line.from + Math.max((problem.column ?? 1) - 1, 0), line.to);
  view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
  view.focus();
}

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
