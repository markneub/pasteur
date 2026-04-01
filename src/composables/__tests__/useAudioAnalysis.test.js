import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock Web Worker ---
// We capture the worker instance so tests can fire messages back at it.
let workerInstance = null

class MockWorker {
  constructor() {
    this.onmessage = null
    this.onerror = null
    this.terminate = vi.fn()
    this.postMessage = vi.fn()
    workerInstance = this
  }

  // Helper: simulate a message from the worker
  _emit(data) {
    if (this.onmessage) this.onmessage({ data })
  }

  _emitError(message) {
    if (this.onerror) this.onerror({ message })
  }
}

// Build a minimal fake AudioBuffer
function makeAudioBuffer(samples = 4096, sampleRate = 44100) {
  const pcm = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    pcm[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate)
  }
  return {
    sampleRate,
    duration: samples / sampleRate,
    numberOfChannels: 1,
    getChannelData: vi.fn(() => pcm),
  }
}

// Build a minimal fake frameData result
function makeFakeFrameData(count) {
  return Array.from({ length: count }, () => ({
    timeDomain: new Uint8Array(1024),
    frequency: new Uint8Array(512),
  }))
}

async function freshUseAudioAnalysis() {
  vi.resetModules()
  global.Worker = MockWorker
  const { useAudioAnalysis } = await import('../useAudioAnalysis.js')
  return useAudioAnalysis()
}

describe('useAudioAnalysis', () => {
  beforeEach(() => {
    workerInstance = null
  })

  it('starts with null frameData and not analyzing', async () => {
    const { frameData, isAnalyzing, progress, analysisError } = await freshUseAudioAnalysis()
    expect(frameData.value).toBeNull()
    expect(isAnalyzing.value).toBe(false)
    expect(progress.value).toBe(0)
    expect(analysisError.value).toBeNull()
  })

  it('sets isAnalyzing true while worker is running', async () => {
    const { analyze, isAnalyzing } = await freshUseAudioAnalysis()
    const audioBuffer = makeAudioBuffer()

    const promise = analyze(audioBuffer, 30)

    // Before worker replies, isAnalyzing should be true
    expect(isAnalyzing.value).toBe(true)

    // Resolve worker
    workerInstance._emit({ type: 'done', frameData: makeFakeFrameData(3) })

    await promise
    expect(isAnalyzing.value).toBe(false)
  })

  it('updates progress on progress messages', async () => {
    const { analyze, progress } = await freshUseAudioAnalysis()
    const audioBuffer = makeAudioBuffer()

    const promise = analyze(audioBuffer, 30)

    workerInstance._emit({ type: 'progress', progress: 0.5 })
    expect(progress.value).toBe(0.5)

    workerInstance._emit({ type: 'done', frameData: makeFakeFrameData(2) })
    await promise

    expect(progress.value).toBe(1)
  })

  it('resolves frameData on done message', async () => {
    const { analyze, frameData } = await freshUseAudioAnalysis()
    const audioBuffer = makeAudioBuffer()
    const fake = makeFakeFrameData(5)

    const promise = analyze(audioBuffer, 30)
    workerInstance._emit({ type: 'done', frameData: fake })
    await promise

    expect(frameData.value).toStrictEqual(fake)
    expect(frameData.value.length).toBe(5)
  })

  it('sets analysisError and rejects on worker error message', async () => {
    const { analyze, analysisError } = await freshUseAudioAnalysis()
    const audioBuffer = makeAudioBuffer()

    const promise = analyze(audioBuffer, 30)
    workerInstance._emit({ type: 'error', message: 'FFT exploded' })

    await expect(promise).rejects.toThrow('FFT exploded')
    expect(analysisError.value).toBe('FFT exploded')
  })

  it('sets analysisError and rejects on worker onerror', async () => {
    const { analyze, analysisError } = await freshUseAudioAnalysis()
    const audioBuffer = makeAudioBuffer()

    const promise = analyze(audioBuffer, 30)
    workerInstance._emitError('Worker crashed')

    await expect(promise).rejects.toThrow('Worker crashed')
    expect(analysisError.value).toBe('Worker crashed')
  })

  it('terminates worker after done', async () => {
    const { analyze } = await freshUseAudioAnalysis()
    const audioBuffer = makeAudioBuffer()

    const promise = analyze(audioBuffer, 30)
    workerInstance._emit({ type: 'done', frameData: makeFakeFrameData(1) })
    await promise

    expect(workerInstance.terminate).toHaveBeenCalled()
  })

  it('terminates worker after error', async () => {
    const { analyze } = await freshUseAudioAnalysis()
    const audioBuffer = makeAudioBuffer()

    const promise = analyze(audioBuffer, 30)
    workerInstance._emit({ type: 'error', message: 'fail' })
    await expect(promise).rejects.toThrow()

    expect(workerInstance.terminate).toHaveBeenCalled()
  })

  it('throws immediately if no audioBuffer is passed', async () => {
    const { analyze } = await freshUseAudioAnalysis()
    await expect(analyze(null, 30)).rejects.toThrow('audioBuffer is required')
  })

  it('reset clears all state', async () => {
    const { analyze, frameData, progress, isAnalyzing, reset } = await freshUseAudioAnalysis()
    const audioBuffer = makeAudioBuffer()

    const promise = analyze(audioBuffer, 30)
    workerInstance._emit({ type: 'done', frameData: makeFakeFrameData(2) })
    await promise

    reset()

    expect(frameData.value).toBeNull()
    expect(progress.value).toBe(0)
    expect(isAnalyzing.value).toBe(false)
  })
})
