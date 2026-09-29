// The CodeMirror setup for editing Swift: language support, completion,
// keymap, and the studio theme.

import type { Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, highlightSpecialChars } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { autocompletion } from "@codemirror/autocomplete";
import { swift } from "@fazelstudio/codemirror-lang-swift";
import { tags as t } from "@lezer/highlight";
import { swiftCompletionSource, type CompletionProvider } from "./swiftCompletion";

export function swiftEditorExtensions(options: { complete: CompletionProvider; onChange: (document: string) => void }): Extension[] {
  return [
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
    autocompletion({ override: [swiftCompletionSource(options.complete)] }),

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
        // Argument placeholders inserted by completions, drawn as tokens
        // like Xcode's.
        ".cm-snippetField": {
          backgroundColor: "rgba(74, 163, 232, 0.18)",
          border: "1px solid rgba(74, 163, 232, 0.35)",
          borderRadius: "4px",
        },
      },
      { dark: true },
    ),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange(update.state.doc.toString());
    }),
  ];
}
