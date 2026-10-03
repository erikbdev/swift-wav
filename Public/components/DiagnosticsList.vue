<script setup lang="ts" vapor>
import type { Diagnostic } from "../types/compiler";

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
  <div class="flex flex-col">
    <div v-if="!diagnostics.length" class="p-3.5 font-mono text-[11px] text-text-3">No diagnostics.</div>
    <button
      v-for="diagnostic in diagnostics"
      :key="`${diagnostic.severity}:${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.message}`"
      type="button"
      class="inline w-full cursor-pointer border-b border-border-faint px-2.75 py-1.75 text-left font-mono text-[11.5px] font-bold text-text-0 last:border-b-0 hover:bg-bg-3"
      @click="emit('reveal', diagnostic)"
    >
      <span v-if="diagnostic.file" class="truncate">{{ location(diagnostic) }}: </span>
      <span :class="diagnostic.severity === 'error' ? 'text-red' : diagnostic.severity === 'note' ? 'text-blue' : 'text-amber'">{{ diagnostic.severity }}: </span>
      <span>{{ diagnostic.message.split("\n")[0] }}</span>
      <pre><span v-for="(line, i) in diagnostic.message.split('\n').slice(1)" class="block font-mono font-medium whitespace-pre text-text-1"><span v-if="diagnostic.line" class="text-text-3">{{ i === 0 ? diagnostic.line : " ".repeat(String(diagnostic.line).length) }} | </span><span :class="{ 'font-bold text-green': POINTER_ONLY.test(line) }">{{ line }}</span></span></pre>
    </button>
  </div>
</template>
