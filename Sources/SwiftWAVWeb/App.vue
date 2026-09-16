<script setup vapor>
import { onMounted } from 'vue';
import { mountMainPage } from './lib/main-page.js';

onMounted(() => {
	try {
		mountMainPage();
	} catch (error) {
		console.error('Failed to initialize the SwiftWAV editor', error);
		const status = document.getElementById('status-text');
		if (status) status.textContent = 'Editor failed to load';
	}
});
</script>

<template>
	<div class="app">
		<header class="topbar">
			<span class="brand">swift-wav</span>
			<div class="tb-spacer"></div>
			<button id="run-button" class="tb-btn run" type="button">
				<span class="tb-ico">▶</span>
				<span id="run-label">Run</span>
			</button>
		</header>

		<div class="body">
			<div class="editor-container">
				<div id="tab-bar" class="tabbar"></div>
				<div id="cm-host" class="cm-host"></div>

				<div class="problems-bar">
					<button
						id="problems-toggle"
						class="problems-toggle"
						type="button"
						aria-expanded="false"
					>
						<span class="problems-icon">✓</span>
						<span>Problems</span>
						<span class="problems-count">0</span>
					</button>
					<button
						id="output-toggle"
						class="output-toggle"
						type="button"
						aria-expanded="false"
					>
						<span class="output-icon">›</span>
						<span>Output</span>
						<span class="output-count">0</span>
					</button>
					<span id="problems-status" class="problems-status">No issues</span>
				</div>

				<div id="problems-panel" class="problems-panel is-hidden"></div>
				<div id="output-panel" class="output-panel is-hidden"></div>
			</div>

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
					>▶</button>
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
							<div class="clip" style="left: 1%; width: 35%;">
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
							<div class="clip blue" style="left: 25%; width: 49%;">
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
							<div class="clip purple" style="left: 50%; width: 37%;">
								<span>Chord sketch</span>
								<small>bars 5–7</small>
							</div>
						</div>
					</div>

					<div class="timeline-note">
						Timeline clips will be populated after Swift parsing.
					</div>
				</div>
			</aside>
		</div>

		<div class="statusbar">
			<span>swift-wav</span>
			<span class="status-spacer"></span>
			<span id="status-text">Ready</span>
		</div>
	</div>
</template>
