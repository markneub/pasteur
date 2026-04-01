import { ref, shallowRef } from 'vue'
import butterchurn from 'butterchurn'
import isButterchurnSupported from 'butterchurn/lib/isSupported.min'

/**
 * Manages a butterchurn visualizer instance on a canvas element.
 *
 * The visualizer renders into the provided canvas via WebGL2.
 * Call init() once with the canvas and AudioContext, then connectAudio()
 * to link a source node. The render loop runs via requestAnimationFrame.
 *
 * The internal AnalyserNode is exposed as `analyserNode` so the export
 * pipeline can monkey-patch it for non-realtime rendering.
 */
export function useButterchurn() {
  const isSupported = isButterchurnSupported()
  const visualizer = shallowRef(null)
  const isInitialized = ref(false)

  let animFrameId = null
  let canvasEl = null

  function init(canvas, audioContext, { width, height } = {}) {
    if (!isSupported) return

    canvasEl = canvas
    const w = width ?? 800
    const h = height ?? 450

    // butterchurn never sets canvas.width/canvas.height itself — it reads the
    // GL framebuffer size from whatever the canvas already has when the WebGL
    // context is created. We must set them explicitly so the framebuffer matches
    // the dimensions we pass to createVisualizer.
    canvas.width = w
    canvas.height = h

    visualizer.value = butterchurn.createVisualizer(audioContext, canvas, {
      width: w,
      height: h,
      pixelRatio: 1,
    })

    isInitialized.value = true
  }

  function connectAudio(audioNode) {
    visualizer.value?.connectAudio(audioNode)
  }

  function disconnectAudio(audioNode) {
    visualizer.value?.disconnectAudio(audioNode)
  }

  function loadPreset(preset, blendTime = 1.5) {
    visualizer.value?.loadPreset(preset, blendTime)
  }

  function setSize(width, height) {
    if (!canvasEl || !visualizer.value) return
    canvasEl.width = width
    canvasEl.height = height
    visualizer.value.setRendererSize(width, height)
  }

  function startRenderLoop() {
    if (!visualizer.value) return
    stopRenderLoop()

    function loop() {
      visualizer.value?.render()
      animFrameId = requestAnimationFrame(loop)
    }
    animFrameId = requestAnimationFrame(loop)
  }

  function stopRenderLoop() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
  }

  /**
   * The internal AnalyserNode butterchurn reads each frame.
   * Exposed so the export pipeline can override getByteTimeDomainData /
   * getByteFrequencyData for non-realtime rendering.
   */
  function getAnalyserNode() {
    return visualizer.value?.audio?.analyser ?? null
  }

  function dispose() {
    stopRenderLoop()
    if (visualizer.value) {
      // Clear the canvas
      if (canvasEl) {
        const gl = canvasEl.getContext('webgl2')
        if (gl) gl.clear(gl.COLOR_BUFFER_BIT)
      }
      visualizer.value = null
    }
    isInitialized.value = false
    canvasEl = null
  }

  return {
    isSupported,
    isInitialized,
    init,
    connectAudio,
    disconnectAudio,
    loadPreset,
    setSize,
    startRenderLoop,
    stopRenderLoop,
    getAnalyserNode,
    dispose,
  }
}
