import { describe, it, expect } from 'vitest'
import { createGrid, setWall, DIRECTIONS } from './grid.js'
import { createGame, stepGame, restartGame, snapshot } from './game.js'
import { FX_LIFE, FX_MAX, BUMP_MIN_SPEED, pruneFx, bumpAxis } from './fx.js'
import { drawScene, hatPose, OUTRO_MS } from './render.js'

/**
 * The effects layer: what the board shows happening, kept apart from what
 * happens. The one property that matters is the last one — a game with every
 * effect stripped out every step plays identically to one that keeps them.
 */

function openGrid(cols, rows) {
  const grid = createGrid(cols, rows)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (x + 1 < cols) setWall(grid, x, y, DIRECTIONS[1], false)
      if (y + 1 < rows) setWall(grid, x, y, DIRECTIONS[2], false)
    }
  }
  return grid
}

function stubContext() {
  const calls = { save: 0, restore: 0 }
  return {
    calls,
    ctx: {
      canvas: null, fillStyle: null, strokeStyle: null, globalAlpha: 1, lineWidth: 0,
      lineCap: '', lineJoin: '', shadowColor: null, shadowBlur: 0, globalCompositeOperation: '',
      save: () => { calls.save++ }, restore: () => { calls.restore++ },
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {},
      quadraticCurveTo() {}, ellipse() {}, fill() {}, stroke() {}, clip() {}, translate() {},
      rotate() {}, fillRect() {}, clearRect() {}, drawImage() {},
      createRadialGradient: () => ({ addColorStop() {} }),
      createLinearGradient: () => ({ addColorStop() {} }),
    },
  }
}

function fallInto(trapX) {
  const grid = openGrid(12, 3)
  grid.traps = [{ x: trapX, y: 1 }]
  const game = createGame(grid)
  game.ball.y = 1.5
  game.input.right = true
  for (let i = 0; i < 600 && game.deaths === 0; i++) stepGame(game)
  expect(game.deaths).toBe(1)
  return game
}

describe('what gets recorded', () => {
  it('a trap records the fall where it happened and the arrival at the start', () => {
    const game = fallInto(5)
    const kinds = game.fx.map((f) => f.kind)
    expect(kinds).toContain('fall')
    expect(kinds).toContain('spawn')
    const fall = game.fx.find((f) => f.kind === 'fall')
    expect(fall).toMatchObject({ x: 5, y: 1 })
    const spawn = game.fx.find((f) => f.kind === 'spawn')
    expect(spawn).toMatchObject({ x: game.grid.start.x, y: game.grid.start.y })
  })

  it('an ear records the pick, and the last ear records the way opening', () => {
    const grid = openGrid(12, 3)
    grid.flags = [{ x: 4, y: 1 }, { x: 8, y: 1 }]
    const game = createGame(grid)
    game.ball.y = 1.5
    game.input.right = true
    for (let i = 0; i < 600 && game.captured.size === 0; i++) stepGame(game)
    expect(game.fx.map((f) => f.kind)).toContain('pick')
    expect(game.fx.map((f) => f.kind)).not.toContain('unlock')

    game.ball.y = 1.5
    for (let i = 0; i < 900 && game.captured.size < 2; i++) stepGame(game)
    expect(game.exitOpen).toBe(true)
    expect(game.fx.map((f) => f.kind)).toContain('unlock')
  })

  it('a knock against a wall at speed is recorded; leaning on one is not', () => {
    const game = createGame(openGrid(10, 3))
    game.ball.y = 1.5
    // counted as they happen, since a knock is gone from the list within a
    // quarter of a second
    let knocks = 0
    game.onSound = (name) => { if (name === 'bump') knocks++ }
    game.input.right = true
    for (let i = 0; i < 400; i++) stepGame(game)
    expect(knocks, 'the far wall should have been struck').toBeGreaterThanOrEqual(1)
    expect(knocks, 'one arrival is one knock').toBeLessThanOrEqual(2)
    // and then held against: no further knocks while the hat leans on it
    const before = knocks
    for (let i = 0; i < 300; i++) stepGame(game)
    expect(knocks - before, 'leaning on a wall should not knock').toBe(0)
  })

  it('only a sign flip at speed counts as a knock', () => {
    expect(bumpAxis({ vx: 0.12, vy: 0 }, { vx: -0.036, vy: 0 })).toBe('x')
    expect(bumpAxis({ vx: 0, vy: -0.12 }, { vx: 0, vy: 0.036 })).toBe('y')
    expect(bumpAxis({ vx: BUMP_MIN_SPEED * 0.5, vy: 0 }, { vx: -0.01, vy: 0 })).toBeNull()
    expect(bumpAxis({ vx: 0.12, vy: 0 }, { vx: 0.1, vy: 0 })).toBeNull()
    expect(bumpAxis({ vx: 0.12, vy: 0 }, { vx: 0, vy: 0 }), 'a reset is not a knock').toBeNull()
  })

  it('the ghost waking is recorded where it stood up', () => {
    const grid = openGrid(8, 3)
    grid.hunter = { spawnMs: 500, speed: 0.05 }
    const game = createGame(grid)
    for (let i = 0; i < 60 && !game.hunter.active; i++) stepGame(game)
    expect(game.hunter.active).toBe(true)
    const wake = game.fx.find((f) => f.kind === 'wake')
    expect(wake).toBeTruthy()
    expect(Math.floor(wake.x)).toBe(Math.floor(game.hunter.x))
  })
})

describe('how long they last', () => {
  it('expire on the game clock and are dropped', () => {
    const game = fallInto(5)
    expect(game.fx.length).toBeGreaterThan(0)
    game.input.right = false
    const longest = Math.max(...Object.values(FX_LIFE))
    for (let i = 0; i < longest / 16 + 5; i++) stepGame(game)
    expect(game.fx).toEqual([])
  })

  it('never grow without bound', () => {
    const game = createGame(openGrid(4, 4))
    for (let i = 0; i < 500; i++) game.fx.push({ kind: 'bump', x: 0, y: 0, at: game.now, axis: 'x' })
    // pushFx caps on the way in; a hand-filled list is pruned on the next step
    stepGame(game)
    pruneFx(game)
    expect(game.fx.length).toBeLessThanOrEqual(500)
    const fresh = createGame(openGrid(4, 4))
    fresh.ball.y = 1.5
    fresh.input.right = true
    for (let i = 0; i < 3000; i++) { stepGame(fresh); fresh.input.right = !fresh.input.right }
    expect(fresh.fx.length).toBeLessThanOrEqual(FX_MAX)
  })

  it('are cleared by a restart, with the outro clock', () => {
    const game = fallInto(5)
    game.outro = 300
    restartGame(game)
    expect(game.fx).toEqual([])
    expect(game.outro).toBe(0)
  })
})

describe('the outro', () => {
  it('runs its own clock after a win and leaves the game clock alone', () => {
    const grid = openGrid(6, 3)
    grid.end = { x: 5, y: 1 }
    const game = createGame(grid)
    game.ball.y = 1.5
    game.input.right = true
    for (let i = 0; i < 600 && !game.won; i++) stepGame(game)
    expect(game.won).toBe(true)
    const at = game.now
    for (let i = 0; i < 20; i++) stepGame(game)
    expect(game.now).toBe(at)
    expect(game.outro).toBeGreaterThan(0)
    expect(OUTRO_MS).toBeGreaterThan(game.outro / 2)
  })
})

describe('the hat', () => {
  it('is level and still when the ball is', () => {
    const game = createGame(openGrid(6, 6))
    expect(hatPose(game)).toEqual({ scale: 1, tilt: 0, bob: 0 })
  })

  it('leans into the walk and arrives from nothing', () => {
    const game = createGame(openGrid(20, 3))
    game.ball.y = 1.5
    game.input.right = true
    for (let i = 0; i < 60; i++) stepGame(game)
    const pose = hatPose(game)
    expect(pose.tilt).toBeGreaterThan(0)
    expect(pose.tilt).toBeLessThanOrEqual(0.3)

    const fallen = fallInto(5)
    // the moment after the fall, the hat is not yet back
    expect(hatPose(fallen).scale).toBeLessThan(0.2)
    fallen.input.right = false
    for (let i = 0; i < FX_LIFE.spawn / 16 + 2; i++) stepGame(fallen)
    expect(hatPose(fallen).scale).toBe(1)
  })
})

describe('the rules do not know any of this exists', () => {
  it('a game with its effects stripped every step plays identically', () => {
    const grid = openGrid(14, 5)
    grid.traps = [{ x: 4, y: 2 }, { x: 9, y: 1 }]
    grid.flags = [{ x: 12, y: 3 }]
    grid.hunter = { spawnMs: 2000, speed: 0.05 }
    const kept = createGame(grid)
    const stripped = createGame(grid)

    const script = ['right', 'down', 'right', 'up', 'left', 'right', 'down', 'right']
    for (let i = 0; i < 2400; i++) {
      const direction = script[Math.floor(i / 300) % script.length]
      for (const game of [kept, stripped]) {
        game.input.up = game.input.down = game.input.left = game.input.right = false
        game.input[direction] = true
        stepGame(game)
      }
      stripped.fx = []
      stripped.stick = { x: 1, y: 1, dx: 0, dy: 0 }
    }

    expect(snapshot(stripped)).toEqual(snapshot(kept))
    expect(stripped.ball).toEqual(kept.ball)
    expect(stripped.deaths).toBe(kept.deaths)
  })

  it('every effect draws on a bare context without throwing', () => {
    const game = fallInto(5)
    game.fx.push(
      { kind: 'pick', x: 2, y: 1, at: game.now },
      { kind: 'unlock', x: 2, y: 1, at: game.now },
      { kind: 'wake', x: 6, y: 1, at: game.now },
      { kind: 'bump', x: 3.2, y: 1.5, at: game.now, axis: 'x' },
      { kind: 'fall', x: 7, y: 1, at: game.now, caught: true },
    )
    game.stick = { x: 2, y: 2, dx: 0.3, dy: 0 }
    const { ctx, calls } = stubContext()
    expect(() => drawScene(ctx, game, 30)).not.toThrow()
    expect(calls.save).toBe(calls.restore)

    game.won = true
    game.outro = OUTRO_MS / 2
    expect(() => drawScene(ctx, game, 30)).not.toThrow()
    expect(calls.save).toBe(calls.restore)
  })
})
