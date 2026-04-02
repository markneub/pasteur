<template>
  <div class="flex flex-col gap-1.5">
    <Label
      for="preset-select"
      class="text-[0.7rem] uppercase tracking-widest text-muted-foreground"
    >
      Preset
    </Label>
    <div class="flex gap-2">
      <Select
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
      >
        <SelectTrigger
          id="preset-select"
          class="h-9 flex-1 text-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent class="max-h-72">
          <SelectItem
            v-for="name in presetNames"
            :key="name"
            :value="name"
          >
            {{ name }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        title="Random preset"
        aria-label="Pick random preset"
        @click="pickRandom"
      >
        <Shuffle class="size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup>
import { Shuffle } from 'lucide-vue-next'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { presetNames } from '../utils/presets.js'

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

function pickRandom() {
  const current = props.modelValue
  let name
  do {
    name = presetNames[Math.floor(Math.random() * presetNames.length)]
  } while (name === current && presetNames.length > 1)
  emit('update:modelValue', name)
}
</script>
