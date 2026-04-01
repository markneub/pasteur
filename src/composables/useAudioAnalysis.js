import { ref } from 'vue'

/**
 * Pre-analyzes audio PCM data into per-frame FFT + time-domain arrays.
 *
 * Runs in a Web Worker to avoid blocking the main thread.
 *
 * Usage:
 *   const { analyze, frameData, progress, isAnalyzing, analysisError } = useAudioAnalysis()
 *   await analyze(audioBuffer, fps)
 *   // frameData.value is now Array<{ timeDomain: Uint8Array, frequency: Uint8Array }>
 *
 * Clip trimming: pass clipStart and clipEnd to analyze only the specified region.
 * The returned frameData indices start at 0 = clipStart (not at the beginning of the file).
 * The worker is unchanged — trimming is done by slicing the PCM before transfer.
 */
export function useAudioAnalysis() {
  const frameData = ref(null)
  const progress = ref(0)
  const isAnalyzing = ref(false)
  const analysisError = ref(null)

  /**
   * @param {AudioBuffer} audioBuffer
   * @param {number} fps
   * @param {number} [fftSize=1024]
   * @param {number} [clipStart=0] Start of the clip region in seconds
   * @param {number|null} [clipEnd=null] End of the clip region in seconds (null = full duration)
   */
  async function analyze(audioBuffer, fps, fftSize = 1024, clipStart = 0, clipEnd = null) {
    if (!audioBuffer) throw new Error('audioBuffer is required')

    frameData.value = null
    analysisError.value = null
    progress.value = 0
    isAnalyzing.value = true

    try {
      // Slice the PCM to the clip region before sending to the worker.
      // The worker derives totalFrames from pcmData.length, so frame indices
      // automatically start at 0 = clipStart with no worker changes required.
      const end = clipEnd ?? audioBuffer.duration
      const startSample = Math.round(clipStart * audioBuffer.sampleRate)
      const endSample = Math.round(end * audioBuffer.sampleRate)
      const pcmData = audioBuffer.getChannelData(0).slice(startSample, endSample)

      const result = await runWorker({
        pcmData,
        sampleRate: audioBuffer.sampleRate,
        fps,
        fftSize,
      })

      frameData.value = result
    } catch (err) {
      analysisError.value = err.message
      throw err
    } finally {
      isAnalyzing.value = false
    }
  }

  function runWorker(payload) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('../workers/audioAnalysis.worker.js', import.meta.url),
        { type: 'module' }
      )

      worker.onmessage = (event) => {
        const { type, progress: p, frameData: fd, message } = event.data

        if (type === 'progress') {
          progress.value = p
        } else if (type === 'done') {
          progress.value = 1
          worker.terminate()
          resolve(fd)
        } else if (type === 'error') {
          worker.terminate()
          reject(new Error(message))
        }
      }

      worker.onerror = (err) => {
        worker.terminate()
        reject(new Error(err.message))
      }

      // Transfer the pcmData ArrayBuffer to avoid copying
      worker.postMessage(payload, [payload.pcmData.buffer])
    })
  }

  function reset() {
    frameData.value = null
    progress.value = 0
    isAnalyzing.value = false
    analysisError.value = null
  }

  return {
    analyze,
    frameData,
    progress,
    isAnalyzing,
    analysisError,
    reset,
  }
}
