import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Build a VideoEncoder constructor class mock.
 *
 * Each `new VideoEncoder({ output, error })` call creates its own encoder
 * instance with its own output/error callbacks captured from the constructor
 * args — no shared closure between instances.
 */
function makeVideoEncoderClass({ configSupported = true, outputFires = true } = {}) {
  const Constructor = vi.fn(function ({ output, error }) {
    // Each construction captures its own output/error — no shared state
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

function makeVideoFrame() {
  return vi.fn(() => ({ close: vi.fn() }))
}

async function fresh({ hasVideoEncoder = true, hasVideoFrame = true, encoderOpts = {} } = {}) {
  vi.resetModules()
  global.VideoFrame = hasVideoFrame ? makeVideoFrame() : undefined
  global.VideoEncoder = hasVideoEncoder ? makeVideoEncoderClass(encoderOpts) : undefined
  const { useBrowserSupport } = await import('../useBrowserSupport.js')
  return useBrowserSupport()
}

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

  it('skips all checks and leaves flags false when WebCodecs absent', async () => {
    const c = await fresh({ hasVideoEncoder: false })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
    expect(c.canExportWebM.value).toBe(false)
  })

  it('sets both true when encoding succeeds for both codecs (Chrome/Edge)', async () => {
    const c = await fresh({ encoderOpts: { configSupported: true, outputFires: true } })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(true)
    expect(c.canExportWebM.value).toBe(true)
  })

  it('returns false when isConfigSupported says unsupported (no encode attempted)', async () => {
    const c = await fresh({ encoderOpts: { configSupported: false } })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
    expect(c.canExportWebM.value).toBe(false)
  })

  it('returns false when isConfigSupported says supported but encoding fires error (Firefox/AVC scenario)', async () => {
    // isConfigSupported returns true but error callback fires — simulates Firefox
    // reporting AVC as config-supported but failing at actual encoding
    const c = await fresh({ encoderOpts: { configSupported: true, outputFires: false } })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
    expect(c.canExportWebM.value).toBe(false)
  })

  it('returns false gracefully when VideoFrame is absent', async () => {
    const c = await fresh({ hasVideoFrame: false, encoderOpts: { configSupported: true } })
    await c.checkCodecSupport()
    expect(c.canExportMp4.value).toBe(false)
    expect(c.canExportWebM.value).toBe(false)
  })

  it('resets isChecking to false after check completes', async () => {
    const c = await fresh({ encoderOpts: { configSupported: true, outputFires: true } })
    const p = c.checkCodecSupport()
    expect(c.isChecking.value).toBe(true)
    await p
    expect(c.isChecking.value).toBe(false)
  })
})
