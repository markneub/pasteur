import { ref } from 'vue'
import { canEncodeVideo } from 'mediabunny'

/**
 * Checks browser support for WebCodecs and the specific codecs used for export.
 *
 * Call `checkCodecSupport()` once on app mount. All refs update reactively.
 *
 * - `isWebCodecsSupported` — false means WebCodecs API is entirely absent (e.g. Safari < 16)
 * - `canExportMp4`  — true when AVC (H.264) encoding is available (Chrome/Edge; not Firefox)
 * - `canExportWebM` — true when VP9 encoding is available (Chrome/Firefox/Edge)
 *
 * Usage:
 *   const { checkCodecSupport, isWebCodecsSupported, canExportMp4, canExportWebM } = useBrowserSupport()
 *   onMounted(checkCodecSupport)
 */
export function useBrowserSupport() {
  const isWebCodecsSupported = ref(typeof VideoEncoder !== 'undefined')
  const canExportMp4 = ref(false)
  const canExportWebM = ref(false)
  const isChecking = ref(false)

  async function checkCodecSupport() {
    if (!isWebCodecsSupported.value) return

    isChecking.value = true
    try {
      const [mp4Ok, webmOk] = await Promise.all([
        canEncodeVideo('avc').catch(() => false),
        canEncodeVideo('vp9').catch(() => false),
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
