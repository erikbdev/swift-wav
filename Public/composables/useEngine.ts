import { computed, onBeforeUnmount, ref } from "vue";
import EngineWorker from "../services/engine/worker.ts?worker";
import type { WasiCommandResult } from "../utils/wasi-run";
import type { Output } from "../types/compiler";

export function useEngine() {
  const worker = new EngineWorker();
  const state = ref({
    running: false,
    output: [] as Output[],
  });

  async function run(program: WebAssembly.Module) {
    if (state.value.running) return;

    state.value.running = true;
    state.value.output = [];

    try {
      const result = await new Promise<WasiCommandResult>((resolve, reject) => {
        worker.onmessage = (event) => resolve(event.data);
        worker.onerror = (event) => reject(event.error);
        worker.postMessage({ program });
      });
      const timestamp = Date.now();
      const lines = result.exitCode === 0 ? result.stdout : [...result.stdout, ...result.stderr];
      state.value.output = lines.map((message) => ({ message, timestamp }));
    } finally {
      state.value.running = false;
    }
  }

  onBeforeUnmount(() => worker.terminate());

  return {
    running: computed(() => state.value.running),
    output: computed(() => state.value.output),
    run,
  };
}
