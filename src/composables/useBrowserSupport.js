import { ref } from 'vue'

/**
 * Checks browser support for WebCodecs and the specific codecs used for export.
 *
 * Call `checkCodecSupport()` once on app mount. All refs update reactively.
 *
 * - `isWebCodecsSupported` — false means WebCodecs API is entirely absent (e.g. Safari < 16)
 * - `canExportMp4`  — true when AVC (H.264) encoding is available (Chrome/Edge; not Firefox)
 * - `canExportWebM` — true when VP9 encoding is available (Chrome/Firefox/Edge)
 *
 * Uses VideoEncoder.isConfigSupported() directly for accurate per-browser results.
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
   * Probes real encoding support by actually encoding a tiny frame.
   * `VideoEncoder.isConfigSupported()` alone is unreliable — some browsers
   * (e.g. Firefox for AVC) report supported=true but fail at encode time.
   */
  async function probeCodec(codec) {
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

  async function checkCodecSupport() {
    if (!isWebCodecsSupported.value) return

    isChecking.value = true
    try {
      const [mp4Ok, webmOk] = await Promise.all([
        probeCodec('avc1.42001f'),   // H.264 Baseline — Chrome/Edge yes, Firefox no
        probeCodec('vp09.00.10.08'), // VP9 — Chrome/Firefox/Edge yes
      ])
      canExportMp4.value = mp4Ok
      canExportWebM.value = webmOk
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
