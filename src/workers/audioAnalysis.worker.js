/**
 * Web Worker: Pre-compute per-frame FFT and time-domain data from raw PCM.
 *
 * Receives message: { pcmData: Float32Array, sampleRate: number, fps: number, fftSize: number }
 * Posts messages:
 *   { type: 'progress', progress: 0-1 }
 *   { type: 'done', frameData: Array<{ timeDomain: Uint8Array, frequency: Uint8Array }> }
 *   { type: 'error', message: string }
 */

import FFT from 'fft.js'

self.onmessage = function (event) {
  const { pcmData, sampleRate, fps, fftSize = 1024 } = event.data

  try {
    const totalFrames = Math.ceil((pcmData.length / sampleRate) * fps)
    const fft = new FFT(fftSize)
    const frameData = []

    // Hann window coefficients for frequency analysis
    const hannWindow = new Float32Array(fftSize)
    for (let n = 0; n < fftSize; n++) {
      hannWindow[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)))
    }

    // fft.js needs a complex output buffer of size fftSize * 2
    const fftInput = new Float32Array(fftSize)
    const fftOutput = fft.createComplexArray()

    for (let i = 0; i < totalFrames; i++) {
      const sampleOffset = Math.floor((i / fps) * sampleRate)

      // --- Time-domain (offset binary: -1→1 float maps to 0→255 Uint8) ---
      const timeDomain = new Uint8Array(fftSize)
      for (let j = 0; j < fftSize; j++) {
        const sample = pcmData[sampleOffset + j] ?? 0
        timeDomain[j] = Math.max(0, Math.min(255, Math.round(128 + sample * 127)))
      }

      // --- Frequency (FFT magnitude → dB → Uint8) ---
      for (let j = 0; j < fftSize; j++) {
        const sample = pcmData[sampleOffset + j] ?? 0
        fftInput[j] = sample * hannWindow[j]
      }
      fft.realTransform(fftOutput, fftInput)

      // Only the first fftSize/2 bins are meaningful for real input
      const binCount = fftSize / 2
      const frequency = new Uint8Array(binCount)
      for (let j = 0; j < binCount; j++) {
        const re = fftOutput[2 * j]
        const im = fftOutput[2 * j + 1]
        const magnitude = Math.sqrt(re * re + im * im) / fftSize
        // Convert to dB: ref 1.0, clamp to -100…0 dB → map to 0…255
        const db = magnitude > 0 ? 20 * Math.log10(magnitude) : -100
        frequency[j] = Math.max(0, Math.min(255, Math.round(((db + 100) / 100) * 255)))
      }

      frameData.push({ timeDomain, frequency })

      // Report progress every 100 frames
      if (i % 100 === 0) {
        self.postMessage({ type: 'progress', progress: i / totalFrames })
      }
    }

    self.postMessage({ type: 'done', frameData })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}
