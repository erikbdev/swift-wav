<script setup vapor>
import EditorWorkspace from "./components/EditorWorkspace.vue";
import StatusBar from "./components/StatusBar.vue";
import TimelinePanel from "./components/TimelinePanel.vue";
import TopBar from "./components/TopBar.vue";
import { useSwiftCompiler } from "./composables/useSwiftCompiler.js";
import { useWorkspace } from "./composables/useWorkspace.js";

const workspace = useWorkspace();
const compiler = useSwiftCompiler();
const { files, activeFile } = workspace;
const { runLabel, runDisabled, problems, output, status } = compiler;

/** @param {{name: string, content: string}} update */
function handleFileUpdate({ name, content }) {
  workspace.updateFile(name, content);
  compiler.clearProblems();
}

/** @param {number} position @returns {Promise<any[]>} */
function requestCompletions(position) {
  return compiler.complete(workspace.snapshot(), position);
}

function runCurrentFile() {
  void compiler.run(workspace.snapshot());
}
</script>

<template>
  <div class="app">
    <TopBar :run-label="runLabel" :disabled="runDisabled" @run="runCurrentFile" />

    <div class="body">
      <EditorWorkspace
        :files="files"
        :active-file="activeFile"
        :problems="problems"
        :output="output"
        :request-completions="requestCompletions"
        @select-file="workspace.selectFile"
        @create-file="workspace.createFile"
        @update-file="handleFileUpdate"
      />
      <TimelinePanel />
    </div>

    <StatusBar :status="status" />
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  display: grid;
  grid-template-rows: var(--topbar-h) 1fr var(--status-h);
  background: var(--bg-0);
  overflow: hidden;
}
.body {
  display: flex;
  min-height: 0;
}

@media (max-width: 800px) {
  .body {
    flex-direction: column;
  }
}
</style>
