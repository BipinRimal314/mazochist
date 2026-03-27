let audioCtx = null

function getAudioContext() {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playSound(type) {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  switch (type) {
    case 'fart': {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(120, now)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.4)
      break
    }
    case 'victory': {
      const notes = [523, 659, 784, 1047]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.2, now + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now + i * 0.12)
        osc.stop(now + i * 0.12 + 0.3)
      })
      break
    }
    case 'fail': {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.5)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.5)
      break
    }
    case 'teleport': {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.exponentialRampToValueAtTime(2000, now + 0.15)
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.3)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.3)
      break
    }
    case 'death': {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.3)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.3)
      break
    }
  }
}

export { playSound }
