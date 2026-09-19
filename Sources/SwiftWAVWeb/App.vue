<script setup lang="ts" vapor>
import EditorWorkspace from "./components/EditorWorkspace.vue";
import StatusBar from "./components/StatusBar.vue";
import TimelinePanel from "./components/TimelinePanel.vue";
import TopBar from "./components/TopBar.vue";
import { useSwiftCompiler } from "./composables/useSwiftCompiler";
import { useWorkspace } from "./composables/useWorkspace";

const workspace = useWorkspace();
const compiler = useSwiftCompiler();
const { files, activeFile } = workspace;
const { runLabel, runDisabled, problems, output, status } = compiler;

function handleFileUpdate({ name, content }: { name: string; content: string }) {
  workspace.updateFile(name, content);
}

function requestCompletions(position: number) {
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
        @delete-file="workspace.deleteFile"
      />

      <br />

      <div class="loading-toolchain" v-if="!compiler.toolchainReady.value">
        <progress max="1" :value="compiler.loadingProgress.value"></progress>
        <p>Preparing Swift compiler...</p>
      </div>
      <TimelinePanel v-else />
    </div>

    <!-- <StatusBar :status="status" /> -->
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

.loading-toolchain {
  width: 100%;
}

@media (max-width: 800px) {
  .body {
    flex-direction: column;
  }
}
</style>
