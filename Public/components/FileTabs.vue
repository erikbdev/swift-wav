<script setup lang="ts" vapor>
import { nextTick, ref } from "vue";

defineProps<{
  files: string[];
  active: string;
}>();

const emit = defineEmits<{
  select: [filename: string];
  create: [filename: string];
  delete: [filename: string];
}>();

const isCreating = ref(false);
const newFileName = ref("");
const newFileInput = ref<HTMLInputElement | null>(null);

function openCreateInput() {
  isCreating.value = true;
  newFileName.value = "";
  nextTick(() => newFileInput.value?.focus());
}

function closeCreateInput() {
  isCreating.value = false;
  newFileName.value = "";
}

function submitCreate() {
  if (!isCreating.value) return;
  const name = newFileName.value.trim();
  closeCreateInput();
  if (name) emit("create", name);
}
</script>

<template>
  <div class="flex h-10 min-w-0 shrink-0 items-center gap-0.75 overflow-x-auto border-b border-border-faint bg-bg-1 px-2.5 [scrollbar-width:thin]" role="tablist" aria-label="Swift files">
    <button
      v-for="name in files"
      :key="name"
      role="tab"
      type="button"
      class="group relative flex h-7 flex-none cursor-pointer items-center gap-1.75 rounded-sm border border-transparent px-2.75 text-left font-mono text-[12.5px] whitespace-nowrap text-text-2 transition-colors duration-120 select-none hover:bg-bg-3 hover:text-text-1 aria-selected:bg-bg-3 aria-selected:text-text-0 aria-selected:shadow-[inset_0_-2px_0_var(--color-accent)] aria-selected:before:size-1.5 aria-selected:before:flex-none aria-selected:before:rounded-full aria-selected:before:bg-accent aria-selected:before:content-['']"
      :aria-selected="name === active"
      @click="emit('select', name)"
    >
      <span>{{ name }}</span>
      <span
        class="inline-grid size-3.75 flex-none place-items-center rounded-[3px] text-[13px] leading-none text-text-3 opacity-0 transition duration-120 group-hover:opacity-100 group-aria-selected:opacity-100 hover:bg-bg-4 hover:text-text-0"
        role="button"
        tabindex="-1"
        title="Delete file"
        @click.stop="emit('delete', name)"
      >
        ×
      </span>
    </button>

    <div v-if="isCreating" class="flex h-7 flex-[0_0_160px] items-center">
      <input
        ref="newFileInput"
        v-model="newFileName"
        class="h-7 w-full rounded-sm border border-accent-line bg-bg-2 px-2 font-mono text-xs text-text-0 outline-none"
        type="text"
        placeholder="NewFile.swift"
        autocomplete="off"
        @keydown.enter.prevent="submitCreate"
        @keydown.esc.prevent="closeCreateInput"
        @blur="submitCreate"
      />
    </div>

    <button
      type="button"
      class="flex size-7 flex-none cursor-pointer items-center justify-center rounded-sm border border-transparent font-sans text-[18px] leading-none text-text-2 transition-colors duration-120 hover:bg-bg-3 hover:text-accent-hi"
      title="New Swift file"
      @click="openCreateInput"
    >
      +
    </button>
  </div>
</template>
