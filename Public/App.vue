<script setup lang="ts" vapor>
import { computed, nextTick, useTemplateRef } from "vue";
import TopBar from "./components/TopBar.vue";
import CompilerConsole from "./features/compiler/CompilerConsole.vue";
import RuntimePanel from "./features/compiler/RuntimePanel.vue";
import type { Diagnostic } from "./features/compiler/types";
import { useAutoTypecheck } from "./features/compiler/useAutoTypecheck";
import { useSwiftCompiler } from "./features/compiler/useSwiftCompiler";
import CodeEditor from "./features/editor/CodeEditor.vue";
import TimelinePanel from "./features/timeline/TimelinePanel.vue";
import FileTabs from "./features/workspace/FileTabs.vue";
import { useWorkspace } from "./features/workspace/useWorkspace";

const workspace = useWorkspace();
const compiler = useSwiftCompiler();
useAutoTypecheck(
  () => workspace.files,
  () => compiler.typecheck(workspace.snapshot()),
);

const { files, activeFile } = workspace;
const { runDisabled, diagnostics, output, activity, toolchainReady, status, loadError, loadingProgress } = compiler;
const fileNames = computed(() => Object.keys(files));
const codeEditor = useTemplateRef("editor");

function complete(position: number) {
  return compiler.autocomplete(workspace.snapshot(), position);
}

function run() {
  void compiler.run(workspace.snapshot());
}

async function revealDiagnostic(diagnostic: Diagnostic) {
  const target = fileNames.value.find((name) => diagnostic.file?.endsWith(name));
  if (target) workspace.selectFile(target);
  await nextTick();
  codeEditor.value?.reveal(diagnostic);
}
</script>

<template>
  <div class="app">
    <TopBar :disabled="runDisabled" @run="run" />

    <div class="body">
      <main class="editor-column">
        <FileTabs :files="fileNames" :active="activeFile" @select="workspace.selectFile" @create="workspace.createFile" @delete="workspace.deleteFile" />
        <CodeEditor ref="editor" :document="files[activeFile] ?? ''" :complete="complete" @change="workspace.updateFile(activeFile, $event)" />
        <CompilerConsole :diagnostics="diagnostics" :output="output" :activity="activity" @reveal="revealDiagnostic" />
      </main>

      <RuntimePanel v-if="!toolchainReady" :status="status" :error="loadError" :progress="loadingProgress" @retry="compiler.preload" />
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
