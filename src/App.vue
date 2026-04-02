<template>
  <div id="app">
    <header class="app-header">
      <h1 class="app-title">
        Pasteur
      </h1>
      <p class="app-subtitle">
        Milkdrop visualization exporter
      </p>
    </header>

    <div
      v-if="!isWebCodecsSupported"
      class="compat-banner"
      role="alert"
    >
      Your browser does not support the WebCodecs API required for export.
      Please use a recent version of Chrome or Edge.
    </div>

    <main class="app-main">
      <div class="content-layout">
        <!-- Left column: preview + timeline -->
        <div class="preview-column">
          <DropZone
            v-if="!audioFile"
            class="preview-drop-zone"
            @file-selected="onFileSelected"
          />

          <template v-else>
            <div class="visualizer-area">
              <!-- During export: show the currently rendered export frame -->
              <img
                v-if="isExporting && exportPreviewUrl"
                class="export-preview"
                :src="exportPreviewUrl"
                alt="Export preview"
              >
              <VisualizerPreview
                v-else-if="audioContext && gainNode"
                ref="visualizerPreviewRef"
                :audio-context="audioContext"
                :audio-node="gainNode"
                :preset="activePreset"
                :transition-duration="activeTransitionDuration"
              />
              <div
                v-else-if="isLoading"
                class="visualizer-placeholder"
              >
                <p class="status-text">
                  Decoding audio…
                </p>
              </div>
              <div
                v-else-if="loadError"
                class="visualizer-placeholder"
              >
                <p class="status-text status-text--error">
                  {{ loadError }}
                </p>
              </div>
            </div>

            <!-- Timeline — waveform scrubber, trim handles, cue markers -->
            <TimelineEditor
              v-if="audioBuffer && peaks"
              :peaks="peaks"
              :preset-timeline="presetTimeline"
              :clip-start="clipStart"
              :clip-end="effectiveClipEnd"
              :duration="audioBuffer.duration"
              :is-playing="isPlaying"
              :get-current-time="getCurrentTime"
              :playhead-time="playheadTime"
              @update:clip-start="clipStart = $event"
              @update:clip-end="clipEnd = $event"
              @update:preset-timeline="onTimelineUpdateTimeline"
              @seek="onTimelineSeek"
              @play="onTimelinePlay"
              @pause="stop()"
              @add-cue="onTimelineAddCue"
            />
          </template>
        </div>

        <!-- Right column: settings panel (always rendered) -->
        <aside
          class="controls-panel"
          :inert="!audioFile || undefined"
        >
          <div
            v-if="audioFile"
            class="file-info"
          >
            <span class="file-name">{{ audioFile.name }}</span>
            <span
              v-if="audioBuffer"
              class="file-duration"
            >{{ audioBuffer.duration.toFixed(1) }}s</span>
            <Button
              variant="outline"
              size="sm"
              :disabled="isExporting"
              aria-label="Remove audio file"
              @click="clearFile"
            >
              Remove
            </Button>
          </div>
          <p
            v-else
            class="no-file-hint"
          >
            Load an audio file to get started
          </p>

          <Separator />

          <ExportControls
            v-model="exportSettings"
            :disabled="isExporting"
            :can-export-mp4="canExportMp4"
            :can-export-web-m="canExportWebM"
          />

          <Separator />

          <ExportButton
            :is-exporting="isExporting"
            :export-phase="exportPhase"
            :analysis-progress="analysisProgress"
            :render-progress="renderProgress"
            :export-error="exportError"
            :export-settings="exportSettings"
            :audio-duration="audioBuffer?.duration ?? 0"
            :can-export="!!audioBuffer && !isLoading && isSelectedFormatSupported"
            @export="onExport"
            @cancel="cancelExport"
          />
        </aside>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import DropZone from './components/DropZone.vue'
import VisualizerPreview from './components/VisualizerPreview.vue'
import TimelineEditor from './components/TimelineEditor.vue'
import ExportControls from './components/ExportControls.vue'
import ExportButton from './components/ExportButton.vue'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAudio } from './composables/useAudio.js'
import { useExporter } from './composables/useExporter.js'
import { useBrowserSupport } from './composables/useBrowserSupport.js'
import { useWaveform } from './composables/useWaveform.js'
import { getPreset, createPresetCue, DEFAULT_PRESET_NAME } from './utils/presets.js'

const audioFile = ref(null)
const visualizerPreviewRef = ref(null)

// --- Preset timeline ---
const presetTimeline = ref([createPresetCue(DEFAULT_PRESET_NAME, 0, 0)])

// --- Playhead-driven active preset ---
const liveActiveCueIndex = ref(0)
let playbackRafId = null

function getActiveCueIndexAtTime(t) {
  let idx = 0
  for (let i = 1; i < presetTimeline.value.length; i++) {
    if (presetTimeline.value[i].startTime <= t) idx = i
  }
  return idx
}

// activePreset drives the VisualizerPreview — based on current playhead position
const activePreset = computed(() => {
  const cue = presetTimeline.value[liveActiveCueIndex.value] ?? presetTimeline.value[0]
  return getPreset(cue?.presetName ?? DEFAULT_PRESET_NAME)
})

// When stopped or at cue[0], use 0 transition (instant switch); during playback use cue's value
const activeTransitionDuration = computed(() => {
  if (!isPlaying.value || liveActiveCueIndex.value === 0) return 0
  return presetTimeline.value[liveActiveCueIndex.value]?.transitionDuration ?? 1.5
})

// --- Clip trim state ---
const clipStart = ref(0)
const clipEnd = ref(null) // null = audioBuffer.duration
const effectiveClipEnd = computed(() => clipEnd.value ?? audioBuffer.value?.duration ?? 0)

// Sync cue[0].startTime to clipStart; also remove any cues that fall behind new clipStart
watch(clipStart, (newStart) => {
  presetTimeline.value = presetTimeline.value
    .filter((c, i) => i === 0 || c.startTime > newStart)
    .map((c, i) => i === 0 ? { ...c, startTime: newStart } : c)
})

// --- Waveform peaks ---
const { peaks, computePeaks } = useWaveform()

// --- Export settings ---
const exportSettings = ref({
  width: 1920,
  height: 1080,
  fps: 30,
  format: 'mp4',
})

const {
  audioContext,
  audioBuffer,
  gainNode,
  isPlaying,
  isLoading,
  loadError,
  loadFile,
  play,
  stop,
  playheadTime,
  getCurrentTime,
  dispose,
} = useAudio()

// During playback: rAF loop polls getCurrentTime() to track active cue
watch(isPlaying, (playing) => {
  if (playing) {
    function tick() {
      liveActiveCueIndex.value = getActiveCueIndexAtTime(getCurrentTime())
      playbackRafId = requestAnimationFrame(tick)
    }
    tick()
  } else {
    if (playbackRafId) { cancelAnimationFrame(playbackRafId); playbackRafId = null }
  }
})

// When stopped/seeking: sync liveActiveCueIndex to playheadTime
watch(playheadTime, (t) => {
  if (!isPlaying.value) liveActiveCueIndex.value = getActiveCueIndexAtTime(t)
})

// Compute peaks and reset clip/cue state when a new audio file is loaded
watch(audioBuffer, (buf) => {
  if (buf) {
    computePeaks(buf)
    clipStart.value = 0
    clipEnd.value = null
    liveActiveCueIndex.value = 0
    presetTimeline.value = [createPresetCue(DEFAULT_PRESET_NAME, 0, 0)]
  } else {
    peaks.value = null
  }
})

const {
  startExport,
  cancel: cancelExport,
  isExporting,
  exportPhase,
  analysisProgress,
  renderProgress,
  exportError,
  exportPreviewUrl,
} = useExporter()

const {
  checkCodecSupport,
  isWebCodecsSupported,
  canExportMp4,
  canExportWebM,
} = useBrowserSupport()

onMounted(checkCodecSupport)

onUnmounted(() => {
  if (playbackRafId) { cancelAnimationFrame(playbackRafId); playbackRafId = null }
})

// Whether the currently selected export format is supported in this browser
const isSelectedFormatSupported = computed(() => {
  const fmt = exportSettings.value.format
  return fmt === 'mp4' ? canExportMp4.value : canExportWebM.value
})

// If the currently selected format becomes unsupported (e.g. MP4 on Firefox),
// auto-switch to the first available format.
watch([canExportMp4, canExportWebM], () => {
  const fmt = exportSettings.value.format
  if (fmt === 'mp4' && !canExportMp4.value && canExportWebM.value) {
    exportSettings.value = { ...exportSettings.value, format: 'webm' }
  } else if (fmt === 'webm' && !canExportWebM.value && canExportMp4.value) {
    exportSettings.value = { ...exportSettings.value, format: 'mp4' }
  }
})

async function onFileSelected(file) {
  audioFile.value = file
  await loadFile(file)
  play()
}

function clearFile() {
  if (playbackRafId) { cancelAnimationFrame(playbackRafId); playbackRafId = null }
  dispose()
  audioFile.value = null
  presetTimeline.value = [createPresetCue(DEFAULT_PRESET_NAME, 0, 0)]
  clipStart.value = 0
  clipEnd.value = null
  liveActiveCueIndex.value = 0
}

// ── Timeline event handlers ────────────────────────────────────────────────

// Play with clip loop bounds so audio loops between the trim handles
function onTimelinePlay() {
  const offset = Math.max(playheadTime.value, clipStart.value)
  play(offset, clipStart.value, effectiveClipEnd.value)
}

// Seek while preserving loop-aware playback if audio was playing
async function onTimelineSeek(seconds) {
  const wasPlaying = isPlaying.value
  stop()
  playheadTime.value = seconds
  if (wasPlaying) await play(seconds, clipStart.value, effectiveClipEnd.value)
}

function onTimelineAddCue(seconds) {
  if (seconds <= clipStart.value) return
  const newCue = createPresetCue(DEFAULT_PRESET_NAME, seconds, 1.5)
  const updated = [...presetTimeline.value, newCue].sort((a, b) => a.startTime - b.startTime)
  presetTimeline.value = updated
}

function onTimelineUpdateTimeline(newTimeline) {
  presetTimeline.value = newTimeline
}

async function onExport() {
  if (!audioBuffer.value || !audioContext.value) return
  stop() // Stop audio playback before starting export
  await startExport({
    audioBuffer: audioBuffer.value,
    audioContext: audioContext.value,
    presetTimeline: presetTimeline.value,
    exportSettings: exportSettings.value,
    clipStart: clipStart.value,
    clipEnd: effectiveClipEnd.value,
  })
  // After export finishes (success, error, or cancel): park playhead at clip start
  playheadTime.value = clipStart.value
}

</script>

<style>
body {
  background: #0a0a0a;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100vh;
}
</style>

<style scoped>
#app {
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  padding: 24px 32px 16px;
  border-bottom: 1px solid #1e1e1e;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #fff;
}

.app-subtitle {
  font-size: 0.8rem;
  color: #666;
  margin-top: 2px;
}

.compat-banner {
  background: #2a1a1a;
  border-bottom: 1px solid #5c2a2a;
  color: #e05c5c;
  font-size: 0.85rem;
  padding: 10px 32px;
}

.app-main {
  flex: 1;
  padding: 32px;
}

.content-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.preview-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.preview-drop-zone {
  aspect-ratio: 16 / 9;
  min-height: 160px;
}

.visualizer-area {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.visualizer-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.controls-panel[inert] {
  opacity: 0.4;
}

.file-info {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.file-name {
  font-size: 0.95rem;
  color: #ddd;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-duration {
  font-size: 0.8rem;
  color: #666;
  flex-shrink: 0;
}

.no-file-hint {
  font-size: 0.82rem;
  color: #555;
  font-style: italic;
}

.status-text {
  font-size: 0.85rem;
  color: #888;
}

.status-text--error {
  color: #e05c5c;
}

/* Wide screens: two-column layout */
@media (min-width: 900px) {
  .content-layout {
    flex-direction: row;
    align-items: flex-start;
    gap: 32px;
  }

  .preview-column {
    flex: 1;
  }

  .controls-panel {
    width: 268px;
    flex-shrink: 0;
    position: sticky;
    top: 24px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
  }
}
</style>
