/**
 * Thin transport wrapper around the Swift compiler worker.
 *
 * Keeping Worker construction and request correlation here makes the Vue
 * composable testable without leaking `postMessage` details into components.
 */
export function createSwiftCompilerClient() {
	/** @type {Worker|null} */
	let worker = null;
	let nextRequestId = 0;

	/** @returns {Worker} */
	function getWorker() {
		if (!worker) {
			worker = new Worker(new URL("../workers/swift-compiler.worker.js", import.meta.url), {
				type: "module",
			});
		}
		return worker;
	}

	/**
	 * @param {string} type
	 * @param {Record<string, any>} payload
	 * @param {string} terminalType
	 * @param {(message: Record<string, any>) => void} [onProgress]
	 */
	function request(type, payload, terminalType, onProgress) {
		return new Promise((resolve, reject) => {
			const id = ++nextRequestId;
			const currentWorker = getWorker();

			/** @param {MessageEvent<Record<string, any>>} event */
			const onMessage = (event) => {
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

			/** @param {ErrorEvent} event */
			const onError = (event) => {
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
		/** @param {(message: Record<string, any>) => void} [onProgress] */
		preload(onProgress) {
			return request("preload", {}, "preload-done", onProgress);
		},

		/**
		 * @param {Record<string, string>} files
		 * @param {string} primaryFile
		 * @param {(message: Record<string, any>) => void} [onProgress]
		 */
		compile(files, primaryFile, onProgress) {
			return request("compile", { files, primaryFile }, "result", onProgress);
		},

		/**
		 * @param {Record<string, string>} files
		 * @param {string} primaryFile
		 * @param {number} offset
		 * @param {(message: Record<string, any>) => void} [onProgress]
		 */
		complete(files, primaryFile, offset, onProgress) {
			return request("complete", { files, primaryFile, offset }, "completion-result", onProgress);
		},

		dispose() {
			worker?.terminate();
			worker = null;
		},
	};
}
