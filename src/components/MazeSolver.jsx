import { useState, useRef, useEffect, useCallback } from 'react'
import { decodeFromHash } from '../utils/serialize'
import { drawMaze, drawBall } from '../engine/renderer'
import { createBallState, updateBall, checkModifierTrigger, checkWin, getAnimatedGrid } from '../engine/physics'
import { applyModifierEffect, renderModifierOverlay } from '../engine/modifiers'
import { playSound } from '../engine/sound'

const CELL_SIZE = 30

function MazeSolver({ levelGrid, levelNumber, onBack, onNextLevel }) {
  const [grid] = useState(() => {
    if (levelGrid) return levelGrid
    const hash = window.location.hash.slice(1)
    return decodeFromHash(hash)
  })

  const [state, setState] = useState(() => ({
    ball: createBallState(grid, CELL_SIZE),
    startTime: Date.now(),
    won: false,
    showFakeWin: false,
  }))

  const canvasRef = useRef(null)
  const inputRef = useRef({ up: false, down: false, left: false, right: false })
  const lastTriggerRef = useRef(null)
  const animFrameRef = useRef(null)

  // keyboard input
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

  // touch input
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
        up: dy < -threshold,
        down: dy > threshold,
        left: dx < -threshold,
        right: dx > threshold,
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

  // timer tick
  useEffect(() => {
    if (state.won) return
    const id = setInterval(() => setState((s) => ({ ...s })), 1000)
    return () => clearInterval(id)
  }, [state.won])

  // game loop
  useEffect(() => {
    if (state.won) return

    const loop = () => {
      const now = Date.now()

      setState((prev) => {
        if (prev.won || prev.showFakeWin) return prev

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

        if (checkWin(ball, animatedGrid, CELL_SIZE)) {
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

  // render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = grid.cols * CELL_SIZE
    canvas.height = grid.rows * CELL_SIZE

    const animatedGrid = getAnimatedGrid(grid, Date.now())
    drawMaze(ctx, animatedGrid, CELL_SIZE)

    const trigger = checkModifierTrigger(state.ball, animatedGrid, CELL_SIZE)
    if (trigger) {
      renderModifierOverlay(ctx, trigger.type, state.ball, animatedGrid, CELL_SIZE, Date.now())
    }

    drawBall(ctx, state.ball.x, state.ball.y, state.ball.radius)
  }, [state.ball, grid])

  const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  if (state.won) {
    const goBack = onBack || (() => { window.location.hash = ''; window.location.reload() })

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <h1 style={{ fontSize: '48px', color: '#00ff88' }}>YOU ESCAPED</h1>
        {levelNumber != null && (
          <p style={{ fontSize: '14px', color: '#555' }}>Level {levelNumber + 1} cleared</p>
        )}
        {grid.hiddenWord && (
          <p style={{ fontSize: '24px', color: '#ffcc00' }}>
            The maze said: &ldquo;{grid.hiddenWord}&rdquo;
          </p>
        )}
        <p style={{ fontSize: '18px', color: '#888' }}>
          Time: {minutes}:{seconds.toString().padStart(2, '0')} | Deaths: {state.ball.deaths}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          {onNextLevel && (
            <button
              onClick={onNextLevel}
              style={{
                padding: '12px 24px', background: '#ffcc00', color: '#000',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                fontFamily: 'monospace', fontWeight: 'bold', fontSize: '16px',
              }}
            >
              NEXT LEVEL
            </button>
          )}
          <button
            onClick={goBack}
            style={{
              padding: '12px 24px', background: onNextLevel ? 'transparent' : '#ffcc00',
              color: onNextLevel ? '#888' : '#000',
              border: onNextLevel ? '1px solid #444' : 'none',
              borderRadius: '4px', cursor: 'pointer',
              fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px',
            }}
          >
            {onBack ? 'LEVELS' : 'BUILD YOUR OWN'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: '#888' }}>
        <span>Time: {minutes}:{seconds.toString().padStart(2, '0')}</span>
        <span>Deaths: {state.ball.deaths}</span>
      </div>

      <canvas ref={canvasRef} style={{ border: '1px solid #333' }} />

      {state.showFakeWin && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.9)', zIndex: 100,
        }}>
          <h1 style={{ fontSize: '64px', color: '#00ff88' }}>YOU WIN!</h1>
        </div>
      )}

      <p style={{ color: '#444', fontSize: '11px' }}>WASD or arrow keys to move</p>

      <button
        onClick={onBack || (() => { window.location.hash = ''; window.location.reload() })}
        style={{
          padding: '8px 16px', background: 'transparent', color: '#ff4444',
          border: '1px solid #ff4444', borderRadius: '4px', cursor: 'pointer',
          fontFamily: 'monospace', fontSize: '12px',
        }}
      >
        RAGE QUIT (deaths: {state.ball.deaths})
      </button>
    </div>
  )
}

export default MazeSolver
