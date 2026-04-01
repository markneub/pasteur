<template>
  <div class="export-controls">
    <!-- Output Size -->
    <div class="control-group">
      <label class="control-label">Output size</label>
      <div class="button-row">
        <button
          v-for="preset in SIZE_PRESETS"
          :key="preset.label"
          class="toggle-btn"
          :class="{ 'toggle-btn--active': activeSizePreset === preset.label }"
          @click="selectSizePreset(preset)"
        >
          {{ preset.label }}
        </button>
        <button
          class="toggle-btn"
          :class="{ 'toggle-btn--active': activeSizePreset === 'Custom' }"
          @click="selectCustomSize"
        >
          Custom
        </button>
      </div>
      <div
        v-if="activeSizePreset === 'Custom'"
        class="custom-size"
      >
        <input
          class="custom-size__input"
          type="number"
          min="1"
          max="7680"
          placeholder="Width"
          :value="modelValue.width"
          @change="onCustomWidth"
        >
        <span class="custom-size__sep">×</span>
        <input
          class="custom-size__input"
          type="number"
          min="1"
          max="4320"
          placeholder="Height"
          :value="modelValue.height"
          @change="onCustomHeight"
        >
        <span class="custom-size__unit">px</span>
      </div>
    </div>

    <!-- FPS -->
    <div class="control-group">
      <label class="control-label">Frame rate</label>
      <div class="button-row">
        <button
          v-for="fps in FPS_OPTIONS"
          :key="fps"
          class="toggle-btn"
          :class="{ 'toggle-btn--active': modelValue.fps === fps }"
          @click="emit('update:modelValue', { ...modelValue, fps })"
        >
          {{ fps }}
        </button>
      </div>
    </div>

    <!-- Format -->
    <div class="control-group">
      <label class="control-label">Format</label>
      <div class="button-row">
        <button
          v-for="fmt in FORMAT_OPTIONS"
          :key="fmt.value"
          class="toggle-btn"
          :class="{ 'toggle-btn--active': modelValue.format === fmt.value }"
          :disabled="!formatSupport[fmt.value]"
          :title="formatSupport[fmt.value] ? undefined : `${fmt.label} encoding is not supported in this browser`"
          @click="formatSupport[fmt.value] && emit('update:modelValue', { ...modelValue, format: fmt.value })"
        >
          {{ fmt.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const SIZE_PRESETS = [
  { label: '4K',    width: 3840, height: 2160 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '720p',  width: 1280, height: 720  },
  { label: '480p',  width: 854,  height: 480  },
]

const FPS_OPTIONS = [120, 60, 30, 15, 12, 10]

const FORMAT_OPTIONS = [
  { label: 'MP4',  value: 'mp4'  },
  { label: 'WebM', value: 'webm' },
]

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
    // shape: { width: Number, height: Number, fps: Number, format: String }
  },
  canExportMp4: { type: Boolean, default: true },
  canExportWebM: { type: Boolean, default: true },
})

const formatSupport = computed(() => ({
  mp4: props.canExportMp4,
  webm: props.canExportWebM,
}))

const emit = defineEmits(['update:modelValue'])

const activeSizePreset = computed(() => {
  const match = SIZE_PRESETS.find(
    p => p.width === props.modelValue.width && p.height === props.modelValue.height
  )
  return match ? match.label : 'Custom'
})

function selectSizePreset(preset) {
  emit('update:modelValue', { ...props.modelValue, width: preset.width, height: preset.height })
}

function selectCustomSize() {
  // Switch to custom mode; keep current dimensions so the inputs are pre-filled
  emit('update:modelValue', { ...props.modelValue })
}

function onCustomWidth(event) {
  const width = Math.max(1, parseInt(event.target.value) || 1)
  emit('update:modelValue', { ...props.modelValue, width })
}

function onCustomHeight(event) {
  const height = Math.max(1, parseInt(event.target.value) || 1)
  emit('update:modelValue', { ...props.modelValue, height })
}
</script>

<style scoped>
.export-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #888;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.toggle-btn {
  background: transparent;
  border: 1px solid #333;
  color: #aaa;
  padding: 5px 12px;
  border-radius: 5px;
  font-size: 0.82rem;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.toggle-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.toggle-btn:hover {
  border-color: #666;
  color: #ddd;
}

.toggle-btn--active {
  border-color: #7c6af7;
  color: #7c6af7;
  background: rgba(124, 106, 247, 0.1);
}

.custom-size {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.custom-size__input {
  width: 90px;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ddd;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 0.85rem;
  font-family: inherit;
}

.custom-size__input:focus {
  outline: none;
  border-color: #7c6af7;
}

.custom-size__sep {
  color: #555;
}

.custom-size__unit {
  color: #555;
  font-size: 0.8rem;
}
</style>
