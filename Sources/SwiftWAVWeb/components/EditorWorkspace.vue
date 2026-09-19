<script setup lang="ts" vapor>
import { computed, nextTick, ref, unref, watch } from "vue";
import { useCodeMirror } from "../composables/useCodeMirror";
import { problemLocation } from "../utils/compiler-output";
import type { OutputLine, Problem } from "../types";
import type { CompletionItem } from "../workers/swift.worker";

const props = defineProps<{
  files: Record<string, string>;
  activeFile: string;
  problems: Problem[];
  output: OutputLine[];
  requestCompletions: (position: number) => Promise<CompletionItem[]>;
}>();

const emit = defineEmits<{
  "select-file": [filename: string];
  "create-file": [filename: string];
  "update-file": [payload: { name: string; content: string }];
  "delete-file": [filename: string];
}>();

const fileMap = computed(() => unref(props.files) || {});
const currentFile = computed(() => unref(props.activeFile) || "");
const problemList = computed(() => {
  const value = unref(props.problems);
  return Array.isArray(value) ? value : [];
});
const outputLines = computed(() => {
  const value = unref(props.output);
  return Array.isArray(value) ? value : [];
});

// ---------- Workspace tabs ----------

const isCreating = ref(false);
const newFileName = ref("");
const newFileInput = ref<HTMLInputElement | null>(null);
const fileNames = computed(() => Object.keys(fileMap.value));

function openCreateInput() {
  isCreating.value = true;
  newFileName.value = "";
  nextTick(() => newFileInput.value?.focus());
}

function cancelCreate() {
  isCreating.value = false;
  newFileName.value = "";
}

function submitCreate() {
  const name = newFileName.value;
  if (!name.trim()) {
    cancelCreate();
  }
  emit("create-file", name);
  cancelCreate();
}

function selectFile(filename: string) {
  emit("select-file", filename);
}

function deleteFile(filename: string) {
  emit("delete-file", filename);
}

// ---------- CodeMirror editor ----------

const editorHost = ref<HTMLElement | null>(null);
const editor = useCodeMirror({
  host: editorHost,
  getDocument: () => fileMap.value[currentFile.value] ?? "",
  onChange: (value) => {
    emit("update-file", { name: currentFile.value, content: value });
  },
  requestCompletions: (position) => props.requestCompletions(position),
});

watch(
  () => currentFile.value,
  async () => {
    await nextTick();
    editor.setDocument(fileMap.value[currentFile.value] ?? "");
  },
);

watch(
  () => fileMap.value[currentFile.value] ?? "",
  (value) => {
    if (value !== editor.getDocument()) editor.setDocument(value);
  },
);

// ---------- Problems and output ----------

const problemsOpen = ref(false);
const outputOpen = ref(false);
const errorCount = computed(() => problemList.value.filter((problem) => problem.severity === "error").length);
const warningCount = computed(() => problemList.value.filter((problem) => problem.severity === "warning").length);
const problemsStatus = computed(() =>
  problemList.value.length ? `${errorCount.value} error${errorCount.value === 1 ? "" : "s"}, ${warningCount.value} warning${warningCount.value === 1 ? "" : "s"}` : "No issues",
);

// A failed compile should surface its diagnostics immediately, while an
// edit clears the panel through the compiler composable just like an IDE.
watch(
  () => problemList.value,
  (nextProblems) => {
    if (nextProblems.length) {
      problemsOpen.value = true;
      outputOpen.value = false;
    } else {
      problemsOpen.value = false;
    }
  },
);

function toggleProblems() {
  problemsOpen.value = !problemsOpen.value;
  if (problemsOpen.value) outputOpen.value = false;
}

function toggleOutput() {
  outputOpen.value = !outputOpen.value;
  if (outputOpen.value) problemsOpen.value = false;
}

async function revealProblem(problem: Problem) {
  const target = Object.keys(fileMap.value).find((name) => problem.file?.endsWith(name));
  if (target && target !== currentFile.value) emit("select-file", target);

  await nextTick();
  editor.reveal(problem);
}
</script>

<template>
  <div class="editor-container">
    <div class="tabbar" role="tablist" aria-label="Swift files">
      <button v-for="name in fileNames" :key="name" role="tab" type="button" class="tab" :class="{ active: name === currentFile }" :aria-selected="name === currentFile" @click="selectFile(name)">
        <span>{{ name }}</span>
        <span class="tab-close" role="button" tabindex="-1" title="Delete file" @click.stop="deleteFile(name)"> × </span>
      </button>

      <div v-if="isCreating" class="new-tab">
        <input
          ref="newFileInput"
          v-model="newFileName"
          type="text"
          placeholder="NewFile.swift"
          autocomplete="off"
          @keydown.enter.prevent="submitCreate"
          @keydown.esc.prevent="cancelCreate"
          @blur="submitCreate"
        />
      </div>

      <button type="button" class="tab tab-add" title="New Swift file" @click="openCreateInput">+</button>
    </div>

    <div ref="editorHost" class="cm-host"></div>

    <div class="problems-bar">
      <button class="problems-toggle" :class="{ 'has-errors': errorCount, 'has-warnings': !errorCount && warningCount }" type="button" :aria-expanded="problemsOpen" @click="toggleProblems">
        <span class="problems-icon">{{ errorCount || warningCount ? "!" : "✓" }}</span>
        <span>Problems</span>
        <span class="problems-count">{{ problemList.length }}</span>
      </button>
      <button class="output-toggle" :class="{ 'has-output': outputLines.length }" type="button" :aria-expanded="outputOpen" @click="toggleOutput">
        <span class="output-icon">{{ outputLines.length ? "•" : "›" }}</span>
        <span>Output</span>
        <span class="output-count">{{ outputLines.length }}</span>
      </button>
      <span class="problems-status">{{ problemsStatus }}</span>
    </div>

    <div class="problems-panel" :class="{ 'is-hidden': !problemsOpen }">
      <div v-if="!problemList.length" class="problems-empty">No Swift problems detected.</div>
      <button
        v-for="problem in problemList"
        :key="`${problem.severity}:${problem.file}:${problem.line}:${problem.column}:${problem.message}`"
        type="button"
        :class="['problem-item', problem.severity]"
        @click="revealProblem(problem)"
      >
        <span class="problem-severity"></span>
        <span class="problem-location">{{ problemLocation(problem) }}</span>
        <span class="problem-message">{{ problem.message }}</span>
      </button>
    </div>

    <div class="output-panel" :class="{ 'is-hidden': !outputOpen }">
      <div v-if="!outputLines.length" class="output-empty">Run the active Swift file to see its output.</div>
      <div v-for="(line, index) in outputLines" :key="`${index}:${line.text}`" :class="['output-line', line.kind || 'stdout']">
        {{ line.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-container {
  flex: 1.6;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-1);
  position: relative;
}

/* ---------- Tab bar + editor ---------- */

.tabbar {
  display: flex;
  align-items: center;
  height: var(--tabbar-h);
  min-width: 0;
  padding: 0 10px;
  gap: 3px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border-faint);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-2);
  font-size: 12.5px;
  font-family: var(--mono);
  appearance: none;
  cursor: pointer;
  flex: 0 0 auto;
  white-space: nowrap;
  text-align: left;
  user-select: none;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}
.tab::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.45;
}
.tab:hover {
  background: var(--bg-3);
  color: var(--text-1);
}
.tab.active {
  background: var(--bg-3);
  color: var(--text-0);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.tab.active::before {
  opacity: 1;
  content: "";
}
.tab-close {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  border-radius: 3px;
  color: var(--text-3);
  font-size: 13px;
  line-height: 1;
  opacity: 0;
  transition:
    opacity 0.12s ease,
    background 0.12s ease,
    color 0.12s ease;
}
.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 1;
}
.tab-close:hover {
  background: var(--bg-4);
  color: var(--text-0);
}
.tab-add {
  width: 28px;
  flex-basis: 28px;
  justify-content: center;
  padding: 0;
  color: var(--text-2);
  font-family: var(--sans);
  font-size: 18px;
  line-height: 1;
}
.tab-add::before {
  display: none;
}
.tab-add:hover {
  color: var(--accent-hi);
}
.new-tab {
  display: flex;
  align-items: center;
  height: 28px;
  flex: 0 0 160px;
}
.new-tab input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--accent-line);
  border-radius: var(--r-sm);
  outline: none;
  background: var(--bg-2);
  color: var(--text-0);
  font: 12px var(--mono);
}
.cm-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-1);
}
.cm-host :deep(.cm-editor) {
  height: 100%;
}
.cm-host :deep(.cm-scroller) {
  overflow: auto;
}
.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  font-size: 12.5px;
  font-family: var(--mono);
}

/* ---------- Problems ---------- */

.problems-bar {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 0 8px;
  gap: 10px;
  background: var(--bg-2);
  border-top: 1px solid var(--border);
  color: var(--text-2);
  font-family: var(--mono);
  font-size: 10.5px;
  flex-shrink: 0;
}
.problems-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-1);
  font: inherit;
  cursor: pointer;
}
.problems-toggle:hover,
.problems-toggle[aria-expanded="true"] {
  background: var(--bg-3);
  border-color: var(--border);
  color: var(--text-0);
}
.problems-icon {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--text-3);
  color: var(--bg-0);
  font-size: 10px;
  font-weight: 700;
}
.problems-toggle.has-errors .problems-icon {
  background: var(--red);
  color: #fff;
}
.problems-toggle.has-warnings .problems-icon {
  background: var(--amber);
  color: var(--bg-0);
}
.problems-count {
  min-width: 16px;
  padding: 1px 5px;
  border-radius: 10px;
  background: var(--bg-4);
  color: var(--text-1);
  text-align: center;
}
.problems-status {
  color: var(--text-3);
}
.output-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-1);
  font: inherit;
  cursor: pointer;
}
.output-toggle:hover,
.output-toggle[aria-expanded="true"] {
  background: var(--bg-3);
  border-color: var(--border);
  color: var(--text-0);
}
.output-icon {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--text-3);
  color: var(--bg-0);
  font-size: 10px;
  font-weight: 700;
}
.output-toggle.has-output .output-icon {
  background: var(--blue);
  color: #fff;
}
.output-count {
  min-width: 16px;
  padding: 1px 5px;
  border-radius: 10px;
  background: var(--bg-4);
  color: var(--text-1);
  text-align: center;
}
.problems-panel {
  position: absolute;
  right: 8px;
  bottom: 38px;
  left: 8px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  max-height: min(320px, 45vh);
  overflow-y: auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  background: rgba(27, 26, 24, 0.98);
  box-shadow: var(--shadow-card);
}
.problems-panel.is-hidden {
  display: none;
}
.problem-item {
  display: grid;
  grid-template-columns: 9px minmax(100px, 175px) 1fr;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  padding: 7px 11px;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--border-faint);
  background: transparent;
  color: var(--text-1);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.problem-item:last-child {
  border-bottom: 0;
}
.problem-item:hover {
  background: var(--bg-3);
}
.problem-severity {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--amber);
}
.problem-item.error .problem-severity {
  background: var(--red);
}
.problem-location {
  overflow: hidden;
  color: var(--text-3);
  font: 10px var(--mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.problem-message {
  overflow: hidden;
  color: var(--text-0);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.problems-empty {
  padding: 14px;
  color: var(--text-3);
  font: 11px var(--mono);
}
.output-panel {
  position: absolute;
  right: 8px;
  bottom: 38px;
  left: 8px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  max-height: min(320px, 45vh);
  overflow-y: auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  background: rgba(27, 26, 24, 0.98);
  box-shadow: var(--shadow-card);
}
.output-panel.is-hidden {
  display: none;
}
.output-line {
  padding: 7px 11px;
  border-bottom: 1px solid var(--border-faint);
  color: var(--text-0);
  font: 11.5px/1.45 var(--mono);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.output-line:last-child {
  border-bottom: 0;
}
.output-line.stderr {
  color: var(--red);
}
.output-line.status {
  color: var(--text-2);
  font-style: italic;
}
.output-empty {
  padding: 14px;
  color: var(--text-3);
  font: 11px var(--mono);
}

@media (max-width: 800px) {
  .editor-container {
    flex: 1 1 58%;
    min-height: 360px;
  }
}
</style>
