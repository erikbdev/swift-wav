import Elementary

struct MainPage: HTMLDocument {
  var title: String { "swift-wav" }

  var head: some HTML {
    meta(.name(.viewport), .content("width=device-width, initial-scale=1.0"))
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
          --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif;
          --mono: "CommitMono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          --r-sm: 6px;
          --r-md: 9px;
          --r-lg: 13px;
          --topbar-h: 54px;
          --status-h: 30px;
          --tabbar-h: 40px;
          --shadow-sm: 0 1px 2px rgba(0, 0, 0, .3), 0 1px 1px rgba(0, 0, 0, .18);
          --shadow-card: 0 6px 22px -8px rgba(0, 0, 0, .45), 0 2px 8px -3px rgba(0, 0, 0, .28);
        }

        @font-face {
          font-family: "CommitMono";
          font-style: normal;
          font-weight: 400 600;
          font-display: swap;
          line-height: 16px;
          src: url("/fonts/CommitMono.woff2") format("woff2");
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
        .editor-container {
          flex: 1.6;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: var(--bg-1);
          position: relative;
        }
        .preview {
          flex: 1.15;
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          background: var(--bg-2);
          border-left: 1px solid var(--border);
        }
        .panel-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 40px;
          padding: 0 14px;
          border-bottom: 1px solid var(--border-faint);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--text-2);
        }
        .panel-meta {
          color: var(--text-3);
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0;
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

        /* ---------- Tab bar + editor ---------- */

        .tabbar {
          display: flex;
          align-items: center;
          height: var(--tabbar-h);
          min-width: 0;
          padding: 0 10px;
          gap: 3px;
          background: var(--bg-1);
          border-bottom: 1px solid var(--border-faint);
          flex-shrink: 0;
          overflow-x: auto;
          scrollbar-width: thin;
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
          background: transparent;
          color: var(--text-2);
          font-size: 12.5px;
          font-family: var(--mono);
          appearance: none;
          cursor: pointer;
          flex: 0 0 auto;
          white-space: nowrap;
          text-align: left;
          user-select: none;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .tab::before {
          content: "";
          width: 6px;
          height: 6px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--accent);
          opacity: 0.45;
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
        .tab.active::before { opacity: 1; }
        .tab-add {
          width: 28px;
          flex-basis: 28px;
          justify-content: center;
          padding: 0;
          color: var(--text-2);
          font-family: var(--sans);
          font-size: 18px;
          line-height: 1;
        }
        .tab-add::before { display: none; }
        .tab-add:hover { color: var(--accent-hi); }
        .new-tab {
          display: flex;
          align-items: center;
          height: 28px;
          flex: 0 0 160px;
        }
        .new-tab input {
          width: 100%;
          height: 26px;
          padding: 0 8px;
          border: 1px solid var(--accent-line);
          border-radius: var(--r-sm);
          outline: none;
          background: var(--bg-2);
          color: var(--text-0);
          font: 12px var(--mono);
          box-shadow: 0 0 0 3px var(--accent-dim);
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

        /* ---------- Problems ---------- */

        .problems-bar {
          display: flex;
          align-items: center;
          min-height: 30px;
          padding: 0 8px;
          gap: 10px;
          background: var(--bg-2);
          border-top: 1px solid var(--border);
          color: var(--text-2);
          font-family: var(--mono);
          font-size: 10.5px;
          flex-shrink: 0;
        }
        .problems-toggle {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 24px;
          padding: 0 8px;
          border: 1px solid transparent;
          border-radius: var(--r-sm);
          background: transparent;
          color: var(--text-1);
          font: inherit;
          cursor: pointer;
        }
        .problems-toggle:hover,
        .problems-toggle[aria-expanded="true"] {
          background: var(--bg-3);
          border-color: var(--border);
          color: var(--text-0);
        }
        .problems-icon {
          display: inline-grid;
          place-items: center;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          background: var(--text-3);
          color: var(--bg-0);
          font-size: 10px;
          font-weight: 700;
        }
        .problems-toggle.has-errors .problems-icon { background: var(--red); color: #fff; }
        .problems-toggle.has-warnings .problems-icon { background: var(--amber); color: var(--bg-0); }
        .problems-count {
          min-width: 16px;
          padding: 1px 5px;
          border-radius: 10px;
          background: var(--bg-4);
          color: var(--text-1);
          text-align: center;
        }
        .problems-status { color: var(--text-3); }
        .output-toggle {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 24px;
          padding: 0 8px;
          border: 1px solid transparent;
          border-radius: var(--r-sm);
          background: transparent;
          color: var(--text-1);
          font: inherit;
          cursor: pointer;
        }
        .output-toggle:hover,
        .output-toggle[aria-expanded="true"] {
          background: var(--bg-3);
          border-color: var(--border);
          color: var(--text-0);
        }
        .output-icon {
          display: inline-grid;
          place-items: center;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          background: var(--text-3);
          color: var(--bg-0);
          font-size: 10px;
          font-weight: 700;
        }
        .output-toggle.has-output .output-icon { background: var(--blue); color: #fff; }
        .output-count {
          min-width: 16px;
          padding: 1px 5px;
          border-radius: 10px;
          background: var(--bg-4);
          color: var(--text-1);
          text-align: center;
        }
        .problems-panel {
          position: absolute;
          right: 8px;
          bottom: 38px;
          left: 8px;
          z-index: 10;
          display: flex;
          flex-direction: column;
          max-height: min(320px, 45vh);
          overflow-y: auto;
          border: 1px solid var(--border-strong);
          border-radius: var(--r-md);
          background: rgba(27, 26, 24, .98);
          box-shadow: var(--shadow-card);
        }
        .problems-panel.is-hidden { display: none; }
        .problem-item {
          display: grid;
          grid-template-columns: 9px minmax(100px, 175px) 1fr;
          align-items: center;
          gap: 9px;
          min-height: 38px;
          padding: 7px 11px;
          width: 100%;
          border: 0;
          border-bottom: 1px solid var(--border-faint);
          background: transparent;
          color: var(--text-1);
          cursor: pointer;
          font: inherit;
          text-align: left;
        }
        .problem-item:last-child { border-bottom: 0; }
        .problem-item:hover { background: var(--bg-3); }
        .problem-severity {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--amber);
        }
        .problem-item.error .problem-severity { background: var(--red); }
        .problem-location {
          overflow: hidden;
          color: var(--text-3);
          font: 10px var(--mono);
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .problem-message {
          overflow: hidden;
          color: var(--text-0);
          font-size: 11.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .problems-empty {
          padding: 14px;
          color: var(--text-3);
          font: 11px var(--mono);
        }
        .output-panel {
          position: absolute;
          right: 8px;
          bottom: 38px;
          left: 8px;
          z-index: 10;
          display: flex;
          flex-direction: column;
          max-height: min(320px, 45vh);
          overflow-y: auto;
          border: 1px solid var(--border-strong);
          border-radius: var(--r-md);
          background: rgba(27, 26, 24, .98);
          box-shadow: var(--shadow-card);
        }
        .output-panel.is-hidden { display: none; }
        .output-line {
          padding: 7px 11px;
          border-bottom: 1px solid var(--border-faint);
          color: var(--text-0);
          font: 11.5px/1.45 var(--mono);
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .output-line:last-child { border-bottom: 0; }
        .output-line.stderr { color: var(--red); }
        .output-line.status { color: var(--text-2); font-style: italic; }
        .output-empty {
          padding: 14px;
          color: var(--text-3);
          font: 11px var(--mono);
        }

        /* ---------- Arrangement preview ---------- */

        .timeline-toolbar {
          display: flex;
          align-items: center;
          min-height: 36px;
          padding: 0 12px;
          gap: 9px;
          border-bottom: 1px solid var(--border-faint);
          color: var(--text-2);
          font: 10px var(--mono);
        }
        .transport-button {
          display: grid;
          place-items: center;
          width: 23px;
          height: 23px;
          border: 1px solid var(--border);
          border-radius: 50%;
          background: var(--bg-3);
          color: var(--text-1);
          cursor: pointer;
        }
        .transport-button:hover { color: var(--accent-hi); border-color: var(--accent-line); }
        .timeline-spacer { flex: 1; }
        .timeline-mode {
          padding: 3px 6px;
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text-3);
          font-size: 9px;
          letter-spacing: .06em;
        }
        .timeline {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding-bottom: 18px;
          background: var(--bg-2);
        }
        .timeline-ruler,
        .timeline-row {
          display: grid;
          grid-template-columns: 116px minmax(520px, 1fr);
        }
        .timeline-ruler {
          position: sticky;
          top: 0;
          z-index: 2;
          min-height: 28px;
          border-bottom: 1px solid var(--border);
          background: rgba(27, 26, 24, .96);
        }
        .timeline-track-label {
          display: flex;
          align-items: center;
          padding-left: 12px;
          color: var(--text-3);
          font: 9px var(--mono);
          letter-spacing: .08em;
        }
        .ruler-bars {
          display: grid;
          grid-template-columns: repeat(8, minmax(65px, 1fr));
          align-items: center;
        }
        .ruler-bars span {
          height: 100%;
          padding: 8px 7px 0;
          border-left: 1px solid var(--border-faint);
          color: var(--text-3);
          font: 9px var(--mono);
        }
        .timeline-row {
          min-height: 76px;
          border-bottom: 1px solid var(--border-faint);
        }
        .track-label {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px 0 12px;
          border-right: 1px solid var(--border-faint);
          background: rgba(22, 21, 20, .42);
        }
        .track-color {
          width: 4px;
          height: 32px;
          border-radius: 4px;
          background: var(--accent);
        }
        .track-color.blue { background: var(--blue); }
        .track-color.purple { background: var(--purple); }
        .track-name { color: var(--text-0); font-size: 11px; }
        .track-type {
          display: block;
          margin-top: 3px;
          color: var(--text-3);
          font: 9px var(--mono);
          letter-spacing: .05em;
        }
        .track-lane {
          position: relative;
          min-width: 520px;
          background-image: repeating-linear-gradient(
            to right,
            transparent 0,
            transparent calc(12.5% - 1px),
            var(--border-faint) calc(12.5% - 1px),
            var(--border-faint) 12.5%
          );
        }
        .track-lane::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            to right,
            transparent 0,
            transparent calc(3.125% - 1px),
            rgba(255, 244, 230, .025) calc(3.125% - 1px),
            rgba(255, 244, 230, .025) 3.125%
          );
        }
        .clip {
          position: absolute;
          top: 16px;
          z-index: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 44px;
          min-width: 92px;
          padding: 0 9px;
          border-left: 3px solid var(--accent-hi);
          border-radius: 4px;
          background: rgba(255, 107, 69, .22);
          color: var(--text-0);
          font-size: 10.5px;
        }
        .clip small { color: rgba(255, 244, 230, .58); font: 9px var(--mono); }
        .clip.blue { border-color: var(--blue); background: rgba(74, 163, 232, .19); }
        .clip.purple { border-color: var(--purple); background: rgba(168, 132, 240, .18); }
        .timeline-note {
          padding: 16px 12px;
          color: var(--text-3);
          font: 10px var(--mono);
          text-align: center;
        }

        @media (max-width: 800px) {
          .body { flex-direction: column; }
          .editor-container { flex: 1 1 58%; min-height: 360px; }
          .preview { flex: 1 1 42%; min-height: 300px; border-top: 1px solid var(--border); border-left: 0; }
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
        div(.class("editor-container")) {
          div(.id("tab-bar"), .class("tabbar")) {}
          div(.id("cm-host"), .class("cm-host")) {}
          div(.class("problems-bar")) {
            button(.id("problems-toggle"), .class("problems-toggle"), .type(.button)) {
              span(.class("problems-icon")) { "0" }
              span { "Problems" }
              span(.class("problems-count")) { "0" }
            }
            button(.id("output-toggle"), .class("output-toggle"), .type(.button)) {
              span(.class("output-icon")) { "›" }
              span { "Output" }
              span(.class("output-count")) { "0" }
            }
            span(.id("problems-status"), .class("problems-status")) { "No issues" }
          }
          div(.id("problems-panel"), .class("problems-panel is-hidden")) {}
          div(.id("output-panel"), .class("output-panel is-hidden")) {}
        }
        aside(.id("preview-pane"), .class("preview")) {
          div(.class("panel-summary")) {
            span { "TIMELINE" }
            span(.class("panel-meta")) { "4/4 · 120 BPM" }
          }
          div(.class("timeline-toolbar")) {
            button(.class("transport-button"), .type(.button), .title("Preview placeholder")) { "▶" }
            span { "1.1.1" }
            span { "·" }
            span { "8 bars" }
            div(.class("timeline-spacer")) {}
            span(.class("timeline-mode")) { "ARRANGEMENT" }
          }
          div(.id("timeline-content"), .class("timeline")) {
            div(.class("timeline-ruler")) {
              div(.class("timeline-track-label")) { "TRACKS" }
              div(.class("ruler-bars")) {
                span { "1" }
                span { "2" }
                span { "3" }
                span { "4" }
                span { "5" }
                span { "6" }
                span { "7" }
                span { "8" }
              }
            }
            div(.class("timeline-row")) {
              div(.class("track-label")) {
                span(.class("track-color")) {}
                div {
                  div(.class("track-name")) { "Drums" }
                  span(.class("track-type")) { "MIDI" }
                }
              }
              div(.class("track-lane")) {
                div(.class("clip"), .style("left: 1%; width: 35%;")) {
                  span { "Beat pattern" }
                  small { "8 bars" }
                }
              }
            }
            div(.class("timeline-row")) {
              div(.class("track-label")) {
                span(.class("track-color blue")) {}
                div {
                  div(.class("track-name")) { "Bass" }
                  span(.class("track-type")) { "MIDI" }
                }
              }
              div(.class("track-lane")) {
                div(.class("clip blue"), .style("left: 25%; width: 49%;")) {
                  span { "Low groove" }
                  small { "bars 3–6" }
                }
              }
            }
            div(.class("timeline-row")) {
              div(.class("track-label")) {
                span(.class("track-color purple")) {}
                div {
                  div(.class("track-name")) { "Harmony" }
                  span(.class("track-type")) { "MIDI" }
                }
              }
              div(.class("track-lane")) {
                div(.class("clip purple"), .style("left: 50%; width: 37%;")) {
                  span { "Chord sketch" }
                  small { "bars 5–7" }
                }
              }
            }
            div(.class("timeline-note")) { "Timeline clips will be populated after Swift parsing." }
          }
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
        import { EditorState } from "https://esm.sh/@codemirror/state@6.7.0";
        // Every CodeMirror package must resolve to the same state/view module
        // URLs. In particular, the Swift package imports view with state as a
        // dependency, so use that same dependency path here as well.
        import {
          EditorView,
          keymap,
          lineNumbers,
          highlightActiveLine,
          highlightActiveLineGutter,
          drawSelection,
          dropCursor,
          highlightSpecialChars,
        } from "https://esm.sh/@codemirror/view@6.43.11?deps=@codemirror/state@6.7.0";
        import { defaultKeymap, history, historyKeymap } from "https://esm.sh/@codemirror/commands@6.10.3?deps=@codemirror/language@6.12.4,@codemirror/state@6.7.0,@codemirror/view@6.43.11,@lezer/highlight@1.2.3";
        import { HighlightStyle, syntaxHighlighting } from "https://esm.sh/@codemirror/language@6.12.4?deps=@codemirror/state@6.7.0,@codemirror/view@6.43.11,@lezer/highlight@1.2.3";
        import { autocompletion } from "https://esm.sh/@codemirror/autocomplete@6.18.7?deps=@codemirror/language@6.12.4,@codemirror/state@6.7.0,@codemirror/view@6.43.11,@lezer/highlight@1.2.3";
        // Keep the language package on the same CodeMirror module instances as
        // the editor. Without this, esm.sh may resolve its broad peer ranges to
        // newer copies, and CodeMirror rejects extensions from the other copy.
        import { swift } from "https://esm.sh/@fazelstudio/codemirror-lang-swift@0.2.1?deps=@codemirror/language@6.12.4,@codemirror/state@6.7.0,@codemirror/view@6.43.11,@lezer/highlight@1.2.3";
        import { tags as t } from "https://esm.sh/@lezer/highlight@1.2.3";

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
                // Only strings are valid CodeMirror documents. Older saved
                // workspaces can contain stale/non-string values, which would
                // otherwise produce an invalid Text tree on the first click.
                const files = Object.fromEntries(
                  Object.entries(parsed.files).filter(([, content]) => typeof content === "string")
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
            // ignore corrupt storage, fall through to defaults
          }
          return {
            files: { [DEFAULT_FILE]: DEFAULT_CONTENT },
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
            ".cm-content": { caretColor: "#ff855f", fontFamily: "var(--mono)", padding: "12px 0" },
            ".cm-cursor": { borderLeft: "2px solid #ff855f" },
            ".cm-dropCursor": { borderLeft: "2px solid #ff855f" },
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

        // ---------- App wiring ----------

        let workspace = loadWorkspace();
        let view = null;

        const tabBarEl = document.getElementById("tab-bar");
        const hostEl = document.getElementById("cm-host");
        const problemsToggleEl = document.getElementById("problems-toggle");
        const problemsPanelEl = document.getElementById("problems-panel");
        const problemsStatusEl = document.getElementById("problems-status");
        const outputToggleEl = document.getElementById("output-toggle");
        const outputPanelEl = document.getElementById("output-panel");

        function editorState(filename) {
          return EditorState.create({
            doc: workspace.files[filename] ?? "",
            extensions: [
              // Keep the setup extensions on the same view instance as the
              // editor. The aggregate `basicSetup` package can pull a second
              // copy of CodeMirror through esm.sh's peer dependency resolver.
              history(),
              lineNumbers(),
              highlightSpecialChars(),
              drawSelection(),
              dropCursor(),
              highlightActiveLine(),
              highlightActiveLineGutter(),
              keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
                {
                  key: "Tab",
                  run: (target) => {
                    target.dispatch(target.state.replaceSelection("  "));
                    return true;
                  },
                },
              ]),
              swift(),
              autocompletion({ override: [swiftCompletionSource] }),
              syntaxHighlighting(studioHighlight),
              studioTheme,
              EditorView.updateListener.of(({ docChanged, state }) => {
                if (docChanged) {
                  workspace.files[filename] = state.doc.toString();
                  saveWorkspace(workspace);
                  // Diagnostics belong to the last compiled snapshot. Clear
                  // them as soon as that snapshot is edited, like an IDE's
                  // Problems view while the next validation is pending.
                  setProblems([], { close: true });
                }
              }),
            ],
          });
        }

        function destroyEditor() {
          if (!view) return;

          // Clear the browser's native selection before destroying the view.
          // Safari can deliver a queued selectionchange after the DOM view has
          // been removed; that stale event is what reaches CodeMirror's
          // lineInner/findPos code with an invalid text leaf.
          const currentView = view;
          currentView.contentDOM.blur();
          const selection = window.getSelection?.();
          if (selection?.anchorNode && hostEl?.contains(selection.anchorNode)) {
            selection.removeAllRanges();
          }
          currentView.destroy();
          view = null;
        }

        function showEditor(filename) {
          if (!hostEl || !filename) return;
          destroyEditor();
          hostEl.replaceChildren();
          const state = editorState(filename);
          view = new EditorView({ state, parent: hostEl });
        }

        function syncEditorDocument() {
          if (!view || !workspace.active) return;
          try {
            workspace.files[workspace.active] = view.state.doc.toString();
            saveWorkspace(workspace);
          } catch {
            // Keep Run usable even if the browser reports a transient selection
            // or view-tree error while the document is being measured.
          }
        }

        function switchTo(filename) {
          if (!(filename in workspace.files)) return;
          syncEditorDocument();
          workspace.active = filename;
          saveWorkspace(workspace);
          showEditor(filename);
          renderTabBar();
        }

        function createFile(filename) {
          let name = filename.trim();
          if (name && !name.toLowerCase().endsWith(".swift")) name += ".swift";
          if (!name || name in workspace.files) return;
          syncEditorDocument();
          workspace.files[name] = "";
          workspace.active = name;
          saveWorkspace(workspace);
          showEditor(name);
          renderTabBar();
        }

        function showNewFileInput() {
          if (!tabBarEl || tabBarEl.querySelector(".new-tab")) return;
          const row = document.createElement("div");
          row.className = "new-tab";
          const input = document.createElement("input");
          input.type = "text";
          input.placeholder = "NewFile.swift";
          row.appendChild(input);
          const addButton = tabBarEl.querySelector(".tab-add");
          tabBarEl.insertBefore(row, addButton);
          input.focus();

          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              createFile(input.value);
            } else if (e.key === "Escape") {
              renderTabBar();
            }
          });
          input.addEventListener("blur", () => renderTabBar());
        }

        function renderTabBar() {
          if (!tabBarEl) return;
          tabBarEl.innerHTML = "";

          for (const name of Object.keys(workspace.files)) {
            const tab = document.createElement("button");
            tab.type = "button";
            tab.className = "tab" + (name === workspace.active ? " active" : "");
            tab.setAttribute("aria-selected", name === workspace.active ? "true" : "false");
            tab.addEventListener("click", () => switchTo(name));

            const label = document.createElement("span");
            label.textContent = name;
            tab.appendChild(label);

            tabBarEl.appendChild(tab);
          }

          const add = document.createElement("button");
          add.type = "button";
          add.className = "tab tab-add";
          add.textContent = "+";
          add.title = "New Swift file";
          add.addEventListener("click", showNewFileInput);
          tabBarEl.appendChild(add);
        }

        showEditor(workspace.active);
        renderTabBar();

        // ---------- In-browser Swift compilation ----------

        const runBtn = document.querySelector(".tb-btn.run");
        const runLabelEl = document.getElementById("run-label");
        const statusEl = document.getElementById("status-text");

        let worker = null;
        let nextRequestId = 0;
        let running = false;
        let toolchainReady = false;
        let problems = [];
        let problemsOpen = false;
        let outputLines = [];
        let outputOpen = false;

        function getWorker() {
          if (!worker) {
            worker = new Worker("/js/swift-compiler-worker.js", { type: "module" });
          }
          return worker;
        }

        // ---------- Code completion (swift-ide-test) ----------

        // Asks the worker to run swift-ide-test's code-completion pass at a
        // UTF-16 offset into the active file, returning a flat item list.
        function fetchCompletions(pos) {
          return new Promise((resolve, reject) => {
            const id = ++nextRequestId;
            const w = getWorker();
            const doc = workspace.files[workspace.active] ?? "";
            const byteOffset = new TextEncoder().encode(doc.slice(0, pos)).length;

            const onMessage = (event) => {
              const data = event.data;
              if (data.id !== id || data.type !== "completion-result") return;
              w.removeEventListener("message", onMessage);
              if (data.ok) resolve(data.items);
              else reject(new Error(data.error || "code completion failed"));
            };
            w.addEventListener("message", onMessage);
            w.postMessage({
              id,
              type: "complete",
              files: { ...workspace.files },
              primaryFile: workspace.active,
              offset: byteOffset,
            });
          });
        }

        // CodeMirror @codemirror/autocomplete completion source. Triggers on
        // identifier prefixes and explicit invocation (e.g. Ctrl+Space); "."
        // member-access completion is left for later since it needs a richer
        // signal than a plain word match.
        async function swiftCompletionSource(context) {
          const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
          if (!word && !context.explicit) return null;
          if (word && word.from === word.to && !context.explicit) return null;
          if (!workspace.active) return null;

          let items;
          try {
            items = await fetchCompletions(context.pos);
          } catch {
            return null;
          }
          if (!items.length) return null;

          return {
            from: word ? word.from : context.pos,
            options: items.map((item) => ({
              label: item.label,
              detail: item.detail,
              type: item.kind,
            })),
            validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
          };
        }

        function setStatus(text) {
          if (statusEl) statusEl.textContent = text;
        }

        function setRunLabel(text) {
          if (runLabelEl) runLabelEl.textContent = text;
        }

        function problemFromLine(line) {
          const text = String(line).trim();
          if (!text) return null;

          const match = text.match(/^(.*?):(\\d+):(\\d+):\\s*(error|warning):\\s*(.*)$/i);
          if (match) {
            return {
              severity: match[4].toLowerCase(),
              file: match[1],
              line: Number(match[2]),
              column: Number(match[3]),
              message: match[5],
            };
          }

          const bareMatch = text.match(/^(error|warning):\\s*(.*)$/i);
          if (bareMatch) {
            return {
              severity: bareMatch[1].toLowerCase(),
              file: "Swift",
              line: null,
              column: null,
              message: bareMatch[2],
            };
          }

          if (text.startsWith("[trap]")) {
            return { severity: "error", file: "runtime", line: null, column: null, message: text.slice(6).trim() };
          }

          return null;
        }

        function problemsFromResult(data) {
          const lines = [...(data.diagnostics ?? []), ...(data.stderr ?? [])]
            .flatMap((line) => String(line).split("\\n"));
          const seen = new Set();
          const parsed = [];
          for (const line of lines) {
            const problem = problemFromLine(line);
            if (!problem) continue;
            const key = `${problem.severity}:${problem.file}:${problem.line}:${problem.column}:${problem.message}`;
            if (!seen.has(key)) {
              seen.add(key);
              parsed.push(problem);
            }
          }
          if (!parsed.length && !data.ok) {
            parsed.push({
              severity: "error",
              file: "Swift",
              line: null,
              column: null,
              message: `Compilation failed at ${data.stage ?? "an unknown stage"}.`,
            });
          }
          return parsed;
        }

        function jumpToProblem(problem) {
          if (!view || !problem.line) return;
          const filename = Object.keys(workspace.files).find((name) => problem.file?.endsWith(name));
          if (filename && filename !== workspace.active) switchTo(filename);
          if (!view) return;

          const lineNumber = Math.min(Math.max(problem.line, 1), view.state.doc.lines);
          const line = view.state.doc.line(lineNumber);
          const position = Math.min(line.from + Math.max((problem.column ?? 1) - 1, 0), line.to);
          view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
          view.focus();
        }

        function renderProblems() {
          if (!problemsToggleEl || !problemsPanelEl) return;
          const errorCount = problems.filter((problem) => problem.severity === "error").length;
          const warningCount = problems.filter((problem) => problem.severity === "warning").length;
          problemsToggleEl.className = "problems-toggle";
          if (errorCount) problemsToggleEl.classList.add("has-errors");
          else if (warningCount) problemsToggleEl.classList.add("has-warnings");
          problemsToggleEl.setAttribute("aria-expanded", problemsOpen ? "true" : "false");
          problemsToggleEl.innerHTML = `
            <span class="problems-icon">${errorCount ? "!" : warningCount ? "!" : "✓"}</span>
            <span>Problems</span>
            <span class="problems-count">${problems.length}</span>
          `;
          if (problemsStatusEl) {
            problemsStatusEl.textContent = problems.length
              ? `${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${warningCount === 1 ? "" : "s"}`
              : "No issues";
          }

          problemsPanelEl.classList.toggle("is-hidden", !problemsOpen);
          problemsPanelEl.innerHTML = "";
          if (!problems.length) {
            const empty = document.createElement("div");
            empty.className = "problems-empty";
            empty.textContent = "No Swift problems detected.";
            problemsPanelEl.appendChild(empty);
            return;
          }

          for (const problem of problems) {
            const item = document.createElement("button");
            item.type = "button";
            item.className = `problem-item ${problem.severity}`;
            item.addEventListener("click", () => jumpToProblem(problem));

            const severity = document.createElement("span");
            severity.className = "problem-severity";
            item.appendChild(severity);

            const location = document.createElement("span");
            location.className = "problem-location";
            location.textContent = problem.line ? `${problem.file}:${problem.line}:${problem.column}` : problem.file;
            item.appendChild(location);

            const message = document.createElement("span");
            message.className = "problem-message";
            message.textContent = problem.message;
            item.appendChild(message);

            problemsPanelEl.appendChild(item);
          }
        }

        function outputFromResult(data) {
          const lines = [];
          const appendLines = (values, kind) => {
            for (const value of values ?? []) {
              for (const text of String(value).split("\\n")) lines.push({ text, kind });
            }
          };

          appendLines(data.stdout, "stdout");
          appendLines(data.stderr, "stderr");
          if (!lines.length) {
            lines.push({
              text: data.ok ? "Program produced no output." : `Run failed at ${data.stage ?? "an unknown stage"}.`,
              kind: "status",
            });
          }
          return lines;
        }

        function renderOutput() {
          if (!outputToggleEl || !outputPanelEl) return;
          outputToggleEl.className = "output-toggle";
          if (outputLines.length) outputToggleEl.classList.add("has-output");
          outputToggleEl.setAttribute("aria-expanded", outputOpen ? "true" : "false");
          outputToggleEl.innerHTML = `
            <span class="output-icon">${outputLines.length ? "•" : "›"}</span>
            <span>Output</span>
            <span class="output-count">${outputLines.length}</span>
          `;

          outputPanelEl.classList.toggle("is-hidden", !outputOpen);
          outputPanelEl.innerHTML = "";
          if (!outputLines.length) {
            const empty = document.createElement("div");
            empty.className = "output-empty";
            empty.textContent = "Run the active Swift file to see its output.";
            outputPanelEl.appendChild(empty);
            return;
          }

          for (const line of outputLines) {
            const item = document.createElement("div");
            item.className = `output-line ${line.kind ?? "stdout"}`;
            item.textContent = line.text;
            outputPanelEl.appendChild(item);
          }
        }

        function setOutput(nextLines, options = {}) {
          outputLines = Array.isArray(nextLines) ? nextLines : [];
          if (options.reveal && outputLines.length) outputOpen = true;
          if (options.close) outputOpen = false;
          renderOutput();
        }

        function setProblems(nextProblems, options = {}) {
          problems = Array.isArray(nextProblems) ? nextProblems : [];
          if (options.reveal && problems.length) problemsOpen = true;
          if (options.close) problemsOpen = false;
          renderProblems();
        }

        problemsToggleEl?.addEventListener("click", () => {
          problemsOpen = !problemsOpen;
          if (problemsOpen) outputOpen = false;
          renderProblems();
          renderOutput();
        });
        renderProblems();
        renderOutput();

        outputToggleEl?.addEventListener("click", () => {
          outputOpen = !outputOpen;
          if (outputOpen) problemsOpen = false;
          renderProblems();
          renderOutput();
        });

        function formatMB(bytes) {
          return (bytes / (1024 * 1024)).toFixed(1);
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
                setProblems([
                  {
                    severity: "error",
                    file: "Toolchain",
                    line: null,
                    column: null,
                    message: `Failed to download Swift toolchain: ${data.error}`,
                  },
                ], { reveal: true });
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
            setProblems(
              [{ severity: "error", file: "Swift", line: null, column: null, message: "No Swift file is active." }],
              { reveal: true }
            );
            return;
          }

          // Read from the live CodeMirror document at the point of execution,
          // rather than relying solely on the asynchronous update listener.
          syncEditorDocument();
          running = true;
          setProblems([], { close: true });
          setOutput([], { close: true });
          if (runBtn) runBtn.disabled = true;
          setStatus("Compiling…");

          const id = ++nextRequestId;
          const w = getWorker();

          const onMessage = (event) => {
            const data = event.data;
            if (data.id !== id) return;

            if (data.type === "progress") {
              setStatus(data.message);
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

            const nextProblems = problemsFromResult(data);
            setProblems(nextProblems, nextProblems.length ? { reveal: true } : { close: true });
            setOutput(outputFromResult(data));

            if (data.ok) {
              setStatus("Ready");
            } else {
              setStatus(`Failed (${data.stage ?? "unknown"})`);
            }
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
