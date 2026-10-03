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
const { preloading, compiling, diagnostics, output, preload, compile, typecheck, codeCompletion } = useCompiler();

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

onBeforeUnmount(() => {
  clearTimeout(typecheckTimer);
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
  <div class="flex h-screen flex-col overflow-hidden bg-bg-0">
    <TopBar :disabled="preloading != 1.0 || compiling" @run="() => compile(workspace)" />

    <div class="flex min-h-0 flex-1 overflow-hidden max-[800px]:flex-col">
      <main class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-1 max-[800px]:min-h-[360px] max-[800px]:flex-[1_1_58%]">
        <FileTabs :files="fileNames" :active="workspace.active" @select="selectFile" @create="createFile" @delete="deleteClicked" />
        <CodeEditor ref="editor" :workspace="workspace" :complete="(p) => codeCompletion(workspace, p)" @change="updateFile" />
        <CompilerConsole :diagnostics="diagnostics" :output="output" :activity="null" @reveal="revealDiagnostic" />
      </main>

      <LoadingCompiler v-if="preloading !== 1.0" :state="preloading" @retry="preload" />
      <TimelinePanel v-else />
    </div>
  </div>
</template>
