<template>
  <div class="preset-selector">
    <label
      class="preset-selector__label"
      :for="selectId"
    >
      Preset
    </label>
    <div class="preset-selector__row">
      <select
        :id="selectId"
        class="preset-selector__select"
        :value="modelValue"
        @change="onSelect"
      >
        <option
          v-for="name in presetNames"
          :key="name"
          :value="name"
        >
          {{ name }}
        </option>
      </select>
      <button
        class="btn-icon"
        title="Random preset"
        @click="pickRandom"
      >
        &#8635;
      </button>
    </div>
  </div>
</template>

<script setup>
import { presetNames } from '../utils/presets.js'

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

// Stable ID for label/select association
const selectId = 'preset-select'

function onSelect(event) {
  emit('update:modelValue', event.target.value)
}

function pickRandom() {
  const current = props.modelValue
  let name
  // Avoid picking the same preset twice in a row
  do {
    name = presetNames[Math.floor(Math.random() * presetNames.length)]
  } while (name === current && presetNames.length > 1)
  emit('update:modelValue', name)
}
</script>

<style scoped>
.preset-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preset-selector__label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #888;
}

.preset-selector__row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.preset-selector__select {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ddd;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  min-width: 0;
}

.preset-selector__select:focus {
  outline: none;
  border-color: #7c6af7;
}

.btn-icon {
  background: transparent;
  border: 1px solid #333;
  color: #888;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.2s, color 0.2s;
  cursor: pointer;
}

.btn-icon:hover {
  border-color: #7c6af7;
  color: #7c6af7;
}
</style>
