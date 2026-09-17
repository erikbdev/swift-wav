<script setup vapor>
defineProps({
	status: { type: String, default: "Ready" },
});
</script>

<template>
	<div class="statusbar">
		<span>swift-wav</span>
		<span class="status-spacer"></span>
		<span id="status-text">{{ status }}</span>
	</div>
</template>
