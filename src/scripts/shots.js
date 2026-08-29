/**
 * Draw real boards to PNG, so somebody can look at them.
 *
 * Run:  npm run shots            # the default set, into shots/
 *       npm run shots -- --cell 64
 *
 * WHY THIS EXISTS
 *
 * For most of this repo's life no one working on it had seen a single frame
 * render. The board is canvas, the tests run under jsdom — whose canvas is a
 * stub that accepts every call and draws nothing — so a change to `render.js`
 * could be reasoned about, type-checked, unit-tested and completely wrong. The
 * neon, the fog, the ghost and the trail map were all shipped unseen.
 *
 * This runs the *real* `drawScene` against a real 2D context from
 * `@napi-rs/canvas`, on real generated levels, and writes PNGs. It is not a
 * test and it asserts nothing; it exists so that a visual claim can be checked
 * by looking instead of by argument.
 *
 * It drives the ball with actual input for a few hundred fixed steps before
 * drawing, because the interesting states — fog lifted around a trail, a
 * hunter awake, memory fading behind you — do not exist at t=0.
 */

import { createCanvas } from '@napi-rs/canvas'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')

/*
 * The globals `render.js` reaches for in a browser. `getFogCanvas` falls back
 * to `document.createElement` when there is no OffscreenCanvas, and
 * `setupCanvas` reads `devicePixelRatio` — neither exists in node, and neither
 * is worth changing the engine for.
 */
globalThis.window = { devicePixelRatio: 2 }
globalThis.document = { createElement: () => createCanvas(8, 8) }
globalThis.Image = class {}

const { fromJSON } = await import(resolve(ROOT, 'src/generate/generate.js'))
const { createGame, stepGame } = await import(resolve(ROOT, 'src/engine/game.js'))
const render = await import(resolve(ROOT, 'src/engine/render.js'))

const levels = JSON.parse(readFileSync(resolve(ROOT, 'public/levels.json'), 'utf8'))

const args = process.argv.slice(2)
const cellArg = args.indexOf('--cell')
const CELL = cellArg === -1 ? 44 : Number(args[cellArg + 1])
const OUT = resolve(ROOT, 'shots')

/**
 * One shot per thing worth looking at, rather than one per level.
 *
 * `drive` is a list of [direction, steps] the ball is actually steered through
 * before the frame is drawn. `steps` runs the clock on afterwards with no input
 * — that is how the hunter gets far enough into its spawn timer to be awake.
 */
const SHOTS = [
  { label: '01-open-board', name: 'Warm Up 1' },
  { label: '02-traps', name: 'Two Trips 1', drive: [['right', 90], ['down', 80]] },
  { label: '03-fog-wide', name: 'First Light 1', drive: [['left', 110], ['down', 90]] },
  { label: '04-fog-tight', name: 'The Fog 1', drive: [['left', 120], ['down', 90], ['left', 120]] },
  { label: '05-hunted', name: 'Company 2', steps: 2600, drive: [['left', 150], ['up', 120]] },
  { label: '06-sand', name: 'The Dry Reach 1', drive: [['right', 130], ['down', 90]] },
  { label: '07-snow', name: 'The White Mile 1', drive: [['right', 140], ['up', 100]] },
  { label: '08-fading', name: 'Forgetting 1', drive: [['right', 120], ['down', 110]] },
  { label: '09-neon', name: 'The Lit Wood 1', drive: [['right', 130], ['down', 110], ['right', 120]] },
  { label: '10-ember', name: 'Nothing Stays 3', drive: [['left', 120], ['up', 100]] },
]

const DIRECTIONS = ['up', 'down', 'left', 'right']

function shoot({ label, name, steps = 0, drive = [] }) {
  const data = levels.find((level) => level.name === name)
  if (!data) {
    console.error(`no level named "${name}" — the campaign may have been re-cut`)
    return
  }

  const grid = fromJSON(data)
  const game = createGame(grid)

  let taken = 0
  for (const [direction, count] of drive) {
    for (const key of DIRECTIONS) game.input[key] = false
    game.input[direction] = true
    for (let i = 0; i < count; i++) { stepGame(game); taken += 1 }
  }
  for (const key of DIRECTIONS) game.input[key] = false
  for (let i = taken; i < steps; i++) stepGame(game)

  const canvas = createCanvas(grid.cols * CELL, grid.rows * CELL)
  render.drawScene(canvas.getContext('2d'), game, CELL)
  writeFileSync(resolve(OUT, `${label}.png`), canvas.toBuffer('image/png'))

  console.log(
    `${label.padEnd(16)} ${name.padEnd(17)} ${data.terrain.padEnd(10)} `
    + `${grid.cols}x${grid.rows} fog=${data.fog ?? '-'} deaths=${game.deaths}`
  )
}

mkdirSync(OUT, { recursive: true })
for (const shot of SHOTS) shoot(shot)
console.log(`\nwrote ${SHOTS.length} shots to ./shots`)
