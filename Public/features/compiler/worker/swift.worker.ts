// Worker that owns the Swift toolchain, so compiling, linking, and code
// completion don't jank the main thread. It only maps messages to the
// compiler; see swiftCompiler.ts and toolchain.ts for the work itself.

import type { WorkerRequest, WorkerResponse } from "../types";
import { createSwiftCompiler } from "./swiftCompiler";
import { fetchToolchains } from "./toolchain";

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

const swiftCompiler = createSwiftCompiler(fetchToolchains((progress) => post({ id: -1, type: "preload", progress })));

/**
 * The newest completion request's id. Each swift-ide-test run blocks the
 * worker for seconds while the user keeps typing, so completion requests
 * queue up behind it; only the newest one's result is still wanted.
 */
let latestCompletionId = -1;

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case "preload": {
      try {
        await swiftCompiler();
        post({ id: -1, type: msg.type, progress: 1.0 });
        post({ id: msg.id, type: msg.type, progress: 1.0 });
      } catch (e) {
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    case "complete": {
      latestCompletionId = msg.id;
      try {
        const compiler = await swiftCompiler();
        // Let any messages already queued behind the previous run arrive (a
        // timer fires after them), then skip this request if a newer one did.
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (msg.id !== latestCompletionId) {
          post({ id: msg.id, type: msg.type, error: new Error("Superseded by a newer completion request") });
          return;
        }
        const { items, diagnostics } = await compiler.autocomplete(msg.files, msg.primaryFile, msg.offset);
        post({ id: msg.id, type: msg.type, items, diagnostics });
      } catch (e) {
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    case "typecheck": {
      try {
        const compiler = await swiftCompiler();
        const result = await compiler.typecheck(msg.files);
        post({ id: msg.id, type: msg.type, ...result });
      } catch (e) {
        post({ id: msg.id, type: msg.type, error: e });
      }
      break;
    }

    case "compile": {
      try {
        const compiler = await swiftCompiler();
        const result = await compiler.run(msg.files);
        post({ id: msg.id, type: msg.type, ...result });
      } catch (e) {
        post({
          id: msg.id,
          type: msg.type,
          error: e,
        });
      }
      break;
    }

    default:
      msg satisfies never;
  }
});
