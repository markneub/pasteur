import { describe, it, expect } from 'vitest'
import { useWaveform } from '../useWaveform.js'

function makeAudioBuffer({ channels, samples, fillFn }) {
  const channelData = Array.from({ length: channels }, (_, ch) => {
    const arr = new Float32Array(samples)
    for (let i = 0; i < samples; i++) arr[i] = fillFn(ch, i)
    return arr
  })
  return {
    length: samples,
    numberOfChannels: channels,
    getChannelData: (ch) => channelData[ch],
  }
}

describe('useWaveform', () => {
  it('peaks starts as null', () => {
    const { peaks } = useWaveform()
    expect(peaks.value).toBeNull()
  })

  it('produces a Float32Array of the requested resolution', () => {
    const { peaks, computePeaks } = useWaveform()
    const buf = makeAudioBuffer({ channels: 1, samples: 44100, fillFn: () => 0.5 })
    computePeaks(buf, 100)
    expect(peaks.value).toBeInstanceOf(Float32Array)
    expect(peaks.value.length).toBe(100)
  })

  it('all values are between 0 and 1', () => {
    const { peaks, computePeaks } = useWaveform()
    const buf = makeAudioBuffer({ channels: 2, samples: 8820, fillFn: (ch, i) => Math.sin(i * 0.1) })
    computePeaks(buf, 60)
    for (const v of peaks.value) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('peak equals max abs value across channels in each bucket', () => {
    // Channel 0: always 0.3, Channel 1: always 0.7
    const { peaks, computePeaks } = useWaveform()
    const buf = makeAudioBuffer({
      channels: 2,
      samples: 100,
      fillFn: (ch) => ch === 0 ? 0.3 : 0.7,
    })
    computePeaks(buf, 10) // 10 buckets of 10 samples each
    for (const v of peaks.value) {
      expect(v).toBeCloseTo(0.7, 5)
    }
  })

  it('negative samples are treated as absolute values', () => {
    const { peaks, computePeaks } = useWaveform()
    const buf = makeAudioBuffer({ channels: 1, samples: 50, fillFn: () => -0.9 })
    computePeaks(buf, 5)
    for (const v of peaks.value) {
      expect(v).toBeCloseTo(0.9, 5)
    }
  })

  it('silent audio produces all-zero peaks', () => {
    const { peaks, computePeaks } = useWaveform()
    const buf = makeAudioBuffer({ channels: 1, samples: 200, fillFn: () => 0 })
    computePeaks(buf, 20)
    for (const v of peaks.value) {
      expect(v).toBe(0)
    }
  })

  it('handles resolution larger than sample count gracefully', () => {
    const { peaks, computePeaks } = useWaveform()
    const buf = makeAudioBuffer({ channels: 1, samples: 10, fillFn: () => 0.5 })
    // resolution > samples — buckets at the end will be empty (peak = 0)
    computePeaks(buf, 50)
    expect(peaks.value.length).toBe(50)
    // First 10 buckets should have a peak, rest should be 0
    for (let i = 0; i < 10; i++) expect(peaks.value[i]).toBeCloseTo(0.5, 5)
    for (let i = 10; i < 50; i++) expect(peaks.value[i]).toBe(0)
  })
})
