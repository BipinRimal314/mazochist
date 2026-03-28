/**
 * Load ML-generated levels from JSON and convert to game format.
 * Replaces the old 100-level procedural generator with curated ML levels.
 */

import { LEVELS as HAND_CRAFTED } from './levels'

function jsonToGrid(mazeData) {
  const cols = mazeData.c
  const rows = mazeData.r

  const cells = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({
        x, y,
        walls: { top: false, right: false, bottom: false, left: false },
        modifier: null,
        trap: false,
        gate: null,
      })
    }
  }

  for (const entry of mazeData.d) {
    const [x, y, wallBits, modifier, trap, gateDir] = entry
    const cell = cells[y * cols + x]
    cell.walls.top = !!(wallBits & 1)
    cell.walls.right = !!(wallBits & 2)
    cell.walls.bottom = !!(wallBits & 4)
    cell.walls.left = !!(wallBits & 8)
    if (modifier) cell.modifier = modifier
    if (trap) cell.trap = true
    if (gateDir) cell.gate = { direction: gateDir, open: true }
  }

  return {
    cols, rows, cells,
    start: { x: mazeData.s[0], y: mazeData.s[1] },
    end: { x: mazeData.e[0], y: mazeData.e[1] },
    hiddenWord: mazeData.w || '',
  }
}

function loadMLLevels(jsonData, chapterName, chapterNumber) {
  return jsonData.map((level, i) => ({
    name: level.name || `${chapterName} ${i + 1}`,
    description: level.description || `Fitness: ${Math.round(level.fitness || 0)}`,
    chapter: chapterName,
    chapterNumber,
    grid: jsonToGrid(level.maze),
    era: level.era || 'learning',
    fogRadius: level.fog_radius || null,
    deathMode: level.death_mode || 'progress',
  }))
}

async function loadAllLevels() {
  // chapter 1: 5 hand-crafted intro levels (keep the best ones)
  const intro = HAND_CRAFTED.slice(0, 5).map((l) => ({
    ...l,
    chapter: 'The Basics',
    chapterNumber: 1,
    era: 'learning',
    fogRadius: null,
    deathMode: 'progress',
  }))

  // load ML-generated levels
  let evolved = []
  let rlPlaced = []

  try {
    const evolvedResp = await fetch('/levels/evolved_50.json')
    const evolvedData = await evolvedResp.json()
    evolved = loadMLLevels(evolvedData, 'Evolved', 2)
  } catch (e) {
    console.warn('Could not load evolved levels:', e)
  }

  try {
    const rlResp = await fetch('/levels/rl_placed_20.json')
    const rlData = await rlResp.json()
    rlPlaced = loadMLLevels(rlData, 'RL-Placed', 3)
  } catch (e) {
    console.warn('Could not load RL levels:', e)
  }

  let vaeCombined = []
  try {
    const vaeResp = await fetch('/levels/vae_rl_combined.json')
    const vaeData = await vaeResp.json()
    vaeCombined = loadMLLevels(vaeData, 'Neural', 4)
  } catch (e) {
    console.warn('Could not load VAE+RL levels:', e)
  }

  return [...intro, ...evolved, ...rlPlaced, ...vaeCombined]
}

export { loadAllLevels }
