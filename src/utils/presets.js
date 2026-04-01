import butterchurnPresets from 'butterchurn-presets'

const allPresets = butterchurnPresets.getPresets()

/** Sorted list of all preset names. */
export const presetNames = Object.keys(allPresets).sort()

/** Look up a preset object by name. Returns null if not found. */
export function getPreset(name) {
  return allPresets[name] ?? null
}

/** The default preset name used on first load. */
export const DEFAULT_PRESET_NAME = presetNames[0]

/**
 * A PresetCue describes when a preset starts and how long the blend takes.
 * The presetTimeline is an array of these, sorted by startTime.
 *
 * v1: single cue at t=0. Architecture supports multiple cues in the future.
 *
 * @typedef {{ presetName: string, startTime: number, transitionDuration: number }} PresetCue
 */

/** Create a new PresetCue with sensible defaults. */
export function createPresetCue(presetName = DEFAULT_PRESET_NAME, startTime = 0, transitionDuration = 1.5) {
  return { presetName, startTime, transitionDuration }
}
