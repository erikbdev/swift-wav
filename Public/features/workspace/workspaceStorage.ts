// Saves the workspace to localStorage and loads it back, falling back to a
// starter song when nothing valid is stored.

import type { Workspace } from "./types";

const STORAGE_KEY = "swift-wav:workspace";
const DEFAULT_FILE = "Song.swift";
const DEFAULT_CONTENT = `import SwiftWAV

@main
struct MySong: Song {
  var body: some Timeline {
    Track("Drums") {
    }
  }
}
`;

export function saveWorkspace(workspace: Workspace) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Storage can be full or unavailable; the current session still works.
  }
}

export function loadWorkspace(): Workspace {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (parsed?.files) {
      // Only strings are valid CodeMirror documents. Older saved workspaces
      // can contain stale/non-string values.
      const files: Record<string, string> = Object.fromEntries(Object.entries(parsed.files as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
      const names = Object.keys(files);
      if (names.length > 0) {
        return { files, active: names.includes(parsed.active) ? parsed.active : names[0]! };
      }
    }
  } catch (e) {
    // Ignore corrupt or unavailable storage and use the default workspace.
    console.error(`An unknown error occurred when trying to load workspace. Loading default workspace: ${e}`);
  }

  return { files: { [DEFAULT_FILE]: DEFAULT_CONTENT }, active: DEFAULT_FILE };
}
