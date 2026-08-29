// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  assist, setAssist, assistOn, resetAssist, adopt,
  NEUTRAL, ASSIST_KEY, FOG_BONUS_MAX, GHOST_PACE_MIN,
} from './assist.js'
import { createGame, restartGame } from './game.js'
import { fromJSON } from '../generate/generate.js'
import levelData from '../../public/levels.json'

const hunted = fromJSON(levelData.find((l) => l.h))
const foggy = fromJSON(levelData.find((l) => l.fog !== null))

/* jsdom here does not supply localStorage, so stand one up — same as persist */
function install() {
  const map = new Map()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)) },
      removeItem: (k) => { map.delete(k) },
      clear: () => { map.clear() },
    },
  })
}

beforeEach(() => {
  install()
  resetAssist()
})
afterEach(() => {
  resetAssist()
  vi.restoreAllMocks()
})

describe('the assist settings', () => {
  it('starts neutral when the system has asked for nothing', () => {
    // no matchMedia at all is one of the shapes this has to survive
    expect(assist()).toEqual(NEUTRAL)
    expect(assistOn()).toBe(false)
  })

  it('remembers what was chosen', () => {
    setAssist({ fogBonus: 2, ghostPace: 0.7 })
    resetAssist()
    expect(assist()).toEqual({ steadyBoard: false, fogBonus: 2, ghostPace: 0.7 })
    expect(assistOn()).toBe(true)
  })

  it('refuses a dial that would make the game harder or stranger', () => {
    // every setting is monotone in the player's favour; nothing may invert that
    expect(adopt({ fogBonus: -4 }).fogBonus).toBe(0)
    expect(adopt({ fogBonus: 99 }).fogBonus).toBe(FOG_BONUS_MAX)
    expect(adopt({ ghostPace: 3 }).ghostPace).toBe(1)
    expect(adopt({ ghostPace: 0 }).ghostPace).toBe(GHOST_PACE_MIN)
    expect(adopt({ fogBonus: 'wide' }).fogBonus).toBe(0)
    expect(adopt('nonsense')).toEqual(NEUTRAL)
  })

  it('survives storage it cannot read', () => {
    window.localStorage.setItem(ASSIST_KEY, '{not json')
    expect(assist()).toEqual(NEUTRAL)
  })

  it('takes the jolt off for a system that asked, until the player says otherwise', () => {
    // jsdom here has no matchMedia at all, which is also the case assist.js
    // has to survive — so stand one up that says "reduce"
    Object.defineProperty(window, 'matchMedia', {
      configurable: true, writable: true, value: () => ({ matches: true }),
    })
    expect(assist().steadyBoard).toBe(true)

    // and the player may still turn it back on, and have that stick
    setAssist({ steadyBoard: false })
    resetAssist()
    expect(assist().steadyBoard).toBe(false)
  })
})

describe('assist cannot reach the proof', () => {
  /*
   * The whole repo rests on every level having been judged beatable by a
   * simulated player. The one way to lose that is to let a player's settings
   * reach the simulation, so the solvers call createGame with one argument and
   * get NEUTRAL no matter what is in this browser. If this test ever fails, a
   * shipped campaign was judged against somebody's accessibility settings.
   */
  it('leaves a game built the solvers\' way untouched', () => {
    setAssist({ steadyBoard: true, fogBonus: 3, ghostPace: GHOST_PACE_MIN })

    const solverGame = createGame(hunted)
    expect(solverGame.assist).toEqual(NEUTRAL)

    const playerGame = createGame(hunted, assist())
    expect(playerGame.hunter.speed).toBeLessThan(solverGame.hunter.speed)
    expect(playerGame.hunter.speed).toBeCloseTo(solverGame.hunter.speed * GHOST_PACE_MIN)
  })

  it('keeps the ghost slowed across a restart', () => {
    const game = createGame(hunted, { ...NEUTRAL, ghostPace: 0.5 })
    const slowed = game.hunter.speed
    restartGame(game)
    expect(game.hunter.speed).toBe(slowed)
  })

  it('never speeds the ghost up', () => {
    const plain = createGame(hunted)
    for (const pace of [0.5, 0.7, 1]) {
      const game = createGame(hunted, { ...NEUTRAL, ghostPace: pace })
      expect(game.hunter.speed).toBeLessThanOrEqual(plain.hunter.speed)
    }
  })

  it('holds the board steady without touching anything the rules read', () => {
    const game = createGame(foggy, { ...NEUTRAL, steadyBoard: true })
    const before = { deaths: game.deaths, now: game.now }
    game.assist = { ...NEUTRAL, steadyBoard: true }
    expect(game.shake).toBe(0)
    expect({ deaths: game.deaths, now: game.now }).toEqual(before)
  })
})
