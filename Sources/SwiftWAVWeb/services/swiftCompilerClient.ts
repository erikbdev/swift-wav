export type WorkerMessage = { id: number; type: string; [key: string]: unknown };

/**
 * Thin transport wrapper around the Swift compiler worker.
 */
export function createSwiftCompilerClient() {
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
		onProgress?: (message: WorkerMessage) => void
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

		compile(files: Record<string, string>, primaryFile: string, onProgress?: (message: WorkerMessage) => void) {
			return request("compile", { files, primaryFile }, "result", onProgress);
		},

		complete(
			files: Record<string, string>,
			primaryFile: string,
			offset: number,
			onProgress?: (message: WorkerMessage) => void
		) {
			return request("complete", { files, primaryFile, offset }, "completion-result", onProgress);
		},

		dispose() {
			worker?.terminate();
			worker = null;
		},
	};
}
