<template>
  <div class="flex flex-col gap-1.5">
    <Label
      class="text-[0.7rem] uppercase tracking-widest text-muted-foreground"
    >
      Preset
    </Label>
    <div class="flex gap-2">
      <!-- Combobox trigger + dropdown -->
      <div
        ref="comboboxEl"
        class="relative flex-1"
        @focusout="onFocusOut"
      >
        <!-- Trigger button -->
        <button
          type="button"
          class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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

        <!-- Dropdown panel -->
        <div
          v-if="isOpen"
          class="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md"
        >
          <!-- Search input -->
          <div class="p-2 border-b border-border">
            <input
              ref="searchInputEl"
              v-model="searchQuery"
              type="text"
              placeholder="Search presets…"
              class="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
              class="flex w-full items-center px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
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

      <!-- Random button -->
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
import { ref, computed, nextTick } from 'vue'
import { Shuffle } from 'lucide-vue-next'
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
}

function onFocusOut(e) {
  // Close if focus moved outside this component
  if (!comboboxEl.value?.contains(e.relatedTarget)) {
    close()
  }
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
