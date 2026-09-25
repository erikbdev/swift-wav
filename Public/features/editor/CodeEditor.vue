<script setup lang="ts" vapor>
import { ref, watch } from "vue";
import type { CompletionProvider } from "./swiftCompletion";
import { swiftEditorExtensions } from "./swiftEditor";
import { useCodeMirror } from "./useCodeMirror";

const props = defineProps<{
  document: string;
  complete: CompletionProvider;
}>();

const emit = defineEmits<{
  change: [document: string];
}>();

const host = ref<HTMLElement | null>(null);
const editor = useCodeMirror({
  host,
  getDocument: () => props.document,
  extensions: () =>
    swiftEditorExtensions({
      complete: (position) => props.complete(position),
      onChange: (document) => emit("change", document),
    }),
});

// Follow outside changes, such as switching files.
watch(
  () => props.document,
  (document) => {
    if (document !== editor.getDocument()) editor.setDocument(document);
  },
);

defineExpose({ reveal: editor.reveal });
</script>

<template>
  <div ref="host" class="code-editor"></div>
</template>

<style scoped>
.code-editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-1);
}
.code-editor :deep(.cm-editor) {
  height: 100%;
}
.code-editor :deep(.cm-scroller) {
  overflow: auto;
}
</style>
