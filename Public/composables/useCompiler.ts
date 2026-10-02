import { computed, onBeforeMount, onBeforeUnmount, ref, toRaw } from "vue";
import SwiftWorker from "../services/compiler/worker.ts?worker";
import type { Workspace } from "../types/workspace";
import type { Output, Diagnostic, WorkerRequest, WorkerResponse } from "../types/compiler";

export function useCompiler() {
  let nextRequestId = 0;
  const worker = new SwiftWorker();
  const state = ref({
    preloaded: null as number | unknown | null,
    compiling: false,
    typechecking: false,
    diagnostics: [] as Diagnostic[],
    output: [] as Output[],
  });

  function request<T extends Omit<WorkerRequest, "id">>(payload: T): Promise<Extract<WorkerResponse, { type: T["type"] }>> {
    const id = ++nextRequestId;

    return new Promise((resolve, reject) => {
      function onMessage(event: MessageEvent<WorkerResponse>) {
        if (event.data.id !== id) return;
        cleanup();
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data as any);
        }
      }

      function onError(event: ErrorEvent) {
        cleanup();
        reject(event.error);
      }

      function cleanup() {
        worker.removeEventListener("error", onError);
        worker.removeEventListener("message", onMessage);
      }

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({ ...payload, id });
    });
  }

  async function preload() {
    if (state.value.preloaded === 1.0) return;

    try {
      state.value.preloaded = 0.0;
      const result = await request({ type: "preload" });
      state.value.preloaded = result.progress ?? 1.0;
    } catch (error) {
      state.value.preloaded = error;
    }
  }

  async function compile(workspace: Workspace) {
    if (state.value.compiling) return;

    state.value.compiling = true;
    state.value.diagnostics = [];
    state.value.output = [];

    try {
      const result = await request({ type: "compile", files: toRaw(workspace.files) });
      state.value.diagnostics = result.diagnostics ?? [];
      state.value.output = result.output ?? [];
    } catch (error) {
      state.value.diagnostics = [
        {
          severity: "error",
          file: null,
          line: null,
          column: null,
          message: `An error occured while compiling:\n\t ${errorMessage(error)}`,
        },
      ];
    } finally {
      state.value.compiling = false;
    }
  }

  async function typecheck(workspace: Workspace) {
    if (state.value.typechecking || state.value.compiling) return;

    state.value.typechecking = true;

    try {
      const result = await request({ type: "typecheck", files: toRaw(workspace.files) });
      state.value.diagnostics = result.diagnostics ?? [];
    } catch (error) {
      state.value.diagnostics = [
        {
          severity: "error",
          file: null,
          line: null,
          column: null,
          message: `An error occurred typechecking:\n\t ${errorMessage(error)}`,
        },
      ];
    } finally {
      state.value.typechecking = false;
    }
  }

  async function codeCompletion(workspace: Workspace, offset: number) {
    if (!workspace.active) return [];
    const result = await request({ type: "codecompletion", files: toRaw(workspace.files), primaryFile: toRaw(workspace.active), offset });
    return result.items ?? [];
  }

  onBeforeMount(() => preload());
  onBeforeUnmount(() => worker.terminate());

  return {
    preloading: computed(() => state.value.preloaded),
    compiling: computed(() => state.value.compiling),
    typechecking: computed(() => state.value.typechecking),
    diagnostics: computed(() => state.value.diagnostics),
    output: computed(() => state.value.output),
    compile,
    typecheck,
    preload,
    codeCompletion,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
