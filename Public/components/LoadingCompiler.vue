<script setup lang="ts" vapor>
import { computed } from "vue";

const props = defineProps<{
  state: unknown; // null = pending, 0.0 = preloading, 1.0 = preloaded, anything else = error
}>();

const starting = computed(() => props.state === null || props.state === undefined);

const loading = computed(() => {
  if (typeof props.state === "number") {
    return props.state !== 1.0;
  } else {
    return false;
  }
});

const error = computed(() => {
  if (props.state == null || typeof props.state === "number") return null;
  return props.state instanceof Error ? props.state.message : String(props.state);
});

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <aside
    class="flex min-h-0 min-w-0 flex-[1.15] flex-col border-l border-border bg-bg-2 max-[800px]:min-h-[300px] max-[800px]:flex-[1_1_42%] max-[800px]:border-t max-[800px]:border-l-0"
    aria-live="polite"
  >
    <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-bg-2 px-4.5 pt-6 pb-10.5">
      <div class="flex w-[min(100%,360px)] items-start gap-2.25 border-t border-b border-t-border border-b-border-faint px-3 py-4">
        <div class="min-w-0 flex-1">
          <div class="text-[11px] text-text-0">{{ error ? "Toolchain unavailable" : "Preparing compiler" }}</div>
          <p class="mt-2 text-[11px] leading-[1.45] text-text-1">{{ error ? "The compiler could not be loaded." : loading ? "Downloading compiler..." : starting ? "Starting..." : "" }}</p>

          <div v-if="!error" class="mt-3.5 h-0.75 overflow-hidden rounded-full bg-bg-4" role="progressbar" aria-label="Loading Swift toolchain">
            <span class="block h-full w-[30%] animate-indeterminate rounded-full bg-accent"></span>
          </div>
          <p v-else class="mt-2 font-mono text-[9px] leading-normal text-text-2">{{ error }}</p>

          <button
            v-if="error"
            type="button"
            class="mt-3 h-6.5 cursor-pointer rounded border border-border bg-bg-3 px-2.25 font-mono text-[10px] text-text-1 hover:border-accent-line hover:text-accent-hi"
            @click="emit('retry')"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
