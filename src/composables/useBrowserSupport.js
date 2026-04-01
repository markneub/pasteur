import { ref } from 'vue'

/**
 * Checks browser support for the specific codec pairs used for export.
 * Both the video AND audio codec must be supported for a format to be enabled.
 *
 * Call `checkCodecSupport()` once on app mount. All refs update reactively.
 *
 * - `isWebCodecsSupported` — false means WebCodecs API is entirely absent
 * - `canExportMp4`  — AVC video + AAC audio both available (Chrome/Edge; not Firefox)
 * - `canExportWebM` — VP9 video + Opus audio both available (Chrome/Firefox/Edge)
 *
 * Usage:
 *   const { checkCodecSupport, isWebCodecsSupported, canExportMp4, canExportWebM } = useBrowserSupport()
 *   onMounted(checkCodecSupport)
 */
export function useBrowserSupport() {
  const isWebCodecsSupported = ref(typeof globalThis.VideoEncoder !== 'undefined')
  const canExportMp4 = ref(false)
  const canExportWebM = ref(false)
  const isChecking = ref(false)

  /**
   * Probes video codec support by actually encoding a tiny frame.
   * `isConfigSupported()` alone is unreliable — Firefox reports AVC as
   * config-supported but fails at encode time.
   */
  async function probeVideoCodec(codec) {
    if (!globalThis.VideoEncoder || !globalThis.VideoFrame) return false
    try {
      const config = { codec, width: 64, height: 64, bitrate: 500_000, framerate: 30 }
      const configCheck = await globalThis.VideoEncoder.isConfigSupported(config)
      if (configCheck.supported !== true) return false

      return await new Promise((resolve) => {
        let settled = false
        const settle = (ok) => {
          if (settled) return
          settled = true
          try { encoder.close() } catch { /* ignore */ }
          resolve(ok)
        }

        const encoder = new globalThis.VideoEncoder({
          output: () => settle(true),
          error: () => settle(false),
        })

        try {
          encoder.configure(config)
          const frame = new globalThis.VideoFrame(
            new Uint8Array(64 * 64 * 4), // blank RGBA frame
            { format: 'RGBA', codedWidth: 64, codedHeight: 64, timestamp: 0 },
          )
          encoder.encode(frame, { keyFrame: true })
          frame.close()
          encoder.flush().catch(() => settle(false))
        } catch {
          settle(false)
        }
      })
    } catch {
      return false
    }
  }

  /**
   * Probes audio codec support via AudioEncoder.isConfigSupported().
   * Firefox correctly reports AAC as unsupported, so isConfigSupported is
   * sufficient here (no real encode needed).
   */
  async function probeAudioCodec(codec) {
    if (!globalThis.AudioEncoder) return false
    try {
      const result = await globalThis.AudioEncoder.isConfigSupported({
        codec,
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 192_000,
      })
      return result.supported === true
    } catch {
      return false
    }
  }

  async function checkCodecSupport() {
    if (!isWebCodecsSupported.value) return

    isChecking.value = true
    try {
      const [avcOk, aacOk, vp9Ok, opusOk] = await Promise.all([
        probeVideoCodec('avc1.42001f'),   // H.264 video — Chrome/Edge yes, Firefox no
        probeAudioCodec('mp4a.40.2'),     // AAC audio   — Chrome/Edge yes, Firefox no
        probeVideoCodec('vp09.00.10.08'), // VP9 video   — Chrome/Firefox/Edge yes
        probeAudioCodec('opus'),          // Opus audio  — Chrome/Firefox/Edge yes
      ])
      canExportMp4.value = avcOk && aacOk
      canExportWebM.value = vp9Ok && opusOk
    } finally {
      isChecking.value = false
    }
  }

  return {
    checkCodecSupport,
    isWebCodecsSupported,
    canExportMp4,
    canExportWebM,
    isChecking,
  }
}
