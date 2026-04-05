<template>
  <div class="timeline-editor">
    <!-- Control bar -->
    <div class="timeline-controls">
      <button
        class="ctrl-btn ctrl-btn--fixed"
        aria-label="Restart from clip start"
        @click="emit('seek', props.clipStart); emit('play')"
      >
        ↺&#xFE0E;
      </button>
      <button
        v-if="!isPlaying"
        class="ctrl-btn ctrl-btn--fixed"
        aria-label="Play audio"
        @click="emit('play')"
      >
        ▶&#xFE0E;
      </button>
      <button
        v-else
        class="ctrl-btn ctrl-btn--fixed"
        aria-label="Pause audio"
        @click="emit('pause')"
      >
        ⏸&#xFE0E;
      </button>

      <span
        ref="clipDisplayEl"
        class="time-display"
      />
      <span
        ref="timeDisplayEl"
        class="clip-display"
      />

      <div class="zoom-controls">
        <button
          class="ctrl-btn ctrl-btn--sm"
          aria-label="Add cue at current time"
          @click="onAddCue"
        >
          <span class="add-cue-label--full">Add Preset Cue</span><span class="add-cue-label--short">+ Cue</span>
        </button>
        <div class="zoom-divider" />
        <button
          class="ctrl-btn ctrl-btn--sm"
          aria-label="Zoom out"
          :disabled="zoomLevel <= 1"
          @click="zoomOut"
        >
          –
        </button>
        <span class="zoom-label">{{ zoomLevel > 1 ? zoomLevel + '×' : 'Zoom' }}</span>
        <button
          class="ctrl-btn ctrl-btn--sm"
          aria-label="Zoom in"
          :disabled="zoomLevel >= 32"
          @click="zoomIn"
        >
          +
        </button>
      </div>
    </div>

    <!-- Waveform canvas -->
    <div
      ref="containerEl"
      class="timeline-canvas-wrapper"
    >
      <canvas
        ref="canvasEl"
        class="timeline-canvas"
        :height="CANVAS_H + FLAG_H"
        :style="{ cursor: canvasCursor }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onPointerLeave"
        @wheel.passive="onWheel"
      />

      <!-- Popover anchor overlay — pointer-events: none so canvas still receives events -->
      <div class="cue-popover-overlay">
        <template
          v-for="(cue, i) in presetTimeline"
          :key="i"
        >
          <Popover
            :open="openCueIndex === i"
            @update:open="(val) => { if (!val) openCueIndex = null }"
          >
            <PopoverAnchor
              class="cue-anchor"
              :style="{ left: cueXPercent(cue) + '%' }"
            />
            <PopoverContent
              side="bottom"
              :side-offset="12"
              :collision-padding="12"
              class="w-[388px] max-w-[calc(100vw-2rem)]"
            >
              <div class="cue-pop-header">
                <span
                  class="cue-pop-dot"
                  :style="{ background: cueColor(i) }"
                />
                <span class="cue-pop-title">{{ i === 0 ? 'Initial Preset' : `Cue ${i}` }}</span>
                <span class="cue-pop-time">{{ formatTime(cue.startTime) }}</span>
              </div>

              <PresetSelector
                :model-value="cue.presetName"
                @update:model-value="onCuePresetChange(i, $event)"
              />

              <div
                v-if="i > 0"
                class="cue-pop-field"
              >
                <Label class="cue-pop-label">Transition</Label>
                <div class="cue-pop-input-row">
                  <input
                    type="number"
                    :value="cue.transitionDuration"
                    min="0"
                    max="30"
                    step="0.1"
                    class="cue-duration-input"
                    @change="onCueTransitionChange(i, $event.target.value)"
                  >
                  <span class="cue-pop-unit">s</span>
                </div>
              </div>

              <div class="flex justify-center gap-2 mt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  class="max-w-[125px] w-[125px]"
                  :disabled="i === 0"
                  @click="onDeleteCue(i)"
                >
                  Delete Cue
                </Button>
                <PopoverClose as-child>
                  <Button
                    variant="default"
                    size="sm"
                    class="max-w-[125px] w-[125px]"
                  >
                    Save Cue
                  </Button>
                </PopoverClose>
              </div>
            </PopoverContent>
          </Popover>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import PresetSelector from './PresetSelector.vue'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { PopoverClose } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createPresetCue, DEFAULT_PRESET_NAME } from '../utils/presets.js'

// ── Constants ──────────────────────────────────────────────────────────────

const CANVAS_H = 88
const FLAG_H = 18        // height of flag tab zone below waveform
const TRIM_HIT_PX = 8   // pixels of tolerance for trim handle hit detection
const CUE_HIT_PX = 8    // pixels of tolerance for cue marker hit detection
const CUE_COLORS = ['#7c6af7', '#f7a06a', '#6af7a0', '#f76a6a', '#6ab4f7', '#f7e06a']
const MIN_CLIP_GAP = 0.5 // minimum seconds between clipStart and clipEnd

function cueColor(index) {
  return CUE_COLORS[index % CUE_COLORS.length]
}

// ── Props & Emits ──────────────────────────────────────────────────────────

const props = defineProps({
  peaks: { type: Object, default: null },          // Float32Array | null
  presetTimeline: { type: Array, default: () => [] },
  clipStart: { type: Number, default: 0 },
  clipEnd: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  isPlaying: { type: Boolean, default: false },
  getCurrentTime: { type: Function, required: true },
  playheadTime: { type: Number, default: 0 },
})

const emit = defineEmits([
  'update:clipStart',
  'update:clipEnd',
  'update:presetTimeline',
  'seek',
  'play',
  'pause',
])

// ── Refs ───────────────────────────────────────────────────────────────────

const containerEl = ref(null)
const canvasEl = ref(null)

// Zoom & pan
const zoomLevel = ref(1)
const zoomPan   = ref(0)   // seconds at left edge of visible window

// Drag state
let isDraggingLeft = false
let isDraggingRight = false
let isDraggingCue = null   // number | null (index)
let isScrubbing = false

// Canvas cursor — changes to col-resize when near a trim handle
const canvasCursor = ref('crosshair')

// Popover state: which cue index has its popover open (null = none)
const openCueIndex = ref(null)

// Click vs drag detection for cue markers
let cueClickedIndex = null
let cueClickedX = 0
let currentPointerX = 0
let cueOpenAtPointerDown = null  // openCueIndex value captured at pointerdown time

// Displayed playhead time — plain variable, updated in draw() and written to DOM directly
// (NOT a Vue ref — keeping it reactive would re-render the component 60×/sec and reset
//  `:value` bindings on inputs while the user is typing in them)
let displayTime = 0

// DOM refs for time displays (updated directly to avoid re-renders)
const timeDisplayEl = ref(null)
const clipDisplayEl = ref(null)

// rAF handle
let animFrameId = null

// ── Zoom helpers ───────────────────────────────────────────────────────────

const visibleDuration = computed(() => {
  if (props.duration <= 0) return 1
  return props.duration / zoomLevel.value
})

const visibleStart = computed(() =>
  Math.max(0, Math.min(zoomPan.value, props.duration - visibleDuration.value))
)

function clampPan(pan) {
  return Math.max(0, Math.min(props.duration - visibleDuration.value, pan))
}

function zoomIn() {
  const newLevel = Math.min(32, zoomLevel.value * 2)
  const pivot = displayTime
  zoomLevel.value = newLevel
  // Re-center the visible window on the current playhead position
  const newVD = props.duration / newLevel
  zoomPan.value = clampPan(pivot - newVD / 2)
}

function zoomOut() {
  const newLevel = Math.max(1, zoomLevel.value / 2)
  zoomLevel.value = newLevel
  if (newLevel === 1) {
    zoomPan.value = 0
  } else {
    const newVD = props.duration / newLevel
    zoomPan.value = clampPan(displayTime - newVD / 2)
  }
}

// ── Coordinate helpers ─────────────────────────────────────────────────────

function timeToX(t) {
  if (!canvasEl.value || visibleDuration.value <= 0) return 0
  return ((t - visibleStart.value) / visibleDuration.value) * canvasEl.value.width
}

function xToTime(x) {
  if (!canvasEl.value || visibleDuration.value <= 0) return 0
  return Math.max(0, Math.min(
    props.duration,
    visibleStart.value + (x / canvasEl.value.width) * visibleDuration.value
  ))
}

// ── Time formatting ────────────────────────────────────────────────────────

function formatTime(s) {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}

function cueXPercent(cue) {
  if (visibleDuration.value <= 0) return 0
  return ((cue.startTime - visibleStart.value) / visibleDuration.value) * 100
}

// ── Canvas drawing ─────────────────────────────────────────────────────────

function draw() {
  const canvas = canvasEl.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const TOTAL_H = CANVAS_H + FLAG_H

  // Update display time from live clock or stopped position
  displayTime = props.isPlaying ? props.getCurrentTime() : props.playheadTime
  if (clipDisplayEl.value) {
    const clipPos = Math.max(0, displayTime - props.clipStart)
    const clipDur = props.clipEnd - props.clipStart
    clipDisplayEl.value.textContent = `Clip: ${formatTime(clipPos)} / ${formatTime(clipDur)}`
  }
  if (timeDisplayEl.value) {
    timeDisplayEl.value.textContent = `Original: ${formatTime(displayTime)} / ${formatTime(props.duration)}`
  }

  ctx.clearRect(0, 0, W, TOTAL_H)

  // 1. Waveform bars (waveform zone only)
  drawWaveform(ctx, W, CANVAS_H)

  // 2. Dim overlay for trimmed-out regions (full height)
  drawTrimOverlay(ctx, W, TOTAL_H)

  // 3. Cue markers (handles its own heights via constants)
  drawCueMarkers(ctx)

  // 4. Trim handles (drawn after cues so they sit on top, waveform zone only)
  drawTrimHandles(ctx, CANVAS_H)

  // 5. Playhead (waveform zone only)
  drawPlayhead(ctx, CANVAS_H)
}

function drawWaveform(ctx, W, H) {
  const peaks = props.peaks
  if (!peaks || peaks.length === 0 || props.duration <= 0) return

  const centerY = H / 2
  const maxBarH = H * 0.42  // slightly under half so bars don't clip the edges

  ctx.fillStyle = '#4a4a7a'

  for (let px = 0; px < W; px++) {
    // Map canvas pixel to a time, then to a peak index
    const t = visibleStart.value + (px / W) * visibleDuration.value
    const peakIdx = Math.floor((t / props.duration) * peaks.length)
    if (peakIdx < 0 || peakIdx >= peaks.length) continue
    const barH = Math.max(1, peaks[peakIdx] * maxBarH)
    ctx.fillRect(px, centerY - barH, 1, barH * 2)
  }
}

function drawTrimOverlay(ctx, W, H) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  const leftEdge = timeToX(props.clipStart)
  const rightEdge = timeToX(props.clipEnd)
  // Left dim region
  if (leftEdge > 0) ctx.fillRect(0, 0, leftEdge, H)
  // Right dim region
  if (rightEdge < W) ctx.fillRect(rightEdge, 0, W - rightEdge, H)
}

function drawCueMarkers(ctx) {
  const TOTAL_H = CANVAS_H + FLAG_H
  const FLAG_W  = 22  // flag tab width

  // Pass 1: translucent transition duration rectangles (drawn behind lines)
  props.presetTimeline.forEach((cue, i) => {
    if (i === 0 || cue.transitionDuration <= 0) return
    const x      = Math.round(timeToX(cue.startTime))
    const endX   = Math.round(timeToX(cue.startTime + cue.transitionDuration))
    const isOpen = i === openCueIndex.value
    ctx.fillStyle   = cueColor(i)
    ctx.globalAlpha = isOpen ? 0.28 : 0.15
    ctx.fillRect(x, 0, endX - x, CANVAS_H)
    ctx.globalAlpha = 1
  })

  // Pass 2: cue lines and flag tabs (drawn on top)
  props.presetTimeline.forEach((cue, i) => {
    const x      = Math.round(timeToX(cue.startTime))
    const color  = cueColor(i)
    const isOpen = i === openCueIndex.value
    const label  = i === 0 ? 'α' : String(i)

    // Vertical line — full height (extends into flag zone)
    ctx.strokeStyle = color
    ctx.lineWidth   = isOpen ? 2 : 1.5
    ctx.globalAlpha = isOpen ? 1 : 0.75
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, TOTAL_H)
    ctx.stroke()
    ctx.globalAlpha = 1

    // Flag tab (filled rectangle extending right from line bottom)
    ctx.fillStyle   = color
    ctx.globalAlpha = isOpen ? 1 : 0.75
    ctx.fillRect(x, CANVAS_H, FLAG_W, FLAG_H)
    ctx.globalAlpha = 1

    // Label text inside flag
    ctx.fillStyle    = '#fff'
    ctx.font         = 'bold 10px system-ui, sans-serif'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + FLAG_W / 2, CANVAS_H + FLAG_H / 2)
  })
}

function drawTrimHandles(ctx, H) {
  const leftX  = Math.round(timeToX(props.clipStart))
  const rightX = Math.round(timeToX(props.clipEnd))

  drawHandle(ctx, leftX, H)
  drawHandle(ctx, rightX, H)
}

function drawHandle(ctx, x, H) {
  const W = 6
  const color = '#d0d0d0'

  // Handle bar
  ctx.fillStyle = color
  ctx.fillRect(x - W / 2, 0, W, H)

  // Grip lines
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 1
  const cx = x
  const cy = H / 2
  for (let dy = -4; dy <= 4; dy += 4) {
    ctx.beginPath()
    ctx.moveTo(cx - 1.5, cy + dy)
    ctx.lineTo(cx + 1.5, cy + dy)
    ctx.stroke()
  }
}

function drawPlayhead(ctx, H) {
  const x = timeToX(displayTime)
  if (x < 0 || x > (canvasEl.value?.width ?? 0)) return
  ctx.strokeStyle = '#ff4444'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, H)
  ctx.stroke()
}

// ── rAF loop ───────────────────────────────────────────────────────────────

function loop() {
  draw()
  animFrameId = requestAnimationFrame(loop)
}

// ── Canvas resize ──────────────────────────────────────────────────────────

let resizeObserver = null

function setupResizeObserver() {
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry || !canvasEl.value) return
    const { width } = entry.contentRect
    if (width > 0) canvasEl.value.width = Math.round(width)
  })
  if (containerEl.value) resizeObserver.observe(containerEl.value)
}

// ── Pointer event handling ─────────────────────────────────────────────────

function getOffsetX(e) {
  return e.offsetX ?? (e.clientX - canvasEl.value.getBoundingClientRect().left)
}

function getOffsetY(e) {
  return e.offsetY ?? (e.clientY - canvasEl.value.getBoundingClientRect().top)
}

function isNearTrimHandle(x) {
  return (
    Math.abs(x - timeToX(props.clipStart)) <= TRIM_HIT_PX ||
    Math.abs(x - timeToX(props.clipEnd)) <= TRIM_HIT_PX
  )
}

function onPointerDown(e) {
  if (!canvasEl.value) return
  // Capture open state before Radix's DismissableLayer fires @update:open(false) on pointerdown
  cueOpenAtPointerDown = openCueIndex.value
  const x = getOffsetX(e)
  const y = getOffsetY(e)
  const leftX  = timeToX(props.clipStart)
  const rightX = timeToX(props.clipEnd)

  // 0. Flag tab zone (y >= CANVAS_H) — click always opens popover, no drag
  if (y >= CANVAS_H) {
    const FLAG_W = 22
    for (let i = props.presetTimeline.length - 1; i >= 0; i--) {
      const cueX = timeToX(props.presetTimeline[i].startTime)
      if (x >= cueX && x <= cueX + FLAG_W) {
        cueClickedIndex = i
        cueClickedX = x
        currentPointerX = x
        canvasEl.value.setPointerCapture(e.pointerId)
        return
      }
    }
    return // click in flag zone but not on a flag — do nothing
  }

  // 1. Left trim handle — also track cue[0] click so a short press opens its popover
  if (Math.abs(x - leftX) <= TRIM_HIT_PX) {
    isDraggingLeft = true
    canvasCursor.value = 'col-resize'
    canvasEl.value.setPointerCapture(e.pointerId)
    // Cue[0] is always at clipStart; record it so onPointerUp can open its popover on click
    cueClickedIndex = 0
    cueClickedX = x
    currentPointerX = x
    return
  }

  // 2. Right trim handle
  if (Math.abs(x - rightX) <= TRIM_HIT_PX) {
    isDraggingRight = true
    canvasCursor.value = 'col-resize'
    canvasEl.value.setPointerCapture(e.pointerId)
    return
  }

  // 3a. Cue lines (reverse order: later cues take priority when overlapping)
  for (let i = props.presetTimeline.length - 1; i >= 0; i--) {
    const cueX = timeToX(props.presetTimeline[i].startTime)
    if (Math.abs(x - cueX) <= CUE_HIT_PX) {
      cueClickedIndex = i
      cueClickedX = x
      currentPointerX = x
      if (i > 0) {
        isDraggingCue = i
      }
      canvasEl.value.setPointerCapture(e.pointerId)
      return
    }
  }

  // 3b. Transition duration rectangles (click-to-open popover, no drag)
  for (let i = props.presetTimeline.length - 1; i >= 0; i--) {
    const cue = props.presetTimeline[i]
    if (i === 0 || cue.transitionDuration <= 0) continue
    const cueX = timeToX(cue.startTime)
    const endX = timeToX(cue.startTime + cue.transitionDuration)
    if (x >= cueX && x <= endX) {
      cueClickedIndex = i
      cueClickedX = x
      currentPointerX = x
      canvasEl.value.setPointerCapture(e.pointerId)
      return
    }
  }

  // 4. Waveform scrubbing
  isScrubbing = true
  canvasEl.value.setPointerCapture(e.pointerId)
  emit('seek', xToTime(x))
}

function onPointerMove(e) {
  if (!canvasEl.value) return
  const x = getOffsetX(e)
  const y = getOffsetY(e)
  const t = xToTime(x)
  currentPointerX = x

  if (isDraggingLeft) {
    const newStart = Math.max(0, Math.min(t, props.clipEnd - MIN_CLIP_GAP))
    emit('update:clipStart', newStart)
    emit('seek', newStart) // Seek preview to new start immediately
    return
  }

  if (isDraggingRight) {
    const newEnd = Math.max(props.clipStart + MIN_CLIP_GAP, Math.min(t, props.duration))
    emit('update:clipEnd', newEnd)
    if (displayTime > newEnd) emit('seek', props.clipStart)
    return
  }

  if (isDraggingCue !== null) {
    const timeline = props.presetTimeline
    const prev = timeline[isDraggingCue - 1]
    const next = timeline[isDraggingCue + 1]
    const minT = Math.max(props.clipStart + 0.01, prev ? prev.startTime + 0.1 : props.clipStart + 0.01)
    const maxT = next ? next.startTime - 0.1 : props.duration
    const newTime = Math.max(minT, Math.min(t, maxT))
    const updated = timeline.map((c, i) =>
      i === isDraggingCue ? { ...c, startTime: newTime } : c
    )
    emit('update:presetTimeline', updated)
    return
  }

  if (isScrubbing) {
    emit('seek', t)
    return
  }

  // Hover — update cursor: trim handles > draggable cues > clickable cues > default
  if (isNearTrimHandle(x)) {
    canvasCursor.value = 'col-resize'
    return
  }

  // Flag tab zone — always pointer
  if (y >= CANVAS_H) {
    const FLAG_W = 22
    for (let i = 0; i < props.presetTimeline.length; i++) {
      const cueX = timeToX(props.presetTimeline[i].startTime)
      if (x >= cueX && x <= cueX + FLAG_W) {
        canvasCursor.value = 'pointer'
        return
      }
    }
    canvasCursor.value = 'default'
    return
  }

  // Cue lines: draggable (index > 0) → col-resize, cue[0] → pointer
  for (let i = props.presetTimeline.length - 1; i >= 0; i--) {
    const cueX = timeToX(props.presetTimeline[i].startTime)
    if (Math.abs(x - cueX) <= CUE_HIT_PX) {
      canvasCursor.value = i === 0 ? 'pointer' : 'col-resize'
      return
    }
  }

  // Transition duration rectangles — pointer
  for (let i = props.presetTimeline.length - 1; i >= 0; i--) {
    const cue = props.presetTimeline[i]
    if (i === 0 || cue.transitionDuration <= 0) continue
    const cueX = timeToX(cue.startTime)
    const endX = timeToX(cue.startTime + cue.transitionDuration)
    if (x >= cueX && x <= endX) {
      canvasCursor.value = 'pointer'
      return
    }
  }

  canvasCursor.value = 'crosshair'
}

function onPointerUp() {
  // Detect click (small movement) on a cue marker → toggle popover.
  // Use cueOpenAtPointerDown (not current openCueIndex) because Radix's
  // DismissableLayer may have already set openCueIndex to null on pointerdown.
  if (cueClickedIndex !== null) {
    if (Math.abs(currentPointerX - cueClickedX) < 4) {
      openCueIndex.value = cueOpenAtPointerDown === cueClickedIndex ? null : cueClickedIndex
    }
    cueClickedIndex = null
  }
  cueOpenAtPointerDown = null

  isDraggingLeft  = false
  isDraggingRight = false
  isDraggingCue   = null
  isScrubbing     = false
  canvasCursor.value = 'crosshair'
}

function onPointerLeave() {
  if (!isDraggingLeft && !isDraggingRight) {
    canvasCursor.value = 'crosshair'
  }
}

function onWheel(e) {
  // Zoom on scroll (no modifier key required — the canvas is the zoom target)
  if (e.deltaY === 0) return
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

// Close popover if the cue it referred to was removed
watch(() => props.presetTimeline, (tl) => {
  if (openCueIndex.value !== null && openCueIndex.value >= tl.length) {
    openCueIndex.value = null
  }
})

// ── Cue add / popover action handlers ─────────────────────────────────────

function onAddCue() {
  const seconds = displayTime
  if (seconds <= props.clipStart) return
  const newCue = createPresetCue(DEFAULT_PRESET_NAME, seconds, 1.5)
  const updated = [...props.presetTimeline, newCue].sort((a, b) => a.startTime - b.startTime)
  emit('update:presetTimeline', updated)
  openCueIndex.value = updated.indexOf(newCue)
}

// ── Cue popover action handlers ────────────────────────────────────────────

function onCuePresetChange(index, name) {
  emit('update:presetTimeline',
    props.presetTimeline.map((c, i) => i === index ? { ...c, presetName: name } : c)
  )
}

function onCueTransitionChange(index, val) {
  emit('update:presetTimeline',
    props.presetTimeline.map((c, i) =>
      i === index ? { ...c, transitionDuration: Math.max(0, parseFloat(val) || 0) } : c
    )
  )
}

function onDeleteCue(index) {
  if (index === 0) return
  openCueIndex.value = null
  emit('update:presetTimeline', props.presetTimeline.filter((_, i) => i !== index))
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(() => {
  if (containerEl.value && canvasEl.value) {
    canvasEl.value.width = containerEl.value.clientWidth || 300
  }
  setupResizeObserver()
  animFrameId = requestAnimationFrame(loop)
  // Open α cue popover immediately — component mounts only when audio is loaded
  openCueIndex.value = 0
})

onUnmounted(() => {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId)
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.timeline-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  user-select: none;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ctrl-btn {
  background: transparent;
  border: 1px solid #444;
  color: #ccc;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.ctrl-btn:hover:not(:disabled) {
  border-color: #7c6af7;
  color: #7c6af7;
}

.ctrl-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ctrl-btn--fixed {
  width: 2.25rem;
  text-align: center;
  padding-left: 0;
  padding-right: 0;
}

.ctrl-btn--sm {
  padding: 3px 8px;
  font-size: 0.75rem;
}

.ctrl-btn--danger:hover:not(:disabled) {
  border-color: #e05c5c;
  color: #e05c5c;
}

.time-display {
  font-size: 0.875rem;
  color: #888;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.clip-display {
  font-size: 0.75rem;
  color: #666;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.cue-label {
  font-size: 0.75rem;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.zoom-divider {
  width: 1px;
  height: 16px;
  background: #444;
  margin: 0 4px;
}

.zoom-label {
  font-size: 0.75rem;
  color: #666;
  min-width: 28px;
  text-align: center;
}

.timeline-canvas-wrapper {
  position: relative;
  width: 100%;
  background: #111;
  border-radius: 6px;
  overflow: visible;
}

.timeline-canvas {
  display: block;
  width: 100%;
  border-radius: 6px;
}

/* Popover overlay — sits over canvas but passes pointer events through */
.cue-popover-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Invisible anchor div at cue position — used purely for popover placement */
.cue-anchor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  pointer-events: none;
}

/* Popover content layout */
.cue-pop-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.cue-pop-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cue-pop-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #ddd;
}

.cue-pop-time {
  font-size: 0.75rem;
  color: #888;
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

.cue-pop-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}

.cue-pop-label {
  font-size: 0.75rem;
  color: #888;
}

.cue-pop-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cue-duration-input {
  width: 64px;
  background: transparent;
  border: 1px solid #444;
  color: #e0e0e0;
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 0.875rem;
  font-family: inherit;
  text-align: right;
}

.cue-duration-input:focus {
  outline: none;
  border-color: #7c6af7;
}

.cue-duration-input:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cue-pop-unit {
  font-size: 0.75rem;
  color: #888;
}

.add-cue-label--short { display: none; }

@media (max-width: 480px) {
  .add-cue-label--full { display: none; }
  .add-cue-label--short { display: inline; }
}
</style>
