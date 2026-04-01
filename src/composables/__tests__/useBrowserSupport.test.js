import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock factories ────────────────────────────────────────────────────────────

/**
 * VideoEncoder mock. Each `new Constructor(...)` captures its own output/error
 * from constructor args so parallel probeVideoCodec calls don't cross-contaminate.
 */
function makeVideoEncoderClass({ configSupported = true, outputFires = true } = {}) {
  const Constructor = vi.fn(function ({ output, error }) {
    const instance = {
      configure: vi.fn(),
      encode: vi.fn(() => {
        if (outputFires) {
          Promise.resolve().then(() => output())
        } else {
          Promise.resolve().then(() => error(new Error('encode failed')))
        }
      }),
      flush: vi.fn(() => Promise.resolve()),
      close: vi.fn(),
    }
    return instance
  })
  Constructor.isConfigSupported = vi.fn(async () => ({ supported: configSupported }))
  return Constructor
}

/**
 * AudioEncoder mock — isConfigSupported only (no real encode needed for audio).
 */
function makeAudioEncoderClass({ configSupported = true } = {}) {
  const Constructor = vi.fn()
  Constructor.isConfigSupported = vi.fn(async () => ({ supported: configSupported }))
  return Constructor
}

function makeVideoFrame() {
  return vi.fn(() => ({ close: vi.fn() }))
}

async function fresh({
  hasVideoEncoder = true,
  hasAudioEncoder = true,
  hasVideoFrame = true,
  videoOpts = {},
  audioOpts = {},
} = {}) {
  vi.resetModules()
  global.VideoFrame = hasVideoFrame ? makeVideoFrame() : undefined
  global.VideoEncoder = hasVideoEncoder ? makeVideoEncoderClass(videoOpts) : undefined
  global.AudioEncoder = hasAudioEncoder ? makeAudioEncoderClass(audioOpts) : undefined
  const { useBrowserSupport } = await import('../useBrowserSupport.js')
  return useBrowserSupport()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useBrowserSupport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('isWebCodecsSupported=false when VideoEncoder absent', async () => {
    const c = await fresh({ hasVideoEncoder: false })
    expect(c.isWebCodecsSupported.value).toBe(false)
  })

  it('isWebCodecsSupported=true when VideoEncoder present', async () => {
    const c = await fresh()
    expect(c.isWebCodecsSupported.value).toBe(true)
  })

  it('skips all checks when WebCodecs absent', async () => {
    const c = await fresh({ hasVideoEncoder: false })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
    expect(c.canExportWebM.value).toBe(false)
  })

  it('enables both formats when all codecs succeed (Chrome/Edge)', async () => {
    const c = await fresh({
      videoOpts: { configSupported: true, outputFires: true },
      audioOpts: { configSupported: true },
    })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(true)
    expect(c.canExportWebM.value).toBe(true)
  })

  it('disables MP4 when video isConfigSupported returns false', async () => {
    // VP9 succeeds, AVC fails config check → only WebM enabled
    const c = await fresh({
      videoOpts: { configSupported: false },
      audioOpts: { configSupported: true },
    })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
  })

  it('disables MP4 when AVC video encode fires error callback (Firefox scenario)', async () => {
    // isConfigSupported says true but actual encode fails — the key Firefox bug
    const c = await fresh({
      videoOpts: { configSupported: true, outputFires: false },
      audioOpts: { configSupported: true },
    })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
    expect(c.canExportWebM.value).toBe(false)
  })

  it('disables MP4 when AAC audio isConfigSupported returns false (Firefox scenario)', async () => {
    // Video probe passes but AAC audio is unsupported — catches the actual Firefox error
    const c = await fresh({
      videoOpts: { configSupported: true, outputFires: true },
      audioOpts: { configSupported: false },
    })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
    expect(c.canExportWebM.value).toBe(false)
  })

  it('handles missing AudioEncoder gracefully', async () => {
    const c = await fresh({
      hasAudioEncoder: false,
      videoOpts: { configSupported: true, outputFires: true },
    })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
    expect(c.canExportWebM.value).toBe(false)
  })

  it('returns false gracefully when VideoFrame is absent', async () => {
    const c = await fresh({ hasVideoFrame: false })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
    expect(c.canExportWebM.value).toBe(false)
  })

  it('resets isChecking to false after check completes', async () => {
    const c = await fresh({
      videoOpts: { configSupported: true, outputFires: true },
      audioOpts: { configSupported: true },
    })
    const p = c.checkCodecSupport()
    expect(c.isChecking.value).toBe(true)
    await p
    expect(c.isChecking.value).toBe(false)
  })
})
