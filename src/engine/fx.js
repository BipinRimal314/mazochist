/**
 * Presentation events: the things the board *shows* happening, as opposed to
 * the things that happen.
 *
 * The engine already carried three of these — `flash`, `shake`, `trail` — as
 * ad-hoc fields. This is the general form: a short list of timestamped records
 * the renderer reads and the rules never do. A record says *what* happened,
 * *where* and *when* on the game clock; how it looks is entirely `render.js`'s
 * business, and how long it lives is decided here so both the engine and the
 * renderer agree on when it is gone.
 *
 * Nothing in this file can reach the simulation. `pushFx` appends and
 * `pruneFx` drops the expired, and neither reads the ball, the grid, or the
 * clock for anything but a stamp. The solvers step the same engine several
 * hundred thousand times a level, so both are O(1) per step and allocate
 * nothing while nothing is happening.
 */

/** How long each kind stays on the board, in game-clock ms. */
const FX_LIFE = {
  fall: 650,      // the hat going down a hole
  spawn: 320,     // the hat reappearing at the start
  pick: 700,      // an ear coming up
  unpick: 600,    // an ear going back where it lay
  unlock: 1100,   // the last ear: the way on is open
  bump: 260,      // a knock against a wall
  wake: 900,      // the ghost standing up
}

const FX_MAX = 24

/** Record a presentation event at game time `now`. Never changes the rules. */
function pushFx(game, kind, at, extra = null) {
  const record = { kind, x: at.x, y: at.y, at: game.now }
  if (extra) Object.assign(record, extra)
  game.fx.push(record)
  // a hard cap rather than a policy: a player stuck on a trap for a minute
  // should not be handed a list that grows without end
  if (game.fx.length > FX_MAX) game.fx.shift()
  return record
}

/** Drop whatever has expired. Oldest first, so it stops at the first survivor. */
function pruneFx(game) {
  const fx = game.fx
  while (fx.length > 0 && game.now - fx[0].at >= (FX_LIFE[fx[0].kind] ?? 0)) fx.shift()
}

/** 0 at birth, 1 at the end of its life. */
function fxProgress(record, now) {
  const life = FX_LIFE[record.kind] ?? 1
  return Math.max(0, Math.min(1, (now - record.at) / life))
}

/**
 * The latest record of `kind`, or null. Used by the renderer to answer
 * "is the hat still arriving" without walking the list on every frame twice.
 */
function latestFx(game, kind) {
  for (let i = game.fx.length - 1; i >= 0; i--) {
    if (game.fx[i].kind === kind) return game.fx[i]
  }
  return null
}

/*
 * A knock against a wall worth showing.
 *
 * The physics reverses a velocity component on contact (`BOUNCE`), so a hit
 * reads as a sign flip between one step and the next. Holding into a wall flips
 * the sign every step too, but at almost no speed — one step of acceleration
 * — which is what the threshold is for. The number is a share of the ball's
 * real terminal velocity (≈0.164 cells/step): above this it arrived at speed.
 */
const BUMP_MIN_SPEED = 0.085

/** Which axis, if any, was struck hard enough to show. */
function bumpAxis(before, after) {
  if (before.vx * after.vx < 0 && Math.abs(before.vx) >= BUMP_MIN_SPEED) return 'x'
  if (before.vy * after.vy < 0 && Math.abs(before.vy) >= BUMP_MIN_SPEED) return 'y'
  return null
}

export { FX_LIFE, FX_MAX, BUMP_MIN_SPEED, pushFx, pruneFx, fxProgress, latestFx, bumpAxis }
