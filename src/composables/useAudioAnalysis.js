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
 */
export function useAudioAnalysis() {
  const frameData = ref(null)
  const progress = ref(0)
  const isAnalyzing = ref(false)
  const analysisError = ref(null)

  async function analyze(audioBuffer, fps, fftSize = 1024) {
    if (!audioBuffer) throw new Error('audioBuffer is required')

    frameData.value = null
    analysisError.value = null
    progress.value = 0
    isAnalyzing.value = true

    try {
      // Extract channel 0 PCM as a copy (we'll transfer it to the worker)
      const pcmData = audioBuffer.getChannelData(0).slice()

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
