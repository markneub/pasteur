<template>
  <div
    class="drop-zone"
    :class="{ 'drop-zone--active': isDragging, 'drop-zone--error': errorMessage }"
    role="button"
    tabindex="0"
    aria-label="Drop an audio file here or press Enter to browse"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
    @click="openFilePicker"
    @keydown.enter.prevent="openFilePicker"
    @keydown.space.prevent="openFilePicker"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="ACCEPTED_MIME_TYPES.join(',')"
      class="drop-zone__input"
      @change="onFileInputChange"
    >

    <div class="drop-zone__content">
      <svg
        class="drop-zone__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      <p class="drop-zone__label">
        Drop an audio file here
      </p>
      <div class="drop-zone__actions">
        <button
          class="drop-zone__btn"
          @click.stop="openFilePicker"
        >
          browse for a file
        </button>
        <button
          class="drop-zone__btn"
          @click.stop="loadSample"
        >
          load a sample track
        </button>
      </div>
      <p class="drop-zone__hint">
        supports MP3, WAV, FLAC, AAC, OGG, M4A
      </p>
      <p
        v-if="errorMessage"
        class="drop-zone__error"
      >
        {{ errorMessage }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const ACCEPTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
]

const ACCEPTED_EXTENSIONS = /\.(mp3|wav|flac|aac|ogg|m4a|mp4)$/i

const emit = defineEmits(['file-selected'])

const fileInput = ref(null)
const isDragging = ref(false)
const errorMessage = ref('')
let dragCounter = 0

function openFilePicker() {
  fileInput.value?.click()
}

function onDragEnter() {
  dragCounter++
  isDragging.value = true
}

function onDragLeave() {
  dragCounter--
  if (dragCounter === 0) isDragging.value = false
}

function onDrop(event) {
  dragCounter = 0
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

function onFileInputChange(event) {
  const file = event.target.files?.[0]
  if (file) handleFile(file)
  // Reset so the same file can be re-selected
  event.target.value = ''
}

function handleFile(file) {
  errorMessage.value = ''
  if (!isAudioFile(file)) {
    errorMessage.value = `Unsupported file type: ${file.type || file.name}. Please use MP3, WAV, FLAC, AAC, OGG, or M4A.`
    return
  }
  emit('file-selected', file)
}

function isAudioFile(file) {
  if (file.type) return ACCEPTED_MIME_TYPES.includes(file.type)
  // Fallback: check extension only when browser provides no MIME type
  return ACCEPTED_EXTENSIONS.test(file.name)
}

async function loadSample() {
  errorMessage.value = ''
  const response = await fetch('/sample.mp3')
  const blob = await response.blob()
  const file = new File([blob], "born in '85.mp3", { type: 'audio/mpeg' })
  emit('file-selected', file)
}
</script>

<style scoped>
.drop-zone {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #444;
  border-radius: 12px;
  padding: 48px 32px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
  background: #111;
  user-select: none;
}

.drop-zone:hover {
  border-color: #555;
  background: #141414;
}

.drop-zone--active {
  border-color: #7c6af7;
  background: #15122a;
}

.drop-zone--error {
  border-color: #e05c5c;
}

.drop-zone__input {
  display: none;
}

.drop-zone__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  pointer-events: none;
}

.drop-zone__icon {
  width: 48px;
  height: 48px;
  color: #666;
  margin-bottom: 8px;
}

.drop-zone--active .drop-zone__icon {
  color: #7c6af7;
}

.drop-zone__label {
  font-size: 1rem;
  color: #ccc;
}

.drop-zone__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  pointer-events: all;
}

.drop-zone__btn {
  background: none;
  border: 1px solid #444;
  border-radius: 999px;
  padding: 4px 14px;
  color: #aaa;
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  pointer-events: all;
}

.drop-zone__btn:hover {
  border-color: #7c6af7;
  color: #fff;
}

.drop-zone__hint {
  font-size: 0.75rem;
  color: #555;
  margin-top: 12px;
}

.drop-zone__error {
  font-size: 0.85rem;
  color: #e05c5c;
  margin-top: 4px;
}

@media (max-width: 480px) {
  .drop-zone__content {
    gap: 4px;
  }

  .drop-zone__icon {
    margin-bottom: 2px;
  }

  .drop-zone__actions {
    margin-top: 2px;
  }

  .drop-zone__hint {
    margin-top: 6px;
  }
}
</style>
