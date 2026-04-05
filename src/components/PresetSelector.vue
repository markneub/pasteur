<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <Label
        class="text-[0.7rem] uppercase tracking-widest text-muted-foreground"
      >
        Preset
      </Label>
      <!-- Prev / Next / Random buttons -->
      <div class="flex">
        <Button
          variant="outline"
          size="icon-sm"
          title="Previous preset"
          aria-label="Previous preset"
          class="rounded-r-none border-r-0"
          @click="pickPrev"
        >
          <ChevronUp class="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          title="Next preset"
          aria-label="Next preset"
          class="rounded-none border-r-0"
          @click="pickNext"
        >
          <ChevronDown class="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          title="Random preset"
          aria-label="Pick random preset"
          class="rounded-l-none"
          @click="pickRandom"
        >
          <Shuffle class="size-4" />
        </Button>
      </div>
    </div>
    <div class="flex">
      <!-- Combobox trigger + dropdown -->
      <div
        ref="comboboxEl"
        class="relative flex-1 min-w-0"
      >
        <!-- Trigger button -->
        <button
          ref="triggerButtonEl"
          type="button"
          class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          :title="modelValue"
          :aria-expanded="isOpen"
          aria-haspopup="listbox"
          @click="toggleOpen"
          @keydown.down.prevent="openAndFocus"
          @keydown.enter.prevent="toggleOpen"
        >
          <span class="truncate text-left">{{ modelValue }}</span>
          <svg
            class="ml-2 h-4 w-4 shrink-0 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 9l4-4 4 4M16 15l-4 4-4-4"
            />
          </svg>
        </button>

        <!-- Dropdown panel: min-width matches trigger, can grow wider for long names -->
        <div
          v-if="isOpen"
          class="absolute z-50 mt-1 min-w-full rounded-md border border-border bg-popover shadow-md"
          style="width: 100%; max-width: 100%"
        >
          <!-- Search input -->
          <div class="p-2 border-b border-border">
            <input
              ref="searchInputEl"
              v-model="searchQuery"
              type="text"
              placeholder="Search presets…"
              class="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Filter presets"
              @keydown.escape="close"
              @keydown.down.prevent="focusList"
              @keydown.enter.prevent="selectHighlighted"
            >
          </div>

          <!-- List -->
          <div
            ref="listEl"
            class="max-h-56 overflow-y-auto"
            role="listbox"
            :aria-label="`${filteredPresets.length} presets`"
            @keydown.escape="close"
            @keydown.enter.prevent="selectHighlighted"
          >
            <div
              v-if="filteredPresets.length === 0"
              class="px-3 py-2 text-sm text-muted-foreground"
            >
              No matches
            </div>
            <button
              v-for="(name, i) in filteredPresets"
              :key="name"
              type="button"
              role="option"
              :aria-selected="name === modelValue"
              :data-index="i"
              :title="name"
              class="flex w-full items-center px-3 py-1 text-xs whitespace-nowrap hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
              :class="{ 'bg-accent/40': name === modelValue }"
              @click="selectPreset(name)"
            >
              {{ name }}
            </button>
          </div>

          <!-- Count footer -->
          <div
            v-if="searchQuery"
            class="border-t border-border px-3 py-1 text-xs text-muted-foreground"
          >
            {{ filteredPresets.length }} of {{ presetNames.length }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { Shuffle, ChevronUp, ChevronDown } from 'lucide-vue-next'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { presetNames } from '../utils/presets.js'

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

const comboboxEl = ref(null)
const triggerButtonEl = ref(null)
const searchInputEl = ref(null)
const listEl = ref(null)
const isOpen = ref(false)
const searchQuery = ref('')

const filteredPresets = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return presetNames
  return presetNames.filter(name => name.toLowerCase().includes(q))
})

function toggleOpen() {
  isOpen.value ? close() : open()
}

function open() {
  isOpen.value = true
  searchQuery.value = ''
  nextTick(() => searchInputEl.value?.focus())
}

function openAndFocus() {
  open()
}

function close() {
  isOpen.value = false
}

function focusList() {
  const first = listEl.value?.querySelector('button[role="option"]')
  first?.focus()
}

function selectHighlighted() {
  const focused = listEl.value?.querySelector('button[role="option"]:focus')
  if (focused) {
    const name = filteredPresets.value[Number(focused.dataset.index)]
    if (name) selectPreset(name)
  } else if (filteredPresets.value.length === 1) {
    selectPreset(filteredPresets.value[0])
  }
}

function selectPreset(name) {
  emit('update:modelValue', name)
  close()
  // Return focus to trigger so Radix's focus-trap doesn't consume the next outside click
  nextTick(() => triggerButtonEl.value?.focus())
}

function onDocumentMouseDown(e) {
  if (isOpen.value && !comboboxEl.value?.contains(e.target)) {
    close()
  }
}

onMounted(() => document.addEventListener('mousedown', onDocumentMouseDown, true))
onUnmounted(() => document.removeEventListener('mousedown', onDocumentMouseDown, true))

function pickPrev() {
  const i = presetNames.indexOf(props.modelValue)
  const prev = (i - 1 + presetNames.length) % presetNames.length
  emit('update:modelValue', presetNames[prev])
}

function pickNext() {
  const i = presetNames.indexOf(props.modelValue)
  const next = (i + 1) % presetNames.length
  emit('update:modelValue', presetNames[next])
}

function pickRandom() {
  const current = props.modelValue
  let name
  do {
    name = presetNames[Math.floor(Math.random() * presetNames.length)]
  } while (name === current && presetNames.length > 1)
  emit('update:modelValue', name)
}
</script>
