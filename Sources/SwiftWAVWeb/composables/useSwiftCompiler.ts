import { onBeforeUnmount, onMounted, ref } from "vue";
import { formatMB, outputFromResult, problemsFromResult } from "../utils/compiler-output";
import SwiftWorker from "../workers/swift.worker.ts?worker";

import type { OutputLine, Problem, WorkspaceSnapshot } from "../types";
import type { ResultTypeFor, WorkerRequest, WorkerResponse } from "../workers/swift.worker";

interface DownloadProgress {
  loaded: number;
  total: number;
}

export function useSwiftCompiler() {
  const worker = new SwiftWorker();
  const runLabel = ref("Downloading runtime…");
  const status = ref("Downloading Swift toolchain…");
  const runDisabled = ref(true);
  const toolchainReady = ref(false);
  const running = ref(false);
  const problems = ref<Problem[]>([]);
  const output = ref<OutputLine[]>([]);
  let nextRequestId = 0;

  function request<T extends WorkerRequest["type"]>(
    type: T,
    payload: Omit<Extract<WorkerRequest, { type: T }>, "id" | "type">,
    onProgress?: (message: WorkerResponse) => void,
  ): Promise<Extract<WorkerResponse, { type: ResultTypeFor<T> }>> {
    const id = ++nextRequestId;
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.id !== id) return;

        if (
          message.type === "progress" ||
          message.type === "download-progress" ||
          message.type === "preload-progress"
        ) {
          onProgress?.(message);
          return;
        }

        cleanup();
        resolve(message as Extract<WorkerResponse, { type: ResultTypeFor<T> }>);
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

  function setDownloadStatus(text: string) {
    runLabel.value = text;
  }

  function handleDownloadProgress(progress: DownloadProgress) {
    if (progress.total > 0) {
      setDownloadStatus(
        `Downloading runtime… ${formatMB(progress.loaded)}/${formatMB(progress.total)}MB`,
      );
    } else {
      setDownloadStatus("Downloading runtime…");
    }
  }

  async function preload() {
    runDisabled.value = true;
    setDownloadStatus("Downloading runtime...");
    status.value = "Downloading Swift toolchain...";

    try {
      const result = await request("preload", {}, (message) => {
        if (message.type === "preload-progress") handleDownloadProgress(message);
      });
      if (!result.ok) throw new Error(result.error || "toolchain download failed");
      toolchainReady.value = true;
      runLabel.value = "Run";
      status.value = "Ready";
      runDisabled.value = false;
    } catch (error) {
      toolchainReady.value = false;
      runLabel.value = "Run (retry download)";
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
      if (!toolchainReady.value) return;
    }

    running.value = true;
    runDisabled.value = true;
    problems.value = [];
    output.value = [];
    status.value = "Compiling...";

    try {
      const result = await request(
        "compile",
        { files: workspace.files, primaryFile: workspace.primaryFile },
        (message) => {
          if (message.type === "progress") status.value = message.message;
          if (message.type === "download-progress") handleDownloadProgress(message);
        },
      );

      problems.value = problemsFromResult(result);
      output.value = outputFromResult(result);
      status.value = result.ok ? "Ready" : `Failed (${result.stage ?? "unknown"})`;
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
      runLabel.value = "Run";
    }
  }

  async function autocomplete(workspace: WorkspaceSnapshot, offset: number) {
    if (!workspace.primaryFile) return [];
    const result = await request(
      "complete",
      { files: workspace.files, primaryFile: workspace.primaryFile, offset },
      (message) => {
        if (message.type === "progress") status.value = message.message;
        if (message.type === "download-progress") handleDownloadProgress(message);
      },
    );
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
    toolchainReady,
    running,
    problems,
    output,
    run,
    complete: autocomplete,
    clearProblems,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
