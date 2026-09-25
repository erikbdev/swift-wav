// Parses swift-ide-test's `-code-completion` output into completion items
// shaped after SourceKit-LSP's: a base name to filter on, a readable label,
// a semantic score for ranking, and insert text with Xcode-style editor
// placeholders, with trailing closures already expanded.

import type { CompletionItem } from "../types";

/**
 * One result line:
 *   Decl[FreeFunction]/OtherModule[Swift]/IsSystem: print({#(items): Any...#})[#Void#]; name=print(:); sourcetext=print(<#T##items: Any...##Any#>)
 * a tag of `/`-separated flags (see CodeCompletionResult::printPrefix), the
 * completion string, then `; key=value` fields in the order
 * printCodeCompletionResultsImpl prints them, of which `name` always comes.
 */
const RESULT_LINE = /^(\S+): +(.*?); name=(.*?)(?:; sourcetext=(.*?))?(?:; (?:briefcomment|xmlcomment|rawcomment|diagnostics)=.*)?$/;

/** Parses swift-ide-test's `-code-completion` stdout, dropping duplicate signatures. */
export function parseCompletionResults(stdoutLines: string[]): CompletionItem[] {
  if (!stdoutLines[0]?.startsWith("found code completion token")) return [];

  const items: CompletionItem[] = [];
  const seen = new Set<string>();
  for (const line of stdoutLines.slice(1)) {
    if (line.startsWith("End completions")) break;
    const item = parseResultLine(line);
    const key = item && `${item.label}\u0000${item.detail}`;
    if (!item || seen.has(key!)) continue;
    seen.add(key!);
    items.push(item);
  }
  return items;
}

function parseResultLine(line: string): CompletionItem | null {
  const match = RESULT_LINE.exec(line);
  if (!match?.[3]) return null;
  const [, rawTag, completion, name, sourceText] = match as unknown as [string, string, string, string, string | undefined];
  const tag = parseTag(rawTag);

  // The result type is the trailing `[#Type#]`; the type itself may contain
  // brackets, e.g. `[#[Int]#]`.
  const typeStart = completion.endsWith("#]") ? completion.lastIndexOf("[#") : -1;
  const signature = typeStart === -1 ? completion : completion.slice(0, typeStart);
  const baseName = (name.startsWith("(") ? name : name.split("(")[0]) || name;

  return {
    name: baseName,
    label: readableCompletion(signature),
    detail: typeStart === -1 ? "" : readableCompletion(completion.slice(typeStart + 2, -2)),
    kind: completionKind(tag),
    score: semanticScore(tag),
    ...insertion(sourceText === undefined ? baseName : unescapeSourceText(sourceText), signature, tag),
  };
}

// ---------- Tags ----------

/** A result's tag, e.g. `Decl[LocalVar]/Local/TypeRelation[Convertible]`. */
type Tag = {
  /** The result kind, e.g. "Decl[InstanceMethod]", "Keyword[func]", "Literal[Integer]", "Pattern". */
  kind: string;
  /** The declaration kind for `Decl[...]` results, e.g. "InstanceMethod". */
  decl: string | undefined;
  /** The semantic context without its module name, e.g. "Local", "CurrNominal", "OtherModule". */
  context: string;
  /** The remaining flags, e.g. "IsSystem", "NotRecommended", "TypeRelation[Convertible]", "Erase[1]". */
  flags: string[];
  flair: string[];
};

function parseTag(tag: string): Tag {
  const [kind = "", context = "", ...flags] = tag.split("/");
  return {
    kind,
    decl: /^Decl\[(\w+)\]$/.exec(kind)?.[1],
    context: context.replace(/\[.*$/, ""),
    flags,
    flair:
      flags
        .find((flag) => flag.startsWith("Flair["))
        ?.slice(6, -1)
        .split(",") ?? [],
  };
}

const VARIABLE_DECLS = new Set(["InstanceVar", "StaticVar", "LocalVar", "GlobalVar"]);

/** CodeMirror completion types (used for icons) by declaration kind. */
const DECL_COMPLETION_KINDS: Record<string, string> = {
  Module: "namespace",
  Class: "class",
  Actor: "class",
  Struct: "type",
  Enum: "type",
  Protocol: "type",
  TypeAlias: "type",
  AssociatedType: "type",
  GenericTypeParam: "type",
  Macro: "type",
  EnumElement: "enum",
  InstanceMethod: "function",
  StaticMethod: "function",
  FreeFunction: "function",
  Constructor: "function",
  Destructor: "function",
  Subscript: "function",
  PrefixOperatorFunction: "function",
  PostfixOperatorFunction: "function",
  InfixOperatorFunction: "function",
  InstanceVar: "variable",
  StaticVar: "variable",
  LocalVar: "variable",
  GlobalVar: "variable",
};

function completionKind(tag: Tag): string {
  if (tag.kind.startsWith("Keyword")) return "keyword";
  if (tag.kind.startsWith("Literal")) return "constant";
  return (tag.decl && DECL_COMPLETION_KINDS[tag.decl]) ?? "text";
}

// ---------- Semantic score ----------

// Factors from SourceKit-LSP's CompletionScoring (SemanticClassification),
// mapped from the flags swift-ide-test prints. It prints no import depth or
// popularity data, so those factors stay neutral.

/** CompletionKind factors by declaration kind; other declarations get 1.025, non-declarations 1. */
const DECL_FACTORS: Record<string, number> = {
  EnumElement: 1.1,
  InstanceVar: 1.075,
  StaticVar: 1.075,
  LocalVar: 1.075,
  GlobalVar: 1.075,
  Constructor: 1.02,
  Module: 0.925,
};

/** ScopeProximity × ModuleProximity factors by semantic context. */
const CONTEXT_FACTORS: Record<string, number> = {
  Local: 1.5 * 1.05,
  CurrNominal: 1.35 * 1.05,
  Super: 1.325,
  OutNominal: 1.325 * 1.05,
  CurrModule: 0.95 * 1.05,
  OtherModule: 0.95 * 1.0125,
};

/** Factors for the remaining flags: SDK symbols, expected-type fit, and deprecation (and the like). */
const FLAG_FACTORS: Record<string, number> = {
  IsSystem: 0.995,
  "TypeRelation[Convertible]": 1.3,
  "TypeRelation[Invalid]": 0.3,
  NotRecommended: 0.5,
};

const FLAIR_FACTORS: Record<string, number> = {
  ExprSpecific: 1.5,
  SuperChain: 1.5,
  CommonKeyword: 1.25,
  RareKeyword: 0.75,
  RareType: 0.75,
  ExprAtFileScope: 0.125,
};

function semanticScore(tag: Tag): number {
  let score = tag.flair.includes("ArgLabels") ? 2 : tag.decl ? (DECL_FACTORS[tag.decl] ?? 1.025) : 1;
  score *= CONTEXT_FACTORS[tag.context] ?? 1;
  // Global variables and enum cases rank a little lower.
  const isGlobal = tag.context === "CurrModule" || tag.context === "OtherModule";
  if (isGlobal && tag.decl && (VARIABLE_DECLS.has(tag.decl) || tag.decl === "EnumElement")) score *= 0.75;
  for (const flag of tag.flags) score *= FLAG_FACTORS[flag] ?? 1;
  for (const flair of tag.flair) score *= FLAIR_FACTORS[flair] ?? 1;
  return score;
}

// ---------- Display text ----------

/**
 * Turns swift-ide-test's completion string markup into readable text:
 * `{#(items): Any...#}` placeholders become `items: Any...`, a `##`-separated
 * closure type is dropped, `[' throws']` annotations become ` throws`, and
 * `[#Type#]` markers are unwrapped.
 */
function readableCompletion(text: string): string {
  return text
    .replace(/##.*?#\}/g, "#}")
    .replace(/\{#\((\w+)\)/g, "{#$1")
    .replace(/\{#|#\}|\[#|#\]/g, "")
    .replace(/\['(.*?)'\]/g, "$1");
}

// ---------- Insert text ----------

/**
 * Undoes the escaping swift-ide-test applies to `sourcetext` (LLVM's
 * `write_escaped`): `\\`, `\n`, `\t`, `\"`, and octal `\ooo` escapes for
 * every other non-printable byte, including each byte of non-ASCII UTF-8.
 */
function unescapeSourceText(text: string): string {
  if (!text.includes("\\")) return text;
  const encoder = new TextEncoder();
  const bytes: number[] = [];
  for (const part of text.split(/(\\(?:[0-7]{3}|.))/)) {
    if (!part.startsWith("\\")) bytes.push(...encoder.encode(part));
    else if (/^\\[0-7]{3}$/.test(part)) bytes.push(parseInt(part.slice(1), 8));
    else bytes.push(...encoder.encode(part[1] === "n" ? "\n" : part[1] === "t" ? "\t" : part[1]!));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/**
 * The insert text for a result, with trailing closures expanded.
 *
 * Right after a call's `(`, the result is its argument list: the signature
 * is wrapped in `['(']` ... `[')']`, but the source text has neither paren.
 * It's completed as the whole call so it gets its `)` and trailing closures,
 * and then the `(` that's already typed is dropped, or erased too when no
 * parenthesized arguments remain (`Box(` → `Box { }`).
 */
function insertion(sourceText: string, signature: string, tag: Tag): Pick<CompletionItem, "sourceText" | "erase" | "closesCall"> {
  const erase = Number(tag.flags.find((flag) => flag.startsWith("Erase["))?.slice(6, -1) ?? 0);
  const closesCall = signature.startsWith("['(']") && /\[' ?\)'\]$/.test(signature);
  if (!closesCall) return { sourceText: expandTrailingClosures(sourceText), erase, closesCall };

  const call = expandTrailingClosures(`_(${sourceText})`);
  const keepsParens = call.startsWith("_(");
  return { sourceText: call.slice(keepsParens ? 2 : 1), erase: erase + (keepsParens ? 0 : 1), closesCall };
}

/**
 * Splits `text` at each `separator` that isn't nested in brackets or inside
 * an editor placeholder (`<#...#>`). `->` never counts as a closing `>`.
 */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("<#", i)) {
      const end = text.indexOf("#>", i + 2);
      if (end === -1) break;
      i = end + 1;
    } else if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(text.slice(start, i));
      start = i + separator.length;
      i = start - 1;
    } else if (text.startsWith("->", i)) {
      i++;
    } else if ("([<".includes(text[i]!)) {
      depth++;
    } else if (")]>".includes(text[i]!)) {
      depth--;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/**
 * Expands a function type such as `(_ someInt: Int) -> String` into a closure
 * literal the way SourceKit-LSP does (swift-syntax's ExpandEditorPlaceholder),
 * with the body indented by a tab (one indent unit when inserted):
 * parameters are named after the argument name, else the label, else become
 * a placeholder for their type, and the body is a `code` placeholder for
 * `Void` or a placeholder for the result type. Returns null for anything that
 * isn't a function type, including optional ones like `((Int) -> Void)?`.
 */
function closureExpansion(type: string): string | null {
  const [input = "", ...output] = splitTopLevel(type.trim().replace(/^(@\w+(\([^)]*\))?\s+)*/, ""), "->");
  const parameters = /^\((.*)\)(\s+(async|throws(\(.*\))?|rethrows))*\s*$/s.exec(input.trim())?.[1];
  if (!output.length || parameters === undefined) return null;

  const names = splitTopLevel(parameters, ",")
    .map((parameter) => parameter.trim())
    .filter(Boolean)
    .map((parameter) => {
      const [label, parameterType] = splitTopLevel(parameter, ":");
      if (parameterType === undefined) return `<#${parameter}#>`;
      const [firstName, secondName] = label!.trim().split(/\s+/);
      if (secondName && secondName !== "_") return secondName;
      if (firstName && firstName !== "_") return firstName;
      return `<#${parameterType.trim()}#>`;
    });
  const result = output.join("->").trim();
  const body = result === "Void" || result === "()" ? "<#code#>" : `<#T##${result}##${result}#>`;
  return `{${names.length ? ` ${names.join(", ")} in` : ""}\n\t${body}\n}`;
}

/**
 * Rewrites a call's trailing function-typed placeholder arguments as
 * trailing closures, as Xcode does on expanding them and swift-syntax's
 * ExpandEditorPlaceholdersToLiteralClosures does by default:
 * `map(<#T##(Int) -> T#>)` becomes `map { <#Int#> in <#T#> }`. The first
 * closure is unlabeled, later ones keep their labels, and the parentheses
 * are dropped when no other arguments remain.
 */
function expandTrailingClosures(sourceText: string): string {
  if (!sourceText.endsWith(")") || !sourceText.includes("->")) return sourceText;

  // Find the `(` opening the final argument list.
  const opens: number[] = [];
  let open = -1;
  for (let i = 0; i < sourceText.length; i++) {
    if (sourceText.startsWith("<#", i)) {
      i = sourceText.indexOf("#>", i + 2);
      if (i === -1) return sourceText;
      i++;
    } else if (sourceText[i] === "(") {
      opens.push(i);
    } else if (sourceText[i] === ")") {
      open = opens.pop() ?? -1;
    }
  }
  // A trailing closure needs a callee right before the parentheses.
  const callee = sourceText.slice(0, open);
  if (open === -1 || opens.length || !/[\w)\]>?!]$/.test(callee)) return sourceText;

  const args = splitTopLevel(sourceText.slice(open + 1, -1), ",").map((arg) => {
    const match = /^\s*(?:(\w+):\s*)?<#(.*)#>\s*$/s.exec(arg);
    // Placeholder formats: `T##display##type##expansion-type`, `T##display`.
    const parts = match?.[2]!.startsWith("T##") ? match[2].slice(3).split("##") : [];
    const closure = parts.length ? closureExpansion(parts[2] ?? parts[1] ?? parts[0]!) : null;
    return { text: arg.trim(), label: match?.[1], closure };
  });
  let firstClosure = args.length;
  while (firstClosure > 0 && args[firstClosure - 1]!.closure) firstClosure--;
  if (firstClosure === args.length) return sourceText;

  const remaining = args.slice(0, firstClosure).map((arg) => arg.text);
  const closures = args.slice(firstClosure).map((arg, index) => (index === 0 ? arg.closure : `${arg.label ?? "_"}: ${arg.closure}`));
  return `${callee}${remaining.length ? `(${remaining.join(", ")})` : ""} ${closures.join(" ")}`;
}
