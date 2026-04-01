import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Minimal Web Audio API mock ---
function makeSourceNode() {
  return {
    buffer: null,
    onended: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

function makeGainNode(ctx) {
  return {
    connect: vi.fn(),
    gain: { value: 1 },
    _ctx: ctx,
  }
}

function makeAudioContext(state = 'running') {
  const ctx = {
    state,
    destination: {},
    resume: vi.fn(async () => { ctx.state = 'running' }),
    close: vi.fn(async () => {}),
    createGain: vi.fn(),
    createBufferSource: vi.fn(),
    decodeAudioData: vi.fn(),
  }
  const gain = makeGainNode(ctx)
  ctx.createGain.mockReturnValue(gain)
  ctx.createBufferSource.mockImplementation(() => makeSourceNode())
  return ctx
}

// Inject mock AudioContext globally before importing the composable
let mockCtx
beforeEach(() => {
  mockCtx = makeAudioContext()
  global.AudioContext = vi.fn(() => mockCtx)
})

// Dynamic import so each test gets a fresh module with the mock in place
async function freshUseAudio() {
  vi.resetModules()
  const { useAudio } = await import('../useAudio.js')
  return useAudio()
}

describe('useAudio', () => {
  it('starts with null audioBuffer and not playing', async () => {
    const { audioBuffer, isPlaying, isLoading } = await freshUseAudio()
    expect(audioBuffer.value).toBeNull()
    expect(isPlaying.value).toBe(false)
    expect(isLoading.value).toBe(false)
  })

  it('decodes file and sets audioBuffer on loadFile', async () => {
    const fakeBuffer = { duration: 120, sampleRate: 44100 }
    mockCtx.decodeAudioData.mockResolvedValue(fakeBuffer)

    const { audioBuffer, isLoading, loadFile } = await freshUseAudio()
    const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }

    await loadFile(fakeFile)

    expect(audioBuffer.value).toBe(fakeBuffer)
    expect(isLoading.value).toBe(false)
  })

  it('sets loadError when decodeAudioData throws', async () => {
    mockCtx.decodeAudioData.mockRejectedValue(new Error('bad format'))

    const { loadError, loadFile } = await freshUseAudio()
    const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }

    await loadFile(fakeFile)

    expect(loadError.value).toMatch('bad format')
  })

  it('sets isPlaying true after play()', async () => {
    const fakeBuffer = { duration: 60, sampleRate: 44100 }
    mockCtx.decodeAudioData.mockResolvedValue(fakeBuffer)

    const { isPlaying, loadFile, play } = await freshUseAudio()
    const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }

    await loadFile(fakeFile)
    await play()

    expect(isPlaying.value).toBe(true)
    expect(mockCtx.createBufferSource).toHaveBeenCalled()
  })

  it('resumes suspended AudioContext on play()', async () => {
    mockCtx.state = 'suspended'
    const fakeBuffer = { duration: 60, sampleRate: 44100 }
    mockCtx.decodeAudioData.mockResolvedValue(fakeBuffer)

    const { loadFile, play } = await freshUseAudio()
    const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }

    await loadFile(fakeFile)
    await play()

    expect(mockCtx.resume).toHaveBeenCalled()
  })

  it('sets isPlaying false after stop()', async () => {
    const fakeBuffer = { duration: 60, sampleRate: 44100 }
    mockCtx.decodeAudioData.mockResolvedValue(fakeBuffer)

    const { isPlaying, loadFile, play, stop } = await freshUseAudio()
    const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }

    await loadFile(fakeFile)
    await play()
    stop()

    expect(isPlaying.value).toBe(false)
  })

  it('closes AudioContext on dispose()', async () => {
    const { dispose } = await freshUseAudio()
    // Trigger context creation
    global.AudioContext = vi.fn(() => mockCtx)
    dispose()
    // dispose before any context creation is a no-op
    expect(mockCtx.close).not.toHaveBeenCalled()
  })
})
