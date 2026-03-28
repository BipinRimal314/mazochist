import { useState, useRef, useEffect } from 'react'
import { decodeFromHash } from '../utils/serialize'
import { drawMaze, drawBall } from '../engine/renderer'
import { createBallState, updateBall, checkModifierTrigger, checkWin, getAnimatedGrid, checkTrap, checkMemoryWipe } from '../engine/physics'
import { applyModifierEffect, renderModifierOverlay } from '../engine/modifiers'
import { playSound } from '../engine/sound'
import { drawFog, drawCorruption, drawTrapFlash, spreadCorruption } from '../engine/fog'
import { createSession, recordPosition, recordDeath, recordGatePass, endSession, saveSession } from '../engine/telemetry'
import { createStalker, recordStalkerPosition, updateStalker, drawStalker, resetStalker, stalkerCountdown } from '../engine/stalker'

const CELL_SIZE = 30

const DEATH_QUIPS = [
  "you're doing great, sweetie!",
  "everyone makes mistakes. yours are just very frequent.",
  "the maze believes in you. we think.",
  "that was the maze's fault. definitely.",
  "pain is just spicy progress.",
  "still here? we're impressed, honestly.",
  "the ball forgives you. the maze doesn't.",
  "maybe try closing your eyes? can't be worse.",
  "we'd hug you but we're a maze.",
  "that one hurt us too. not really.",
  "have you tried being better at this?",
  "suffering builds character. you have SO much character.",
  "the maze whispers: 'again.'",
  "almost! (we say that every time.)",
  "breathe. then fail again.",
  "nobody's watching. (everyone's watching.)",
]

function getGrade(deaths, seconds) {
  const score = Math.max(0, 100 - deaths * 3 - seconds * 0.5)
  if (score >= 90) return { grade: 'S', label: 'Absolute legend.', color: 'var(--tertiary-container)' }
  if (score >= 75) return { grade: 'A', label: 'Barely bleeding.', color: 'var(--secondary-container)' }
  if (score >= 60) return { grade: 'B', label: 'Respectable suffering.', color: 'var(--secondary-container)' }
  if (score >= 40) return { grade: 'C', label: 'Average agony.', color: 'var(--surface-container-high)' }
  if (score >= 20) return { grade: 'D', label: 'Concerning performance.', color: 'var(--primary-container)' }
  return { grade: 'E-', label: 'Legendary suffering.', color: 'var(--error-container)' }
}

function MazeSolver({ levelGrid, levelNumber, levelName, levelEra, levelFogRadius, levelDeathMode, onBack, onNextLevel }) {
  const [grid] = useState(() => {
    if (levelGrid) return levelGrid
    return decodeFromHash(window.location.hash.slice(1))
  })

  const [state, setState] = useState(() => {
    const fakeExits = grid.cells.filter((c) => c.modifier === 'fakeExit').map((c) => `${c.x},${c.y}`)
    const eraType = levelEra || 'learning'
    const baseFogRadius = levelFogRadius || null

    return {
      ball: createBallState(grid, CELL_SIZE),
      startTime: Date.now(),
      won: false,
      psycheUntil: 0,
      fakeExitsTotal: fakeExits.length,
      fakeExitsCollected: new Set(),
      exitUnlocked: fakeExits.length === 0,
      lastQuip: '',
      eraType,
      baseFogRadius,
      fogRadius: baseFogRadius,
      visitedCells: new Set(),
      trapFlashPos: null,
      trapFlashUntil: 0,
      gateStates: new Map(),
      corruptedCells: new Set(),
      corruptionFrontier: [],
      lastCorruptionTick: 0,
      deathsThisLevel: 0,
      corruptionActive: false,
      stalker: createStalker(eraType === 'punishing' || eraType === 'sadistic'),
    }
  })

  const canvasRef = useRef(null)
  const telemetryRef = useRef(createSession(levelNumber || 0, levelName || 'custom', levelEra || 'learning'))
  const inputRef = useRef({ up: false, down: false, left: false, right: false })
  const lastTriggerRef = useRef(null)
  const animFrameRef = useRef(null)
  const prevDeathsRef = useRef(0)

  useEffect(() => {
    if (state.deathsThisLevel > prevDeathsRef.current) {
      setState((s) => ({ ...s, lastQuip: DEATH_QUIPS[s.deathsThisLevel % DEATH_QUIPS.length] }))
      prevDeathsRef.current = state.deathsThisLevel
    }
  }, [state.deathsThisLevel])

  useEffect(() => {
    const keyMap = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
    }
    const onDown = (e) => { const d = keyMap[e.key]; if (d) { inputRef.current[d] = true; e.preventDefault() } }
    const onUp = (e) => { const d = keyMap[e.key]; if (d) inputRef.current[d] = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [])

  useEffect(() => {
    let sx = 0, sy = 0
    const onTS = (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY }
    const onTM = (e) => {
      e.preventDefault()
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy, t = 5
      inputRef.current = { up: dy < -t, down: dy > t, left: dx < -t, right: dx > t }
    }
    const onTE = () => { inputRef.current = { up: false, down: false, left: false, right: false } }
    window.addEventListener('touchstart', onTS)
    window.addEventListener('touchmove', onTM, { passive: false })
    window.addEventListener('touchend', onTE)
    return () => { window.removeEventListener('touchstart', onTS); window.removeEventListener('touchmove', onTM); window.removeEventListener('touchend', onTE) }
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
        const ag = getAnimatedGrid(grid, now)
        let ball = updateBall(prev.ball, inputRef.current, ag, CELL_SIZE, now)
        const trigger = checkModifierTrigger(ball, ag, CELL_SIZE)
        const tk = trigger ? `${trigger.cellX},${trigger.cellY}` : null
        if (trigger && tk !== lastTriggerRef.current) {
          if (['fart', 'fakeExit', 'teleporter', 'reverse'].includes(trigger.type)) {
            ball = applyModifierEffect(trigger.type, ball, grid, CELL_SIZE, now, setState)
          }
          lastTriggerRef.current = tk
        }
        if (!trigger) lastTriggerRef.current = null

        // trap check — invisible death tiles
        const trap = checkTrap(ball, ag, CELL_SIZE)
        if (trap) {
          playSound('death')
          telemetryRef.current = recordDeath(telemetryRef.current, trap.cellX, trap.cellY, trap.type)
          const newDeaths = prev.deathsThisLevel + 1
          const deathMode = levelDeathMode || 'progress'
          const resetFakeExits = deathMode !== 'progress'
          const fogShrink = prev.eraType === 'sadistic' && newDeaths > 3
            ? Math.max((prev.baseFogRadius || 2.5) - (newDeaths - 3) * 0.5, 1.0)
            : prev.fogRadius
          const corruptionActive = prev.eraType === 'sadistic' && newDeaths >= 10

          return {
            ...prev,
            ball: createBallState(grid, CELL_SIZE),
            trapFlashPos: { x: trap.cellX, y: trap.cellY },
            trapFlashUntil: now + 500,
            deathsThisLevel: newDeaths,
            fogRadius: fogShrink,
            corruptionActive,
            corruptionFrontier: corruptionActive && prev.corruptionFrontier.length === 0
              ? [{ x: grid.start.x, y: grid.start.y }] : prev.corruptionFrontier,
            lastCorruptionTick: corruptionActive && !prev.corruptionActive ? now : prev.lastCorruptionTick,
            fakeExitsCollected: resetFakeExits ? new Set() : prev.fakeExitsCollected,
            exitUnlocked: resetFakeExits ? prev.fakeExitsTotal === 0 : prev.exitUnlocked,
            lastQuip: DEATH_QUIPS[newDeaths % DEATH_QUIPS.length],
          }
        }

        // gate check — close behind the ball
        const ballCellX = Math.floor(ball.x / CELL_SIZE)
        const ballCellY = Math.floor(ball.y / CELL_SIZE)
        const currentCell = ag.cells[ballCellY * ag.cols + ballCellX]
        if (currentCell && currentCell.gate && currentCell.gate.open) {
          const gateKey = `${ballCellX},${ballCellY}`
          if (!prev.gateStates.has(gateKey)) {
            const newGates = new Map(prev.gateStates)
            newGates.set(gateKey, true)
            // mark gate as closed — physics handles blocking, don't mutate walls
            const idx = ballCellY * grid.cols + ballCellX
            grid.cells[idx] = {
              ...grid.cells[idx],
              gate: { ...grid.cells[idx].gate, open: false },
            }
            telemetryRef.current = recordGatePass(telemetryRef.current)
            return { ...prev, ball, gateStates: newGates }
          }
        }

        // memory wipe — clears fog memory trail
        if (checkMemoryWipe(ball, ag, CELL_SIZE)) {
          const wipeKey = `${ballCellX},${ballCellY}`
          if (!prev.lastWipeCell || prev.lastWipeCell !== wipeKey) {
            return {
              ...prev, ball,
              visitedCells: new Set(),
              lastWipeCell: wipeKey,
              lastQuip: 'your memory has been wiped.',
            }
          }
        }

        // track visited cells for fog memory trail
        const visitedKey = `${ballCellX},${ballCellY}`
        let newVisited = prev.visitedCells
        if (!prev.visitedCells.has(visitedKey)) {
          newVisited = new Set(prev.visitedCells)
          newVisited.add(visitedKey)
        }

        // corruption spread (sadistic era, 10+ deaths)
        let corruption = { corruptedCells: prev.corruptedCells, frontier: prev.corruptionFrontier }
        let corruptionTick = prev.lastCorruptionTick
        if (prev.corruptionActive && now - prev.lastCorruptionTick > 10000) {
          corruption = spreadCorruption(prev.corruptedCells, prev.corruptionFrontier, grid)
          corruptionTick = now
          // death if ball is in corrupted cell
          if (corruption.corruptedCells.has(visitedKey)) {
            return {
              ...prev,
              ball: createBallState(grid, CELL_SIZE),
              deathsThisLevel: prev.deathsThisLevel + 1,
              corruptedCells: corruption.corruptedCells,
              corruptionFrontier: corruption.frontier,
              lastCorruptionTick: now,
              lastQuip: 'the void consumed you.',
            }
          }
        }

        if (checkWin(ball, ag, CELL_SIZE) && prev.exitUnlocked) {
          playSound('victory')
          telemetryRef.current = endSession(telemetryRef.current, true)
          saveSession(telemetryRef.current)
          return { ...prev, ball, won: true }
        }

        // record position for telemetry
        telemetryRef.current = recordPosition(telemetryRef.current, ball.x / CELL_SIZE, ball.y / CELL_SIZE)

        // stalker — record position and check if caught
        let stalker = recordStalkerPosition(prev.stalker, ball.x, ball.y, CELL_SIZE)
        stalker = updateStalker(stalker, ball.x, ball.y, CELL_SIZE, ag)
        if (stalker.caught) {
          playSound('death')
          telemetryRef.current = recordDeath(telemetryRef.current, ball.x / CELL_SIZE, ball.y / CELL_SIZE, 'stalker')
          const newDeaths = prev.deathsThisLevel + 1
          return {
            ...prev,
            ball: createBallState(grid, CELL_SIZE),
            deathsThisLevel: newDeaths,
            stalker: resetStalker(stalker),
            lastQuip: 'the apparition caught you.',
          }
        }

        return {
          ...prev, ball,
          stalker,
          visitedCells: newVisited,
          corruptedCells: corruption.corruptedCells,
          corruptionFrontier: corruption.frontier,
          lastCorruptionTick: corruptionTick,
        }
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
    const ag = getAnimatedGrid(grid, Date.now())
    drawMaze(ctx, ag, CELL_SIZE, { collectedFakeExits: state.fakeExitsCollected })
    const trigger = checkModifierTrigger(state.ball, ag, CELL_SIZE)
    if (trigger) renderModifierOverlay(ctx, trigger.type, state.ball, ag, CELL_SIZE, Date.now())
    drawBall(ctx, state.ball.x, state.ball.y, state.ball.radius)

    // fog of war
    if (state.fogRadius !== null) {
      drawFog(ctx, grid, CELL_SIZE, state.ball.x, state.ball.y, state.fogRadius, state.visitedCells)
    }

    // corruption overlay
    drawCorruption(ctx, grid, CELL_SIZE, state.corruptedCells, Date.now())

    // stalker (visible through fog — you can always see it coming)
    drawStalker(ctx, state.stalker, CELL_SIZE, Date.now())

    // trap flash (above fog so player sees where they died)
    if (state.trapFlashPos && Date.now() < state.trapFlashUntil) {
      drawTrapFlash(ctx, CELL_SIZE, state.trapFlashPos.x, state.trapFlashPos.y)
    }
  }, [state.ball, state.fogRadius, state.corruptedCells, state.trapFlashPos, state.stalker, grid])

  const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  const goBack = () => {
    telemetryRef.current = endSession(telemetryRef.current, false)
    saveSession(telemetryRef.current)
    if (onBack) onBack()
    else { window.location.hash = ''; window.location.reload() }
  }

  // VICTORY / SHAME SCREEN
  if (state.won) {
    const { grade, label, color } = getGrade(state.deathsThisLevel, elapsed)
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', padding: '40px 20px',
        fontFamily: "var(--font-body)",
        background: 'radial-gradient(at 0% 0%, #fef6e4 0%, transparent 50%), radial-gradient(at 100% 0%, #fa86b2 0%, transparent 50%), radial-gradient(at 100% 100%, #a3ecf6 0%, transparent 50%), radial-gradient(at 0% 100%, #fed701 0%, transparent 50%)',
        backgroundColor: '#fef6e4',
      }}>
        <div style={{
          background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-gummy)', overflow: 'hidden', maxWidth: '420px', width: '100%',
          border: '4px solid white',
        }}>
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {state.deathsThisLevel < 5 ? '\u{1F389}' : state.deathsThisLevel < 20 ? '\u{1F605}' : '\u{1F480}'}
            </div>
            <h2 style={{
              fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: '24px',
              color: 'var(--primary)', lineHeight: 1.2, marginBottom: '4px',
            }}>
              {state.deathsThisLevel < 5 ? 'you actually escaped!' : 'I barely survived a MAZOCHIST maze'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
              {state.deathsThisLevel < 5 ? 'show-off.' : '"at least you didn\'t quit. yet."'}
            </p>

            {grid.hiddenWord && (
              <div style={{
                marginTop: '16px', padding: '12px 20px', background: 'var(--surface-container-low)',
                borderRadius: 'var(--radius)', display: 'inline-block',
              }}>
                <span style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: '20px', color: 'var(--primary)' }}>
                  &ldquo;{grid.hiddenWord}&rdquo;
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px' }}>
              <div style={{ background: 'var(--surface-container-low)', borderRadius: 'var(--radius)', padding: '16px' }}>
                <div style={{ fontSize: '10px', fontFamily: "var(--font-headline)", textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>
                  time
                </div>
                <div style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: '18px', color: 'var(--primary)' }}>
                  {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
                </div>
              </div>
              <div style={{ background: 'var(--secondary-container)', borderRadius: 'var(--radius)', padding: '16px' }}>
                <div style={{ fontSize: '10px', fontFamily: "var(--font-headline)", textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--on-secondary-container)', marginBottom: '4px', opacity: 0.7 }}>
                  deaths
                </div>
                <div style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: '18px', color: 'var(--on-secondary-container)' }}>
                  {state.deathsThisLevel}
                </div>
              </div>
            </div>

            <div style={{ background: color, borderRadius: 'var(--radius)', padding: '16px', marginTop: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: "var(--font-headline)", textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', opacity: 0.7 }}>rank</div>
              <div style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: '24px' }}>{grade}</div>
              <div style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>{label}</div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
              {onNextLevel && (
                <button
                  onClick={onNextLevel}
                  style={{
                    background: 'linear-gradient(180deg, var(--primary-container) 0%, var(--primary) 100%)',
                    color: '#fff', fontFamily: "var(--font-headline)", fontWeight: 700,
                    fontSize: '15px', padding: '14px 28px', borderRadius: '9999px',
                    border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-gummy)',
                    transition: 'transform 0.3s var(--bounce)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  next level
                </button>
              )}
              <button
                onClick={goBack}
                style={{
                  background: 'var(--surface-container-lowest)', color: 'var(--primary)',
                  fontFamily: "var(--font-headline)", fontWeight: 700, fontSize: '14px',
                  padding: '14px 24px', borderRadius: '9999px',
                  border: '2px solid var(--primary-container)', cursor: 'pointer',
                  transition: 'transform 0.3s var(--bounce)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {onBack ? 'levels' : 'build your own'}
              </button>
            </div>
          </div>
          <div style={{
            background: 'var(--surface-container-high)', padding: '12px',
            textAlign: 'center', fontSize: '10px', fontStyle: 'italic',
            color: 'var(--primary)', opacity: 0.6,
          }}>
            mazochist — lovingly crafted suffering
          </div>
        </div>
      </div>
    )
  }

  // PLAYING SCREEN
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '16px', padding: '20px', fontFamily: "var(--font-body)",
    }}>
      {levelNumber != null && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{
            fontFamily: "var(--font-headline)", fontWeight: 800,
            fontSize: '14px', color: 'var(--primary)', letterSpacing: '-0.5px',
          }}>
            level {levelNumber + 1}{levelName ? `: ${levelName}` : ''}
          </div>
          <div style={{
            background: 'var(--primary-container)', color: 'var(--primary-dim)',
            padding: '4px 12px', borderRadius: '9999px', fontSize: '10px',
            fontFamily: "var(--font-headline)", fontWeight: 600,
          }}>
            {levelEra === 'sadistic' ? 'good luck' : levelEra === 'punishing' ? 'careful now' : 'you got this'} {'\u{1F496}'}
          </div>
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
        width: '100%', maxWidth: `${grid.cols * CELL_SIZE}px`,
      }}>
        <div style={{
          background: 'var(--surface-container-low)', borderRadius: 'var(--radius)',
          padding: '14px 16px', boxShadow: 'var(--shadow-gummy)',
          transform: 'rotate(-0.5deg)',
        }}>
          <div style={{ fontSize: '10px', fontFamily: "var(--font-headline)", color: 'var(--on-surface-variant)', opacity: 0.6, textTransform: 'lowercase' }}>
            suffering duration
          </div>
          <div style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: '24px', color: 'var(--on-surface)', marginTop: '2px' }}>
            {timeStr}
          </div>
        </div>
        <div style={{
          background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius)',
          padding: '14px 16px', boxShadow: 'var(--shadow-gummy)',
          transform: 'rotate(0.5deg)', textAlign: 'right',
        }}>
          <div style={{ fontSize: '10px', fontFamily: "var(--font-headline)", color: 'var(--on-surface-variant)', opacity: 0.6, textTransform: 'lowercase' }}>
            setbacks
          </div>
          <div style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: '24px', color: 'var(--primary)', marginTop: '2px' }}>
            {state.deathsThisLevel}
            {state.deathsThisLevel > 0 && (
              <span style={{ fontSize: '12px', fontWeight: 500, marginLeft: '6px' }}>(ouch)</span>
            )}
          </div>
        </div>
      </div>

      {state.fakeExitsTotal > 0 && (
        <div style={{
          background: state.exitUnlocked ? 'var(--secondary-container)' : 'var(--surface-container)',
          borderRadius: '9999px', padding: '6px 16px', fontSize: '11px',
          fontFamily: "var(--font-headline)", fontWeight: 700,
          color: state.exitUnlocked ? 'var(--on-secondary-container)' : 'var(--on-surface-variant)',
          transition: 'all 0.3s ease',
        }}>
          {state.exitUnlocked ? '\u{2705} exit unlocked!' : `\u{1F512} ${state.fakeExitsCollected.size}/${state.fakeExitsTotal} found`}
        </div>
      )}

      {state.eraType === 'sadistic' && state.deathsThisLevel >= 4 && (
        <div style={{
          background: 'var(--error-container)', color: '#fff',
          borderRadius: '9999px', padding: '4px 12px', fontSize: '10px',
          fontFamily: "var(--font-headline)", fontWeight: 700,
        }}>
          {state.deathsThisLevel >= 10
            ? '\u{1F525} void spreading'
            : state.deathsThisLevel >= 7
            ? `\u{26A0}\u{FE0F} +${(state.deathsThisLevel - 6) * 2} traps added`
            : '\u{1F441}\u{FE0F} fog shrinking'}
        </div>
      )}

      {state.fogRadius !== null && (
        <div style={{
          background: 'var(--surface-container)', color: 'var(--on-surface-variant)',
          borderRadius: '9999px', padding: '4px 12px', fontSize: '10px',
          fontFamily: "var(--font-headline)", fontWeight: 600,
        }}>
          {'\u{1F32B}\u{FE0F}'} fog active
        </div>
      )}

      {state.stalker.enabled && (() => {
        const cd = stalkerCountdown(state.stalker)
        return (
          <div style={{
            background: cd > 0 ? 'var(--tertiary-container)' : 'var(--error-container)',
            color: cd > 0 ? 'var(--on-tertiary-container)' : '#fff',
            borderRadius: '9999px', padding: '4px 12px', fontSize: '10px',
            fontFamily: "var(--font-headline)", fontWeight: 700,
            animation: cd === 0 ? 'none' : undefined,
          }}>
            {cd > 0
              ? `\u{1F440} apparition in ${cd}s`
              : '\u{1F47B} apparition is hunting you'}
          </div>
        )
      })()}

      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-gummy)',
            transition: 'filter 0.3s ease',
            filter: (state.ball.reversed && Date.now() < state.ball.reversedUntil) ? 'hue-rotate(180deg)' : 'none',
          }}
        />
        {state.ball.reversed && Date.now() < state.ball.reversedUntil && (
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            background: 'var(--error-container)', color: '#fff',
            padding: '4px 10px', borderRadius: '9999px',
            fontSize: '10px', fontFamily: "var(--font-headline)", fontWeight: 700,
            pointerEvents: 'none',
          }}>
{'\u{1F500}'} reversed!
          </div>
        )}
      </div>

      {Date.now() < state.psycheUntil && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, pointerEvents: 'none',
        }}>
          <h1 style={{
            fontFamily: "var(--font-headline)", fontSize: '72px', fontWeight: 800,
            color: 'var(--primary)', textShadow: '0 4px 24px rgba(153, 56, 98, 0.3)',
          }}>
            psyche!
          </h1>
        </div>
      )}

      {state.lastQuip && state.deathsThisLevel > 0 && (
        <p style={{
          fontSize: '12px', color: 'var(--on-surface-variant)',
          fontStyle: 'italic', textAlign: 'center', maxWidth: '300px',
          fontFamily: "var(--font-body)",
        }}>
          {state.lastQuip}
        </p>
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', opacity: 0.5, textTransform: 'lowercase' }}>
          wasd or arrows
        </span>
        <button
          onClick={goBack}
          style={{
            background: 'var(--surface-container-lowest)', color: 'var(--primary)',
            fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: '12px',
            padding: '8px 20px', borderRadius: '9999px',
            border: '2px solid var(--primary-container)', cursor: 'pointer',
            transition: 'all 0.4s var(--bounce)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--primary-container)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface-container-lowest)'
            e.currentTarget.style.color = 'var(--primary)'
          }}
        >
          just give up already?
        </button>
      </div>
    </div>
  )
}

export default MazeSolver
