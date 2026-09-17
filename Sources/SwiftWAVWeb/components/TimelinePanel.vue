<template>
  <aside id="preview-pane" class="preview">
    <div class="panel-summary">
      <span>TIMELINE</span>
      <span class="panel-meta">4/4 · 120 BPM</span>
    </div>

    <div class="timeline-toolbar">
      <button
        class="transport-button"
        type="button"
        title="Preview placeholder"
        aria-label="Preview"
      >
        ▶
      </button>
      <span>1.1.1</span>
      <span>·</span>
      <span>8 bars</span>
      <div class="timeline-spacer"></div>
      <span class="timeline-mode">ARRANGEMENT</span>
    </div>

    <div id="timeline-content" class="timeline">
      <div class="timeline-ruler">
        <div class="timeline-track-label">TRACKS</div>
        <div class="ruler-bars">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
          <span>6</span>
          <span>7</span>
          <span>8</span>
        </div>
      </div>

      <div class="timeline-row">
        <div class="track-label">
          <span class="track-color"></span>
          <div>
            <div class="track-name">Drums</div>
            <span class="track-type">MIDI</span>
          </div>
        </div>
        <div class="track-lane">
          <div class="clip" style="left: 1%; width: 35%">
            <span>Beat pattern</span>
            <small>8 bars</small>
          </div>
        </div>
      </div>

      <div class="timeline-row">
        <div class="track-label">
          <span class="track-color blue"></span>
          <div>
            <div class="track-name">Bass</div>
            <span class="track-type">MIDI</span>
          </div>
        </div>
        <div class="track-lane">
          <div class="clip blue" style="left: 25%; width: 49%">
            <span>Low groove</span>
            <small>bars 3–6</small>
          </div>
        </div>
      </div>

      <div class="timeline-row">
        <div class="track-label">
          <span class="track-color purple"></span>
          <div>
            <div class="track-name">Harmony</div>
            <span class="track-type">MIDI</span>
          </div>
        </div>
        <div class="track-lane">
          <div class="clip purple" style="left: 50%; width: 37%">
            <span>Chord sketch</span>
            <small>bars 5–7</small>
          </div>
        </div>
      </div>

      <div class="timeline-note">Timeline clips will be populated after Swift parsing.</div>
    </div>
  </aside>
</template>

<style scoped>
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
.transport-button:hover {
  color: var(--accent-hi);
  border-color: var(--accent-line);
}
.timeline-spacer {
  flex: 1;
}
.timeline-mode {
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-3);
  font-size: 9px;
  letter-spacing: 0.06em;
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
  background: rgba(27, 26, 24, 0.96);
}
.timeline-track-label {
  display: flex;
  align-items: center;
  padding-left: 12px;
  color: var(--text-3);
  font: 9px var(--mono);
  letter-spacing: 0.08em;
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
  background: rgba(22, 21, 20, 0.42);
}
.track-color {
  width: 4px;
  height: 32px;
  border-radius: 4px;
  background: var(--accent);
}
.track-color.blue {
  background: var(--blue);
}
.track-color.purple {
  background: var(--purple);
}
.track-name {
  color: var(--text-0);
  font-size: 11px;
}
.track-type {
  display: block;
  margin-top: 3px;
  color: var(--text-3);
  font: 9px var(--mono);
  letter-spacing: 0.05em;
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
    rgba(255, 244, 230, 0.025) calc(3.125% - 1px),
    rgba(255, 244, 230, 0.025) 3.125%
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
  background: rgba(255, 107, 69, 0.22);
  color: var(--text-0);
  font-size: 10.5px;
}
.clip small {
  color: rgba(255, 244, 230, 0.58);
  font: 9px var(--mono);
}
.clip.blue {
  border-color: var(--blue);
  background: rgba(74, 163, 232, 0.19);
}
.clip.purple {
  border-color: var(--purple);
  background: rgba(168, 132, 240, 0.18);
}
.timeline-note {
  padding: 16px 12px;
  color: var(--text-3);
  font: 10px var(--mono);
  text-align: center;
}

@media (max-width: 800px) {
  .preview {
    flex: 1 1 42%;
    min-height: 300px;
    border-top: 1px solid var(--border);
    border-left: 0;
  }
}
</style>
