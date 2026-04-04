<template>
  <div class="flex flex-col gap-5">
    <!-- Output size -->
    <div class="flex flex-col gap-2">
      <Label class="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
        Output size
      </Label>

      <Select :model-value="selectedOption" @update:model-value="onSizeOptionChange">
        <SelectTrigger class="h-8 text-sm">
          <SelectValue placeholder="Select size…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="preset in SIZE_PRESETS"
            :key="preset.label"
            :value="preset.label"
          >
            {{ preset.label }} ({{ preset.width }}×{{ preset.height }})
          </SelectItem>
          <SelectItem value="Custom">
            Custom
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Custom size inputs -->
      <div v-if="selectedOption === 'Custom'" class="flex items-center gap-2">
        <input
          class="w-20 rounded-md border border-input bg-input px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          type="number"
          min="1"
          max="7680"
          placeholder="Width"
          aria-label="Custom width in pixels"
          :value="customWidth"
          @change="onCustomWidth"
          @blur="onCustomWidthBlur"
        >
        <span class="text-sm text-muted-foreground">×</span>
        <input
          class="w-20 rounded-md border border-input bg-input px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          type="number"
          min="1"
          max="4320"
          placeholder="Height"
          aria-label="Custom height in pixels"
          :value="customHeight"
          @change="onCustomHeight"
          @blur="onCustomHeightBlur"
        >
        <span class="text-sm text-muted-foreground">px</span>
      </div>

      <!-- Warning for very large custom sizes -->
      <p
        v-if="selectedOption === 'Custom' && (customWidth > 3840 || customHeight > 2160)"
        class="text-xs text-yellow-500"
      >
        Large resolutions may fail on some devices.
      </p>
    </div>

    <!-- Frame rate -->
    <div class="flex flex-col gap-2">
      <Label class="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
        Frame rate
      </Label>
      <Select
        :model-value="String(modelValue.fps)"
        @update:model-value="onFpsChange"
      >
        <SelectTrigger class="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="fps in FPS_OPTIONS"
            :key="fps"
            :value="String(fps)"
          >
            {{ fps }} fps
          </SelectItem>
        </SelectContent>
      </Select>
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
        <span
          v-for="fmt in FORMAT_OPTIONS"
          :key="fmt.value"
          :title="!formatSupport[fmt.value] ? `${fmt.label} encoding is not supported in this browser` : undefined"
        >
          <ToggleGroupItem
            :value="fmt.value"
            variant="outline"
            size="sm"
            :disabled="!formatSupport[fmt.value]"
            :aria-label="formatSupport[fmt.value] ? fmt.label : `${fmt.label} (not supported in this browser)`"
          >
            {{ fmt.label }}
          </ToggleGroupItem>
        </span>
      </ToggleGroup>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'

const SIZE_PRESETS = [
  { label: '4K',        width: 3840, height: 2160 },
  { label: '1080p',     width: 1920, height: 1080 },
  { label: '720p',      width: 1280, height: 720  },
  { label: '480p',      width: 854,  height: 480  },
  { label: 'Instagram', width: 1080, height: 1920 },
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

function matchesPreset(w, h) {
  return SIZE_PRESETS.find(p => p.width === w && p.height === h) ?? null
}

const initialPreset = matchesPreset(props.modelValue.width, props.modelValue.height)
const selectedOption = ref(initialPreset ? initialPreset.label : 'Custom')
const customWidth = ref(initialPreset ? 1024 : props.modelValue.width)
const customHeight = ref(initialPreset ? 768 : props.modelValue.height)

watch(() => props.modelValue, (val) => {
  const preset = matchesPreset(val.width, val.height)
  if (preset) {
    selectedOption.value = preset.label
  } else {
    selectedOption.value = 'Custom'
    customWidth.value = val.width
    customHeight.value = val.height
  }
})

function onSizeOptionChange(val) {
  if (!val) return
  selectedOption.value = val
  if (val === 'Custom') {
    emit('update:modelValue', { ...props.modelValue, width: customWidth.value, height: customHeight.value })
    return
  }
  const preset = SIZE_PRESETS.find(p => p.label === val)
  if (preset) emit('update:modelValue', { ...props.modelValue, width: preset.width, height: preset.height })
}

function onFpsChange(val) {
  if (!val) return
  emit('update:modelValue', { ...props.modelValue, fps: Number(val) })
}

function onFormatChange(val) {
  if (!val || !formatSupport.value[val]) return
  emit('update:modelValue', { ...props.modelValue, format: val })
}

function toEven(n) {
  return n % 2 === 0 ? n : n + 1
}

function onCustomWidth(event) {
  const width = Math.max(1, Math.min(7680, parseInt(event.target.value) || 1))
  customWidth.value = width
  emit('update:modelValue', { ...props.modelValue, width })
}

function onCustomHeight(event) {
  const height = Math.max(1, Math.min(4320, parseInt(event.target.value) || 1))
  customHeight.value = height
  emit('update:modelValue', { ...props.modelValue, height })
}

function onCustomWidthBlur(event) {
  const width = toEven(Math.max(1, Math.min(7680, parseInt(event.target.value) || 1)))
  customWidth.value = width
  emit('update:modelValue', { ...props.modelValue, width })
}

function onCustomHeightBlur(event) {
  const height = toEven(Math.max(1, Math.min(4320, parseInt(event.target.value) || 1)))
  customHeight.value = height
  emit('update:modelValue', { ...props.modelValue, height })
}
</script>
