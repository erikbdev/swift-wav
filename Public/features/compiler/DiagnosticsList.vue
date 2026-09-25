<script setup lang="ts" vapor>
import type { Diagnostic } from "./types";

defineProps<{
  diagnostics: Diagnostic[];
}>();

const emit = defineEmits<{
  reveal: [diagnostic: Diagnostic];
}>();

// A pointer line underlines the span a diagnostic refers to with only
// whitespace, "^", and "~" characters (e.g. "  ^~~~~~~~").
const POINTER_ONLY = /^[\s^~]*[\^~][\s^~]*$/;

function location(diagnostic: Diagnostic) {
  return [diagnostic.file, diagnostic.line, diagnostic.column].filter((part) => part !== null).join(":");
}
</script>

<template>
  <div class="diagnostics">
    <div v-if="!diagnostics.length" class="empty">No diagnostics.</div>
    <button
      v-for="diagnostic in diagnostics"
      :key="`${diagnostic.severity}:${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.message}`"
      type="button"
      :class="['diagnostic-item', diagnostic.severity]"
      @click="emit('reveal', diagnostic)"
    >
      <span v-if="diagnostic.file" class="diagnostic-location">{{ location(diagnostic) }}: </span>
      <span class="diagnostic-severity">{{ diagnostic.severity }}: </span>
      <span class="diagnostic-message-lead">{{ diagnostic.message.split("\n")[0] }}</span>
      <pre
        class="diagnostic-context-lines"
      ><span v-for="(line, i) in diagnostic.message.split('\n').slice(1)" class="diagnostic-message-context"><span v-if="diagnostic.line" class="context-segment gutter">{{ i === 0 ? diagnostic.line : " ".repeat(String(diagnostic.line).length) }} | </span><span class="context-segment" :class="{ pointer: POINTER_ONLY.test(line) }">{{ line }}</span></span></pre>
    </button>
  </div>
</template>

<style scoped>
.diagnostics {
  display: flex;
  flex-direction: column;
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
.diagnostic-message-lead {
  color: inherit;
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
.empty {
  padding: 14px;
  color: var(--text-3);
  font: 11px var(--mono);
}
</style>
