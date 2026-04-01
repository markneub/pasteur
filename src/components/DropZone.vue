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
          d="M9 9l3-3m0 0l3 3m-3-3v8M5.25 12H3.75A2.25 2.25 0 001.5 14.25v4.5A2.25 2.25 0 003.75 21h16.5a2.25 2.25 0 002.25-2.25v-4.5A2.25 2.25 0 0020.25 12h-1.5"
        />
      </svg>
      <p class="drop-zone__label">
        Drop an audio file here, or <span class="drop-zone__browse">browse</span>
      </p>
      <p class="drop-zone__hint">
        Supports MP3, WAV, FLAC, AAC, OGG, M4A
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

.drop-zone:hover,
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

.drop-zone__browse {
  color: #7c6af7;
  text-decoration: underline;
}

.drop-zone__hint {
  font-size: 0.8rem;
  color: #666;
}

.drop-zone__error {
  font-size: 0.85rem;
  color: #e05c5c;
  margin-top: 4px;
}
</style>
