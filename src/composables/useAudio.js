import { ref, shallowRef } from 'vue'

/**
 * Manages audio file loading and playback via Web Audio API.
 *
 * AudioContext is created lazily on first use (satisfies autoplay policy).
 * Each call to loadFile decodes the file and prepares a new source node.
 * Call play(offset, loopStart, loopEnd) / stop() / seekTo(seconds) to control playback.
 *
 * Playback position tracking:
 *   - playheadTime: reactive ref; updated when stop() is called or playback ends
 *   - getCurrentTime(): returns live position while playing, playheadTime when stopped
 *   - seekTo(seconds): stop → update playheadTime → restart if was playing
 *
 * Looping:
 *   - play(offset, loopStart, loopEnd) — loops audio between loopStart and loopEnd
 *   - When looping, getCurrentTime() wraps the position into the loop region
 */
export function useAudio() {
  const audioContext = shallowRef(null)
  const audioBuffer = shallowRef(null)
  const gainNode = shallowRef(null)
  const isPlaying = ref(false)
  const isLoading = ref(false)
  const loadError = ref(null)

  // Reactive playhead position (seconds). Updated by stop() and seekTo().
  const playheadTime = ref(0)

  // Active source node — replaced each time play() is called
  let sourceNode = null
  // AudioContext clock snapshot taken when play() is called
  let playStartContextTime = 0
  let playStartOffset = 0
  // Loop region (null loopEndTime = no looping)
  let loopStartTime = 0
  let loopEndTime = null

  function getOrCreateContext() {
    if (!audioContext.value) {
      audioContext.value = new AudioContext()
      gainNode.value = audioContext.value.createGain()
      gainNode.value.connect(audioContext.value.destination)
    }
    return audioContext.value
  }

  /**
   * Returns the current playback position in seconds.
   * When playing: derived from AudioContext clock for sub-frame accuracy.
   *   If looping, wraps the raw time into the loop region.
   * When stopped: returns the last captured playheadTime.
   */
  function getCurrentTime() {
    if (!isPlaying.value || !audioContext.value) return playheadTime.value
    const rawTime = playStartOffset + (audioContext.value.currentTime - playStartContextTime)
    if (loopEndTime !== null && rawTime >= loopEndTime && loopEndTime > loopStartTime) {
      const loopDuration = loopEndTime - loopStartTime
      return loopStartTime + ((rawTime - loopStartTime) % loopDuration)
    }
    return rawTime
  }

  async function loadFile(file) {
    loadError.value = null
    isLoading.value = true
    stop()

    try {
      const ctx = getOrCreateContext()
      const arrayBuffer = await file.arrayBuffer()
      if (arrayBuffer.byteLength === 0) {
        throw new Error('The file is empty.')
      }
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      if (decoded.duration === 0 || decoded.length === 0) {
        throw new Error('Audio file has zero duration.')
      }
      audioBuffer.value = decoded
    } catch (err) {
      if (err.name === 'EncodingError' || err.name === 'NotSupportedError') {
        loadError.value = 'Unsupported or corrupted audio file. Try MP3, WAV, FLAC, or AAC.'
      } else {
        loadError.value = err.message
      }
      audioBuffer.value = null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Start playback from `offset` seconds.
   * @param {number} [offset=0] Start position in seconds
   * @param {number} [loopStart=0] Loop region start (seconds). Only used when loopEnd is provided.
   * @param {number|null} [loopEnd=null] Loop region end (seconds). Pass null for no looping.
   */
  async function play(offset = 0, loopStart = 0, loopEnd = null) {
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

    if (loopEnd !== null) {
      sourceNode.loop = true
      sourceNode.loopStart = loopStart
      sourceNode.loopEnd = loopEnd
    }

    sourceNode.onended = () => {
      if (isPlaying.value) {
        // Natural end of audio (non-looping) — reset playhead to start
        playheadTime.value = 0
        playStartContextTime = 0
        loopEndTime = null
        isPlaying.value = false
      }
    }
    sourceNode.start(0, offset)

    // Capture the AudioContext clock snapshot for getCurrentTime()
    playStartContextTime = ctx.currentTime
    playStartOffset = offset
    loopStartTime = loopStart
    loopEndTime = loopEnd

    isPlaying.value = true
  }

  function stop() {
    if (sourceNode) {
      // Capture position before stopping so playheadTime is accurate
      playheadTime.value = getCurrentTime()
      try {
        sourceNode.onended = null
        sourceNode.stop()
      } catch {
        // Already stopped — ignore
      }
      sourceNode.disconnect()
      sourceNode = null
    }
    playStartContextTime = 0
    loopEndTime = null
    isPlaying.value = false
  }

  /**
   * Seek to a specific position. If playing, stops first then restarts from new position.
   * Loop params are not preserved — call play() directly for loop-aware seeks.
   * @param {number} seconds
   */
  async function seekTo(seconds) {
    const wasPlaying = isPlaying.value
    stop()
    playheadTime.value = seconds
    if (wasPlaying) await play(seconds)
  }

  function dispose() {
    stop()
    audioContext.value?.close()
    audioContext.value = null
    gainNode.value = null
    audioBuffer.value = null
    playheadTime.value = 0
  }

  return {
    audioContext,
    audioBuffer,
    gainNode,
    isPlaying,
    isLoading,
    loadError,
    playheadTime,
    getCurrentTime,
    loadFile,
    play,
    stop,
    seekTo,
    dispose,
  }
}
