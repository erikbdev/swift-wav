import { onBeforeUnmount, onMounted, ref } from "vue";
import { createSwiftCompilerClient } from "../services/swiftCompilerClient.js";
import { formatMB, outputFromResult, problemsFromResult } from "../utils/compiler-output.js";

/** @typedef {{severity: string, file: string, line: (number|null), column: (number|null), message: string}} Problem */
/** @typedef {{text: string, kind: string}} OutputLine */

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
	/** @type {import('vue').Ref<Problem[]>} */
	const problems = ref([]);
	/** @type {import('vue').Ref<OutputLine[]>} */
	const output = ref([]);

	/** @param {string} text */
	function setDownloadStatus(text) {
		runLabel.value = text;
	}

	/** @param {any} progress */
	function handleDownloadProgress(progress) {
		if (progress.total > 0) {
			setDownloadStatus(
				`Downloading runtime… ${formatMB(progress.loaded)}/${formatMB(progress.total)}MB`
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
			const result = await client.preload(handleDownloadProgress);
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

	/**
	 * @param {{files: Record<string, string>, primaryFile: string}} workspace
	 */
	async function run(workspace) {
		if (running.value) return;
		if (!workspace.primaryFile) {
			problems.value = [
				{ severity: "error", file: "Swift", line: null, column: null, message: "No Swift file is active." },
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
			const result = await client.compile(workspace.files, workspace.primaryFile, (message) => {
				if (message.type === "progress") status.value = message.message;
				if (message.type === "download-progress") handleDownloadProgress(message);
			});

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

	/**
	 * @param {{files: Record<string, string>, primaryFile: string}} workspace
	 * @param {number} offset
	 * @returns {Promise<any[]>}
	 */
	async function complete(workspace, offset) {
		if (!workspace.primaryFile) return [];
		const result = await client.complete(workspace.files, workspace.primaryFile, offset, (message) => {
			if (message.type === "progress") status.value = message.message;
			if (message.type === "download-progress") handleDownloadProgress(message);
		});
		return result.items ?? [];
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
		complete,
		clearProblems,
	};
}

/** @param {unknown} error @returns {string} */
function errorMessage(error) {
	if (error instanceof Error) return error.message;
	return String(error);
}
