import { shallowRef } from 'vue'

/**
 * Computes a fixed-resolution peak array from an AudioBuffer for waveform display.
 *
 * Usage:
 *   const { peaks, computePeaks } = useWaveform()
 *   computePeaks(audioBuffer)  // call once; peaks.value is a Float32Array of length `resolution`
 *
 * Each entry in `peaks` is the maximum absolute sample value (0..1) across all channels
 * within that time bucket. Suitable for drawing a symmetric waveform on a Canvas 2D context.
 */
export function useWaveform() {
  const peaks = shallowRef(null) // Float32Array | null

  /**
   * @param {AudioBuffer} audioBuffer
   * @param {number} [resolution=1200] Number of buckets (one per output pixel at typical widths)
   */
  function computePeaks(audioBuffer, resolution = 1200) {
    const totalSamples = audioBuffer.length
    const samplesPerBucket = Math.ceil(totalSamples / resolution)
    const result = new Float32Array(resolution)

    for (let b = 0; b < resolution; b++) {
      const start = b * samplesPerBucket
      const end = Math.min(start + samplesPerBucket, totalSamples)
      let max = 0
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const data = audioBuffer.getChannelData(ch)
        for (let s = start; s < end; s++) {
          const abs = Math.abs(data[s])
          if (abs > max) max = abs
        }
      }
      result[b] = max
    }

    peaks.value = result
  }

  return { peaks, computePeaks }
}
