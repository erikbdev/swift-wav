<script setup lang="ts" vapor>
withDefaults(
  defineProps<{
    status?: string;
    error?: string | null;
    progress?: number;
  }>(),
  {
    status: "Downloading Swift toolchain…",
    error: null,
    progress: 0,
  },
);

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <aside class="runtime-panel" aria-live="polite">
    <div class="panel-summary">
      <span>COMPILER</span>
      <span class="panel-meta">{{ error ? "OFFLINE" : "LOADING" }}</span>
    </div>

    <div class="runtime-content">
      <div class="runtime-message">
        <span class="runtime-marker" :class="{ error }" aria-hidden="true">
          <span v-if="error">!</span>
          <span v-else class="runtime-spinner"></span>
        </span>

        <div class="runtime-copy">
          <div class="track-name">{{ error ? "Toolchain unavailable" : "Preparing compiler" }}</div>
          <div class="track-type">SWIFT TOOLCHAIN</div>
          <p>{{ error ? "The compiler could not be loaded." : status }}</p>

          <div
            v-if="!error"
            class="runtime-progress"
            role="progressbar"
            aria-label="Loading Swift toolchain"
            :aria-valuenow="Math.round(progress * 100)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span :style="{ width: `${Math.max(progress * 100, 3)}%` }"></span>
          </div>
          <p v-else class="runtime-error-detail">{{ error }}</p>

          <button v-if="error" type="button" class="runtime-retry" @click="emit('retry')">Try again</button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.runtime-panel {
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
.runtime-content {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px 18px 42px;
  background: var(--bg-2);
}
.runtime-message {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: min(100%, 360px);
  padding: 16px 12px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border-faint);
}
.runtime-marker {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  flex: 0 0 auto;
  border: 1px solid var(--accent-line);
  border-radius: 50%;
  background: var(--accent-dim);
  color: var(--accent-hi);
  font: 700 10px var(--mono);
}
.runtime-marker.error {
  border-color: rgba(240, 86, 74, 0.45);
  background: rgba(240, 86, 74, 0.12);
  color: var(--red);
}
.runtime-spinner {
  width: 9px;
  height: 9px;
  border: 1px solid var(--border-strong);
  border-top-color: var(--accent-hi);
  border-radius: 50%;
  animation: runtime-spin 0.8s linear infinite;
}
.runtime-copy {
  min-width: 0;
  flex: 1;
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
.runtime-copy p {
  margin: 8px 0 0;
  color: var(--text-1);
  font-size: 11px;
  line-height: 1.45;
}
.runtime-progress {
  height: 3px;
  margin-top: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-4);
}
.runtime-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.2s ease;
}
.runtime-error-detail {
  overflow: hidden;
  color: var(--text-2) !important;
  font: 9px/1.5 var(--mono) !important;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.runtime-retry {
  height: 26px;
  margin-top: 12px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-3);
  color: var(--text-1);
  font: 10px var(--mono);
  cursor: pointer;
}
.runtime-retry:hover {
  border-color: var(--accent-line);
  color: var(--accent-hi);
}
@keyframes runtime-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 800px) {
  .runtime-panel {
    flex: 1 1 42%;
    min-height: 300px;
    border-top: 1px solid var(--border);
    border-left: 0;
  }
}
</style>
