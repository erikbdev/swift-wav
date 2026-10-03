import { runWASICommand } from "../../utils/wasi-run";

self.addEventListener("message", async (event: MessageEvent<{ program: WebAssembly.Module }>) => {
  self.postMessage(await runWASICommand(event.data.program, ["main"], []));
});
