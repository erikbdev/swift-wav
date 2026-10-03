<script setup lang="ts" vapor>
import { ref, watch } from "vue";
import { useCodeMirror } from "../composables/useCodeMirror";
import { swiftEditorExtensions } from "../utils/swiftEditor";
import type { CompletionProvider } from "../utils/swiftCompletion";
import type { Workspace } from "../types/workspace";

const props = defineProps<{
  workspace: Workspace;
  complete: CompletionProvider;
}>();

const emit = defineEmits<{
  change: [fileId: string, document: string];
}>();

const host = ref<HTMLElement | null>(null);
const editor = useCodeMirror({
  host,
  getFileId: () => props.workspace.active,
  getDocument: () => props.workspace.files[props.workspace.active],
  extensions: () =>
    swiftEditorExtensions({
      complete: (position) => props.complete(position),
      onChange: (document) => emit("change", props.workspace.active, document),
    }),
});

// Switching files restores that file's undo history and selection.
watch(
  () => [props.workspace.active, props.workspace.files[props.workspace.active]] as const,
  ([fileId, document]) => {
    editor.showFile(fileId, document);
  },
);

defineExpose({ reveal: editor.reveal, forgetFile: editor.forgetFile });
</script>

<template>
  <div ref="host" class="min-h-0 flex-1 overflow-hidden bg-bg-1 [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"></div>
</template>
