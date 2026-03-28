/**
 * Load curated levels — hand-crafted basics + ML-generated curated set.
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
        liarWalls: null,
        mimic: false,
        memoryWipe: false,
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

async function loadAllLevels() {
  // chapter 1: 3 hand-crafted intro levels (just enough to learn)
  const intro = HAND_CRAFTED.slice(0, 3).map((l) => ({
    ...l,
    chapter: 'The Basics',
    chapterNumber: 1,
    era: 'learning',
    fogRadius: null,
    deathMode: 'progress',
  }))

  // chapters 2-4: curated ML levels
  let curated = []
  try {
    const resp = await fetch('/levels/curated.json')
    const data = await resp.json()

    let currentChapter = null
    let chapterNum = 1

    for (const level of data) {
      const chName = level.name.split(' ').slice(0, -1).join(' ')
      if (chName !== currentChapter) {
        chapterNum++
        currentChapter = chName
      }

      curated.push({
        name: level.name,
        description: level.description,
        chapter: currentChapter,
        chapterNumber: chapterNum,
        grid: jsonToGrid(level.maze),
        era: level.era || 'learning',
        fogRadius: level.fog_radius || null,
        deathMode: level.death_mode || 'progress',
      })
    }
  } catch (e) {
    console.warn('Could not load curated levels:', e)
  }

  return [...intro, ...curated]
}

export { loadAllLevels }
