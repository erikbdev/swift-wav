/**
 * The small, browser-only persistence layer for the editor workspace.
 *
 * Keeping storage access here means components and composables can work with
 * plain workspace values and do not need to know which persistence mechanism
 * is being used.
 */

import type { Workspace } from "../types";

export const STORAGE_KEY = "swift-wav:workspace";
export const DEFAULT_FILE = "Song.swift";
export const DEFAULT_CONTENT = `struct MySong: Song {
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

export function loadWorkspace(): Workspace {
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
						(entry): entry is [string, string] => typeof entry[1] === "string"
					)
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

export function defaultWorkspace(): Workspace {
	return {
		files: { [DEFAULT_FILE]: DEFAULT_CONTENT },
		active: DEFAULT_FILE,
	};
}

export function saveWorkspace(workspace: Workspace): void {
	try {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
		}
	} catch {
		// Storage can be full or unavailable; the current session still works.
	}
}
