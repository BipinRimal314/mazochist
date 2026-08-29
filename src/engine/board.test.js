import { describe, it, expect } from 'vitest'
import { createGrid, setWall, DIRECTIONS } from './grid.js'
import { createGame } from './game.js'
import { MAIZE_SCALE, TERRAINS, drawMaizeIcon, drawMaze, drawBall } from './render.js'
import { ballDrawMetrics } from './render.js'

/**
 * What the board is made of.
 *
 * A headless canvas draws nothing and complains about nothing, so none of this
 * can check that the board *looks* right — `npm run shots` is what does that,
 * by writing real PNGs somebody can open. What is checked here is the geometry
 * and the invariants a screenshot would not catch you breaking: that ink stays
 * inside the cell it belongs to, that a picked ear stops being drawn, and that
 * every terrain still obeys the art direction.
 */

function recordingContext() {
  const calls = { drawImage: [], ellipse: [], arc: [], fillText: [], fillRect: [], fills: [] }
  const ctx = {
    canvas: null,
    fillStyle: null, strokeStyle: null, lineWidth: 0, font: '',
    textAlign: '', textBaseline: '', globalAlpha: 1, lineCap: '', lineJoin: '',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    drawImage: (...a) => calls.drawImage.push(a),
    ellipse: (...a) => calls.ellipse.push(a),
    arc: (...a) => calls.arc.push(a),
    fillText: (...a) => calls.fillText.push(a),
    fillRect(...a) { calls.fillRect.push([...a, this.fillStyle]) },
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    arcTo() {}, quadraticCurveTo() {},
    fill() { calls.fills.push(this.fillStyle) },
    stroke() {}, clip() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    clearRect() {}, setTransform() {},
  }
  return { ctx, calls }
}

function openBoard(size = 6) {
  const grid = createGrid(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x + 1 < size) setWall(grid, x, y, DIRECTIONS[1], false)
      if (y + 1 < size) setWall(grid, x, y, DIRECTIONS[2], false)
    }
  }
  return grid
}

describe('an ear of maize', () => {
  it('is drawn, not blitted', () => {
    // it used to be an illustrated PNG, which read as a sticker on a board made
    // of flat strokes and would be the only unlit thing on a lit ground
    const { ctx, calls } = recordingContext()
    drawMaizeIcon(ctx, 3, 5, 40)
    expect(calls.drawImage).toHaveLength(0)
    expect(calls.ellipse.length).toBeGreaterThan(0)
  })

  it('stays inside its cell, so it cannot bleed over a wall', () => {
    const cell = 40
    const { ctx, calls } = recordingContext()
    drawMaizeIcon(ctx, 0, 0, cell)

    // drawn around a translated origin, so every extent is measured from centre
    for (const [ox, oy, rx, ry] of calls.ellipse) {
      expect(Math.abs(ox) + rx, 'ear too wide for its cell').toBeLessThanOrEqual(cell / 2)
      expect(Math.abs(oy) + ry, 'ear too tall for its cell').toBeLessThanOrEqual(cell / 2)
    }
  })

  it('scales with the cell', () => {
    const small = recordingContext()
    const large = recordingContext()
    drawMaizeIcon(small.ctx, 0, 0, 20)
    drawMaizeIcon(large.ctx, 0, 0, 80)
    expect(large.calls.ellipse[0][2]).toBeCloseTo(small.calls.ellipse[0][2] * 4)
    expect(MAIZE_SCALE).toBeLessThan(1)
  })
})

describe('on the board', () => {
  function boardWithMaize() {
    const grid = openBoard()
    grid.flags = [{ x: 2, y: 2 }, { x: 4, y: 4 }]
    return grid
  }

  it('draws one ear per uncollected flag', () => {
    const game = createGame(boardWithMaize())
    const { ctx, calls } = recordingContext()
    drawMaze(ctx, game, 40)
    // three ellipses per ear: husk, cob, and nothing else
    expect(calls.ellipse.filter(([, , , ry]) => ry > 0)).not.toHaveLength(0)
    const before = calls.ellipse.length

    const picked = createGame(boardWithMaize())
    picked.captured.add('2,2')
    const second = recordingContext()
    drawMaze(second.ctx, picked, 40)
    expect(second.calls.ellipse.length, 'a picked ear should stop being drawn')
      .toBeLessThan(before)
  })

  it('leaves a faint ring where an ear was picked, not a loud tile', () => {
    const game = createGame(boardWithMaize())
    game.captured.add('2,2')
    const { ctx, calls } = recordingContext()
    drawMaze(ctx, game, 40)
    expect(calls.fillText, 'no glyphs on the board any more').toHaveLength(0)
    expect(calls.arc.length).toBeGreaterThan(0)
  })

  it('paints the ground from the terrain, not a fixed colour', () => {
    for (const name of ['field', 'snow', 'enchanted']) {
      const grid = openBoard()
      grid.terrain = name
      const { ctx, calls } = recordingContext()
      drawMaze(ctx, createGame(grid), 40)
      expect(calls.fillRect[0].at(-1)).toBe(TERRAINS[name].bg)
    }
  })
})

describe('the art direction', () => {
  /*
   * Lit from within: every ground is dark and every wall emits. The game is
   * mostly under fog, and fog over a pale page is a grey smear laid on a
   * drawing — fog over a dark ground is just the dark you have not reached.
   * If a terrain ever goes back to being paper, these fail.
   */
  const luminance = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  }

  it('gives every terrain a dark ground', () => {
    for (const [name, terrain] of Object.entries(TERRAINS)) {
      expect(luminance(terrain.bg), `${name} is not a dark ground`).toBeLessThan(0.12)
    }
  })

  it('gives every terrain a wall that emits', () => {
    for (const [name, terrain] of Object.entries(TERRAINS)) {
      expect(terrain.glow, `${name} has no glow`).toBeTruthy()
      expect(luminance(terrain.wall), `${name}'s wall is not light`)
        .toBeGreaterThan(luminance(terrain.bg) + 0.35)
    }
  })

  it('keeps the hat inside its collision radius', () => {
    // the physics clamps the centre to exactly one radius from a wall, so ink
    // outside that radius reads as clipping through a wall that is colliding
    const cell = 40
    const radius = 0.3
    const { fillRadius, rimRadius, rimWidth } = ballDrawMetrics(radius, cell)
    expect(fillRadius).toBeLessThanOrEqual(radius * cell)
    expect(rimRadius + rimWidth / 2).toBeLessThanOrEqual(radius * cell)

    const { ctx, calls } = recordingContext()
    drawBall(ctx, { x: 2, y: 2, radius }, cell)
    for (const [ox, oy, rx, ry] of calls.ellipse) {
      const dx = Math.abs(ox - 2 * cell) + rx
      const dy = Math.abs(oy - 2 * cell) + ry
      expect(Math.hypot(0, dy), 'hat ink outside the collision radius')
        .toBeLessThanOrEqual(radius * cell + 0.001)
      expect(dx, 'hat ink outside the collision radius')
        .toBeLessThanOrEqual(radius * cell + 0.001)
    }
  })
})
