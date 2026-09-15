import Elementary

struct MainPage: HTMLDocument {
  var title: String { "swift-wav" }

  var head: some HTML {
    meta(.name(.viewport), .content("width=device-width, initial-scale=1.0"))
    link(.rel("preconnect"), .href("https://fonts.googleapis.com"))
    link(.rel("preconnect"), .href("https://fonts.gstatic.com"), .crossorigin(.anonymous))
    link(
      .rel(.stylesheet),
      .href("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap")
    )
    style {
      HTMLRaw(
        /* css */
        """
        :root {
          color-scheme: dark;
          --bg-0: #0c0b0a;
          --bg-1: #161514;
          --bg-2: #1b1a18;
          --bg-3: #22211e;
          --bg-4: #2a2926;
          --bg-5: #343330;
          --border: rgba(255, 244, 230, .08);
          --border-strong: rgba(255, 244, 230, .16);
          --border-faint: rgba(255, 244, 230, .05);
          --text-0: #edece7;
          --text-1: #a6a29a;
          --text-2: #85817a;
          --text-3: #5f5c55;
          --accent: #ff6b45;
          --accent-hi: #ff855f;
          --accent-dim: rgba(255, 107, 69, .14);
          --accent-line: rgba(255, 107, 69, .38);
          --green: #46c07e;
          --blue: #4aa3e8;
          --amber: #d6a04a;
          --red: #f0564a;
          --purple: #a884f0;
          --sans: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
          --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
          --r-sm: 6px;
          --r-md: 9px;
          --r-lg: 13px;
          --topbar-h: 54px;
          --status-h: 30px;
          --tabbar-h: 40px;
          --activity-w: 44px;
          --sidebar-w: 250px;
          --shadow-sm: 0 1px 2px rgba(0, 0, 0, .3), 0 1px 1px rgba(0, 0, 0, .18);
          --shadow-card: 0 6px 22px -8px rgba(0, 0, 0, .45), 0 2px 8px -3px rgba(0, 0, 0, .28);
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          height: 100%;
          background: var(--bg-0);
          color: var(--text-0);
          font-family: var(--sans);
          font-size: 13px;
          letter-spacing: -0.006em;
          -webkit-font-smoothing: antialiased;
        }

        /* ---------- App shell ---------- */

        .app {
          height: 100vh;
          display: grid;
          grid-template-rows: var(--topbar-h) 1fr var(--status-h);
          background: var(--bg-0);
          overflow: hidden;
        }
        .topbar {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0 14px;
          background: color-mix(in srgb, var(--bg-0) 86%, transparent);
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--border);
        }
        .brand {
          font-weight: 600;
          font-size: 13px;
          letter-spacing: -0.01em;
          color: var(--text-0);
        }
        .tb-spacer { flex: 1; }
        .tb-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 34px;
          padding: 0 13px;
          border: 1px solid transparent;
          border-radius: var(--r-md);
          background: transparent;
          color: var(--text-1);
          font-family: var(--sans);
          font-size: 12.5px;
          font-weight: 560;
          letter-spacing: -0.004em;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease, transform 0.12s ease;
        }
        .tb-btn.run {
          background: var(--text-0);
          border-color: var(--text-0);
          color: var(--bg-1);
          font-weight: 640;
          padding: 0 16px;
          box-shadow: var(--shadow-sm);
        }
        .tb-btn.run:hover {
          background: var(--accent-hi);
          border-color: var(--accent-hi);
          color: #fff;
        }
        .tb-btn.run:active {
          transform: translateY(0.5px) scale(0.99);
        }
        .body {
          display: flex;
          min-height: 0;
        }
        .activity {
          width: var(--activity-w);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 0;
          background: var(--bg-1);
          border-right: 1px solid var(--border);
        }
        .activity-icon {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: var(--r-sm);
          color: var(--text-2);
          font-size: 13px;
          cursor: pointer;
        }
        .activity-icon:hover {
          background: var(--bg-3);
          color: var(--text-1);
        }
        .activity-icon.active {
          background: var(--accent-dim);
          color: var(--accent-hi);
          box-shadow: inset 0 0 0 1px var(--accent-line);
        }
        .editor-container {
          flex: 1.6;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: var(--bg-1);
        }
        .preview {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: var(--bg-2);
          border-left: 1px solid var(--border);
        }
        .panel-summary {
          padding: 10px 14px;
          border-bottom: 1px solid var(--border-faint);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--text-2);
        }
        .panel-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 1rem;
          color: var(--text-2);
          font-size: 12.5px;
        }
        .statusbar {
          display: flex;
          align-items: center;
          padding: 0 10px;
          background: color-mix(in srgb, var(--bg-0) 86%, transparent);
          border-top: 1px solid var(--border);
          font-family: var(--mono);
          font-size: 10.5px;
          letter-spacing: 0.02em;
          color: var(--text-2);
          user-select: none;
        }
        .status-spacer { flex: 1; }

        /* ---------- Sidebar (file tree) ---------- */

        .sidebar {
          width: var(--sidebar-w);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: var(--bg-2);
          border-right: 1px solid var(--border);
          overflow: hidden;
        }
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px 6px;
          color: var(--text-2);
          font-weight: 600;
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .sidebar-header button {
          display: grid;
          place-items: center;
          width: 20px;
          height: 20px;
          border-radius: var(--r-sm);
          border: 1px solid var(--border);
          background: var(--bg-3);
          color: var(--text-1);
          font-family: inherit;
          font-size: 0.85rem;
          line-height: 1;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .sidebar-header button:hover {
          background: var(--accent-dim);
          color: var(--accent-hi);
          border-color: var(--accent-line);
        }
        .file-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 6px;
        }
        .file-item {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 28px;
          padding: 0 8px;
          border-radius: var(--r-sm);
          color: var(--text-1);
          font-size: 12.5px;
          cursor: pointer;
          white-space: nowrap;
          user-select: none;
        }
        .file-item:hover {
          background: var(--bg-3);
        }
        .file-item.active {
          background: var(--accent-dim);
          color: var(--text-0);
          box-shadow: inset 0 0 0 1px var(--accent-line);
        }
        .file-item .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          opacity: 0.55;
          flex-shrink: 0;
        }
        .file-item.active .dot {
          opacity: 1;
        }
        .file-item .name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: var(--mono);
        }
        .file-item .remove {
          opacity: 0;
          color: var(--text-3);
          font-size: 0.85rem;
          padding: 0 3px;
          border-radius: var(--r-sm);
        }
        .file-item:hover .remove {
          opacity: 1;
        }
        .file-item .remove:hover {
          color: #fff;
          background: var(--red);
        }
        .new-file-row {
          display: flex;
          align-items: center;
          padding: 2px 8px;
          gap: 6px;
        }
        .new-file-row input {
          flex: 1;
          min-width: 0;
          background: var(--bg-1);
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          color: var(--text-0);
          font: 12.5px var(--mono);
          padding: 4px 7px;
        }
        .new-file-row input:focus {
          outline: none;
          border-color: var(--accent-line);
          box-shadow: 0 0 0 3px var(--accent-dim);
        }

        /* ---------- Tab bar + editor ---------- */

        .tabbar {
          display: flex;
          align-items: center;
          height: var(--tabbar-h);
          padding: 0 8px;
          gap: 4px;
          border-bottom: 1px solid var(--border-faint);
          flex-shrink: 0;
          overflow-x: auto;
        }
        .tab {
          position: relative;
          display: flex;
          align-items: center;
          gap: 7px;
          height: 28px;
          padding: 0 11px;
          max-width: 200px;
          border: 1px solid transparent;
          border-radius: var(--r-sm);
          color: var(--text-2);
          font-size: 12.5px;
          font-family: var(--mono);
          cursor: pointer;
          white-space: nowrap;
          user-select: none;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .tab:hover {
          background: var(--bg-3);
          color: var(--text-1);
        }
        .tab.active {
          background: var(--bg-3);
          color: var(--text-0);
          box-shadow: inset 0 -2px 0 var(--accent);
        }
        .tab .close {
          color: var(--text-3);
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          flex-shrink: 0;
        }
        .tab .close:hover {
          color: #fff;
          background: var(--red);
        }
        .cm-host {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          background: var(--bg-1);
        }
        .cm-host .cm-editor {
          height: 100%;
        }
        .cm-host .cm-scroller {
          overflow: auto;
        }
        .empty-state {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-3);
          font-size: 12.5px;
          font-family: var(--mono);
        }

        .panel-content.output {
          display: block;
          align-items: initial;
          justify-content: initial;
          text-align: left;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--mono);
          font-size: 11.5px;
          line-height: 1.5;
        }
        .panel-content .out-line { color: var(--text-0); }
        .panel-content .out-line.stderr { color: var(--red); }
        .panel-content .out-line.diagnostic { color: var(--amber); }
        .panel-content .out-line.status { color: var(--text-2); font-style: italic; }

        @media (max-width: 800px) {
          .body { flex-direction: column; }
          .sidebar { width: 100%; }
        }
        """
      )
    }
  }

  var body: some HTML {
    div(.class("app")) {
      header(.class("topbar")) {
        span(.class("brand")) { "swift-wav" }
        div(.class("tb-spacer")) {}
        button(.class("tb-btn run"), .type(.button)) {
          span(.class("tb-ico")) { "▶" }
          span(.id("run-label")) { "Run" }
        }
      }
      div(.class("body")) {
        // TODO: work this out later.
        //
        // nav(.class("activity")) {
        //   div(.class("activity-icon active"), .title("Files")) { "📄" }
        //   div(.class("activity-icon"), .title("Search")) { "🔍" }
        //   div(.class("activity-icon"), .title("Settings")) { "⚙" }
        // }
        // aside(.id("file-sidebar"), .class("sidebar")) {}
        div(.class("editor-container")) {
          div(.id("tab-bar"), .class("tabbar")) {}
          div(.id("cm-host"), .class("cm-host")) {}
        }
        aside(.id("preview-pane"), .class("preview")) {
          div(.class("panel-summary")) { "RESULTS" }
          div(.id("preview-content"), .class("panel-content")) { "Run your code to hear it play." }
        }
      }
      div(.class("statusbar")) {
        span { "swift-wav" }
        span(.class("status-spacer")) {}
        span(.id("status-text")) { "Ready" }
      }
    }
    script(.type(.module)) {
      HTMLRaw(
        /* js */
        """
        import { EditorState, Compartment } from "https://esm.sh/@codemirror/state@6.4.1";
        import { EditorView, keymap } from "https://esm.sh/@codemirror/view@6.34.1";
        import { basicSetup } from "https://esm.sh/codemirror@6.0.1";
        import { indentWithTab } from "https://esm.sh/@codemirror/commands@6.7.1";
        import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "https://esm.sh/@codemirror/language@6.10.3";
        import { swift } from "https://esm.sh/@codemirror/legacy-modes@6.5.1/mode/swift";
        import { tags as t } from "https://esm.sh/@lezer/highlight@1.2.1";

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

        // ---------- Workspace state (files, tabs, active file) ----------

        function loadWorkspace() {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.files && Object.keys(parsed.files).length > 0) {
                return parsed;
              }
            }
          } catch {
            // ignore corrupt storage, fall through to defaults
          }
          return {
            files: { [DEFAULT_FILE]: DEFAULT_CONTENT },
            open: [DEFAULT_FILE],
            active: DEFAULT_FILE,
          };
        }

        function saveWorkspace(ws) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
          } catch {
            // storage full or unavailable; editing still works for this session
          }
        }

        // ---------- CodeMirror setup ----------

        // Warm near-black studio theme: bg-1 editor surface, orange-red accent,
        // JetBrains Mono, matching the rest of the app's chrome.
        const studioHighlight = HighlightStyle.define([
          { tag: t.keyword, color: "#ff6b45" },
          { tag: t.controlKeyword, color: "#ff6b45" },
          { tag: t.definitionKeyword, color: "#ff6b45" },
          { tag: t.string, color: "#46c07e" },
          { tag: t.comment, color: "#5f5c55", fontStyle: "italic" },
          { tag: t.number, color: "#a884f0" },
          { tag: t.bool, color: "#a884f0" },
          { tag: t.typeName, color: "#4aa3e8" },
          { tag: t.className, color: "#4aa3e8" },
          { tag: t.function(t.variableName), color: "#d6a04a" },
          { tag: t.propertyName, color: "#d6a04a" },
          { tag: t.operator, color: "#a6a29a" },
          { tag: t.punctuation, color: "#85817a" },
          { tag: t.attributeName, color: "#a884f0" },
        ]);

        const studioTheme = EditorView.theme(
          {
            "&": {
              color: "#edece7",
              backgroundColor: "#161514",
              height: "100%",
              fontSize: "12.5px",
            },
            ".cm-content": { caretColor: "#ff6b45", fontFamily: "var(--mono)", padding: "12px 0" },
            ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#ff6b45" },
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
              backgroundColor: "rgba(255, 107, 69, 0.22)",
            },
            ".cm-activeLine": { backgroundColor: "rgba(255, 244, 230, 0.035)" },
            ".cm-activeLineGutter": { backgroundColor: "rgba(255, 244, 230, 0.035)" },
            ".cm-gutters": {
              backgroundColor: "#161514",
              color: "#5f5c55",
              border: "none",
            },
            ".cm-scroller": { fontFamily: "var(--mono)" },
          },
          { dark: true }
        );

        const languageCompartment = new Compartment();

        function extensionsFor() {
          return [
            basicSetup,
            keymap.of([indentWithTab]),
            languageCompartment.of(StreamLanguage.define(swift)),
            syntaxHighlighting(studioHighlight),
            studioTheme,
            EditorView.updateListener.of((update) => {
              if (update.docChanged) onDocChanged(update.state.doc.toString());
            }),
          ];
        }

        // ---------- App wiring ----------

        let workspace = loadWorkspace();
        let view = null;

        const sidebarEl = document.getElementById("file-sidebar");
        const tabBarEl = document.getElementById("tab-bar");
        const hostEl = document.getElementById("cm-host");

        function onDocChanged(content) {
          if (!workspace.active) return;
          workspace.files[workspace.active] = content;
          saveWorkspace(workspace);
        }

        function stateFor(filename) {
          return EditorState.create({
            doc: workspace.files[filename] ?? "",
            extensions: extensionsFor(),
          });
        }

        function mountEditor() {
          if (!hostEl) return;
          view = new EditorView({
            state: workspace.active ? stateFor(workspace.active) : undefined,
            parent: hostEl,
          });
        }

        function switchTo(filename) {
          if (!(filename in workspace.files)) return;
          if (!workspace.open.includes(filename)) workspace.open.push(filename);
          workspace.active = filename;
          saveWorkspace(workspace);
          if (view) view.setState(stateFor(filename));
          render();
        }

        function closeTab(filename, event) {
          event.stopPropagation();
          workspace.open = workspace.open.filter((f) => f !== filename);
          if (workspace.active === filename) {
            workspace.active = workspace.open[workspace.open.length - 1] ?? null;
          }
          saveWorkspace(workspace);
          if (view) {
            if (workspace.active) view.setState(stateFor(workspace.active));
            else view.setState(EditorState.create({ doc: "", extensions: extensionsFor() }));
          }
          render();
        }

        function deleteFile(filename, event) {
          event.stopPropagation();
          if (!confirm(`Delete ${filename}?`)) return;
          delete workspace.files[filename];
          workspace.open = workspace.open.filter((f) => f !== filename);
          if (workspace.active === filename) {
            workspace.active = workspace.open[workspace.open.length - 1] ?? null;
          }
          saveWorkspace(workspace);
          if (view) {
            view.setState(
              workspace.active ? stateFor(workspace.active) : EditorState.create({ doc: "", extensions: extensionsFor() })
            );
          }
          render();
        }

        function createFile(filename) {
          const name = filename.trim();
          if (!name || name in workspace.files) return;
          workspace.files[name] = "";
          workspace.open.push(name);
          workspace.active = name;
          saveWorkspace(workspace);
          if (view) view.setState(stateFor(name));
          render();
        }

        function renderSidebar() {
          if (!sidebarEl) return;
          sidebarEl.innerHTML = "";

          const header = document.createElement("div");
          header.className = "sidebar-header";
          header.innerHTML = `<span>Files</span>`;
          const addBtn = document.createElement("button");
          addBtn.textContent = "+";
          addBtn.title = "New file";
          addBtn.addEventListener("click", () => showNewFileInput());
          header.appendChild(addBtn);
          sidebarEl.appendChild(header);

          const list = document.createElement("div");
          list.className = "file-list";

          for (const name of Object.keys(workspace.files).sort()) {
            const item = document.createElement("div");
            item.className = "file-item" + (name === workspace.active ? " active" : "");
            item.addEventListener("click", () => switchTo(name));

            const dot = document.createElement("span");
            dot.className = "dot";
            item.appendChild(dot);

            const label = document.createElement("span");
            label.className = "name";
            label.textContent = name;
            item.appendChild(label);

            const remove = document.createElement("span");
            remove.className = "remove";
            remove.textContent = "×";
            remove.addEventListener("click", (e) => deleteFile(name, e));
            item.appendChild(remove);

            list.appendChild(item);
          }

          sidebarEl.appendChild(list);
        }

        function showNewFileInput() {
          const row = document.createElement("div");
          row.className = "new-file-row";
          const input = document.createElement("input");
          input.type = "text";
          input.placeholder = "NewFile.swift";
          row.appendChild(input);
          sidebarEl.appendChild(row);
          input.focus();

          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              createFile(input.value);
            } else if (e.key === "Escape") {
              render();
            }
          });
          input.addEventListener("blur", () => render());
        }

        function renderTabBar() {
          if (!tabBarEl) return;
          tabBarEl.innerHTML = "";

          for (const name of workspace.open) {
            const tab = document.createElement("div");
            tab.className = "tab" + (name === workspace.active ? " active" : "");
            tab.addEventListener("click", () => switchTo(name));

            const label = document.createElement("span");
            label.textContent = name;
            tab.appendChild(label);

            const close = document.createElement("span");
            close.className = "close";
            close.textContent = "×";
            close.addEventListener("click", (e) => closeTab(name, e));
            tab.appendChild(close);

            tabBarEl.appendChild(tab);
          }
        }

        function render() {
          renderSidebar();
          renderTabBar();
          if (hostEl) {
            const empty = hostEl.querySelector(".empty-state");
            if (!workspace.active) {
              if (!empty) {
                hostEl.innerHTML = `<div class="empty-state">No file open</div>`;
              }
            } else if (empty) {
              hostEl.innerHTML = "";
              mountEditor();
            }
          }
        }

        if (!workspace.active) {
          render();
        } else {
          mountEditor();
          render();
        }

        // ---------- In-browser Swift compilation ----------

        const runBtn = document.querySelector(".tb-btn.run");
        const runLabelEl = document.getElementById("run-label");
        const statusEl = document.getElementById("status-text");
        const outputEl = document.getElementById("preview-content");

        let worker = null;
        let nextRequestId = 0;
        let running = false;
        let toolchainReady = false;

        function getWorker() {
          if (!worker) {
            worker = new Worker("/js/swift-compiler-worker.js", { type: "module" });
          }
          return worker;
        }

        function setStatus(text) {
          if (statusEl) statusEl.textContent = text;
        }

        function setRunLabel(text) {
          if (runLabelEl) runLabelEl.textContent = text;
        }

        function formatMB(bytes) {
          return (bytes / (1024 * 1024)).toFixed(1);
        }

        function renderOutput(lines) {
          if (!outputEl) return;
          outputEl.classList.add("output");
          outputEl.innerHTML = "";
          for (const { text, kind } of lines) {
            const div = document.createElement("div");
            div.className = "out-line" + (kind ? ` ${kind}` : "");
            div.textContent = text;
            outputEl.appendChild(div);
          }
        }

        // Kick off the precompressed toolchain download as soon as the page
        // loads, rather than waiting for the first Run click. The button
        // stays disabled until it lands.
        function preloadToolchain() {
          if (runBtn) runBtn.disabled = true;
          setRunLabel("Downloading runtime…");
          setStatus("Downloading Swift toolchain…");

          const id = ++nextRequestId;
          const w = getWorker();

          const onMessage = (event) => {
            const data = event.data;
            if (data.id !== id) return;

            if (data.type === "preload-progress") {
              if (data.total > 0) {
                setRunLabel(`Downloading runtime… ${formatMB(data.loaded)}/${formatMB(data.total)}MB`);
              } else {
                setRunLabel("Downloading runtime…");
              }
              return;
            }

            w.removeEventListener("message", onMessage);
            if (data.type === "preload-done") {
              toolchainReady = data.ok;
              if (data.ok) {
                setRunLabel("Run");
                setStatus("Ready");
                if (runBtn) runBtn.disabled = false;
              } else {
                setRunLabel("Run (retry download)");
                setStatus("Toolchain download failed");
                renderOutput([{ text: `Failed to download Swift toolchain: ${data.error}`, kind: "stderr" }]);
                if (runBtn) runBtn.disabled = false;
              }
            }
          };

          w.addEventListener("message", onMessage);
          w.postMessage({ id, type: "preload" });
        }

        function runCurrentFile() {
          if (running) return;
          if (!workspace.active) {
            renderOutput([{ text: "No file open.", kind: "stderr" }]);
            return;
          }

          running = true;
          if (runBtn) runBtn.disabled = true;
          setStatus("Compiling…");
          renderOutput([{ text: "Compiling…", kind: "status" }]);

          const id = ++nextRequestId;
          const w = getWorker();

          const onMessage = (event) => {
            const data = event.data;
            if (data.id !== id) return;

            if (data.type === "progress") {
              setStatus(data.message);
              renderOutput([{ text: data.message, kind: "status" }]);
              return;
            }
            if (data.type === "download-progress") {
              if (data.total > 0) {
                setRunLabel(`Downloading runtime… ${formatMB(data.loaded)}/${formatMB(data.total)}MB`);
              } else {
                setRunLabel("Downloading runtime…");
              }
              return;
            }

            w.removeEventListener("message", onMessage);
            running = false;
            toolchainReady = true;
            setRunLabel("Run");
            if (runBtn) runBtn.disabled = false;

            const lines = [];
            for (const text of data.diagnostics ?? []) lines.push({ text, kind: "diagnostic" });
            for (const text of data.stdout ?? []) lines.push({ text, kind: "stdout" });
            for (const text of data.stderr ?? []) lines.push({ text, kind: "stderr" });

            if (data.ok) {
              setStatus("Ready");
              if (lines.length === 0) lines.push({ text: "Program produced no output.", kind: "status" });
            } else {
              setStatus(`Failed (${data.stage ?? "unknown"})`);
              if (lines.length === 0) lines.push({ text: `Compilation failed at stage: ${data.stage}`, kind: "stderr" });
            }
            renderOutput(lines);
          };

          w.addEventListener("message", onMessage);
          w.postMessage({
            id,
            type: "compile",
            files: { ...workspace.files },
            primaryFile: workspace.active,
          });
        }

        if (runBtn) runBtn.addEventListener("click", runCurrentFile);
        preloadToolchain();
        """
      )
    }
  }
}
