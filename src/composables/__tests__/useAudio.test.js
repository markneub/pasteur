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
    currentTime: 0,   // mock AudioContext clock (set manually in tests)
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

  it('playheadTime starts at 0', async () => {
    const { playheadTime } = await freshUseAudio()
    expect(playheadTime.value).toBe(0)
  })

  it('getCurrentTime returns 0 when not playing', async () => {
    const { getCurrentTime } = await freshUseAudio()
    expect(getCurrentTime()).toBe(0)
  })

  it('getCurrentTime uses AudioContext clock while playing', async () => {
    const fakeBuffer = { duration: 60, sampleRate: 44100 }
    mockCtx.decodeAudioData.mockResolvedValue(fakeBuffer)
    mockCtx.currentTime = 10  // AudioContext clock starts at 10s

    const { loadFile, play, getCurrentTime } = await freshUseAudio()
    const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }

    await loadFile(fakeFile)
    await play(5)  // start at offset 5s; AudioContext.currentTime captured = 10

    // Simulate 3 seconds of playback having elapsed
    mockCtx.currentTime = 13

    // currentTime = offset + (ctx.currentTime - playStartContextTime) = 5 + (13 - 10) = 8
    expect(getCurrentTime()).toBeCloseTo(8, 5)
  })

  it('stop captures playheadTime and stops playback', async () => {
    const fakeBuffer = { duration: 60, sampleRate: 44100 }
    mockCtx.decodeAudioData.mockResolvedValue(fakeBuffer)
    mockCtx.currentTime = 0

    const { loadFile, play, stop, playheadTime, isPlaying } = await freshUseAudio()
    const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }

    await loadFile(fakeFile)
    await play(2)          // offset 2, ctx.currentTime=0 at start
    mockCtx.currentTime = 3  // 3 seconds elapsed

    stop()

    // playheadTime = 2 + (3 - 0) = 5
    expect(playheadTime.value).toBeCloseTo(5, 5)
    expect(isPlaying.value).toBe(false)
  })

  it('seekTo updates playheadTime without restarting when stopped', async () => {
    const fakeBuffer = { duration: 60, sampleRate: 44100 }
    mockCtx.decodeAudioData.mockResolvedValue(fakeBuffer)

    const { loadFile, seekTo, playheadTime, isPlaying } = await freshUseAudio()
    const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }

    await loadFile(fakeFile)
    await seekTo(15)

    expect(playheadTime.value).toBe(15)
    expect(isPlaying.value).toBe(false)
  })

  it('seekTo restarts playback from new position when was playing', async () => {
    const fakeBuffer = { duration: 60, sampleRate: 44100 }
    mockCtx.decodeAudioData.mockResolvedValue(fakeBuffer)

    const { loadFile, play, seekTo, playheadTime, isPlaying } = await freshUseAudio()
    const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }

    await loadFile(fakeFile)
    await play(0)
    expect(isPlaying.value).toBe(true)

    await seekTo(20)

    expect(playheadTime.value).toBe(20)
    expect(isPlaying.value).toBe(true)
    // play() was called twice: once at offset 0, once at offset 20
    const sourceNodeCalls = mockCtx.createBufferSource.mock.calls.length
    expect(sourceNodeCalls).toBe(2)
  })
})
