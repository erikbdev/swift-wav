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
  <div class="tabbar" role="tablist" aria-label="Swift files">
    <button v-for="name in files" :key="name" role="tab" type="button" class="tab" :class="{ active: name === active }" :aria-selected="name === active" @click="emit('select', name)">
      <span>{{ name }}</span>
      <span class="tab-close" role="button" tabindex="-1" title="Delete file" @click.stop="emit('delete', name)"> × </span>
    </button>

    <div v-if="isCreating" class="new-tab">
      <input
        ref="newFileInput"
        v-model="newFileName"
        type="text"
        placeholder="NewFile.swift"
        autocomplete="off"
        @keydown.enter.prevent="submitCreate"
        @keydown.esc.prevent="closeCreateInput"
        @blur="submitCreate"
      />
    </div>

    <button type="button" class="tab tab-add" title="New Swift file" @click="openCreateInput">+</button>
  </div>
</template>

<style scoped>
.tabbar {
  display: flex;
  align-items: center;
  height: var(--tabbar-h);
  min-width: 0;
  padding: 0 10px;
  gap: 3px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border-faint);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-2);
  font-size: 12.5px;
  font-family: var(--mono);
  appearance: none;
  cursor: pointer;
  flex: 0 0 auto;
  white-space: nowrap;
  text-align: left;
  user-select: none;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}
.tab::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.45;
}
.tab:hover {
  background: var(--bg-3);
  color: var(--text-1);
}
.tab.active {
  background: var(--bg-3);
  color: var(--text-0);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.tab.active::before {
  opacity: 1;
  content: "";
}
.tab-close {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  border-radius: 3px;
  color: var(--text-3);
  font-size: 13px;
  line-height: 1;
  opacity: 0;
  transition:
    opacity 0.12s ease,
    background 0.12s ease,
    color 0.12s ease;
}
.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 1;
}
.tab-close:hover {
  background: var(--bg-4);
  color: var(--text-0);
}
.tab-add {
  width: 28px;
  flex-basis: 28px;
  justify-content: center;
  padding: 0;
  color: var(--text-2);
  font-family: var(--sans);
  font-size: 18px;
  line-height: 1;
}
.tab-add::before {
  display: none;
}
.tab-add:hover {
  color: var(--accent-hi);
}
.new-tab {
  display: flex;
  align-items: center;
  height: 28px;
  flex: 0 0 160px;
}
.new-tab input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--accent-line);
  border-radius: var(--r-sm);
  outline: none;
  background: var(--bg-2);
  color: var(--text-0);
  font: 12px var(--mono);
}
</style>
