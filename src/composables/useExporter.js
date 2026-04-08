import { ref } from 'vue'
import butterchurn from 'butterchurn'
import {
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
} from 'mediabunny'
import { useAudioAnalysis } from './useAudioAnalysis.js'
import { getPreset } from '../utils/presets.js'

/**
 * Manages the non-realtime export pipeline:
 *   1. Pre-analyze audio PCM → per-frame FFT data (via useAudioAnalysis Web Worker)
 *   2. Create hidden canvas + butterchurn visualizer
 *   3. Monkey-patch the internal AnalyserNode to feed pre-computed frame data
 *   4. Tight render loop: render() → canvasSource.add() per frame
 *   5. mediabunny Output → finalize → Blob download
 *
 * Exposes two-phase progress: `analysisProgress` (0-1) during analysis,
 * `renderProgress` (0-1) during rendering. Use `exportPhase` to know which.
 *
 * Usage:
 *   const { startExport, cancel, isExporting, exportPhase, analysisProgress, renderProgress, exportError } = useExporter()
 *   await startExport({ audioBuffer, audioContext, presetTimeline, exportSettings })
 */
export function useExporter() {
  const isExporting = ref(false)
  const exportPhase = ref(null) // 'analyzing' | 'rendering' | null
  const renderProgress = ref(0)
  const exportError = ref(null)
  // JPEG data URL of the most recently rendered export frame (null when not exporting)
  const exportPreviewUrl = ref(null)

  let cancelled = false
  let activeOutput = null

  const {
    analyze,
    frameData,
    progress: analysisProgress,
    reset: resetAnalysis,
  } = useAudioAnalysis()

  /**
   * @param {object} params
   * @param {AudioBuffer} params.audioBuffer
   * @param {AudioContext} params.audioContext
   * @param {Array<{presetName: string, startTime: number, transitionDuration: number}>} params.presetTimeline
   * @param {{width: number, height: number, fps: number, format: 'mp4'|'webm'}} params.exportSettings
   * @param {number} [params.clipStart=0] Start of the clip region in seconds
   * @param {number|null} [params.clipEnd=null] End of the clip region (null = full duration)
   * @param {string} [params.titleText=''] Title text to display at the start via butterchurn
   * @param {boolean} [params.showTitle=false] Whether to show the title text
   * @param {{duration?: number, fontFamily?: string, fontStyle?: string}} [params.titleOptions={}] Title display options
   */
  async function startExport({ audioBuffer, audioContext, presetTimeline, exportSettings, clipStart = 0, clipEnd = null, titleText = '', showTitle = false, titleOptions = {} }) {
    if (isExporting.value) return

    cancelled = false
    activeOutput = null
    isExporting.value = true
    exportError.value = null
    renderProgress.value = 0
    exportPhase.value = 'analyzing'
    resetAnalysis()

    let hiddenCanvas = null
    let visualizer = null

    try {
      const clipEnd_ = clipEnd ?? audioBuffer.duration
      const clipDuration = clipEnd_ - clipStart

      // ── Phase 1: Audio pre-analysis ─────────────────────────────────────
      await analyze(audioBuffer, exportSettings.fps, 1024, clipStart, clipEnd_)
      if (cancelled) return

      // ── Phase 2: Rendering ───────────────────────────────────────────────
      exportPhase.value = 'rendering'
      renderProgress.value = 0

      const { width, height, fps, format } = exportSettings
      const totalFrames = Math.ceil(clipDuration * fps)
      if (totalFrames === 0) {
        throw new Error('Audio duration is too short to export any frames.')
      }
      const frameDuration = 1 / fps
      const fd = frameData.value

      // Hidden canvas must be in the DOM for WebGL context creation
      hiddenCanvas = document.createElement('canvas')
      hiddenCanvas.width = width
      hiddenCanvas.height = height
      hiddenCanvas.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;pointer-events:none;visibility:hidden'
      document.body.appendChild(hiddenCanvas)

      // Create a separate butterchurn instance for export
      visualizer = butterchurn.createVisualizer(audioContext, hiddenCanvas, {
        width,
        height,
        pixelRatio: 1,
      })

      // Load the active preset at clipStart instantly (blendTime=0).
      // This is the last cue whose startTime <= clipStart, falling back to cue[0].
      const activeAtClipStart = [...presetTimeline]
        .filter((c) => c.startTime <= clipStart)
        .at(-1) ?? presetTimeline[0]
      if (activeAtClipStart) {
        const preset = getPreset(activeAtClipStart.presetName)
        if (preset) visualizer.loadPreset(preset, 0)
      }

      // Connect a silent GainNode so butterchurn creates its internal AnalyserNode
      const dummyGain = audioContext.createGain()
      dummyGain.gain.value = 0
      visualizer.connectAudio(dummyGain)

      // Monkey-patch the internal AnalyserNode to return pre-computed frame data
      let currentFrame = 0
      const analyser = visualizer.audio?.analyser
      if (analyser) {
        analyser.getByteTimeDomainData = (arr) => {
          const src = fd[currentFrame]?.timeDomain
          if (src) arr.set(src.subarray(0, arr.length))
        }
        analyser.getByteFrequencyData = (arr) => {
          const src = fd[currentFrame]?.frequency
          if (src) arr.set(src.subarray(0, arr.length))
        }
      }

      // ── mediabunny Output setup ──────────────────────────────────────────
      const isWebM = format === 'webm'
      const target = new BufferTarget()
      const output = new Output({
        format: isWebM ? new WebMOutputFormat() : new Mp4OutputFormat(),
        target,
      })
      activeOutput = output

      const canvasSource = new CanvasSource(hiddenCanvas, {
        codec: isWebM ? 'vp9' : 'avc',
        bitrate: 8_000_000,
        keyFrameInterval: 2,
        latencyMode: 'quality',
      })

      const audioSource = new AudioBufferSource({
        codec: isWebM ? 'opus' : 'aac',
        bitrate: 192_000,
      })

      output.addVideoTrack(canvasSource, { frameRate: fps })
      output.addAudioTrack(audioSource)

      await output.start()

      // Build a trimmed AudioBuffer for the clip region so the audio track
      // matches the video duration exactly.
      const startSample = Math.round(clipStart * audioBuffer.sampleRate)
      const endSample = Math.round(clipEnd_ * audioBuffer.sampleRate)
      const trimmedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        endSample - startSample,
        audioBuffer.sampleRate
      )
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        trimmedBuffer.copyToChannel(
          audioBuffer.getChannelData(ch).subarray(startSample, endSample),
          ch
        )
      }
      await audioSource.add(trimmedBuffer)
      audioSource.close()

      if (cancelled) {
        await output.cancel()
        return
      }

      // Build sorted list of future preset cues that fall within the clip.
      // startFrame is relative to clipStart (frame 0 = clipStart seconds).
      const frameOffset = Math.round(clipStart * fps)
      const futureCues = presetTimeline
        .slice(1)
        .map((cue) => ({ ...cue, startFrame: Math.round(cue.startTime * fps) - frameOffset }))
        .filter((cue) => cue.startFrame >= 0 && cue.startFrame < totalFrames)
        .sort((a, b) => a.startFrame - b.startFrame)

      // Fire title animation at frame 0 if requested
      if (showTitle && titleText) {
        visualizer.launchSongTitleAnim(titleText, titleOptions)
      }

      // ── Non-realtime render loop ─────────────────────────────────────────
      for (let i = 0; i < totalFrames && !cancelled; i++) {
        currentFrame = i

        // Fire preset cues whose start frame matches the current frame
        for (const cue of futureCues) {
          if (cue.startFrame === i) {
            const preset = getPreset(cue.presetName)
            if (preset) visualizer.loadPreset(preset, cue.transitionDuration)
          }
        }

        try {
          visualizer.render()
          // Capture a preview frame every ~500ms of video time
          const previewInterval = Math.max(1, Math.round(fps * 0.5))
          if (i % previewInterval === 0) {
            try { exportPreviewUrl.value = hiddenCanvas.toDataURL('image/jpeg', 0.7) } catch { /* ignore */ }
          }
        } catch (renderErr) {
          const msg = renderErr?.message ?? ''
          if (
            msg.toLowerCase().includes('out of memory') ||
            msg.toLowerCase().includes('context lost') ||
            renderErr?.name === 'WEBGL_lose_context'
          ) {
            throw new Error(
              'GPU ran out of memory. Try a smaller resolution (e.g. 1080p instead of 4K).'
            )
          }
          throw renderErr
        }

        // Backpressure: wait if the encoder queue is getting too deep
        // canvasSource exposes encodeQueueSize via its internal encoder
        if (canvasSource.encodeQueueSize > 10) {
          await new Promise((r) => setTimeout(r, 0))
        }

        try {
          await canvasSource.add(i * frameDuration, frameDuration)
        } catch (encErr) {
          const msg = encErr?.message ?? ''
          if (
            msg.toLowerCase().includes('out of memory') ||
            encErr?.name === 'EncodingError'
          ) {
            throw new Error(
              'Encoder ran out of memory. Try a smaller resolution or lower frame rate.'
            )
          }
          throw encErr
        }

        renderProgress.value = (i + 1) / totalFrames

        // Yield to the browser every 10 frames to keep the UI responsive
        if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0))
      }

      if (cancelled) {
        await output.cancel()
        return
      }

      canvasSource.close()
      await output.finalize()

      // ── Trigger download ─────────────────────────────────────────────────
      const blob = new Blob([target.buffer], {
        type: isWebM ? 'video/webm' : 'video/mp4',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pasteur-export.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      if (!cancelled) {
        exportError.value = err.message
      }
      if (activeOutput) {
        try { await activeOutput.cancel() } catch { /* already finalized or never started */ }
      }
    } finally {
      if (hiddenCanvas?.parentNode) {
        hiddenCanvas.parentNode.removeChild(hiddenCanvas)
      }
      // Nullify to allow GC of WebGL context and butterchurn instance
      visualizer = null
      hiddenCanvas = null
      isExporting.value = false
      exportPhase.value = null
      activeOutput = null
      exportPreviewUrl.value = null
    }
  }

  async function cancel() {
    if (!isExporting.value) return
    cancelled = true
    if (activeOutput) {
      try { await activeOutput.cancel() } catch { /* ignore */ }
    }
  }

  return {
    startExport,
    cancel,
    isExporting,
    exportPhase,
    analysisProgress,
    renderProgress,
    exportError,
    exportPreviewUrl,
  }
}
