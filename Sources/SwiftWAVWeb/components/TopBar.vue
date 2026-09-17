<script setup vapor>
defineProps({
	runLabel: { type: String, default: "Run" },
	disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["run"]);

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
