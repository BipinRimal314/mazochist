/**
 * The assist settings, and the promise they make.
 *
 * Three dials, all of which only ever make the game gentler:
 *
 *   steadyBoard  stop the screen jolting when you fall or get caught
 *   fogBonus     extra cells of sight, added to whatever the level allows
 *   ghostPace    a share of the hunter's speed, so it can be told to hang back
 *
 * WHY THIS EXISTS
 *
 * The board jolts, the air is opaque, a drone rises when the thing behind you
 * closes, and the thing behind you never stops. That is four separate reasons a
 * person might have to put the game down that have nothing to do with whether
 * they wanted to know how it ends. None of them is the puzzle; all of them are
 * the presentation of it.
 *
 * WHY IT CANNOT BREAK THE PROOF
 *
 * This is the important part. The repo rests on every level having been proven
 * beatable by a simulated player, and the one way to lose that guarantee is to
 * let a setting reach into the simulation. So:
 *
 *   1. Every dial is monotone in the player's favour. A wider view and a slower
 *      hunter cannot turn a solved level into an unsolvable one, and the jolt
 *      was never in the simulation at all.
 *   2. Nothing in the engine reads this file's storage. `createGame` takes an
 *      assist record as an argument and defaults to NEUTRAL, so the solvers —
 *      which call `createGame(grid)` with one argument, as they always have —
 *      are judging the same game they judged before, whatever is in this
 *      player's browser. There is a test for exactly that.
 *
 * Kept in `engine/` rather than `ui/` because the renderer and the hunter are
 * the things that read it, and an engine module importing from the React shell
 * would be the dependency pointing the wrong way.
 */

const ASSIST_KEY = 'maizes:assist'

/** The game as designed: no help, and what every solver sees. */
const NEUTRAL = Object.freeze({
  steadyBoard: false,
  fogBonus: 0,
  ghostPace: 1,
})

/** What the dials are allowed to be. Anything else is ignored on read. */
const FOG_BONUS_MAX = 3
const GHOST_PACE_MIN = 0.5

function clamp(value, low, high, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback
}

/** Fold anything at all into a usable assist record. */
function adopt(raw) {
  if (!raw || typeof raw !== 'object') return { ...NEUTRAL }
  return {
    steadyBoard: raw.steadyBoard === true,
    fogBonus: clamp(raw.fogBonus, 0, FOG_BONUS_MAX, 0),
    ghostPace: clamp(raw.ghostPace, GHOST_PACE_MIN, 1, 1),
  }
}

let current = null

/**
 * Whether the machine has already said it wants less movement.
 *
 * A player who has set this at the OS level has told every application on it
 * what they need, and should not have to find a pause menu to say it again.
 */
function systemPrefersStill() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * The player's settings. Read once and cached; storage may not exist at all.
 *
 * With nothing stored, the only dial that is not neutral is the jolt, and only
 * if the system asked. Choosing anything in the menu writes the whole record,
 * so the player can turn the jolt back on and it stays on.
 */
function assist() {
  if (current) return current
  let stored = null
  try {
    stored = JSON.parse(localStorage.getItem(ASSIST_KEY))
  } catch { /* private mode, or nothing stored */ }
  current = stored
    ? adopt(stored)
    : { ...NEUTRAL, steadyBoard: systemPrefersStill() }
  return current
}

/** Change one or more dials. Returns the settings as they now stand. */
function setAssist(patch) {
  current = adopt({ ...assist(), ...patch })
  try {
    localStorage.setItem(ASSIST_KEY, JSON.stringify(current))
  } catch { /* private mode: hold it in memory for this session */ }
  return current
}

/** True when the player has turned anything on, for labelling the menu. */
const assistOn = () => {
  const a = assist()
  return a.steadyBoard || a.fogBonus > 0 || a.ghostPace < 1
}

/** Testing seam: drop the cached copy so the next read hits storage again. */
function resetAssist() {
  current = null
}

export {
  assist, setAssist, assistOn, resetAssist, adopt,
  NEUTRAL, ASSIST_KEY, FOG_BONUS_MAX, GHOST_PACE_MIN,
}
