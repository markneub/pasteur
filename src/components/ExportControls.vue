<template>
  <div class="flex flex-col gap-5">
    <!-- Output size -->
    <div class="flex flex-col gap-2">
      <Label class="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
        Output size
      </Label>
      <ToggleGroup
        type="single"
        class="flex-wrap justify-start gap-1.5"
        :model-value="activeSizePreset"
        @update:model-value="onSizeChange"
      >
        <ToggleGroupItem
          v-for="preset in SIZE_PRESETS"
          :key="preset.label"
          :value="preset.label"
          variant="outline"
          size="sm"
          :aria-label="`${preset.label} (${preset.width}×${preset.height})`"
        >
          {{ preset.label }}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="Custom"
          variant="outline"
          size="sm"
          aria-label="Custom resolution"
        >
          Custom
        </ToggleGroupItem>
      </ToggleGroup>
      <div
        v-if="activeSizePreset === 'Custom'"
        class="flex items-center gap-2"
      >
        <input
          class="w-20 rounded-md border border-input bg-input px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          type="number"
          min="1"
          max="7680"
          placeholder="Width"
          aria-label="Custom width in pixels"
          :value="modelValue.width"
          @change="onCustomWidth"
        >
        <span class="text-sm text-muted-foreground">×</span>
        <input
          class="w-20 rounded-md border border-input bg-input px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          type="number"
          min="1"
          max="4320"
          placeholder="Height"
          aria-label="Custom height in pixels"
          :value="modelValue.height"
          @change="onCustomHeight"
        >
        <span class="text-sm text-muted-foreground">px</span>
      </div>
    </div>

    <!-- Frame rate -->
    <div class="flex flex-col gap-2">
      <Label class="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
        Frame rate
      </Label>
      <ToggleGroup
        type="single"
        class="flex-wrap justify-start gap-1.5"
        :model-value="String(modelValue.fps)"
        @update:model-value="onFpsChange"
      >
        <ToggleGroupItem
          v-for="fps in FPS_OPTIONS"
          :key="fps"
          :value="String(fps)"
          variant="outline"
          size="sm"
          :aria-label="`${fps} frames per second`"
        >
          {{ fps }}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <!-- Format -->
    <div class="flex flex-col gap-2">
      <Label class="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
        Format
      </Label>
      <ToggleGroup
        type="single"
        class="flex-wrap justify-start gap-1.5"
        :model-value="modelValue.format"
        @update:model-value="onFormatChange"
      >
        <ToggleGroupItem
          v-for="fmt in FORMAT_OPTIONS"
          :key="fmt.value"
          :value="fmt.value"
          variant="outline"
          size="sm"
          :disabled="!formatSupport[fmt.value]"
          :aria-label="formatSupport[fmt.value] ? fmt.label : `${fmt.label} (not supported in this browser)`"
          :title="formatSupport[fmt.value] ? undefined : `${fmt.label} encoding is not supported in this browser`"
        >
          {{ fmt.label }}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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

function onSizeChange(val) {
  if (!val) return
  if (val === 'Custom') {
    emit('update:modelValue', { ...props.modelValue })
  } else {
    const preset = SIZE_PRESETS.find(p => p.label === val)
    if (preset) emit('update:modelValue', { ...props.modelValue, width: preset.width, height: preset.height })
  }
}

function onFpsChange(val) {
  if (!val) return
  emit('update:modelValue', { ...props.modelValue, fps: Number(val) })
}

function onFormatChange(val) {
  if (!val || !formatSupport.value[val]) return
  emit('update:modelValue', { ...props.modelValue, format: val })
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
