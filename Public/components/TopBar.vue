<script setup lang="ts" vapor>
defineProps<{
  disabled: boolean;
}>();

const emit = defineEmits<{
  run: [];
}>();
</script>

<template>
  <header class="flex h-13.5 items-center gap-3.5 border-b border-border bg-bg-0/86 px-3.5 backdrop-blur-[10px]">
    <span class="text-[13px] font-semibold tracking-[-0.01em] text-text-0">swift-wav</span>
    <div class="flex-1"></div>
    <button
      id="run-button"
      class="inline-flex h-8.5 cursor-pointer items-center gap-1.75 rounded-md border border-text-0 bg-text-0 px-4 font-sans text-[12.5px] font-[640] tracking-[-0.004em] text-bg-1 shadow-sm transition duration-120 hover:border-accent-hi hover:bg-accent-hi hover:text-white active:translate-y-[0.5px] active:scale-99"
      type="button"
      :disabled="disabled"
      @click="emit('run')"
    >
      <span>▶</span>
      <span id="run-label">Play</span>
    </button>
  </header>
</template>
