import { reactive, ref } from "vue";
import type { WorkspaceSnapshot } from "./types";
import { loadWorkspace, saveWorkspace } from "./workspaceStorage";

/** The editor's files and active tab, saved on every change. */
export function useWorkspace() {
  const stored = loadWorkspace();
  const files = reactive<Record<string, string>>({ ...stored.files });
  const activeFile = ref(stored.active);

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

  function deleteFile(filename: string) {
    if (!(filename in files)) return;
    delete files[filename];
    if (activeFile.value === filename) activeFile.value = Object.keys(files)[0] ?? "";
    persist();
  }

  function snapshot(): WorkspaceSnapshot {
    return { files: { ...files }, primaryFile: activeFile.value };
  }

  return { files, activeFile, selectFile, createFile, updateFile, deleteFile, snapshot };
}
