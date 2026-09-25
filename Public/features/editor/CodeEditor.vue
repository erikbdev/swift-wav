<script setup lang="ts" vapor>
import { ref, watch } from "vue";
import type { CompletionProvider } from "./swiftCompletion";
import { swiftEditorExtensions } from "./swiftEditor";
import { useCodeMirror } from "./useCodeMirror";

const props = defineProps<{
  fileId: string;
  document: string;
  complete: CompletionProvider;
}>();

const emit = defineEmits<{
  change: [fileId: string, document: string];
}>();

const host = ref<HTMLElement | null>(null);
const editor = useCodeMirror({
  host,
  getFileId: () => props.fileId,
  getDocument: () => props.document,
  extensions: () =>
    swiftEditorExtensions({
      complete: (position) => props.complete(position),
      onChange: (document) => emit("change", props.fileId, document),
    }),
});

// Switching files restores that file's undo history and selection.
watch(
  () => [props.fileId, props.document] as const,
  ([fileId, document]) => {
    editor.showFile(fileId, document);
  },
);

defineExpose({ reveal: editor.reveal, forgetFile: editor.forgetFile });
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
