import { onBeforeUnmount, onMounted, type Ref } from "vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, highlightSpecialChars } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { swift } from "@fazelstudio/codemirror-lang-swift";
import { tags as t } from "@lezer/highlight";
import type { CompletionItem } from "../workers/swift.worker";

type SyntaxNode = ReturnType<typeof syntaxTree>["topNode"];

const IDENTIFIER_BEFORE = /[A-Za-z_][A-Za-z0-9_]*/;

/**
 * Characters that open completions as soon as they're typed: member access
 * (`.`), call arguments (`(`), and attributes and attached macros (`@`).
 * `:`, `,`, and `[` are left out since they're usually followed by a space or
 * newline, where an open list would swallow Enter.
 */
const TRIGGER_CHARACTERS = new Set([".", "(", "@"]);

/** An unclosed `\( ... )` (or raw `\#( ... )`) interpolation at the end of a string. */
const OPEN_INTERPOLATION = /\\#*\((?:[^()]|\([^()]*\))*$/;

/**
 * Creates the CodeMirror completion source for Swift.
 *
 * Like SourceKit-LSP, completions are requested at the start of the
 * identifier being typed (or right after a trigger character) rather than at
 * the cursor, so the compiler returns everything valid at that point.
 * CodeMirror then filters that list by prefix and fuzzy match on every
 * keystroke without going back to the compiler. The last response is cached
 * by completion point, so retyping a word doesn't hit the compiler again.
 */
function swiftCompletionSource(requestCompletions: (position: number) => Promise<CompletionItem[]>) {
  let cache: { key: string; items: CompletionItem[] } | null = null;

  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const { state, pos } = context;
    const triggered = context.explicit || TRIGGER_CHARACTERS.has(state.sliceDoc(pos - 1, pos));
    const from = context.matchBefore(IDENTIFIER_BEFORE)?.from ?? (triggered ? pos : null);
    if (from === null) return null;
    if (!context.explicit) {
      for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent) {
        if (node.name.includes("Comment")) {
          return null;
        } else if (node.name.includes("String")) {
          if (!OPEN_INTERPOLATION.test(state.sliceDoc(node.from, pos))) {
            return null;
          } else {
            break;
          }
        }
      }
    }

    // The document around the completion point, minus the typed prefix,
    // determines what the compiler returns.
    const key = `${from}\u0000${state.sliceDoc(0, from)}\u0000${state.sliceDoc(pos)}`;
    if (cache?.key !== key) {
      try {
        cache = { key, items: await requestCompletions(from) };
      } catch {
        return null;
      }
    }
    const { items } = cache;
    if (!items.length) return null;

    return {
      from,
      options: items.map((item, index) => {
        // Match against the base name ("foo" for "foo(x:)") so argument
        // labels don't produce spurious fuzzy matches, and keep the
        // compiler's own ranking among equally good matches. The boost stays
        // under 50 so it never outweighs a better kind of match.
        const name = item.label.split("(")[0] || item.label;
        return {
          label: name,
          displayLabel: name === item.label ? undefined : item.label,
          detail: item.detail,
          type: item.kind,
          boost: 49 - (98 * index) / items.length,
        };
      }),
      // `label` is a prefix of `displayLabel`, so the matched ranges carry over.
      getMatch: (_completion, matched) => matched ?? [],
      validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
    };
  };
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

    const state = EditorState.create({
      doc: options.getDocument(),
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
    if (!view || !problem.line) return;

    const lineNumber = Math.min(Math.max(problem.line, 1), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    const position = Math.min(line.from + Math.max((problem.column ?? 1) - 1, 0), line.to);
    view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
    view.focus();
  }

  onMounted(mount);
  onBeforeUnmount(destroy);

  return { setDocument, getDocument, reveal };
}
