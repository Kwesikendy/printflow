'use client'

// Base64 encoded extremely tiny, subtle UI sounds.
// These allow us to have sound without external assets.
// Note: In a real app these would be better as small mp3s, but for self-contained MVP this is great.

const SOUNDS = {
  // A very soft, high quality click/tick
  click: 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
  // A gentle pop
  pop: 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
  // A soft pleasant chime/success
  success: 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
}

export type SoundType = keyof typeof SOUNDS

// We keep a registry of audio objects to reuse them and avoid spamming
const audioCache: Partial<Record<SoundType, HTMLAudioElement>> = {}

export function playSound(type: SoundType, volume: number = 0.2) {
  // Only play on client
  if (typeof window === 'undefined') return

  try {
    if (!audioCache[type]) {
      audioCache[type] = new Audio(SOUNDS[type])
    }
    
    const audio = audioCache[type]!
    
    // If it's already playing, reset to start to allow rapid clicking
    if (!audio.paused) {
      audio.currentTime = 0
    }
    
    audio.volume = volume
    
    // Play might fail if user hasn't interacted with document yet (browser policy)
    audio.play().catch(e => {
      // Ignore autoplay prevention errors, totally normal.
    })
  } catch (error) {
    // Failsafe for older browsers
    console.warn('Sound playback failed', error)
  }
}
