<script setup lang="ts" vapor>
import type { Output } from "./types";

defineProps<{
  output: Output[];
}>();

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
</script>

<template>
  <div class="output">
    <div v-if="!output.length" class="empty">No output.</div>
    <div v-for="(entry, i) in output" :key="i" class="output-item">
      <span class="output-timestamp">{{ formatTimestamp(entry.timestamp) }}</span>
      <pre class="output-message">{{ entry.message }}</pre>
    </div>
  </div>
</template>

<style scoped>
.output {
  display: flex;
  flex-direction: column;
}
.output-item {
  display: flex;
  gap: 10px;
  padding: 6px 11px;
  border-bottom: 1px solid var(--border-faint);
  font: 11.5px var(--mono);
}
.output-item:last-child {
  border-bottom: 0;
}
.output-timestamp {
  flex-shrink: 0;
  color: var(--text-3);
}
.output-message {
  margin: 0;
  overflow-x: auto;
  white-space: pre;
  color: var(--text-0);
}
.empty {
  padding: 14px;
  color: var(--text-3);
  font: 11px var(--mono);
}
</style>
