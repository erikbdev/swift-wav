import { onBeforeUnmount, watch } from "vue";
import type { SourceFiles } from "./types";

const TYPECHECK_DELAY_MS = 1000;

/** Calls `typecheck` once edits to `files` pause. */
export function useAutoTypecheck(files: () => SourceFiles, typecheck: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(
    files,
    () => {
      clearTimeout(timer);
      timer = setTimeout(typecheck, TYPECHECK_DELAY_MS);
    },
    { deep: true },
  );

  onBeforeUnmount(() => clearTimeout(timer));
}
