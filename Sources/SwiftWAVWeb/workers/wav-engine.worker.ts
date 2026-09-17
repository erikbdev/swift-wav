/**
 * Dedicated audio-engine worker boundary.
 *
 * Keep realtime scheduling, WASM engine calls, and transferable audio data in
 * this worker. The UI should communicate with it through a small message
 * protocol rather than importing engine internals into Vue components.
 *
 * The worker is intentionally a development scaffold until the WAV engine
 * protocol is defined. `ping` makes it easy to smoke-test worker startup.
 */

type WorkerMessage = Record<string, any>;

function post(message: WorkerMessage): void {
	self.postMessage(message);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
	const message = event.data ?? {};

	if (message.type === "ping") {
		post({ id: message.id, type: "pong" });
		return;
	}

	post({
		id: message.id,
		type: "error",
		error: `Unsupported WAV engine message: ${String(message.type ?? "unknown")}`,
	});
};
