<template>
  <div class="flex flex-col gap-2.5">
    <!-- Estimated file size (idle only) -->
    <p
      v-if="!isExporting && clipEnd > clipStart"
      class="text-xs text-muted-foreground"
    >
      Est. {{ estimatedSizeMb }} MB
    </p>

    <!-- Error banner -->
    <p
      v-if="exportError"
      class="text-sm text-destructive"
    >
      {{ exportError }}
    </p>

    <!-- Progress area -->
    <template v-if="isExporting">
      <div class="flex justify-between text-xs text-muted-foreground">
        <span>{{ phaseLabel }}</span>
        <span class="tabular-nums">{{ progressPct }}%</span>
      </div>
      <Progress
        :model-value="progressPct"
        class="h-1.5"
        role="progressbar"
        :aria-label="phaseLabel"
        :aria-valuenow="progressPct"
        aria-valuemin="0"
        aria-valuemax="100"
      />
    </template>

    <!-- Buttons -->
    <Button
      v-if="!isExporting"
      class="w-full"
      :disabled="!canExport"
      :aria-label="canExport ? `Export as ${formatLabel}` : `Export as ${formatLabel} (load an audio file first)`"
      @click="emit('export')"
    >
      Export {{ formatLabel }}
    </Button>

    <Button
      v-if="isExporting"
      variant="outline"
      class="w-full"
      aria-label="Cancel export"
      @click="emit('cancel')"
    >
      Cancel
    </Button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const props = defineProps({
  isExporting: { type: Boolean, default: false },
  exportPhase: { type: String, default: null }, // 'analyzing' | 'rendering' | null
  analysisProgress: { type: Number, default: 0 }, // 0–1
  renderProgress: { type: Number, default: 0 },   // 0–1
  exportError: { type: String, default: null },
  exportSettings: { type: Object, required: true },
  clipStart: { type: Number, default: 0 },
  clipEnd: { type: Number, default: 0 },
  canExport: { type: Boolean, default: false },
})

const emit = defineEmits(['export', 'cancel'])

const formatLabel = computed(() =>
  props.exportSettings.format === 'webm' ? 'WebM' : 'MP4'
)

// Fixed encoding bitrates used by useExporter (not scaled by resolution)
const VIDEO_BITRATE = 8_000_000  // 8 Mbps
const AUDIO_BITRATE = 192_000    // 192 kbps

const estimatedSizeMb = computed(() => {
  const clipDuration = props.clipEnd - props.clipStart
  if (clipDuration <= 0) return '0.0'
  const totalBits = (VIDEO_BITRATE + AUDIO_BITRATE) * clipDuration
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
