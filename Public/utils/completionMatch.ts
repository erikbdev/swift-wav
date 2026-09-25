// Client-side filtering and ranking of completion results, modeled on
// SourceKit-LSP: the compiler is asked for completions once, at the start of
// the identifier being typed, and the typed prefix is then matched against
// that unfiltered list locally on every keystroke.

export type CompletionMatch<T> = {
  item: T;
  score: number;
  /** Matched ranges in the candidate as flat `[from, to, from, to, ...]` pairs. */
  ranges: number[];
};

// Match tiers, so that any exact match outranks any prefix match, which in
// turn outranks any fuzzy (subsequence) match.
const EXACT_CASE_SENSITIVE = 4000;
const EXACT = 3000;
const PREFIX_CASE_SENSITIVE = 2000;
const PREFIX = 1000;

// Per-character scoring for fuzzy matches.
const MATCH = 1;
const CASE_MATCH = 1;
const WORD_START = 8;
const CONSECUTIVE = 5;
const GAP = 1;
const LEADING_GAP_MAX = 3;

/**
 * The text a completion is matched against: its base name, e.g. "foo" for
 * "foo(x:)", so the argument labels don't produce spurious fuzzy matches.
 */
export function filterText(label: string): string {
  const paren = label.indexOf("(");
  return paren > 0 ? label.slice(0, paren) : label;
}

/** Whether `index` in `text` starts a word (start, after `_`, a camelCase hump, or after a digit). */
function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text[index - 1]!;
  const char = text[index]!;
  if (prev === "_" || prev === "$") return char !== "_";
  if (/[a-z]/.test(prev) && /[A-Z]/.test(char)) return true;
  if (/[0-9]/.test(prev) !== /[0-9]/.test(char)) return true;
  // The last capital of an acronym run followed by lowercase, e.g. "U" in "URLSession".
  if (/[A-Z]/.test(prev) && /[A-Z]/.test(char) && /[a-z]/.test(text[index + 1] ?? "")) return true;
  return false;
}

/**
 * Finds the best-scoring alignment of `pattern` as a case-insensitive
 * subsequence of `candidate`, rewarding matches at word starts and runs of
 * consecutive characters and penalizing skipped characters. Returns null if
 * `pattern` isn't a subsequence.
 */
function fuzzyMatch(pattern: string, candidate: string): { score: number; positions: number[] } | null {
  const m = pattern.length;
  const n = candidate.length;
  if (m > n) return null;

  const lowerPattern = pattern.toLowerCase();
  const lowerCandidate = candidate.toLowerCase();

  // score[i][j]: best score matching pattern[0...i] with pattern[i] at candidate[j].
  const score: number[][] = [];
  const parent: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(n).fill(-Infinity);
    const parents = new Array<number>(n).fill(-1);
    // Best of `score[i - 1][k] + GAP * k` over k < j - 1, so the gap penalty
    // `GAP * (j - k - 1)` can be applied in constant time per cell.
    let bestGapped = -Infinity;
    let bestGappedIndex = -1;
    for (let j = i; j < n - (m - 1 - i); j++) {
      if (i > 0 && j >= 2) {
        const k = j - 2;
        const value = score[i - 1]![k]! + GAP * k;
        if (value > bestGapped) {
          bestGapped = value;
          bestGappedIndex = k;
        }
      }
      if (lowerPattern[i] !== lowerCandidate[j]) continue;

      let charScore = MATCH;
      if (pattern[i] === candidate[j]) charScore += CASE_MATCH;
      if (isWordStart(candidate, j)) charScore += WORD_START;

      if (i === 0) {
        row[j] = charScore - Math.min(j, LEADING_GAP_MAX) * GAP;
        continue;
      }
      const consecutive = j > 0 ? score[i - 1]![j - 1]! + CONSECUTIVE : -Infinity;
      const gapped = bestGapped - GAP * (j - 1);
      if (consecutive === -Infinity && gapped === -Infinity) continue;
      if (consecutive >= gapped) {
        row[j] = charScore + consecutive;
        parents[j] = j - 1;
      } else {
        row[j] = charScore + gapped;
        parents[j] = bestGappedIndex;
      }
    }
    score.push(row);
    parent.push(parents);
  }

  let end = -1;
  let best = -Infinity;
  for (let j = 0; j < n; j++) {
    if (score[m - 1]![j]! > best) {
      best = score[m - 1]![j]!;
      end = j;
    }
  }
  if (end === -1) return null;

  const positions = new Array<number>(m);
  for (let i = m - 1, j = end; i >= 0; i--) {
    positions[i] = j;
    j = parent[i]![j]!;
  }
  return { score: best, positions };
}

/** Collapses sorted character positions into `[from, to, ...]` ranges. */
function toRanges(positions: number[]): number[] {
  const ranges: number[] = [];
  for (const position of positions) {
    if (ranges.length && ranges[ranges.length - 1] === position) ranges[ranges.length - 1] = position + 1;
    else ranges.push(position, position + 1);
  }
  return ranges;
}

/** Scores a single candidate against `pattern`, or returns null if it doesn't match. */
function matchCandidate(pattern: string, candidate: string): { score: number; ranges: number[] } | null {
  if (!pattern) return { score: 0, ranges: [] };

  const lowerPattern = pattern.toLowerCase();
  const lowerCandidate = candidate.toLowerCase();
  if (candidate === pattern) return { score: EXACT_CASE_SENSITIVE, ranges: [0, pattern.length] };
  if (lowerCandidate === lowerPattern) return { score: EXACT, ranges: [0, pattern.length] };
  // Within the prefix tiers, shorter candidates (closer to what was typed) rank first.
  if (candidate.startsWith(pattern)) return { score: PREFIX_CASE_SENSITIVE - candidate.length, ranges: [0, pattern.length] };
  if (lowerCandidate.startsWith(lowerPattern)) return { score: PREFIX - candidate.length, ranges: [0, pattern.length] };

  const fuzzy = fuzzyMatch(pattern, candidate);
  if (!fuzzy) return null;
  return { score: fuzzy.score, ranges: toRanges(fuzzy.positions) };
}

/**
 * Filters `items` down to those matching `pattern` by prefix or fuzzy
 * (subsequence) match and sorts them best-first. Ties keep the compiler's
 * original order, which already reflects its own semantic ranking.
 */
export function rankCompletions<T>(items: readonly T[], pattern: string, labelOf: (item: T) => string): CompletionMatch<T>[] {
  const matches: (CompletionMatch<T> & { index: number })[] = [];
  items.forEach((item, index) => {
    const match = matchCandidate(pattern, filterText(labelOf(item)));
    if (match) matches.push({ item, score: match.score, ranges: match.ranges, index });
  });
  matches.sort((a, b) => b.score - a.score || a.index - b.index);
  return matches;
}
