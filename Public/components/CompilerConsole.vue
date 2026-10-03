<script setup lang="ts" vapor>
import { computed, ref, watch } from "vue";
import DiagnosticsList from "./DiagnosticsList.vue";
import OutputList from "./OutputList.vue";
import type { Diagnostic, Output } from "../types/compiler";

const props = defineProps<{
  diagnostics: Diagnostic[];
  output: Output[];
  activity: "typechecking" | "building" | null;
}>();

const emit = defineEmits<{
  reveal: [diagnostic: Diagnostic];
}>();

/** The panel shown above the bar, if any. */
const open = ref<"diagnostics" | "output" | null>(null);

const errorCount = computed(() => props.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length);
const warningCount = computed(() => props.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length);

// Show diagnostics as they arrive, and hide the panel once they're resolved.
watch(
  () => props.diagnostics,
  (diagnostics) => {
    if (diagnostics.length) open.value = "diagnostics";
    else if (open.value === "diagnostics") open.value = null;
  },
);

function toggle(panel: "diagnostics" | "output") {
  open.value = open.value === panel ? null : panel;
}
</script>

<template>
  <div class="relative shrink-0">
    <!-- Overlays the bottom of whatever sits above the console. -->
    <div v-if="open" class="absolute inset-x-0 bottom-full z-10 max-h-[min(320px,45vh)] overflow-y-auto border border-b-0 border-border-strong bg-bg-2/98 shadow-card">
      <DiagnosticsList v-if="open === 'diagnostics'" :diagnostics="diagnostics" @reveal="emit('reveal', $event)" />
      <OutputList v-else :output="output" />
    </div>

    <div class="flex min-h-7.5 items-center gap-2.5 border-t border-border bg-bg-2 px-2 font-mono text-[10.5px] text-text-2">
      <button
        class="inline-flex h-6 cursor-pointer items-center gap-1.75 rounded-sm border border-transparent px-2 text-text-1 hover:border-border hover:bg-bg-3 hover:text-text-0 aria-expanded:border-border aria-expanded:bg-bg-3 aria-expanded:text-text-0"
        type="button"
        :aria-expanded="open === 'diagnostics'"
        @click="toggle('diagnostics')"
      >
        <span
          class="inline-grid size-3.75 place-items-center rounded-full text-[10px] font-bold"
          :class="errorCount ? 'bg-red text-white' : warningCount ? 'bg-amber text-bg-0' : 'bg-text-3 text-bg-0'"
          >{{ errorCount || warningCount ? "!" : "✓" }}</span
        >
        <span>Diagnostics</span>
        <span class="min-w-4 rounded-[10px] bg-bg-4 px-1.25 py-px text-center text-text-1">{{ diagnostics.length }}</span>
      </button>
      <button
        class="inline-flex h-6 cursor-pointer items-center gap-1.75 rounded-sm border border-transparent px-2 text-text-1 hover:border-border hover:bg-bg-3 hover:text-text-0 aria-expanded:border-border aria-expanded:bg-bg-3 aria-expanded:text-text-0"
        type="button"
        :aria-expanded="open === 'output'"
        @click="toggle('output')"
      >
        <span class="inline-grid size-3.75 place-items-center rounded-full bg-text-3 text-[10px] font-bold text-bg-0">›</span>
        <span>Output</span>
        <span class="min-w-4 rounded-[10px] bg-bg-4 px-1.25 py-px text-center text-text-1">{{ output.length }}</span>
      </button>
      <span v-if="activity" class="ml-auto inline-flex items-center gap-1.75 px-2 whitespace-nowrap text-text-2" role="status" aria-live="polite">
        <span class="size-2.5 animate-spin rounded-full border border-border-strong border-t-accent-hi" aria-hidden="true"></span>
        {{ activity === "typechecking" ? "Type checking…" : "Building…" }}
      </span>
    </div>
  </div>
</template>
