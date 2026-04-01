import { describe, it, expect } from 'vitest'
import { presetNames, getPreset, DEFAULT_PRESET_NAME, createPresetCue } from '../presets.js'

describe('presets', () => {
  it('exports a non-empty sorted list of preset names', () => {
    expect(presetNames.length).toBeGreaterThan(0)
    for (let i = 1; i < presetNames.length; i++) {
      expect(presetNames[i] >= presetNames[i - 1]).toBe(true)
    }
  })

  it('getPreset returns an object for a valid name', () => {
    const preset = getPreset(presetNames[0])
    expect(preset).toBeTruthy()
    expect(typeof preset).toBe('object')
  })

  it('getPreset returns null for an unknown name', () => {
    expect(getPreset('__not_a_real_preset__')).toBeNull()
  })

  it('DEFAULT_PRESET_NAME is in the preset list', () => {
    expect(presetNames).toContain(DEFAULT_PRESET_NAME)
  })

  it('createPresetCue returns correct defaults', () => {
    const cue = createPresetCue()
    expect(cue.presetName).toBe(DEFAULT_PRESET_NAME)
    expect(cue.startTime).toBe(0)
    expect(cue.transitionDuration).toBe(1.5)
  })

  it('createPresetCue accepts custom values', () => {
    const cue = createPresetCue('MyPreset', 30, 2.0)
    expect(cue.presetName).toBe('MyPreset')
    expect(cue.startTime).toBe(30)
    expect(cue.transitionDuration).toBe(2.0)
  })
})
