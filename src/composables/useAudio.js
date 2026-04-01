import { ref, shallowRef } from 'vue'

/**
 * Manages audio file loading and playback via Web Audio API.
 *
 * AudioContext is created lazily on first use (satisfies autoplay policy).
 * Each call to loadFile decodes the file and prepares a new source node.
 * Call play() / stop() to control playback.
 */
export function useAudio() {
  const audioContext = shallowRef(null)
  const audioBuffer = shallowRef(null)
  const gainNode = shallowRef(null)
  const isPlaying = ref(false)
  const isLoading = ref(false)
  const loadError = ref(null)

  // Active source node — replaced each time play() is called
  let sourceNode = null

  function getOrCreateContext() {
    if (!audioContext.value) {
      audioContext.value = new AudioContext()
      gainNode.value = audioContext.value.createGain()
      gainNode.value.connect(audioContext.value.destination)
    }
    return audioContext.value
  }

  async function loadFile(file) {
    loadError.value = null
    isLoading.value = true
    stop()

    try {
      const ctx = getOrCreateContext()
      const arrayBuffer = await file.arrayBuffer()
      audioBuffer.value = await ctx.decodeAudioData(arrayBuffer)
    } catch (err) {
      loadError.value = `Could not decode audio: ${err.message}`
      audioBuffer.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function play(offset = 0) {
    if (!audioBuffer.value) return
    stop()

    const ctx = getOrCreateContext()

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    sourceNode = ctx.createBufferSource()
    sourceNode.buffer = audioBuffer.value
    sourceNode.connect(gainNode.value)
    sourceNode.onended = () => {
      if (isPlaying.value) isPlaying.value = false
    }
    sourceNode.start(0, offset)
    isPlaying.value = true
  }

  function stop() {
    if (sourceNode) {
      try {
        sourceNode.onended = null
        sourceNode.stop()
      } catch {
        // Already stopped — ignore
      }
      sourceNode.disconnect()
      sourceNode = null
    }
    isPlaying.value = false
  }

  function dispose() {
    stop()
    audioContext.value?.close()
    audioContext.value = null
    gainNode.value = null
    audioBuffer.value = null
  }

  return {
    audioContext,
    audioBuffer,
    gainNode,
    isPlaying,
    isLoading,
    loadError,
    loadFile,
    play,
    stop,
    dispose,
  }
}
