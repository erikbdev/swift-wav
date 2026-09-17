import { onBeforeUnmount, onMounted, ref } from "vue";
import { formatMB, outputFromResult, problemsFromResult } from "../utils/compiler-output";
import type {
  CompilerResult,
  CompletionItem,
  OutputLine,
  Problem,
  WorkspaceSnapshot,
} from "../types";

interface DownloadProgress {
  loaded: number;
  total: number;
}

type WorkerMessage = { id: number; type: string; [key: string]: unknown };

/**
 * Coordinates the Swift compiler worker and exposes UI-ready reactive state.
 *
 * The worker client handles transport; this composable translates worker
 * messages into statuses, diagnostics, output, and button state for Vue.
 */
export function useSwiftCompiler() {
  const client = createSwiftCompilerClient();
  const runLabel = ref("Downloading runtime…");
  const status = ref("Downloading Swift toolchain…");
  const runDisabled = ref(true);
  const toolchainReady = ref(false);
  const running = ref(false);
  const problems = ref<Problem[]>([]);
  const output = ref<OutputLine[]>([]);

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
    setDownloadStatus("Downloading runtime…");
    status.value = "Downloading Swift toolchain…";

    try {
      const result = await client.preload((message) =>
        handleDownloadProgress(message as unknown as DownloadProgress),
      );
      if (!result.ok) throw new Error((result.error as string) || "toolchain download failed");
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
    if (!workspace.primaryFile) {
      problems.value = [
        {
          severity: "error",
          file: "Swift",
          line: null,
          column: null,
          message: "No Swift file is active.",
        },
      ];
      return;
    }

    if (!toolchainReady.value) {
      await preload();
      if (!toolchainReady.value) return;
    }

    running.value = true;
    runDisabled.value = true;
    problems.value = [];
    output.value = [];
    status.value = "Compiling…";

    try {
      const result = (await client.compile(workspace.files, workspace.primaryFile, (message) => {
        if (message.type === "progress") status.value = message.message as string;
        if (message.type === "download-progress")
          handleDownloadProgress(message as unknown as DownloadProgress);
      })) as unknown as CompilerResult;

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

  async function autocomplete(
    workspace: WorkspaceSnapshot,
    offset: number,
  ): Promise<CompletionItem[]> {
    if (!workspace.primaryFile) return [];
    const result = await client.complete(
      workspace.files,
      workspace.primaryFile,
      offset,
      (message) => {
        if (message.type === "progress") status.value = message.message as string;
        if (message.type === "download-progress")
          handleDownloadProgress(message as unknown as DownloadProgress);
      },
    );
    return (result.items as CompletionItem[]) ?? [];
  }

  function clearProblems() {
    problems.value = [];
  }

  onMounted(() => {
    void preload();
  });
  onBeforeUnmount(() => client.dispose());

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

/**
 * Private transport implementation for the Swift compiler worker.
 *
 * Keeping this next to the composable makes the Swift compiler feature
 * self-contained while preserving the Worker/message-protocol boundary.
 */
function createSwiftCompilerClient() {
  let worker: Worker | null = null;
  let nextRequestId = 0;

  function getWorker(): Worker {
    worker ??= new Worker(new URL("../workers/swift-compiler.worker.ts", import.meta.url), {
      type: "module",
    });
    return worker;
  }

  function request(
    type: string,
    payload: Record<string, unknown>,
    terminalType: string,
    onProgress?: (message: WorkerMessage) => void,
  ): Promise<WorkerMessage> {
    return new Promise((resolve, reject) => {
      const id = ++nextRequestId;
      const currentWorker = getWorker();

      const onMessage = (event: MessageEvent<WorkerMessage>) => {
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

        if (message.type !== terminalType) return;
        cleanup();
        resolve(message);
      };

      const onError = (event: ErrorEvent) => {
        cleanup();
        reject(event.error instanceof Error ? event.error : new Error(event.message));
      };

      function cleanup() {
        currentWorker.removeEventListener("message", onMessage);
        currentWorker.removeEventListener("error", onError);
      }

      currentWorker.addEventListener("message", onMessage);
      currentWorker.addEventListener("error", onError);
      currentWorker.postMessage({ id, type, ...payload });
    });
  }

  return {
    preload(onProgress?: (message: WorkerMessage) => void) {
      return request("preload", {}, "preload-done", onProgress);
    },

    compile(
      files: Record<string, string>,
      primaryFile: string,
      onProgress?: (message: WorkerMessage) => void,
    ) {
      return request("compile", { files, primaryFile }, "result", onProgress);
    },

    complete(
      files: Record<string, string>,
      primaryFile: string,
      offset: number,
      onProgress?: (message: WorkerMessage) => void,
    ) {
      return request("complete", { files, primaryFile, offset }, "completion-result", onProgress);
    },

    dispose() {
      worker?.terminate();
      worker = null;
    },
  };
}
