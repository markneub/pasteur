import { describe, it, expect } from 'vitest'

// Extracted validation logic — mirrors DropZone.vue
const ACCEPTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
]
const ACCEPTED_EXTENSIONS = /\.(mp3|wav|flac|aac|ogg|m4a|mp4)$/i

function isAudioFile(file) {
  if (file.type) return ACCEPTED_MIME_TYPES.includes(file.type)
  return ACCEPTED_EXTENSIONS.test(file.name)
}

describe('isAudioFile', () => {
  it('accepts known MIME types', () => {
    expect(isAudioFile({ type: 'audio/mpeg', name: 'track.mp3' })).toBe(true)
    expect(isAudioFile({ type: 'audio/wav', name: 'track.wav' })).toBe(true)
    expect(isAudioFile({ type: 'audio/flac', name: 'track.flac' })).toBe(true)
    expect(isAudioFile({ type: 'audio/ogg', name: 'track.ogg' })).toBe(true)
    expect(isAudioFile({ type: 'audio/aac', name: 'track.aac' })).toBe(true)
    expect(isAudioFile({ type: 'audio/x-m4a', name: 'track.m4a' })).toBe(true)
  })

  it('accepts by extension when MIME type is missing', () => {
    expect(isAudioFile({ type: '', name: 'track.mp3' })).toBe(true)
    expect(isAudioFile({ type: '', name: 'track.FLAC' })).toBe(true)
    expect(isAudioFile({ type: '', name: 'track.M4A' })).toBe(true)
  })

  it('rejects non-audio MIME types', () => {
    expect(isAudioFile({ type: 'video/mp4', name: 'video.mp4' })).toBe(false)
    expect(isAudioFile({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(false)
    expect(isAudioFile({ type: 'application/pdf', name: 'doc.pdf' })).toBe(false)
  })

  it('rejects unknown extensions with no MIME type', () => {
    expect(isAudioFile({ type: '', name: 'doc.pdf' })).toBe(false)
    expect(isAudioFile({ type: '', name: 'image.png' })).toBe(false)
  })
})
