import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('mediabunny', () => ({
  canEncodeVideo: vi.fn(),
}))

async function freshUseBrowserSupport(hasVideoEncoder = true) {
  vi.resetModules()
  global.VideoEncoder = hasVideoEncoder ? {} : undefined

  // Re-import after resetting modules so the mock is applied fresh
  const mediabunny = await import('mediabunny')
  const { useBrowserSupport } = await import('../useBrowserSupport.js')
  return { composable: useBrowserSupport(), mediabunny }
}

describe('useBrowserSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports isWebCodecsSupported=false when VideoEncoder is absent', async () => {
    const { composable } = await freshUseBrowserSupport(false)
    expect(composable.isWebCodecsSupported.value).toBe(false)
  })

  it('reports isWebCodecsSupported=true when VideoEncoder exists', async () => {
    const { composable } = await freshUseBrowserSupport(true)
    expect(composable.isWebCodecsSupported.value).toBe(true)
  })

  it('skips codec checks when WebCodecs is unsupported', async () => {
    const { composable, mediabunny } = await freshUseBrowserSupport(false)
    await composable.checkCodecSupport()
    expect(mediabunny.canEncodeVideo).not.toHaveBeenCalled()
    expect(composable.canExportMp4.value).toBe(false)
    expect(composable.canExportWebM.value).toBe(false)
  })

  it('sets canExportMp4 and canExportWebM when both codecs are available', async () => {
    const { composable, mediabunny } = await freshUseBrowserSupport(true)
    mediabunny.canEncodeVideo.mockResolvedValue(true)

    await composable.checkCodecSupport()

    expect(composable.canExportMp4.value).toBe(true)
    expect(composable.canExportWebM.value).toBe(true)
  })

  it('sets canExportMp4=false when avc is unavailable (e.g. Firefox)', async () => {
    const { composable, mediabunny } = await freshUseBrowserSupport(true)
    mediabunny.canEncodeVideo.mockImplementation((codec) =>
      Promise.resolve(codec === 'vp9')
    )

    await composable.checkCodecSupport()

    expect(composable.canExportMp4.value).toBe(false)
    expect(composable.canExportWebM.value).toBe(true)
  })

  it('handles canEncodeVideo rejecting gracefully', async () => {
    const { composable, mediabunny } = await freshUseBrowserSupport(true)
    mediabunny.canEncodeVideo.mockRejectedValue(new Error('not supported'))

    await composable.checkCodecSupport()

    expect(composable.canExportMp4.value).toBe(false)
    expect(composable.canExportWebM.value).toBe(false)
  })

  it('resets isChecking to false after check completes', async () => {
    const { composable, mediabunny } = await freshUseBrowserSupport(true)
    mediabunny.canEncodeVideo.mockResolvedValue(true)

    const p = composable.checkCodecSupport()
    expect(composable.isChecking.value).toBe(true)
    await p
    expect(composable.isChecking.value).toBe(false)
  })
})
