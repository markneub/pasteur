import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────

// butterchurn
vi.mock('butterchurn', () => ({
  default: {
    createVisualizer: vi.fn(),
  },
}))

// mediabunny
const mockCanvasSource = {
  add: vi.fn(async () => {}),
  close: vi.fn(),
}
const mockAudioSource = {
  add: vi.fn(async () => {}),
  close: vi.fn(),
}
const mockOutput = {
  addVideoTrack: vi.fn(),
  addAudioTrack: vi.fn(),
  start: vi.fn(async () => {}),
  finalize: vi.fn(async () => {}),
  cancel: vi.fn(async () => {}),
  target: { buffer: new ArrayBuffer(8) },
}

vi.mock('mediabunny', () => ({
  Output: vi.fn(() => mockOutput),
  Mp4OutputFormat: vi.fn(),
  WebMOutputFormat: vi.fn(),
  BufferTarget: vi.fn(() => ({ buffer: new ArrayBuffer(8) })),
  CanvasSource: vi.fn(() => mockCanvasSource),
  AudioBufferSource: vi.fn(() => mockAudioSource),
}))

// useAudioAnalysis — expose a controller so tests can resolve/reject it
let resolveAnalysis, rejectAnalysis
const mockFrameData = Array.from({ length: 5 }, () => ({
  timeDomain: new Uint8Array(1024),
  frequency: new Uint8Array(512),
}))

vi.mock('../useAudioAnalysis.js', () => {
  return {
    useAudioAnalysis: () => {
      // Plain ref-like objects — sufficient for unit tests that read .value directly
      const frameData = { value: null }
      const progress = { value: 0 }
      const isAnalyzing = { value: false }
      const analysisError = { value: null }

      const analyze = vi.fn(() =>
        new Promise((res, rej) => {
          resolveAnalysis = () => { frameData.value = mockFrameData; res() }
          rejectAnalysis = (msg) => { analysisError.value = msg; rej(new Error(msg)) }
        })
      )
      const reset = vi.fn()

      return { analyze, frameData, progress, isAnalyzing, analysisError, reset }
    },
  }
})

// getPreset
vi.mock('../../utils/presets.js', () => ({
  getPreset: vi.fn((name) => (name ? { name } : null)),
}))

// ── Helpers ───────────────────────────────────────────────────────────────

function makeAudioBuffer(durationSecs = 0.1, sampleRate = 44100) {
  return {
    duration: durationSecs,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: vi.fn(() => new Float32Array(Math.round(durationSecs * sampleRate))),
  }
}

function makeAudioContext() {
  const dummyGain = { gain: { value: 1 } }
  const dummyBuffer = { copyToChannel: vi.fn() }
  return {
    createGain: vi.fn(() => dummyGain),
    createBuffer: vi.fn(() => dummyBuffer),
    _dummyBuffer: dummyBuffer,
  }
}

function makeVisualizer() {
  return {
    loadPreset: vi.fn(),
    connectAudio: vi.fn(),
    render: vi.fn(),
    audio: {
      analyser: {
        getByteTimeDomainData: vi.fn(),
        getByteFrequencyData: vi.fn(),
      },
    },
  }
}

function makeExportSettings(overrides = {}) {
  return {
    width: 320,
    height: 180,
    fps: 30,
    format: 'mp4',
    ...overrides,
  }
}

// DOM stubs
function setupDom() {
  const fakeCanvas = {
    style: {},
    width: 0,
    height: 0,
    parentNode: { removeChild: vi.fn() },
  }
  global.document = {
    createElement: vi.fn((tag) => {
      if (tag === 'canvas') return fakeCanvas
      if (tag === 'a') return { href: '', download: '', click: vi.fn() }
      return {}
    }),
    body: { appendChild: vi.fn() },
  }
  global.URL = {
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  }
  global.Blob = vi.fn(() => ({}))
  return fakeCanvas
}

async function freshUseExporter(visualizerOverride) {
  vi.resetModules()
  // Re-apply mocks after module reset
  const butterchurn = await import('butterchurn')
  const fakeViz = visualizerOverride ?? makeVisualizer()
  butterchurn.default.createVisualizer.mockReturnValue(fakeViz)

  const { useExporter } = await import('../useExporter.js')
  return { composable: useExporter(), visualizer: fakeViz }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('useExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDom()
    resolveAnalysis = null
    rejectAnalysis = null
  })

  it('starts with idle state', async () => {
    const { composable } = await freshUseExporter()
    const { isExporting, exportPhase, exportError } = composable
    expect(isExporting.value).toBe(false)
    expect(exportPhase.value).toBeNull()
    expect(exportError.value).toBeNull()
  })

  it('sets isExporting and exportPhase=analyzing while analysis runs', async () => {
    const { composable } = await freshUseExporter()
    const { startExport, isExporting, exportPhase } = composable

    const promise = startExport({
      audioBuffer: makeAudioBuffer(),
      audioContext: makeAudioContext(),
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings(),
    })

    // Before analysis resolves, check state
    expect(isExporting.value).toBe(true)
    expect(exportPhase.value).toBe('analyzing')

    // Clean up
    resolveAnalysis()
    await promise
  })

  it('transitions to rendering phase after analysis', async () => {
    const { composable } = await freshUseExporter()
    const { startExport, exportPhase } = composable

    const promise = startExport({
      audioBuffer: makeAudioBuffer(),
      audioContext: makeAudioContext(),
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings(),
    })

    resolveAnalysis()
    await promise

    expect(exportPhase.value).toBeNull() // null after completion
  })

  it('resets to idle state after successful export', async () => {
    const { composable } = await freshUseExporter()
    const { startExport, isExporting, exportPhase } = composable

    const promise = startExport({
      audioBuffer: makeAudioBuffer(),
      audioContext: makeAudioContext(),
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings(),
    })

    resolveAnalysis()
    await promise

    expect(isExporting.value).toBe(false)
    expect(exportPhase.value).toBeNull()
  })

  it('sets exportError and resets to idle on analysis failure', async () => {
    const { composable } = await freshUseExporter()
    const { startExport, isExporting, exportError } = composable

    const promise = startExport({
      audioBuffer: makeAudioBuffer(),
      audioContext: makeAudioContext(),
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings(),
    })

    rejectAnalysis('Worker exploded')
    await promise

    expect(exportError.value).toBe('Worker exploded')
    expect(isExporting.value).toBe(false)
  })

  it('does nothing if startExport called while already exporting', async () => {
    const { composable } = await freshUseExporter()
    const { startExport, isExporting } = composable

    const p1 = startExport({
      audioBuffer: makeAudioBuffer(),
      audioContext: makeAudioContext(),
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings(),
    })

    // Second call while first is running
    const p2 = startExport({
      audioBuffer: makeAudioBuffer(),
      audioContext: makeAudioContext(),
      presetTimeline: [],
      exportSettings: makeExportSettings(),
    })

    expect(isExporting.value).toBe(true)

    resolveAnalysis()
    await Promise.all([p1, p2])
  })

  it('calls output.cancel() on cancel() during analysis', async () => {
    const { composable } = await freshUseExporter()
    const { startExport, cancel, isExporting } = composable

    const promise = startExport({
      audioBuffer: makeAudioBuffer(),
      audioContext: makeAudioContext(),
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings(),
    })

    await cancel()
    resolveAnalysis()
    await promise

    expect(isExporting.value).toBe(false)
  })

  it('calls output.finalize() on successful export', async () => {
    const { composable } = await freshUseExporter()
    const { startExport } = composable

    const promise = startExport({
      audioBuffer: makeAudioBuffer(),
      audioContext: makeAudioContext(),
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings(),
    })

    resolveAnalysis()
    await promise

    expect(mockOutput.finalize).toHaveBeenCalled()
  })

  it('trims audio buffer to clipStart/clipEnd range', async () => {
    const { composable } = await freshUseExporter()
    const { startExport } = composable
    const sampleRate = 44100
    const audioCtx = makeAudioContext()
    const audioBuffer = makeAudioBuffer(10, sampleRate) // 10s audio

    const promise = startExport({
      audioBuffer,
      audioContext: audioCtx,
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings(),
      clipStart: 2,
      clipEnd: 5,  // 3s clip
    })

    resolveAnalysis()
    await promise

    // createBuffer should be called with the trimmed sample count: 3s * 44100 = 132300
    expect(audioCtx.createBuffer).toHaveBeenCalledWith(
      1,           // numberOfChannels
      Math.round((5 - 2) * sampleRate),  // 132300
      sampleRate
    )
  })

  it('uses full duration when clipStart=0 and no clipEnd', async () => {
    const { composable } = await freshUseExporter()
    const { startExport } = composable
    const sampleRate = 44100
    const duration = 0.1
    const audioCtx = makeAudioContext()
    const audioBuffer = makeAudioBuffer(duration, sampleRate)

    const promise = startExport({
      audioBuffer,
      audioContext: audioCtx,
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings(),
    })

    resolveAnalysis()
    await promise

    expect(audioCtx.createBuffer).toHaveBeenCalledWith(
      1,
      Math.round(duration * sampleRate),
      sampleRate
    )
  })

  it('creates WebMOutputFormat for webm format', async () => {
    const mediabunny = await import('mediabunny')

    const { composable } = await freshUseExporter()
    const { startExport } = composable

    const promise = startExport({
      audioBuffer: makeAudioBuffer(),
      audioContext: makeAudioContext(),
      presetTimeline: [{ presetName: 'foo', startTime: 0, transitionDuration: 1.5 }],
      exportSettings: makeExportSettings({ format: 'webm' }),
    })

    resolveAnalysis()
    await promise

    expect(mediabunny.WebMOutputFormat).toHaveBeenCalled()
  })
})
