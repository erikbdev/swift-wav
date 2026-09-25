// The Swift completion source: asks the compiler for completions at the start
// of the word being typed, ranks them, and inserts them as snippets with
// Xcode-style placeholders.

import { syntaxTree } from "@codemirror/language";
import { snippet, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { CompletionItem } from "../compiler/types";

/** Returns the completions at a document offset (the start of the word being completed). */
export type CompletionProvider = (position: number) => Promise<CompletionItem[]>;

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
 * Converts compiler source text with Xcode-style editor placeholders
 * (`<#T##display##type#>`, `<#code#>`) into a CodeMirror snippet template.
 * Each placeholder becomes a numbered field showing its display text, so
 * placeholders with the same text (e.g. two `Int` arguments) aren't linked.
 */
function snippetTemplate(sourceText: string): string {
  let field = 0;
  return sourceText
    .split(/(<#.*?#>)/)
    .map((part, index) => {
      // Odd parts are placeholders; braces are the only template syntax
      // that needs escaping in plain text, and aren't allowed in fields. A
      // tab after `{` indents a block's body one level (e.g. `if`'s `code`).
      if (index % 2 === 0) return part.replace(/[{}]/g, "\\$&").replace(/\\\{\n(?!\t)/g, "\\{\n\t");
      const display = part.slice(2, -2).replace(/^T##/, "").split("##")[0]!;
      return `\${${++field}:${display.replace(/[{}]/g, "")}}`;
    })
    .join("");
}

/**
 * The CodeMirror option for a compiler completion item. `index` is the
 * item's position in the compiler's list, and `afterPound` whether a `#` is
 * typed right before the completion point.
 */
function completionOption(item: CompletionItem, index: number, afterPound: boolean): Completion {
  // `#if`, `#warning`, etc. are listed with their `#`; when it's already
  // typed, match without it and replace it on insertion.
  const replacesPound = afterPound && item.name.startsWith("#");
  return {
    // Match against the base name so argument labels don't produce spurious
    // fuzzy matches, and rank by the compiler's semantic score on top of
    // CodeMirror's match score, like SourceKit-LSP multiplies the two. A
    // score of 2 (or 0.5) adds (or subtracts) 50. The tiny per-item offset
    // keeps overloads (same name, type, and result) from being merged by
    // CodeMirror, and keeps them in the compiler's order.
    label: replacesPound ? item.name.slice(1) : item.name,
    displayLabel: item.label,
    detail: item.detail,
    type: item.kind,
    boost: Math.max(-99, Math.min(99, Math.round(50 * Math.log2(item.score)))) - index * 1e-6,
    // Insert the full call with its arguments as placeholder fields,
    // selecting the first; Tab and Shift-Tab move between them. `erase` also
    // replaces text before the completion point, e.g. `.` → `?.`, and an
    // argument list that closes its call replaces a typed `)`.
    apply: (view, completion, from, to) => {
      const end = item.closesCall && view.state.sliceDoc(to, to + 1) === ")" ? to + 1 : to;
      snippet(snippetTemplate(item.sourceText))(view, completion, from - item.erase - (replacesPound ? 1 : 0), end);
    },
  };
}

/**
 * Creates the CodeMirror completion source for Swift.
 *
 * Like SourceKit-LSP, completions are requested at the start of the
 * identifier being typed (or right after a trigger character) rather than at
 * the cursor, so the compiler returns everything valid at that point.
 * CodeMirror then filters that list by prefix and fuzzy match on every
 * keystroke without going back to the compiler. The last request is cached
 * by completion point, so retyping a word doesn't hit the compiler again.
 */
export function swiftCompletionSource(requestCompletions: CompletionProvider) {
  // The pending or settled request for the last completion point, so a
  // repeat request for it (even while it's running) doesn't re-run the
  // compiler. Failed requests aren't kept.
  let cache: { key: string; items: Promise<CompletionItem[]> } | null = null;

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
      const pending = requestCompletions(from);
      cache = { key, items: pending };
      pending.catch(() => {
        if (cache?.items === pending) cache = null;
      });
    }
    let items: CompletionItem[];
    try {
      items = await cache.items;
    } catch {
      return null;
    }
    if (!items.length) return null;

    const afterPound = state.sliceDoc(from - 1, from) === "#";
    return {
      from,
      options: items.map((item, index) => completionOption(item, index, afterPound)),
      getMatch: (_completion, matched) => matched ?? [],
      validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
    };
  };
}
