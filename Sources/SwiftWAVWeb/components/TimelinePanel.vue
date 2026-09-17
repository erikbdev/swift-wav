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

			<div class="timeline-note">Timeline clips will be populated after Swift parsing.</div>
		</div>
	</aside>
</template>
