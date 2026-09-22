import { onBeforeUnmount, onMounted, ref } from "vue";
import SwiftWorker from "../workers/swift.worker.ts?worker";

import type { WorkspaceSnapshot } from "../types";
import type { ResultTypeFor, WorkerRequest, WorkerResponse, Diagnostic, Output } from "../workers/swift.worker";

const DOWNLOAD_PROGRESS_WEIGHT = 0.8;

export function useSwiftCompiler() {
  const worker = new SwiftWorker();
  const runLabel = ref("Play");
  const runDisabled = ref(true);
  const status = ref("Downloading Swift toolchain…");
  const loadError = ref<string | null>(null);
  const toolchainReady = ref(false);
  const running = ref(false);
  const diagnostics = ref<Diagnostic[]>([]);
  const output = ref<Output[]>([]);
  const loadingProgress = ref(0);
  let nextRequestId = 0;

  function request<T extends WorkerRequest["type"]>(type: T, payload: Omit<Extract<WorkerRequest, { type: T }>, "id" | "type">): Promise<Extract<WorkerResponse, { type: ResultTypeFor<T> }>> {
    const id = ++nextRequestId;
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.id !== id && message.id !== -1) return;

        if (message.type === "preload" && message.id === -1) {
          const progress = Number.isFinite(message.progress) ? (message.progress ?? 0) : 0;
          loadingProgress.value = progress;
          if (progress >= DOWNLOAD_PROGRESS_WEIGHT) {
            status.value = "Setting up Swift compiler…";
          } else if (progress > 0) {
            status.value = `Downloading runtime… ${Math.round((progress / DOWNLOAD_PROGRESS_WEIGHT) * 100)}%`;
          } else {
            status.value = "Downloading runtime…";
          }
        } else {
          cleanup();
          resolve(message as Extract<WorkerResponse, { type: ResultTypeFor<T> }>);
        }
      };

      const onError = (event: ErrorEvent) => {
        cleanup();
        reject(event.error instanceof Error ? event.error : new Error(event.message));
      };

      function cleanup() {
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      }

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({ id, type, ...payload } as WorkerRequest);
    });
  }

  async function preload() {
    runDisabled.value = true;
    loadError.value = null;
    loadingProgress.value = 0;
    status.value = "Downloading Swift toolchain…";

    try {
      const result = await request("preload", {});
      if (result.error) throw result.error;
      loadingProgress.value = 1;
      toolchainReady.value = true;
      loadError.value = null;
      status.value = "Ready";
      runDisabled.value = false;
    } catch (error) {
      toolchainReady.value = false;
      loadingProgress.value = 0;
      loadError.value = errorMessage(error);
      status.value = "Toolchain download failed";
      diagnostics.value = [
        {
          severity: "error",
          file: null,
          line: null,
          column: null,
          message: `Failed to download Swift toolchain: \n\t ${errorMessage(error)}`,
        },
      ];
      runDisabled.value = false;
    }
  }

  async function run(workspace: WorkspaceSnapshot) {
    if (running.value) return;

    if (!toolchainReady.value) {
      await preload();
      if (!toolchainReady.value) return;
    }

    running.value = true;
    runDisabled.value = true;
    diagnostics.value = [];
    output.value = [];
    status.value = "Compiling...";

    try {
      const result = await request("compile", { files: workspace.files, primaryFile: workspace.primaryFile });
      diagnostics.value = result.diagnostics ?? [];
      output.value = result.output ?? [];
    } catch (error) {
      diagnostics.value = [
        {
          severity: "error",
          file: null,
          line: null,
          column: null,
          message: errorMessage(error),
        },
      ];
      status.value = "Compiler worker failed";
    } finally {
      running.value = false;
      runDisabled.value = false;
    }
  }

  async function autocomplete(workspace: WorkspaceSnapshot, offset: number) {
    if (!workspace.primaryFile) return [];
    const result = await request("complete", { files: workspace.files, primaryFile: workspace.primaryFile, offset });
    return result.items ?? [];
  }

  function clearDiagnostics() {
    diagnostics.value = [];
  }

  onMounted(() => preload());
  onBeforeUnmount(() => worker.terminate());

  return {
    runLabel,
    status,
    loadError,
    runDisabled,
    loadingProgress,
    toolchainReady,
    running,
    diagnostics,
    output,
    run,
    preload,
    autocomplete,
    clearDiagnostics,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
