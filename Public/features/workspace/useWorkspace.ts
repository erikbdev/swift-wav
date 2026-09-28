import { computed, reactive, readonly, ref, toRefs, unref } from "vue";
import type { Workspace } from "./types";

const STORAGE_KEY = "swift-wav:workspace";

export function useWorkspace() {
  const workspace = ref(loadWorkspace());

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // Storage can be full or unavailable; the current session still works.
    }
  }

  function selectFile(filename: string) {
    if (!(filename in workspace.value.files)) return;
    workspace.value.active = filename;
    persist();
  }

  function createFile(filename: string, content: string = "") {
    let name = filename.trim();
    if (name && !name.toLowerCase().endsWith(".swift")) name += ".swift";
    if (!name || name in workspace.value.files) return;
    workspace.value.files[name] = content || "";
    workspace.value.active = name;
    persist();
  }

  function updateFile(filename: string, content: string) {
    if (!(filename in workspace.value.files)) return;
    workspace.value.files[filename] = content;
    persist();
  }

  function deleteFile(filename: string) {
    if (!(filename in workspace.value.files)) return;
    delete workspace.value.files[filename];
    if (workspace.value.active === filename) workspace.value.active = Object.keys(workspace.value.active)[0] || "";
    persist();
  }

  function loadWorkspace(): Workspace {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") || null;
      if (parsed?.files) {
        const files = Object.fromEntries(Object.entries(parsed.files).map((value) => [value[0], String(value[1] ?? "")]));
        const names = Object.keys(files);
        if (names.length > 0) {
          return {
            files,
            active: names.includes(parsed.active) ? parsed.active : (names[0] ?? ""),
          };
        }
      }
    } catch (e) {
      console.error(`An unknown error occurred when trying to load workspace. Loading default workspace: ${e}`);
    }

    return {
      files: {
        ["Song.swift"]: 'print("hello, world!")',
      },
      active: "Song.swift",
    };
  }

  return {
    workspace,
    files: computed(() => workspace.value.files),
    fileNames: computed(() => Object.keys(workspace.value.files)),
    selectFile,
    createFile,
    updateFile,
    deleteFile,
  };
}
