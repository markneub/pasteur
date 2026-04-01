import { describe, it, expect } from 'vitest'

// Mirror the SIZE_PRESETS from ExportControls.vue
const SIZE_PRESETS = [
  { label: '4K',    width: 3840, height: 2160 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '720p',  width: 1280, height: 720  },
  { label: '480p',  width: 854,  height: 480  },
]

function activeSizePreset(settings) {
  const match = SIZE_PRESETS.find(
    p => p.width === settings.width && p.height === settings.height
  )
  return match ? match.label : 'Custom'
}

describe('export settings', () => {
  it('recognises all size presets', () => {
    for (const preset of SIZE_PRESETS) {
      expect(activeSizePreset({ width: preset.width, height: preset.height })).toBe(preset.label)
    }
  })

  it('returns Custom for non-preset dimensions', () => {
    expect(activeSizePreset({ width: 1000, height: 500 })).toBe('Custom')
    expect(activeSizePreset({ width: 1920, height: 720 })).toBe('Custom')
  })

  it('default export settings match a known preset', () => {
    const defaults = { width: 1920, height: 1080, fps: 30, format: 'mp4' }
    expect(activeSizePreset(defaults)).toBe('1080p')
  })

  it('custom width/height clamped to minimum of 1', () => {
    const clamp = (val) => Math.max(1, parseInt(val) || 1)
    expect(clamp('0')).toBe(1)
    expect(clamp('-50')).toBe(1)
    expect(clamp('abc')).toBe(1)
    expect(clamp('1280')).toBe(1280)
  })
})
