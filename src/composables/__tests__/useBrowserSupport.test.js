import { describe, it, expect, vi, beforeEach } from 'vitest'

// We mock VideoEncoder.isConfigSupported directly — no mediabunny dependency
function makeVideoEncoder(supportedCodecs = []) {
  return {
    isConfigSupported: vi.fn(async ({ codec }) => ({
      supported: supportedCodecs.some((c) => codec.startsWith(c)),
    })),
  }
}

async function freshUseBrowserSupport(hasVideoEncoder = true, supportedCodecs = []) {
  vi.resetModules()
  global.VideoEncoder = hasVideoEncoder ? makeVideoEncoder(supportedCodecs) : undefined

  const { useBrowserSupport } = await import('../useBrowserSupport.js')
  return useBrowserSupport()
}

describe('useBrowserSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports isWebCodecsSupported=false when VideoEncoder is absent', async () => {
    const composable = await freshUseBrowserSupport(false)
    expect(composable.isWebCodecsSupported.value).toBe(false)
  })

  it('reports isWebCodecsSupported=true when VideoEncoder exists', async () => {
    const composable = await freshUseBrowserSupport(true)
    expect(composable.isWebCodecsSupported.value).toBe(true)
  })

  it('skips codec checks when WebCodecs is unsupported', async () => {
    const composable = await freshUseBrowserSupport(false)
    await composable.checkCodecSupport()
    expect(composable.canExportMp4.value).toBe(false)
    expect(composable.canExportWebM.value).toBe(false)
  })

  it('sets both true when avc1 and vp09 are supported (Chrome/Edge)', async () => {
    const composable = await freshUseBrowserSupport(true, ['avc1', 'vp09'])
    await composable.checkCodecSupport()
    expect(composable.canExportMp4.value).toBe(true)
    expect(composable.canExportWebM.value).toBe(true)
  })

  it('sets canExportMp4=false when only vp09 is supported (Firefox)', async () => {
    const composable = await freshUseBrowserSupport(true, ['vp09'])
    await composable.checkCodecSupport()
    expect(composable.canExportMp4.value).toBe(false)
    expect(composable.canExportWebM.value).toBe(true)
  })

  it('handles isConfigSupported throwing gracefully', async () => {
    global.VideoEncoder = {
      isConfigSupported: vi.fn().mockRejectedValue(new Error('not supported')),
    }
    vi.resetModules()
    const { useBrowserSupport } = await import('../useBrowserSupport.js')
    const composable = useBrowserSupport()
    await composable.checkCodecSupport()
    expect(composable.canExportMp4.value).toBe(false)
    expect(composable.canExportWebM.value).toBe(false)
  })

  it('resets isChecking to false after check completes', async () => {
    const composable = await freshUseBrowserSupport(true, ['avc1', 'vp09'])
    const p = composable.checkCodecSupport()
    expect(composable.isChecking.value).toBe(true)
    await p
    expect(composable.isChecking.value).toBe(false)
  })
})
