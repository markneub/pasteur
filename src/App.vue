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

    <main class="app-main">
      <DropZone
        v-if="!audioFile"
        @file-selected="onFileSelected"
      />

      <template v-else>
        <div class="visualizer-area">
          <VisualizerPreview
            v-if="audioContext && gainNode"
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

        <aside class="controls-panel">
          <div class="file-info">
            <span class="file-name">{{ audioFile.name }}</span>
            <span
              v-if="audioBuffer"
              class="file-duration"
            >{{ audioBuffer.duration.toFixed(1) }}s</span>
          </div>

          <div class="playback-controls">
            <button
              v-if="audioBuffer && !isLoading"
              class="btn-secondary"
              @click="isPlaying ? stop() : play()"
            >
              {{ isPlaying ? 'Pause' : 'Play' }}
            </button>
            <button
              class="btn-secondary"
              @click="clearFile"
            >
              Remove file
            </button>
          </div>

          <PresetSelector v-model="activePresetName" />

          <ExportControls v-model="exportSettings" />

          <!-- ExportButton will go here -->
        </aside>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import DropZone from './components/DropZone.vue'
import VisualizerPreview from './components/VisualizerPreview.vue'
import PresetSelector from './components/PresetSelector.vue'
import ExportControls from './components/ExportControls.vue'
import { useAudio } from './composables/useAudio.js'
import { getPreset, createPresetCue, DEFAULT_PRESET_NAME } from './utils/presets.js'

const audioFile = ref(null)
const visualizerPreviewRef = ref(null)

// --- Preset timeline (v1: single cue; architecture supports multiple) ---
const presetTimeline = ref([createPresetCue(DEFAULT_PRESET_NAME)])

const activePresetName = computed({
  get: () => presetTimeline.value[0].presetName,
  set: (name) => { presetTimeline.value[0].presetName = name },
})

const activePreset = computed(() => getPreset(activePresetName.value))

const activeTransitionDuration = computed(() => presetTimeline.value[0].transitionDuration)

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
  dispose,
} = useAudio()

async function onFileSelected(file) {
  audioFile.value = file
  await loadFile(file)
  play()
}

function clearFile() {
  dispose()
  audioFile.value = null
  presetTimeline.value = [createPresetCue(DEFAULT_PRESET_NAME)]
}
</script>

<style>
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #0a0a0a;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100vh;
}

button {
  cursor: pointer;
  font-family: inherit;
}

.btn-secondary {
  background: transparent;
  border: 1px solid #444;
  color: #ccc;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.85rem;
  transition: border-color 0.2s, color 0.2s;
}

.btn-secondary:hover {
  border-color: #7c6af7;
  color: #7c6af7;
}
</style>

<style scoped>
#app {
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

.app-main {
  flex: 1;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
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

.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.playback-controls {
  display: flex;
  gap: 8px;
}


.status-text {
  font-size: 0.85rem;
  color: #888;
}

.status-text--error {
  color: #e05c5c;
}
</style>
