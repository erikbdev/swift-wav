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
import { autocompletion } from "@codemirror/autocomplete";
import { swift } from "@fazelstudio/codemirror-lang-swift";
import { tags as t } from "@lezer/highlight";

/**
 * Mounts the browser behavior for the SwiftWAV main page.
 *
 * The compiler itself is hosted by the bundled module Worker in
 * ./swift.worker.js.
 */
export function mountMainPage() {

  /**
   * @typedef {{files: Record<string, string>, active: string}} Workspace
   * @typedef {{severity: string, file: string, line: (number|null), column: (number|null), message: string}} Problem
   * @typedef {{text: string, kind: string}} OutputLine
   * @typedef {Record<string, any>} WorkerMessage
   */

const STORAGE_KEY = "swift-wav:workspace";

const DEFAULT_FILE = "Song.swift";
const DEFAULT_CONTENT = `struct MySong: Song {
  var body: some Timeline {
    Track("drums") {
      Pattern {
        Sample("bd")
        Sample("hh")
        Sample("sd")
        Sample("hh")
      }
    }
  }
}
`;

// ---------- Workspace state (files, tabs, active file) ----------

/** @returns {Workspace} */
function loadWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.files && Object.keys(parsed.files).length > 0) {
        // Only strings are valid CodeMirror documents. Older saved
        // workspaces can contain stale/non-string values, which would
        // otherwise produce an invalid Text tree on the first click.
        const files = Object.fromEntries(
          Object.entries(parsed.files).filter(([, content]) => typeof content === "string")
        );
        const names = Object.keys(files);
        if (names.length > 0) {
          return {
            files,
            active: names.includes(parsed.active) ? parsed.active : names[0],
          };
        }
      }
    }
  } catch {
    // ignore corrupt storage, fall through to defaults
  }
  return {
    files: { [DEFAULT_FILE]: DEFAULT_CONTENT },
    active: DEFAULT_FILE,
  };
}

/** @param {Workspace} ws */
function saveWorkspace(ws) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
  } catch {
    // storage full or unavailable; editing still works for this session
  }
}

// ---------- CodeMirror setup ----------

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

// ---------- App wiring ----------

/** @type {Workspace} */
let workspace = loadWorkspace();
/** @type {any|null} */
let view = null;

/** @type {HTMLDivElement|null} */
const tabBarEl = /** @type {HTMLDivElement|null} */ (document.getElementById("tab-bar"));
/** @type {HTMLDivElement|null} */
const hostEl = /** @type {HTMLDivElement|null} */ (document.getElementById("cm-host"));
/** @type {HTMLButtonElement|null} */
const problemsToggleEl = /** @type {HTMLButtonElement|null} */ (document.getElementById("problems-toggle"));
/** @type {HTMLDivElement|null} */
const problemsPanelEl = /** @type {HTMLDivElement|null} */ (document.getElementById("problems-panel"));
/** @type {HTMLSpanElement|null} */
const problemsStatusEl = /** @type {HTMLSpanElement|null} */ (document.getElementById("problems-status"));
/** @type {HTMLButtonElement|null} */
const outputToggleEl = /** @type {HTMLButtonElement|null} */ (document.getElementById("output-toggle"));
/** @type {HTMLDivElement|null} */
const outputPanelEl = /** @type {HTMLDivElement|null} */ (document.getElementById("output-panel"));

/** @param {string} filename */
function editorState(filename) {
  return EditorState.create({
    doc: workspace.files[filename] ?? "",
    extensions: [
      // Keep the setup extensions on the same view instance as the
      // editor. The aggregate `basicSetup` package can pull a second
      // copy of CodeMirror through the package manager's dependency resolver.
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
          /** @param {any} target */
          run: (target) => {
            target.dispatch(target.state.replaceSelection("  "));
            return true;
          },
        },
      ]),
      swift(),
      autocompletion({ override: [swiftCompletionSource] }),
      syntaxHighlighting(studioHighlight),
      studioTheme,
      EditorView.updateListener.of(/** @param {any} update */ (update) => {
        const { docChanged, state } = update;
        if (docChanged) {
          workspace.files[filename] = state.doc.toString();
          saveWorkspace(workspace);
          // Diagnostics belong to the last compiled snapshot. Clear
          // them as soon as that snapshot is edited, like an IDE's
          // Problems view while the next validation is pending.
          setProblems([], { close: true });
        }
      }),
    ],
  });
}

function destroyEditor() {
  if (!view) return;

  // Clear the browser's native selection before destroying the view.
  // Safari can deliver a queued selectionchange after the DOM view has
  // been removed; that stale event is what reaches CodeMirror's
  // lineInner/findPos code with an invalid text leaf.
  const currentView = view;
  currentView.contentDOM.blur();
  const selection = window.getSelection?.();
  if (selection?.anchorNode && hostEl?.contains(selection.anchorNode)) {
    selection.removeAllRanges();
  }
  currentView.destroy();
  view = null;
}

/** @param {string} filename */
function showEditor(filename) {
  if (!hostEl || !filename) return;
  destroyEditor();
  hostEl.replaceChildren();
  const state = editorState(filename);
  view = new EditorView({ state, parent: hostEl });
}

function syncEditorDocument() {
  if (!view || !workspace.active) return;
  try {
    workspace.files[workspace.active] = view.state.doc.toString();
    saveWorkspace(workspace);
  } catch {
    // Keep Run usable even if the browser reports a transient selection
    // or view-tree error while the document is being measured.
  }
}

/** @param {string} filename */
function switchTo(filename) {
  if (!(filename in workspace.files)) return;
  syncEditorDocument();
  workspace.active = filename;
  saveWorkspace(workspace);
  showEditor(filename);
  renderTabBar();
}

/** @param {string} filename */
function createFile(filename) {
  let name = filename.trim();
  if (name && !name.toLowerCase().endsWith(".swift")) name += ".swift";
  if (!name || name in workspace.files) return;
  syncEditorDocument();
  workspace.files[name] = "";
  workspace.active = name;
  saveWorkspace(workspace);
  showEditor(name);
  renderTabBar();
}

function showNewFileInput() {
  if (!tabBarEl || tabBarEl.querySelector(".new-tab")) return;
  const row = document.createElement("div");
  row.className = "new-tab";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "NewFile.swift";
  row.appendChild(input);
  const addButton = tabBarEl.querySelector(".tab-add");
  tabBarEl.insertBefore(row, addButton);
  input.focus();

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      createFile(input.value);
    } else if (e.key === "Escape") {
      renderTabBar();
    }
  });
  input.addEventListener("blur", () => renderTabBar());
}

function renderTabBar() {
  if (!tabBarEl) return;
  tabBarEl.innerHTML = "";

  for (const name of Object.keys(workspace.files)) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab" + (name === workspace.active ? " active" : "");
    tab.setAttribute("aria-selected", name === workspace.active ? "true" : "false");
    tab.addEventListener("click", () => switchTo(name));

    const label = document.createElement("span");
    label.textContent = name;
    tab.appendChild(label);

    tabBarEl.appendChild(tab);
  }

  const add = document.createElement("button");
  add.type = "button";
  add.className = "tab tab-add";
  add.textContent = "+";
  add.title = "New Swift file";
  add.addEventListener("click", showNewFileInput);
  tabBarEl.appendChild(add);
}

showEditor(workspace.active);
renderTabBar();

// ---------- In-browser Swift compilation ----------

/** @type {HTMLButtonElement|null} */
const runBtn = /** @type {HTMLButtonElement|null} */ (document.querySelector(".tb-btn.run"));
/** @type {HTMLSpanElement|null} */
const runLabelEl = /** @type {HTMLSpanElement|null} */ (document.getElementById("run-label"));
/** @type {HTMLSpanElement|null} */
const statusEl = /** @type {HTMLSpanElement|null} */ (document.getElementById("status-text"));

/** @type {Worker|null} */
let worker = null;
let nextRequestId = 0;
let running = false;
let toolchainReady = false;
/** @type {Problem[]} */
let problems = [];
let problemsOpen = false;
/** @type {OutputLine[]} */
let outputLines = [];
let outputOpen = false;

/** @returns {Worker} */
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./swift.worker.js", import.meta.url), { type: "module" });
  }
  return worker;
}

// ---------- Code completion (swift-ide-test) ----------

// Asks the worker to run swift-ide-test's code-completion pass at a
// UTF-16 offset into the active file, returning a flat item list.
/** @param {number} pos */
function fetchCompletions(pos) {
  return new Promise((resolve, reject) => {
    const id = ++nextRequestId;
    const w = getWorker();
    const doc = workspace.files[workspace.active] ?? "";
    const byteOffset = new TextEncoder().encode(doc.slice(0, pos)).length;

    /** @param {MessageEvent<WorkerMessage>} event */
    const onMessage = (event) => {
      const data = event.data;
      if (data.id !== id || data.type !== "completion-result") return;
      w.removeEventListener("message", onMessage);
      if (data.ok) resolve(data.items);
      else reject(new Error(data.error || "code completion failed"));
    };
    w.addEventListener("message", onMessage);
    w.postMessage({
      id,
      type: "complete",
      files: { ...workspace.files },
      primaryFile: workspace.active,
      offset: byteOffset,
    });
  });
}

// CodeMirror @codemirror/autocomplete completion source. Triggers on
// identifier prefixes and explicit invocation (e.g. Ctrl+Space); "."
// member-access completion is left for later since it needs a richer
// signal than a plain word match.
/** @param {any} context */
async function swiftCompletionSource(context) {
  const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
  if (!word && !context.explicit) return null;
  if (word && word.from === word.to && !context.explicit) return null;
  if (!workspace.active) return null;

  /** @type {any[]} */
  let items;
  try {
    items = await fetchCompletions(context.pos);
  } catch {
    return null;
  }
  if (!items.length) return null;

  return {
    from: word ? word.from : context.pos,
    options: items.map((/** @type {any} */ item) => ({
      label: item.label,
      detail: item.detail,
      type: item.kind,
    })),
    validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
  };
}

/** @param {string} text */
function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

/** @param {string} text */
function setRunLabel(text) {
  if (runLabelEl) runLabelEl.textContent = text;
}

/** @param {string} line @returns {Problem|null} */
function problemFromLine(line) {
  const text = String(line).trim();
  if (!text) return null;

  const match = text.match(/^(.*?):(\d+):(\d+):\s*(error|warning):\s*(.*)$/i);
  if (match) {
    return {
      severity: match[4].toLowerCase(),
      file: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
      message: match[5],
    };
  }

  const bareMatch = text.match(/^(error|warning):\s*(.*)$/i);
  if (bareMatch) {
    return {
      severity: bareMatch[1].toLowerCase(),
      file: "Swift",
      line: null,
      column: null,
      message: bareMatch[2],
    };
  }

  if (text.startsWith("[trap]")) {
    return { severity: "error", file: "runtime", line: null, column: null, message: text.slice(6).trim() };
  }

  return null;
}

/** @param {WorkerMessage} data @returns {Problem[]} */
function problemsFromResult(data) {
  const lines = [...(data.diagnostics ?? []), ...(data.stderr ?? [])]
    .flatMap((line) => String(line).split("\n"));
  const seen = new Set();
  const parsed = [];
  for (const line of lines) {
    const problem = problemFromLine(line);
    if (!problem) continue;
    const key = `${problem.severity}:${problem.file}:${problem.line}:${problem.column}:${problem.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      parsed.push(problem);
    }
  }
  if (!parsed.length && !data.ok) {
    parsed.push({
      severity: "error",
      file: "Swift",
      line: null,
      column: null,
      message: `Compilation failed at ${data.stage ?? "an unknown stage"}.`,
    });
  }
  return parsed;
}

/** @param {Problem} problem */
function jumpToProblem(problem) {
  if (!view || !problem.line) return;
  const filename = Object.keys(workspace.files).find((name) => problem.file?.endsWith(name));
  if (filename && filename !== workspace.active) switchTo(filename);
  if (!view) return;

  const lineNumber = Math.min(Math.max(problem.line, 1), view.state.doc.lines);
  const line = view.state.doc.line(lineNumber);
  const position = Math.min(line.from + Math.max((problem.column ?? 1) - 1, 0), line.to);
  view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
  view.focus();
}

function renderProblems() {
  if (!problemsToggleEl || !problemsPanelEl) return;
  const errorCount = problems.filter((problem) => problem.severity === "error").length;
  const warningCount = problems.filter((problem) => problem.severity === "warning").length;
  problemsToggleEl.className = "problems-toggle";
  if (errorCount) problemsToggleEl.classList.add("has-errors");
  else if (warningCount) problemsToggleEl.classList.add("has-warnings");
  problemsToggleEl.setAttribute("aria-expanded", problemsOpen ? "true" : "false");
  problemsToggleEl.innerHTML = `
    <span class="problems-icon">${errorCount ? "!" : warningCount ? "!" : "✓"}</span>
    <span>Problems</span>
    <span class="problems-count">${problems.length}</span>
  `;
  if (problemsStatusEl) {
    problemsStatusEl.textContent = problems.length
      ? `${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${warningCount === 1 ? "" : "s"}`
      : "No issues";
  }

  problemsPanelEl.classList.toggle("is-hidden", !problemsOpen);
  problemsPanelEl.innerHTML = "";
  if (!problems.length) {
    const empty = document.createElement("div");
    empty.className = "problems-empty";
    empty.textContent = "No Swift problems detected.";
    problemsPanelEl.appendChild(empty);
    return;
  }

  for (const problem of problems) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `problem-item ${problem.severity}`;
    item.addEventListener("click", () => jumpToProblem(problem));

    const severity = document.createElement("span");
    severity.className = "problem-severity";
    item.appendChild(severity);

    const location = document.createElement("span");
    location.className = "problem-location";
    location.textContent = problem.line ? `${problem.file}:${problem.line}:${problem.column}` : problem.file;
    item.appendChild(location);

    const message = document.createElement("span");
    message.className = "problem-message";
    message.textContent = problem.message;
    item.appendChild(message);

    problemsPanelEl.appendChild(item);
  }
}

/** @param {WorkerMessage} data @returns {OutputLine[]} */
function outputFromResult(data) {
  /** @type {OutputLine[]} */
  const lines = [];
  /** @param {any[]|undefined} values @param {string} kind */
  const appendLines = (values, kind) => {
    for (const value of values ?? []) {
      for (const text of String(value).split("\n")) lines.push({ text, kind });
    }
  };

  appendLines(data.stdout, "stdout");
  appendLines(data.stderr, "stderr");
  if (!lines.length) {
    lines.push({
      text: data.ok ? "Program produced no output." : `Run failed at ${data.stage ?? "an unknown stage"}.`,
      kind: "status",
    });
  }
  return lines;
}

function renderOutput() {
  if (!outputToggleEl || !outputPanelEl) return;
  outputToggleEl.className = "output-toggle";
  if (outputLines.length) outputToggleEl.classList.add("has-output");
  outputToggleEl.setAttribute("aria-expanded", outputOpen ? "true" : "false");
  outputToggleEl.innerHTML = `
    <span class="output-icon">${outputLines.length ? "•" : "›"}</span>
    <span>Output</span>
    <span class="output-count">${outputLines.length}</span>
  `;

  outputPanelEl.classList.toggle("is-hidden", !outputOpen);
  outputPanelEl.innerHTML = "";
  if (!outputLines.length) {
    const empty = document.createElement("div");
    empty.className = "output-empty";
    empty.textContent = "Run the active Swift file to see its output.";
    outputPanelEl.appendChild(empty);
    return;
  }

  for (const line of outputLines) {
    const item = document.createElement("div");
    item.className = `output-line ${line.kind ?? "stdout"}`;
    item.textContent = line.text;
    outputPanelEl.appendChild(item);
  }
}

/**
 * @param {OutputLine[]} nextLines
 * @param {{reveal?: boolean, close?: boolean}} [options]
 */
function setOutput(nextLines, options = {}) {
  outputLines = Array.isArray(nextLines) ? nextLines : [];
  if (options.reveal && outputLines.length) outputOpen = true;
  if (options.close) outputOpen = false;
  renderOutput();
}

/**
 * @param {Problem[]} nextProblems
 * @param {{reveal?: boolean, close?: boolean}} [options]
 */
function setProblems(nextProblems, options = {}) {
  problems = Array.isArray(nextProblems) ? nextProblems : [];
  if (options.reveal && problems.length) problemsOpen = true;
  if (options.close) problemsOpen = false;
  renderProblems();
}

problemsToggleEl?.addEventListener("click", () => {
  problemsOpen = !problemsOpen;
  if (problemsOpen) outputOpen = false;
  renderProblems();
  renderOutput();
});
renderProblems();
renderOutput();

outputToggleEl?.addEventListener("click", () => {
  outputOpen = !outputOpen;
  if (outputOpen) problemsOpen = false;
  renderProblems();
  renderOutput();
});

/** @param {number} bytes */
function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

// Kick off the precompressed toolchain download as soon as the page
// loads, rather than waiting for the first Run click. The button
// stays disabled until it lands.
function preloadToolchain() {
  if (runBtn) runBtn.disabled = true;
  setRunLabel("Downloading runtime…");
  setStatus("Downloading Swift toolchain…");

  const id = ++nextRequestId;
  const w = getWorker();

  /** @param {MessageEvent<WorkerMessage>} event */
  const onMessage = (event) => {
    const data = event.data;
    if (data.id !== id) return;

    if (data.type === "preload-progress") {
      if (data.total > 0) {
        setRunLabel(`Downloading runtime… ${formatMB(data.loaded)}/${formatMB(data.total)}MB`);
      } else {
        setRunLabel("Downloading runtime…");
      }
      return;
    }

    w.removeEventListener("message", onMessage);
    if (data.type === "preload-done") {
      toolchainReady = data.ok;
      if (data.ok) {
        setRunLabel("Run");
        setStatus("Ready");
        if (runBtn) runBtn.disabled = false;
      } else {
        setRunLabel("Run (retry download)");
        setStatus("Toolchain download failed");
        setProblems([
          {
            severity: "error",
            file: "Toolchain",
            line: null,
            column: null,
            message: `Failed to download Swift toolchain: ${data.error}`,
          },
        ], { reveal: true });
        if (runBtn) runBtn.disabled = false;
      }
    }
  };

  w.addEventListener("message", onMessage);
  w.postMessage({ id, type: "preload" });
}

function runCurrentFile() {
  if (running) return;
  if (!workspace.active) {
    setProblems(
      [{ severity: "error", file: "Swift", line: null, column: null, message: "No Swift file is active." }],
      { reveal: true }
    );
    return;
  }

  // Read from the live CodeMirror document at the point of execution,
  // rather than relying solely on the asynchronous update listener.
  syncEditorDocument();
  running = true;
  setProblems([], { close: true });
  setOutput([], { close: true });
  if (runBtn) runBtn.disabled = true;
  setStatus("Compiling…");

  const id = ++nextRequestId;
  const w = getWorker();

  /** @param {MessageEvent<WorkerMessage>} event */
  const onMessage = (event) => {
    const data = event.data;
    if (data.id !== id) return;

    if (data.type === "progress") {
      setStatus(data.message);
      return;
    }
    if (data.type === "download-progress") {
      if (data.total > 0) {
        setRunLabel(`Downloading runtime… ${formatMB(data.loaded)}/${formatMB(data.total)}MB`);
      } else {
        setRunLabel("Downloading runtime…");
      }
      return;
    }

    w.removeEventListener("message", onMessage);
    running = false;
    toolchainReady = true;
    setRunLabel("Run");
    if (runBtn) runBtn.disabled = false;

    const nextProblems = problemsFromResult(data);
    setProblems(nextProblems, nextProblems.length ? { reveal: true } : { close: true });
    setOutput(outputFromResult(data));

    if (data.ok) {
      setStatus("Ready");
    } else {
      setStatus(`Failed (${data.stage ?? "unknown"})`);
    }
  };

  w.addEventListener("message", onMessage);
  w.postMessage({
    id,
    type: "compile",
    files: { ...workspace.files },
    primaryFile: workspace.active,
  });
}

if (runBtn) runBtn.addEventListener("click", runCurrentFile);
preloadToolchain();

}
