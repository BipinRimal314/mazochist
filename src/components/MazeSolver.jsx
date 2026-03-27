import { useState, useRef, useEffect } from 'react'
import { decodeFromHash } from '../utils/serialize'
import { drawMaze, drawBall } from '../engine/renderer'
import { createBallState, updateBall, checkModifierTrigger, checkWin, getAnimatedGrid } from '../engine/physics'
import { applyModifierEffect, renderModifierOverlay } from '../engine/modifiers'
import { playSound } from '../engine/sound'

const CELL_SIZE = 30

const DEATH_QUIPS = [
  'almost!', 'so close!', 'oof.', 'not quite.', 'try again!',
  'the maze believes in you.', 'that was rude of the maze.', 'breathe.',
  'you got this.', 'it gets easier. (it doesn\'t.)', 'the maze is rooting for you.',
  'pain is just progress with extra steps.', 'that one hurt.', 'still here? respect.',
  'the ball forgives you.', 'we don\'t talk about that one.',
]

function MazeSolver({ levelGrid, levelNumber, onBack, onNextLevel }) {
  const [grid] = useState(() => {
    if (levelGrid) return levelGrid
    const hash = window.location.hash.slice(1)
    return decodeFromHash(hash)
  })

  const [state, setState] = useState(() => {
    const fakeExits = grid.cells
      .filter((c) => c.modifier === 'fakeExit')
      .map((c) => `${c.x},${c.y}`)
    return {
      ball: createBallState(grid, CELL_SIZE),
      startTime: Date.now(),
      won: false,
      psycheUntil: 0,
      fakeExitsTotal: fakeExits.length,
      fakeExitsCollected: new Set(),
      exitUnlocked: fakeExits.length === 0,
      lastQuip: '',
    }
  })

  const canvasRef = useRef(null)
  const inputRef = useRef({ up: false, down: false, left: false, right: false })
  const lastTriggerRef = useRef(null)
  const animFrameRef = useRef(null)
  const prevDeathsRef = useRef(0)

  // track deaths for quips
  useEffect(() => {
    if (state.ball.deaths > prevDeathsRef.current) {
      const quip = DEATH_QUIPS[state.ball.deaths % DEATH_QUIPS.length]
      setState((s) => ({ ...s, lastQuip: quip }))
      prevDeathsRef.current = state.ball.deaths
    }
  }, [state.ball.deaths])

  useEffect(() => {
    const keyMap = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
    }
    const onDown = (e) => {
      const dir = keyMap[e.key]
      if (dir) { inputRef.current[dir] = true; e.preventDefault() }
    }
    const onUp = (e) => {
      const dir = keyMap[e.key]
      if (dir) inputRef.current[dir] = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  useEffect(() => {
    let touchStartX = 0
    let touchStartY = 0
    const onTouchStart = (e) => {
      const touch = e.touches[0]
      touchStartX = touch.clientX
      touchStartY = touch.clientY
    }
    const onTouchMove = (e) => {
      e.preventDefault()
      const touch = e.touches[0]
      const dx = touch.clientX - touchStartX
      const dy = touch.clientY - touchStartY
      const threshold = 5
      inputRef.current = {
        up: dy < -threshold, down: dy > threshold,
        left: dx < -threshold, right: dx > threshold,
      }
    }
    const onTouchEnd = () => {
      inputRef.current = { up: false, down: false, left: false, right: false }
    }
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  useEffect(() => {
    if (state.won) return
    const id = setInterval(() => setState((s) => ({ ...s })), 1000)
    return () => clearInterval(id)
  }, [state.won])

  useEffect(() => {
    if (state.won) return
    const loop = () => {
      const now = Date.now()
      setState((prev) => {
        if (prev.won) return prev
        const animatedGrid = getAnimatedGrid(grid, now)
        let ball = updateBall(prev.ball, inputRef.current, animatedGrid, CELL_SIZE, now)
        const trigger = checkModifierTrigger(ball, animatedGrid, CELL_SIZE)
        const triggerKey = trigger ? `${trigger.cellX},${trigger.cellY}` : null
        if (trigger && triggerKey !== lastTriggerRef.current) {
          if (trigger.type === 'fart' || trigger.type === 'fakeExit' || trigger.type === 'teleporter') {
            ball = applyModifierEffect(trigger.type, ball, grid, CELL_SIZE, now, setState)
          }
          lastTriggerRef.current = triggerKey
        }
        if (!trigger) lastTriggerRef.current = null
        if (checkWin(ball, animatedGrid, CELL_SIZE) && prev.exitUnlocked) {
          playSound('victory')
          return { ...prev, ball, won: true }
        }
        return { ...prev, ball }
      })
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [grid, state.won])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = grid.cols * CELL_SIZE
    canvas.height = grid.rows * CELL_SIZE
    const animatedGrid = getAnimatedGrid(grid, Date.now())
    drawMaze(ctx, animatedGrid, CELL_SIZE, { collectedFakeExits: state.fakeExitsCollected })
    const trigger = checkModifierTrigger(state.ball, animatedGrid, CELL_SIZE)
    if (trigger) {
      renderModifierOverlay(ctx, trigger.type, state.ball, animatedGrid, CELL_SIZE, Date.now())
    }
    drawBall(ctx, state.ball.x, state.ball.y, state.ball.radius)
  }, [state.ball, grid])

  const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  const containerStyle = {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '14px', padding: '24px 20px', fontFamily: 'var(--font)',
  }

  const btnPrimary = {
    padding: '12px 28px', background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
    fontFamily: 'var(--font)', fontWeight: 700, fontSize: '15px',
    boxShadow: '0 2px 8px rgba(232, 152, 90, 0.3)',
    transition: 'transform 0.15s ease',
  }

  const btnSecondary = {
    padding: '10px 24px', background: 'transparent', color: 'var(--text-muted)',
    border: '1.5px solid #ede6dd', borderRadius: 'var(--radius)', cursor: 'pointer',
    fontFamily: 'var(--font)', fontWeight: 600, fontSize: '13px',
    transition: 'all 0.15s ease',
  }

  if (state.won) {
    const goBack = onBack || (() => { window.location.hash = ''; window.location.reload() })
    return (
      <div style={{ ...containerStyle, justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>🎉</div>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--success)' }}>you escaped!</h1>
        {levelNumber != null && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>level {levelNumber + 1} cleared</p>
        )}
        {grid.hiddenWord && (
          <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>
            &ldquo;{grid.hiddenWord}&rdquo;
          </p>
        )}
        <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
          {minutes}:{seconds.toString().padStart(2, '0')} &middot; {state.ball.deaths} {state.ball.deaths === 1 ? 'death' : 'deaths'}
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          {onNextLevel && (
            <button onClick={onNextLevel} style={btnPrimary}>next level</button>
          )}
          <button onClick={goBack} style={btnSecondary}>
            {onBack ? 'levels' : 'build your own'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
        <span>{minutes}:{seconds.toString().padStart(2, '0')}</span>
        <span>{state.ball.deaths} {state.ball.deaths === 1 ? 'death' : 'deaths'}</span>
        {state.fakeExitsTotal > 0 && (
          <span style={{ color: state.exitUnlocked ? 'var(--success)' : 'var(--danger)' }}>
            {state.exitUnlocked ? 'exit open' : `${state.fakeExitsCollected.size}/${state.fakeExitsTotal} found`}
          </span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}
      />

      {Date.now() < state.psycheUntil && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, pointerEvents: 'none',
        }}>
          <h1 style={{
            fontSize: '64px', fontWeight: 800, color: 'var(--danger)',
            textShadow: '0 4px 20px rgba(217, 115, 115, 0.4)',
            fontFamily: 'var(--font)',
          }}>
            psyche!
          </h1>
        </div>
      )}

      {state.lastQuip && state.ball.deaths > 0 && (
        <p style={{
          fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic',
          minHeight: '20px', transition: 'opacity 0.3s ease',
        }}>
          {state.lastQuip}
        </p>
      )}

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>wasd or arrows</span>
        <button
          onClick={onBack || (() => { window.location.hash = ''; window.location.reload() })}
          style={{
            ...btnSecondary, fontSize: '11px', padding: '6px 14px',
            borderColor: 'var(--danger-light)', color: 'var(--danger)',
          }}
        >
          give up
        </button>
      </div>
    </div>
  )
}

export default MazeSolver
