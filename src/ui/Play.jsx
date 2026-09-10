import { useRef, useState, useCallback, useEffect } from 'react'
import { createGame, restartGame } from '../engine/game.js'
import { assist, setAssist } from '../engine/assist.js'
import { recordWin, parFor, speedrunActive } from './progress.js'
import {
  playSound, isMuted, toggleMuted, playStep, getVolume, setVolume,
  startAmbience, stopAmbience, setHunterProximity,
} from '../engine/sound.js'
import { record } from './telemetry.js'
import { whisperFor } from './story.js'
import { useCellSize } from './useCellSize.js'
import { useGameInput } from './useGameInput.js'
import { useGamepad } from './useGamepad.js'
import { useGameLoop } from './useGameLoop.js'
import { OUTRO_MS } from '../engine/render.js'

/**
 * How long the field's name sits over the board before the clock starts.
 *
 * The game is paused underneath it, so the time on the card is time spent
 * walking and not time spent reading. Any move ends it early: a player who
 * knows the field does not wait for the title.
 */
const INTRO_MS = 1300

/* eslint-disable react-hooks/refs --
 * The game is an imperative engine instance, not render data. It is created
 * once per level and mutated in place several hundred times a second, so it
 * cannot live in useState — every mutation would be a lie to React. Nothing
 * read from the ref drives rendering; the HUD comes from useGameLoop's state.
 */

function clock(ms) {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/*
 * Deaths are counted, and not shown while you are playing.
 *
 * A running death tally on the board is a shame meter, and it argues with
 * everything the writing does — the farmer's whole character is that falling in
 * a hole is an indignity rather than a failure ("Nothing broken. Nothing that
 * counts."). The number still exists, is still recorded, and is still reported
 * on the card at the end of the field, where it reads as a story about the walk
 * instead of a score ticking up next to your hands.
 */
function Play({ level, index, total, isLast = false, onBack, onNext }) {
  const canvasRef = useRef(null)
  const boardRef = useRef(null)
  const [result, setResult] = useState(null)

  const restartsRef = useRef(0)
  const wonRef = useRef(false)
  const [lost, setLost] = useState(false)
  const [caughtLine, setCaughtLine] = useState('')

  // Read once per level rather than per render: the target must not move while
  // the player is racing it.
  const parRef = useRef(null)
  if (parRef.current === null) {
    parRef.current = speedrunActive() ? { ms: parFor(level.name) } : { ms: null }
  }
  const par = parRef.current.ms

  const gameRef = useRef(null)
  if (gameRef.current === null) {
    const game = createGame(level.grid, assist())
    game.onSound = playSound
    game.onStep = playStep
    game.onWin = () => {
      wonRef.current = true
      recordWin(level.name, { deaths: game.deaths, ms: game.now })
      record('level_won', {
        levelName: level.name,
        levelIndex: index,
        deaths: game.deaths,
        ms: game.now,
        restarts: restartsRef.current,
      })
      // the card waits for the hat to go in; the numbers on it are already fixed
      const outcome = { deaths: game.deaths, ms: game.now, par: parRef.current.ms }
      setTimeout(() => setResult(outcome), OUTRO_MS + 120)
    }
    // the field opens under its title, and the clock with it
    game.paused = true
    /*
     * Caught. Set from the callback rather than read off the HUD snapshot: the
     * snapshot lands ten times a second, and a beat this abrupt should stop the
     * board on the frame it happened, not up to 100ms later.
     */
    game.onLose = () => {
      setLost(true)
      setCaughtLine(game.quip)
      record('level_lost', {
        levelName: level.name,
        levelIndex: index,
        deaths: game.deaths,
        ms: game.now,
        restarts: restartsRef.current,
      })
    }
    gameRef.current = game
  }
  const game = gameRef.current

  const view = useCellSize(level.grid.cols, level.grid.rows)
  const hud = useGameLoop(game, canvasRef, view)

  const [muted, setMuted] = useState(isMuted)

  /*
   * A fragment heard a few seconds into some levels.
   *
   * It arrives while the player is busy and cannot stop to study it, which is
   * the right delivery for something meant to feel half-heard — and it puts a
   * hint inside the game rather than only on the cards between levels. It
   * borrows the quip line rather than adding furniture, and yields back to the
   * quips afterwards, because a death has more to say than a ghost does.
   */
  const [whisper, setWhisper] = useState(null)

  useEffect(() => {
    const line = whisperFor(level.name)
    if (!line) return undefined
    const show = setTimeout(() => setWhisper(line), 4500)
    const hide = setTimeout(() => setWhisper(null), 13000)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [level.name])

  /*
   * Pause is React state that writes through to `game.paused`, rather than
   * being read back off the HUD snapshot. The snapshot is published ten times a
   * second, so driving the menu from it opened it up to 100ms after the tap —
   * fine for a number that ticks, wrong for a menu, which should appear on the
   * press that asked for it.
   */
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)

  const pause = useCallback((next) => {
    if (game.won) return
    game.paused = next
    pausedRef.current = next
    if (next) game.input.up = game.input.down = game.input.left = game.input.right = false
    setPaused(next)
  }, [game])

  /*
   * The title over the field.
   *
   * `game.paused` was set true when the game was built, so nothing moves and
   * the clock does not run until this lifts it. It lifts on the timer or on
   * the first thing the player does, whichever is first — and only if the menu
   * has not been opened in the meantime, so a player who pressed P during the
   * title is not quietly un-paused by it.
   */
  const [intro, setIntro] = useState(true)
  const introRef = useRef(true)
  const endIntro = useCallback(() => {
    if (!introRef.current) return
    introRef.current = false
    setIntro(false)
    if (!pausedRef.current && !game.won && !game.lost) game.paused = false
  }, [game])

  useEffect(() => {
    const timer = setTimeout(endIntro, INTRO_MS)
    const onAnyInput = (e) => {
      if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return
      endIntro()
    }
    window.addEventListener('keydown', onAnyInput)
    window.addEventListener('pointerdown', onAnyInput)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onAnyInput)
      window.removeEventListener('pointerdown', onAnyInput)
    }
  }, [endIntro])

  const restart = useCallback(() => {
    if (game.won) return
    restartsRef.current += 1
    restartGame(game)
    setLost(false)
    pause(false)
  }, [game, pause])

  // toggled from the menu's own state, not `game.paused`: the intro holds the
  // game paused too, and a menu that reads that would close instead of open
  const togglePause = useCallback(() => { pause(!pausedRef.current) }, [pause])

  const onToggleSound = useCallback(() => { setMuted(toggleMuted()) }, [])

  /*
   * The assist dials.
   *
   * Changing one mid-field takes effect on the next attempt rather than this
   * one: `game.assist` is read by the hunter at the moment it is built, and
   * quietly slowing something that is already chasing you would be the game
   * changing its own rules mid-run. Restarting the field is one button away and
   * the menu says so.
   */
  const [help, setHelp] = useState(assist)
  const onAssist = useCallback((patch) => { setHelp(setAssist(patch)) }, [])

  const [volume, setVol] = useState(getVolume)
  const onVolume = useCallback((e) => {
    const next = setVolume(e.target.value)
    setVol(next)
    // the bed is built with the volume baked into its gains, so it has to be
    // rebuilt to hear the change rather than only new one-shots picking it up
    startAmbience(level.terrain)
  }, [level.terrain])

  useGameInput(game, boardRef, { onRestart: restart, onTogglePause: togglePause, onBack })
  useGamepad(game, { onRestart: restart, onTogglePause: togglePause, onBack })

  /*
   * The air of this terrain, and the ghost's layer under it.
   *
   * Torn down on unmount without exception: these are looping nodes, and one
   * left running plays until the tab is closed. The proximity is pushed from
   * the HUD tick rather than the frame loop — ten times a second is plenty for
   * something that is ramped anyway, and it keeps audio off the hot path.
   */
  useEffect(() => {
    startAmbience(level.terrain)
    return () => stopAmbience()
  }, [level.terrain, muted])

  useEffect(() => {
    if (!game.hunter?.active) {
      setHunterProximity(0)
      return
    }
    const span = Math.hypot(game.grid.cols, game.grid.rows)
    const gap = Math.hypot(game.hunter.x - game.ball.x, game.hunter.y - game.ball.y)
    setHunterProximity(1 - Math.min(1, gap / (span * 0.6)))
  }, [game, hud.now, hud.hunterAwake])

  useEffect(() => {
    const onHide = () => {
      if (game.won || !document.hidden) return
      pause(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [game, pause])

  /*
   * Playtest telemetry: one event on arrival, one on the way out.
   *
   * The quit event is the one worth having. A tester who gives up on level 28
   * tells you far more than one who finishes level 3, and they are exactly the
   * tester who never files feedback — so it is recorded on unmount, which
   * covers leaving by menu, by key, and by closing the tab.
   */
  useEffect(() => {
    record('level_started', { levelName: level.name, levelIndex: index })
    return () => {
      if (wonRef.current) return
      record('level_quit', {
        levelName: level.name,
        levelIndex: index,
        deaths: game.deaths,
        ms: game.now,
        restarts: restartsRef.current,
      })
    }
  }, [game, level.name, index])

  if (result) {
    const seconds = Math.floor(result.ms / 1000)
    const racing = result.par != null
    const saved = racing && result.ms < result.par

    return (
      <div className="result">
        <div className="card">
          <div className="card__emoji">
            {racing
              ? (saved ? '\u{1F3C3}' : '\u{23F1}')
              : (result.deaths === 0 ? '\u{1F3C6}' : result.deaths < 6 ? '\u{1F389}' : '\u{1F605}')}
          </div>
          <h2 className="card__title">
            {racing
              ? (saved ? 'Faster.' : 'Not fast enough.')
              : (result.deaths === 0 ? 'Not one stumble.' : 'Through.')}
          </h2>
          <p className="card__sub">
            {racing
              ? (saved
                ? `${clock(result.par - result.ms)} to the good. Keep on.`
                : `${clock(result.ms - result.par)} short. This field again, then.`)
              : (result.deaths === 0
                ? 'Clean as a whistle. Do not let it go to your head.'
                : 'Slow, and sore, and through all the same.')}
          </p>
          <div className="card__stats">
            <div className="stat"><span className="stat__label">time</span><span className="stat__value">{clock(result.ms)}</span></div>
            {racing
              ? <div className="stat"><span className="stat__label">to beat</span><span className="stat__value">{clock(result.par)}</span></div>
              : <div className="stat"><span className="stat__label">deaths</span><span className="stat__value">{result.deaths}</span></div>}
          </div>
          <div className="card__actions">
            {onNext && (
              <button className="btn btn--primary" onClick={onNext}>
                {isLast ? 'finish' : 'next level'}
              </button>
            )}
            <button className="btn" onClick={onBack}>levels</button>
          </div>
          <p className="card__meta">{level.name} · {seconds}s</p>
        </div>
      </div>
    )
  }

  return (
    <div className="play">
      <header className="play__head">
        <button className="play__back" onClick={onBack}>&larr; levels</button>
        <span className="play__title">{level.name}</span>
        <span className="play__count">{index + 1}/{total}</span>
        <button
          className="play__menu"
          onClick={togglePause}
          aria-label={paused ? 'resume' : 'pause and open the menu'}
        >
          {paused ? '▶' : '⏸'}
        </button>
      </header>

      <div className="hud">
        <div className="hud__tile">
          <span className="hud__label">time</span>
          <span className="hud__value">{clock(hud.now)}</span>
        </div>
        <div className={`hud__tile hud__tile--flags${hud.exitOpen ? ' is-complete' : ''}`}>
          <span className="hud__label">maize</span>
          {/* keyed on the count so the number pops each time it changes */}
          <span className="hud__value" key={hud.captured}>
            <span className="hud__pop">{hud.captured}</span><span className="hud__of">/{hud.flagsTotal}</span>
          </span>
        </div>
        {par != null && (
          <div className={`hud__tile hud__tile--par${hud.now > par ? ' is-blown' : ''}`}>
            <span className="hud__label">{hud.now > par ? 'too slow' : 'beat'}</span>
            <span className="hud__value">{clock(par)}</span>
          </div>
        )}
        {hud.hasHunter && (
          <div className={`hud__tile hud__tile--hunter${hud.hunterAwake ? ' is-awake' : ''}`}>
            <span className="hud__label">{hud.hunterAwake ? 'ghost' : 'ghost in'}</span>
            <span className="hud__value">{hud.hunterAwake ? '\u{1F47B}' : `${hud.hunterIn}s`}</span>
          </div>
        )}
      </div>

      <div className="board" ref={boardRef}>
        <canvas ref={canvasRef} className="board__canvas" />
        {intro && (
          <div className="board__intro" aria-hidden="true">
            <span className="board__intro-chapter">{level.chapter}</span>
            <span className="board__intro-name">{level.name}</span>
          </div>
        )}
        {lost && (
          <div className="board__overlay board__overlay--lost">
            <span className="menu__title">Caught.</span>
            <p className="lost__line">{caughtLine}</p>
            <p className="lost__cost">
              {level.grid.flags.length > 1
                ? 'The maize goes back where it was. Start the field again.'
                : 'Start the field again.'}
            </p>
            <div className="menu">
              <button className="btn btn--primary" onClick={restart}>again</button>
              <button className="btn" onClick={onBack}>levels</button>
            </div>
          </div>
        )}
        {paused && !lost && (
          <div className="board__overlay">
            <span className="menu__title">paused</span>
            <div className="menu">
              <button className="btn btn--primary" onClick={togglePause}>resume</button>
              <button className="btn" onClick={restart}>restart level</button>
              <button className="btn" onClick={onToggleSound}>
                sound: {muted ? 'off' : 'on'}
              </button>
              <label className="menu__slider">
                <span>volume</span>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={volume} onChange={onVolume}
                  disabled={muted}
                  aria-label="volume"
                />
              </label>
              <button className="btn" onClick={onBack}>back to levels</button>

              <div className="menu__assist">
                <span className="menu__assist-title">make it kinder</span>
                <label className="menu__toggle">
                  <input
                    type="checkbox"
                    checked={help.steadyBoard}
                    onChange={(e) => onAssist({ steadyBoard: e.target.checked })}
                  />
                  <span>hold the board steady</span>
                </label>
                <label className="menu__slider">
                  <span>see further</span>
                  <input
                    type="range" min="0" max="3" step="1"
                    value={help.fogBonus}
                    onChange={(e) => onAssist({ fogBonus: Number(e.target.value) })}
                    aria-label="how much further you can see"
                  />
                </label>
                <label className="menu__slider">
                  <span>ghost hangs back</span>
                  <input
                    type="range" min="0.5" max="1" step="0.1"
                    value={1.5 - help.ghostPace}
                    onChange={(e) => onAssist({ ghostPace: 1.5 - Number(e.target.value) })}
                    aria-label="how far the ghost hangs back"
                  />
                </label>
                <span className="menu__assist-note">
                  takes effect next go &middot; every field is still beatable
                </span>
              </div>
            </div>
            <span className="board__hint">P resume · R restart · Esc levels</span>
          </div>
        )}
      </div>

      {/* keyed on the line so each new one fades up rather than swapping in */}
      <p
        key={hud.quip || whisper || ''}
        className={`play__quip${whisper && !hud.quip ? ' play__quip--whisper' : ''}`}
      >
        {hud.quip || whisper || ''}
      </p>

      <div className="play__controls">
        <span className="play__keys">wasd / arrows / stick · R restart · P menu</span>
        <button className="btn btn--sm" onClick={restart}>restart</button>
      </div>
    </div>
  )
}

export default Play
