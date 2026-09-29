<script setup lang="ts" vapor>
import { nextTick, onBeforeMount, onBeforeUnmount, useTemplateRef, watch } from "vue";
import { useCompiler } from "./composables/useCompiler";
import { useWorkspace } from "./composables/useWorkspace";

import TopBar from "./components/TopBar.vue";
import CompilerConsole from "./components/CompilerConsole.vue";
import CodeEditor from "./components/CodeEditor.vue";
import FileTabs from "./components/FileTabs.vue";
import TimelinePanel from "./components/TimelinePanel.vue";
import LoadingCompiler from "./components/LoadingCompiler.vue";

import type { Diagnostic } from "./types/compiler";

const { workspace, fileNames, deleteFile, createFile, updateFile, selectFile } = useWorkspace();
const { loading, compiling, typechecking, diagnostics, output, preload, compile, typecheck, codeCompletion, terminate } = useCompiler();

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

onBeforeMount(() => {
  preload();
});

onBeforeUnmount(() => {
  clearTimeout(typecheckTimer);
  terminate();
});

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
    <TopBar :disabled="!compiling && loading === 1.0" @run="() => compile(workspace)" />

    <div class="body">
      <main class="editor-column">
        <FileTabs :files="fileNames" :active="workspace.active" @select="selectFile" @create="createFile" @delete="deleteClicked" />
        <CodeEditor ref="editor" :workspace="workspace" :complete="(p) => codeCompletion(workspace, p)" @change="updateFile" />
        <CompilerConsole :diagnostics="diagnostics" :output="output" :activity="null" @reveal="revealDiagnostic" />
      </main>

      <LoadingCompiler v-if="loading !== 1.0" :status="''" :error="loading?.message" :progress="typeof loading === 'number' ? loading : undefined" @retry="preload" />
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
