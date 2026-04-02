<template>
  <div
    ref="containerEl"
    class="visualizer-preview"
  >
    <canvas
      ref="canvasEl"
      class="visualizer-preview__canvas"
    />
    <div
      v-if="!isInitialized"
      class="visualizer-preview__overlay"
    >
      <p>Initializing visualizer…</p>
    </div>
    <div
      v-if="!isSupported"
      class="visualizer-preview__overlay visualizer-preview__overlay--error"
    >
      <p>WebGL2 is required but not supported in this browser.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useButterchurn } from '../composables/useButterchurn.js'

const props = defineProps({
  audioContext: {
    type: Object,
    default: null,
  },
  audioNode: {
    type: Object,
    default: null,
  },
  preset: {
    type: Object,
    default: null,
  },
  transitionDuration: {
    type: Number,
    default: 1.5,
  },
  isPlaying: {
    type: Boolean,
    default: false,
  },
  exportWidth: {
    type: Number,
    default: 1920,
  },
  exportHeight: {
    type: Number,
    default: 1080,
  },
  fps: {
    type: Number,
    default: 60,
  },
})

const containerEl = ref(null)
const canvasEl = ref(null)

const {
  isSupported,
  isInitialized,
  init,
  connectAudio,
  disconnectAudio,
  loadPreset,
  setSize,
  setTargetFps,
  startRenderLoop,
  stopRenderLoop,
  getAnalyserNode,
  launchSongTitleAnim,
  dispose,
} = useButterchurn()

// Expose analyser access and title anim to parent
defineExpose({
  getAnalyserNode,
  launchTitleAnim: launchSongTitleAnim,
})

onMounted(() => {
  if (!props.audioContext || !canvasEl.value) return
  setupVisualizer()
})

onUnmounted(() => {
  stopRenderLoop()
  dispose()
})

watch(() => props.audioContext, (ctx) => {
  if (ctx && canvasEl.value) setupVisualizer()
})

watch(() => props.audioNode, (newNode, oldNode) => {
  if (oldNode) disconnectAudio(oldNode)
  if (newNode) connectAudio(newNode)
})

watch(() => props.preset, (preset) => {
  if (preset) loadPreset(preset, props.transitionDuration)
})

watch(() => props.isPlaying, (playing) => {
  if (playing) {
    startRenderLoop()
  } else {
    stopRenderLoop()
  }
})

watch(() => props.fps, (fps) => {
  setTargetFps(fps)
}, { immediate: true })

// Re-size canvas when export dimensions change
watch([() => props.exportWidth, () => props.exportHeight], () => {
  if (lastContainerW > 0 && lastContainerH > 0) applyCanvasSize(lastContainerW, lastContainerH)
})

function setupVisualizer() {
  // Init with a default size — the ResizeObserver fires immediately after
  // observeResize() and calls setSize() with the true container dimensions.
  init(canvasEl.value, props.audioContext)
  if (props.audioNode) connectAudio(props.audioNode)
  if (props.preset) loadPreset(props.preset, props.transitionDuration)
  startRenderLoop()
  observeResize()
}

let resizeObserver = null
let lastContainerW = 0
let lastContainerH = 0

function applyCanvasSize(containerW, containerH) {
  const r = props.exportWidth / props.exportHeight
  let cw, ch
  if (containerW / containerH > r) {
    ch = containerH
    cw = containerH * r
  } else {
    cw = containerW
    ch = containerW / r
  }
  cw = Math.round(cw)
  ch = Math.round(ch)
  canvasEl.value.style.width = cw + 'px'
  canvasEl.value.style.height = ch + 'px'
  setSize(cw, ch)
}

function observeResize() {
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    const { width, height } = entry.contentRect
    if (width > 0 && height > 0) {
      lastContainerW = width
      lastContainerH = height
      applyCanvasSize(width, height)
    }
  })
  resizeObserver.observe(containerEl.value)
}
</script>

<style scoped>
.visualizer-preview {
  position: relative;
  width: 100%;
  height: 100%;
  background: #111;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.visualizer-preview__canvas {
  display: block;
  flex-shrink: 0;
}

.visualizer-preview__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  font-size: 0.9rem;
  pointer-events: none;
}

.visualizer-preview__overlay--error {
  color: #e05c5c;
}
</style>
