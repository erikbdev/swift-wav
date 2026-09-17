import { computed, reactive, ref } from "vue";
import { loadWorkspace, saveWorkspace } from "../utils/workspace-storage";
import type { WorkspaceSnapshot } from "../types";

/**
 * Owns the editor's files and active tab.
 *
 * Components receive the reactive values and emit user intent. Persistence
 * stays here so adding another editor surface does not duplicate storage
 * logic.
 */
export function useWorkspace() {
	const stored = loadWorkspace();
	const files = reactive<Record<string, string>>({ ...stored.files });
	const activeFile = ref(stored.active);

	const activeContent = computed(() => files[activeFile.value] ?? "");

	function persist() {
		saveWorkspace({ files: { ...files }, active: activeFile.value });
	}

	function selectFile(filename: string) {
		if (!(filename in files)) return;
		activeFile.value = filename;
		persist();
	}

	function createFile(filename: string) {
		let name = filename.trim();
		if (name && !name.toLowerCase().endsWith(".swift")) name += ".swift";
		if (!name || name in files) return;

		files[name] = "";
		activeFile.value = name;
		persist();
	}

	function updateFile(filename: string, content: string) {
		if (!(filename in files)) return;
		files[filename] = content;
		persist();
	}

	function snapshot(): WorkspaceSnapshot {
		return { files: { ...files }, primaryFile: activeFile.value };
	}

	return {
		files,
		activeFile,
		activeContent,
		selectFile,
		createFile,
		updateFile,
		snapshot,
	};
}
