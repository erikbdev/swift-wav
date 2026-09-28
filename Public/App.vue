<script setup lang="ts" vapor>
import { computed, nextTick, onBeforeUnmount, useTemplateRef, watch } from "vue";
import { useSwiftCompiler } from "./features/compiler/useSwiftCompiler";
import { useWorkspace } from "./features/workspace/useWorkspace";

import TopBar from "./components/TopBar.vue";
import CompilerConsole from "./features/compiler/CompilerConsole.vue";
import RuntimePanel from "./features/compiler/RuntimePanel.vue";
import CodeEditor from "./features/editor/CodeEditor.vue";
import FileTabs from "./features/editor/FileTabs.vue";
import TimelinePanel from "./features/timeline/TimelinePanel.vue";

import type { Diagnostic } from "./features/compiler/types";

const { workspace, deleteFile, createFile, updateFile, selectFile } = useWorkspace();
const { runDisabled, diagnostics, output, activity, toolchainReady, status, loadError, loadingProgress, typecheck, autocomplete, run, preload } = useSwiftCompiler();

const fileNames = computed(() => Object.keys(workspace.value.files));
const codeEditor = useTemplateRef("editor");
let typecheckTimer: ReturnType<typeof setTimeout> | undefined;

// Typecheck every 1500ms once user stops editing.
watch(
  workspace.value.files,
  () => {
    clearTimeout(typecheckTimer);
    typecheckTimer = setTimeout(() => typecheck(workspace.value), 1500);
  },
  { deep: true },
);

onBeforeUnmount(() => clearTimeout(typecheckTimer));

function complete(position: number) {
  return autocomplete(workspace.value, position);
}

function runClicked() {
  run(workspace.value);
}

function deleteClicked(filename: string) {
  codeEditor.value?.forgetFile(filename);
  deleteFile(filename);
}

async function revealDiagnostic(diagnostic: Diagnostic) {
  const target = fileNames.value.find((name) => diagnostic.file?.endsWith(name));
  if (target) selectFile(target);
  await nextTick();
  codeEditor.value?.reveal(diagnostic);
}
</script>
<template>
  <div class="app">
    <TopBar :disabled="runDisabled" @run="runClicked" />

    <div class="body">
      <main class="editor-column">
        <FileTabs :files="fileNames" :active="workspace.active" @select="selectFile" @create="createFile" @delete="deleteClicked" />
        <CodeEditor ref="editor" :workspace="workspace" :complete="complete" @change="updateFile" />
        <CompilerConsole :diagnostics="diagnostics" :output="output" :activity="activity" @reveal="revealDiagnostic" />
      </main>

      <RuntimePanel v-if="!toolchainReady" :status="status" :error="loadError" :progress="loadingProgress" @retry="preload" />
      <TimelinePanel v-else />
    </div>
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  background: var(--bg-0);
  overflow: hidden;
}

.body {
  display: flex;
  min-height: 0;
  height: calc(100% - var(--topbar-h));
  overflow: hidden;
}

.editor-column {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-1);
}

@media (max-width: 800px) {
  .body {
    flex-direction: column;
  }

  .editor-column {
    flex: 1 1 58%;
    min-height: 360px;
  }
}
</style>
