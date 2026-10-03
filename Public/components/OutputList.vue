<script setup lang="ts" vapor>
import type { Output } from "../types/compiler";

defineProps<{
  output: Output[];
}>();

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
</script>

<template>
  <div class="flex flex-col">
    <div v-if="!output.length" class="p-3.5 font-mono text-[11px] text-text-3">No output.</div>
    <div v-for="(entry, i) in output" :key="i" class="flex gap-2.5 border-b border-border-faint px-2.75 py-1.5 font-mono text-[11.5px] last:border-b-0">
      <span class="shrink-0 text-text-3">{{ formatTimestamp(entry.timestamp) }}</span>
      <pre class="overflow-x-auto whitespace-pre text-text-0">{{ entry.message }}</pre>
    </div>
  </div>
</template>
