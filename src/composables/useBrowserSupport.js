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

  async function probeCodec(codec) {
    try {
      const result = await globalThis.VideoEncoder.isConfigSupported({
        codec,
        width: 1280,
        height: 720,
        bitrate: 4_000_000,
        framerate: 30,
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
      const [mp4Ok, webmOk] = await Promise.all([
        probeCodec('avc1.42001f'), // H.264 Baseline Level 3.1 — unsupported in Firefox
        probeCodec('vp09.00.10.08'), // VP9 Profile 0
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
