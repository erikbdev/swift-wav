<script setup lang="ts" vapor>
withDefaults(
	defineProps<{
		runLabel?: string;
		disabled?: boolean;
	}>(),
	{
		runLabel: "Run",
		disabled: false,
	}
);

const emit = defineEmits<{
	run: [];
}>();

function handleRun() {
	emit("run");
}
</script>

<template>
	<header class="topbar">
		<span class="brand">swift-wav</span>
		<div class="tb-spacer"></div>
		<button
			id="run-button"
			class="tb-btn run"
			type="button"
			:disabled="disabled"
			@click="handleRun"
		>
			<span class="tb-ico">▶</span>
			<span id="run-label">{{ runLabel }}</span>
		</button>
	</header>
</template>

<style scoped>
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
</style>
