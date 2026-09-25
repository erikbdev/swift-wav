// Talks to the Swift compiler worker: sends a request and resolves with the
// response carrying the same id. Download progress arrives as unsolicited
// `preload` messages with id -1.

import SwiftWorker from "./worker/swift.worker.ts?worker";
import type { ResponseFor, WorkerRequest, WorkerResponse } from "./types";

export type CompilerClient = ReturnType<typeof createCompilerClient>;

export function createCompilerClient(onProgress: (progress: number) => void) {
  const worker = new SwiftWorker();
  let nextRequestId = 0;

  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.id === -1 && message.type === "preload") {
      onProgress(Number.isFinite(message.progress) ? (message.progress ?? 0) : 0);
    }
  });

  function request<T extends WorkerRequest["type"]>(type: T, payload: Omit<Extract<WorkerRequest, { type: T }>, "id" | "type">): Promise<ResponseFor<T>> {
    const id = ++nextRequestId;
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.id !== id) return;
        cleanup();
        resolve(event.data as ResponseFor<T>);
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

  return { request, terminate: () => worker.terminate() };
}
