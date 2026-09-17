import { computed, reactive, ref } from "vue";
import type { WorkspaceSnapshot, Workspace } from "../types";

const STORAGE_KEY = "swift-wav:workspace";
const DEFAULT_FILE = "Song.swift";
const DEFAULT_CONTENT = `struct MySong: Song {
  var body: some Timeline {
    Track("drums") {
      Pattern {
        Sample("bd")
        Sample("hh")
        Sample("sd")
        Sample("hh")
      }
    }
  }
}
`;

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
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ files: { ...files, active: activeFile.value } }),
        );
      }
    } catch {
      // Storage can be full or unavailable; the current session still works.
    }
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

  function loadWorkspace(): Workspace {
    try {
      if (typeof localStorage === "undefined") return defaultWorkspace();

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.files && Object.keys(parsed.files).length > 0) {
          // Only strings are valid CodeMirror documents. Older saved
          // workspaces can contain stale/non-string values.
          const files: Record<string, string> = Object.fromEntries(
            Object.entries(parsed.files as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          );
          const names = Object.keys(files);
          if (names.length > 0) {
            return {
              files,
              active: names.includes(parsed.active) ? parsed.active : names[0],
            };
          }
        }
      }
    } catch {
      // Ignore corrupt storage and fall through to the default workspace.
    }

    return defaultWorkspace();
  }

  function defaultWorkspace(): Workspace {
    return {
      files: { [DEFAULT_FILE]: DEFAULT_CONTENT },
      active: DEFAULT_FILE,
    };
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
