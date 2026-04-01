<template>
  <div class="export-button">
    <!-- Estimated file size (idle only) -->
    <p
      v-if="!isExporting && audioDuration > 0"
      class="est-size"
    >
      Est. {{ estimatedSizeMb }} MB
    </p>

    <!-- Error banner -->
    <p
      v-if="exportError"
      class="export-error"
    >
      {{ exportError }}
    </p>

    <!-- Progress area -->
    <template v-if="isExporting">
      <div class="progress-label">
        <span>{{ phaseLabel }}</span>
        <span class="progress-pct">{{ progressPct }}%</span>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        :aria-valuenow="progressPct"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="progress-fill"
          :style="{ width: progressPct + '%' }"
        />
      </div>
    </template>

    <!-- Buttons -->
    <div class="button-row">
      <button
        v-if="!isExporting"
        class="btn-export"
        :disabled="!canExport"
        @click="emit('export')"
      >
        Export {{ formatLabel }}
      </button>

      <button
        v-if="isExporting"
        class="btn-cancel"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isExporting: { type: Boolean, default: false },
  exportPhase: { type: String, default: null }, // 'analyzing' | 'rendering' | null
  analysisProgress: { type: Number, default: 0 }, // 0–1
  renderProgress: { type: Number, default: 0 },   // 0–1
  exportError: { type: String, default: null },
  exportSettings: { type: Object, required: true },
  // shape: { width, height, fps, format }
  audioDuration: { type: Number, default: 0 }, // seconds
  canExport: { type: Boolean, default: false },
})

const emit = defineEmits(['export', 'cancel'])

const formatLabel = computed(() =>
  props.exportSettings.format === 'webm' ? 'WebM' : 'MP4'
)

// Rough estimate: 8 Mbps video + 192 kbps audio
const VIDEO_BITRATE = 8_000_000
const AUDIO_BITRATE = 192_000

const estimatedSizeMb = computed(() => {
  const totalBits = (VIDEO_BITRATE + AUDIO_BITRATE) * props.audioDuration
  return (totalBits / 8 / 1_000_000).toFixed(1)
})

const phaseLabel = computed(() => {
  if (props.exportPhase === 'analyzing') return 'Analyzing audio…'
  if (props.exportPhase === 'rendering') return 'Rendering…'
  return ''
})

const progressPct = computed(() => {
  const raw =
    props.exportPhase === 'analyzing'
      ? props.analysisProgress
      : props.renderProgress
  return Math.round(raw * 100)
})
</script>

<style scoped>
.export-button {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.est-size {
  font-size: 0.78rem;
  color: #555;
}

.export-error {
  font-size: 0.82rem;
  color: #e05c5c;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: #888;
}

.progress-pct {
  font-variant-numeric: tabular-nums;
}

.progress-track {
  height: 4px;
  background: #222;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #7c6af7;
  border-radius: 2px;
  transition: width 0.15s ease;
}

.button-row {
  display: flex;
  gap: 8px;
}

.btn-export {
  background: #7c6af7;
  border: none;
  color: #fff;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 0.88rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-export:hover:not(:disabled) {
  background: #9585f9;
}

.btn-export:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #555;
  color: #aaa;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.88rem;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.btn-cancel:hover {
  border-color: #e05c5c;
  color: #e05c5c;
}
</style>
