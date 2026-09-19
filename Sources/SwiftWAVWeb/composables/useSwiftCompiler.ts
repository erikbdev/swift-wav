import { onBeforeUnmount, onMounted, ref } from "vue";
import { outputFromResult, problemsFromResult } from "../utils/compiler-output";
import SwiftWorker from "../workers/swift.worker.ts?worker";

import type { OutputLine, Problem, WorkspaceSnapshot, Diagnostic } from "../types";
import type { ResultTypeFor, WorkerRequest, WorkerResponse } from "../workers/swift.worker";

export function useSwiftCompiler() {
  const worker = new SwiftWorker();
  const runLabel = ref("Play");
  const runDisabled = ref(true);
  const status = ref("Downloading Swift toolchain…");
  const toolchainReady = ref(false);
  const running = ref(false);
  const problems = ref<Problem[]>([]);
  const output = ref<OutputLine[]>([]);
  const diagnostics = ref<Diagnostic[]>([]);
  const loadingProgress = ref(0);
  let nextRequestId = 0;

  function request<T extends WorkerRequest["type"]>(type: T, payload: Omit<Extract<WorkerRequest, { type: T }>, "id" | "type">): Promise<Extract<WorkerResponse, { type: ResultTypeFor<T> }>> {
    const id = ++nextRequestId;
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.id !== id && message.id !== -1) return;

        if (message.type == "preload") {
          loadingProgress.value = message.progress ?? 0;
        }

        if (message.type === "preload" && message.id === -1) {
          loadingProgress.value = message.progress ?? 0;
          if (message.progress && message.progress > 0) {
            status.value = `Downloading runtime… ${message.progress * 100}%`;
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
    status.value = "Downloading Swift toolchain...";

    try {
      const result = await request("preload", {});
      if (result.error) throw result.error;
      toolchainReady.value = true;
      status.value = "Ready";
      runDisabled.value = false;
    } catch (error) {
      toolchainReady.value = false;
      status.value = "Toolchain download failed";
      problems.value = [
        {
          severity: "error",
          file: "Toolchain",
          line: null,
          column: null,
          message: `Failed to download Swift toolchain: ${errorMessage(error)}`,
        },
      ];
      runDisabled.value = false;
    }
  }

  async function run(workspace: WorkspaceSnapshot) {
    if (running.value) return;

    if (!toolchainReady.value) {
      await preload();
    }

    running.value = true;
    runDisabled.value = true;
    problems.value = [];
    output.value = [];
    status.value = "Compiling...";

    try {
      const result = await request("compile", { files: workspace.files, primaryFile: workspace.primaryFile });

      problems.value = problemsFromResult(result);
      output.value = outputFromResult(result);
      // status.value = result.ok ? "Ready" : `Failed (${result.stage ?? "unknown"})`;
    } catch (error) {
      problems.value = [
        {
          severity: "error",
          file: "Swift",
          line: null,
          column: null,
          message: errorMessage(error),
        },
      ];
      output.value = [{ text: "The compiler worker stopped unexpectedly.", kind: "status" }];
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

  function clearProblems() {
    problems.value = [];
  }

  onMounted(() => preload());
  onBeforeUnmount(() => worker.terminate());

  return {
    runLabel,
    status,
    runDisabled,
    loadingProgress,
    toolchainReady,
    running,
    problems,
    output,
    diagnostics,
    run,
    complete: autocomplete,
    clearProblems,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
