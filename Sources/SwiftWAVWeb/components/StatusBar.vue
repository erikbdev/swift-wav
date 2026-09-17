<script setup lang="ts" vapor>
withDefaults(
	defineProps<{
		status?: string;
	}>(),
	{
		status: "Ready",
	}
);
</script>

<template>
	<div class="statusbar">
		<span>swift-wav</span>
		<span class="status-spacer"></span>
		<span id="status-text">{{ status }}</span>
	</div>
</template>

<style scoped>
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
</style>
