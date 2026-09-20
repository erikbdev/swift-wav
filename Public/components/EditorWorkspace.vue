<script setup lang="ts" vapor>
import { computed, nextTick, ref, unref, watch } from "vue";
import { useCodeMirror } from "../composables/useCodeMirror";
import type { CompletionItem, Diagnostic } from "../workers/swift.worker";

const props = defineProps<{
  files: Record<string, string>;
  activeFile: string;
  diagnostics: Diagnostic[];
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
const diagnosticList = computed(() => {
  const value = unref(props.diagnostics);
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

const diagnosticsOpen = ref(false);
const errorCount = computed(() => diagnosticList.value.filter((problem) => problem.severity === "error").length);
const warningCount = computed(() => diagnosticList.value.filter((problem) => problem.severity === "warning").length);

// A failed compile should surface its diagnostics immediately, while an
// edit clears the panel through the compiler composable just like an IDE.
watch(
  () => diagnosticList.value,
  (nextDiagnostic) => {
    if (nextDiagnostic.length) {
      diagnosticsOpen.value = true;
    } else {
      diagnosticsOpen.value = false;
    }
  },
);

function toggleDiagnostics() {
  diagnosticsOpen.value = !diagnosticsOpen.value;
}

async function revealDiagnostic(diagnostic: Diagnostic) {
  const target = Object.keys(fileMap.value).find((name) => diagnostic.file?.endsWith(name));
  if (target && target !== currentFile.value) emit("select-file", target);

  await nextTick();
  editor.reveal(diagnostic);
}

// A pointer line underlines the span a diagnostic refers to with only
// whitespace, "^", and "~" characters (e.g. "  ^~~~~~~~").
const POINTER_ONLY = /^[\s^~]*[\^~][\s^~]*$/;
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

    <div class="editor-container">
      <div ref="editorHost" class="cm-host"></div>
      <div class="diagnostics-panel" :hidden="!diagnosticsOpen">
        <div v-if="!diagnosticList.length" class="diagnostics-empty">No diagnostics.</div>
        <button
          v-for="diagnostic in diagnosticList"
          :key="`${diagnostic.severity}:${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.message}`"
          type="button"
          :class="['diagnostic-item', diagnostic.severity]"
          @click="revealDiagnostic(diagnostic)"
        >
          <span v-if="diagnostic.file" class="diagnostic-location">{{ [diagnostic.file, diagnostic.line, diagnostic.column].filter((s) => s !== null && s !== undefined).join(":") }}: </span>
          <span class="diagnostic-severity">{{ diagnostic.severity }}: </span>
          <span class="diagnostic-message-lead">{{ diagnostic.message.split("\n")[0] }}</span>
          <pre
            class="diagnostic-context-lines"
          ><span v-for="(line, i) in diagnostic.message.split('\n').slice(1)" class="diagnostic-message-context"><span v-if="diagnostic.line" class="context-segment gutter">{{ i === 0 ? diagnostic.line : " ".repeat(String(diagnostic.line).length) }} | </span><span class="context-segment" :class="{ pointer: POINTER_ONLY.test(line) }">{{ line }}</span></span></pre>
        </button>
      </div>
    </div>

    <div class="diagnostics-bar">
      <button class="diagnostics-toggle" :class="{ 'has-errors': errorCount, 'has-warnings': !errorCount && warningCount }" type="button" :aria-expanded="diagnosticsOpen" @click="toggleDiagnostics">
        <span class="diagnostics-icon">{{ errorCount || warningCount ? "!" : "✓" }}</span>
        <span>Diagnostics</span>
        <span class="diagnostics-count">{{ diagnosticList.length }}</span>
      </button>
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
.editor-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-1);
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

/* ---------- Diagnostics ---------- */

.diagnostics-bar {
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
.diagnostics-toggle {
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
.diagnostics-toggle:hover,
.diagnostics-toggle[aria-expanded="true"] {
  background: var(--bg-3);
  border-color: var(--border);
  color: var(--text-0);
}
.diagnostics-icon {
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
.diagnostics-toggle.has-errors .diagnostics-icon {
  background: var(--red);
  color: #fff;
}
.diagnostics-toggle.has-warnings .diagnostics-icon {
  background: var(--amber);
  color: var(--bg-0);
}
.diagnostics-count {
  min-width: 16px;
  padding: 1px 5px;
  border-radius: 10px;
  background: var(--bg-4);
  color: var(--text-1);
  text-align: center;
}

.diagnostics-panel {
  position: absolute;
  right: 0px;
  bottom: 0px;
  left: 0px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  max-height: min(320px, 45vh);
  overflow-y: auto;
  border: 1px solid var(--border-strong);
  border-bottom: 0;
  background: rgba(27, 26, 24, 0.98);
  box-shadow: var(--shadow-card);
}
.diagnostic-item {
  display: inline;
  flex-direction: column;
  gap: 4px;
  padding: 7px 11px;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--border-faint);
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: 11.5px var(--mono);
  font-weight: 700;
  color: var(--text-0);
}
.diagnostic-item:last-child {
  border-bottom: 0;
}
.diagnostic-item:hover {
  background: var(--bg-3);
}
.diagnostic-meta {
  display: flex;
  gap: 8px;
  overflow: hidden;
}
.diagnostic-location {
  overflow: hidden;
  color: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.diagnostic-severity {
  flex-shrink: 0;
  color: var(--amber);
}
.diagnostic-item.error .diagnostic-severity {
  color: var(--red);
}
.diagnostic-item.note .diagnostic-severity {
  color: var(--blue);
}
.diagnostic-message {
  display: inline;
  overflow-x: auto;
  margin: 0;
  white-space: pre;
}
.diagnostic-message-lead {
  color: inherit;
  /* font-weight: 600; */
}
.diagnostic-context-lines {
  margin: 0;
  padding: 0;
  font: inherit;
}
.diagnostic-message-context {
  display: block;
  color: var(--text-1);
  font-weight: 500;
  font-family: var(--mono);
  white-space: pre;
}
.context-segment.gutter {
  color: var(--text-3);
}
.context-segment.pointer {
  color: var(--green);
  font-weight: 700;
}
.diagnostics-empty {
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
