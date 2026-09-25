<script setup lang="ts" vapor>
import { computed, ref, watch } from "vue";
import DiagnosticsList from "./DiagnosticsList.vue";
import OutputList from "./OutputList.vue";
import type { Diagnostic, Output } from "./types";

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
  <div class="console">
    <div v-if="open" class="panel">
      <DiagnosticsList v-if="open === 'diagnostics'" :diagnostics="diagnostics" @reveal="emit('reveal', $event)" />
      <OutputList v-else :output="output" />
    </div>

    <div class="bar">
      <button class="toggle" :class="{ 'has-errors': errorCount, 'has-warnings': !errorCount && warningCount }" type="button" :aria-expanded="open === 'diagnostics'" @click="toggle('diagnostics')">
        <span class="icon">{{ errorCount || warningCount ? "!" : "✓" }}</span>
        <span>Diagnostics</span>
        <span class="count">{{ diagnostics.length }}</span>
      </button>
      <button class="toggle" type="button" :aria-expanded="open === 'output'" @click="toggle('output')">
        <span class="icon">›</span>
        <span>Output</span>
        <span class="count">{{ output.length }}</span>
      </button>
      <span v-if="activity" class="activity" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        {{ activity === "typechecking" ? "Type checking…" : "Building…" }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.console {
  position: relative;
  flex-shrink: 0;
}

/* Overlays the bottom of whatever sits above the console. */
.panel {
  position: absolute;
  right: 0;
  bottom: 100%;
  left: 0;
  z-index: 10;
  max-height: min(320px, 45vh);
  overflow-y: auto;
  border: 1px solid var(--border-strong);
  border-bottom: 0;
  background: rgba(27, 26, 24, 0.98);
  box-shadow: var(--shadow-card);
}

.bar {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 0 8px;
  gap: 10px;
  background: var(--bg-2);
  border-top: 1px solid var(--border);
  color: var(--text-2);
  font-family: var(--mono);
  font-size: 10.5px;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-1);
  font: inherit;
  cursor: pointer;
}
.toggle:hover,
.toggle[aria-expanded="true"] {
  background: var(--bg-3);
  border-color: var(--border);
  color: var(--text-0);
}
.icon {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--text-3);
  color: var(--bg-0);
  font-size: 10px;
  font-weight: 700;
}
.toggle.has-errors .icon {
  background: var(--red);
  color: #fff;
}
.toggle.has-warnings .icon {
  background: var(--amber);
  color: var(--bg-0);
}
.count {
  min-width: 16px;
  padding: 1px 5px;
  border-radius: 10px;
  background: var(--bg-4);
  color: var(--text-1);
  text-align: center;
}
.activity {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 0 8px;
  color: var(--text-2);
  white-space: nowrap;
}
.spinner {
  width: 10px;
  height: 10px;
  border: 1px solid var(--border-strong);
  border-top-color: var(--accent-hi);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
