import { useCallback, useEffect, useRef, useState } from 'react'

const KEY = 'foodstack-kitchen-sound'

function readStored(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext }

/** Short two-tone chime for new tickets. The AudioContext is created on the toggle click. */
export function useKitchenSound() {
  const [enabled, setEnabled] = useState(readStored)
  const context = useRef<AudioContext | null>(null)

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current
      try {
        window.localStorage.setItem(KEY, next ? '1' : '0')
      } catch {
        /* the choice just won't persist */
      }
      if (next && !context.current) {
        const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext
        context.current = Ctor ? new Ctor() : null
      }
      return next
    })
  }, [])

  // The context may not exist after a reload with the preference already on; the first
  // toggle click (a user gesture) recreates it.
  useEffect(() => () => void context.current?.close?.(), [])

  const chime = useCallback(() => {
    const audio = context.current
    if (!enabled || !audio) return
    const start = audio.currentTime
    for (const [index, frequency] of [880, 1320].entries()) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + index * 0.14)
      gain.gain.exponentialRampToValueAtTime(0.2, start + index * 0.14 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.14 + 0.2)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(start + index * 0.14)
      oscillator.stop(start + index * 0.14 + 0.22)
    }
  }, [enabled])

  return { enabled, toggle, chime }
}
