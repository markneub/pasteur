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
          <!-- VisualizerPreview will go here -->
          <div class="visualizer-placeholder">
            <p>{{ audioFile.name }}</p>
            <button
              class="btn-secondary"
              @click="clearFile"
            >
              Remove file
            </button>
          </div>
        </div>

        <aside class="controls-panel">
          <!-- PresetSelector, ExportControls, ExportButton will go here -->
          <p class="controls-placeholder">
            Controls coming soon
          </p>
        </aside>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DropZone from './components/DropZone.vue'

const audioFile = ref(null)

function onFileSelected(file) {
  audioFile.value = file
}

function clearFile() {
  audioFile.value = null
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
}

.visualizer-area {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 24px;
}

.visualizer-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #555;
}

.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.controls-placeholder {
  color: #555;
  font-size: 0.9rem;
}
</style>
