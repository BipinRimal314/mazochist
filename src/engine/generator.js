import { createGrid, setModifier, setStart, setEnd, setHiddenWord, getCell } from './maze'

// seeded PRNG for deterministic level generation
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// recursive backtracker maze generation — guarantees exactly one path between any two cells
function generateMaze(cols, rows, seed) {
  const rng = mulberry32(seed)

  // start with all walls
  const walls = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      walls.push({ top: true, right: true, bottom: true, left: true })
    }
  }

  const visited = new Array(cols * rows).fill(false)
  const stack = []
  const startX = 0
  const startY = 0

  visited[startY * cols + startX] = true
  stack.push({ x: startX, y: startY })

  while (stack.length > 0) {
    const current = stack[stack.length - 1]
    const neighbors = []

    const dirs = [
      { dx: 0, dy: -1, wall: 'top', opposite: 'bottom' },
      { dx: 1, dy: 0, wall: 'right', opposite: 'left' },
      { dx: 0, dy: 1, wall: 'bottom', opposite: 'top' },
      { dx: -1, dy: 0, wall: 'left', opposite: 'right' },
    ]

    for (const dir of dirs) {
      const nx = current.x + dir.dx
      const ny = current.y + dir.dy
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny * cols + nx]) {
        neighbors.push({ x: nx, y: ny, ...dir })
      }
    }

    if (neighbors.length === 0) {
      stack.pop()
      continue
    }

    const chosen = neighbors[Math.floor(rng() * neighbors.length)]
    const ci = current.y * cols + current.x
    const ni = chosen.y * cols + chosen.x

    walls[ci][chosen.wall] = false
    walls[ni][chosen.opposite] = false

    visited[ni] = true
    stack.push({ x: chosen.x, y: chosen.y })
  }

  // build grid
  let grid = createGrid(cols, rows)
  const newCells = grid.cells.map((cell, i) => ({
    ...cell,
    walls: walls[i],
  }))

  return { ...grid, cells: newCells }
}

// find the solution path using BFS
function solveMaze(grid) {
  const { cols } = grid
  const queue = [{ x: grid.start.x, y: grid.start.y, path: [] }]
  const visited = new Set()
  visited.add(`${grid.start.x},${grid.start.y}`)

  while (queue.length > 0) {
    const { x, y, path } = queue.shift()
    const newPath = [...path, { x, y }]

    if (x === grid.end.x && y === grid.end.y) return newPath

    const cell = getCell(grid, x, y)
    if (!cell) continue

    const dirs = [
      { dx: 0, dy: -1, wall: 'top' },
      { dx: 1, dy: 0, wall: 'right' },
      { dx: 0, dy: 1, wall: 'bottom' },
      { dx: -1, dy: 0, wall: 'left' },
    ]

    for (const dir of dirs) {
      if (cell.walls[dir.wall]) continue
      const nx = x + dir.dx
      const ny = y + dir.dy
      const key = `${nx},${ny}`
      if (visited.has(key)) continue
      visited.add(key)
      queue.push({ x: nx, y: ny, path: newPath })
    }
  }

  return []
}

// identify which cells on the solution path are turns vs straight segments
function getStraightCells(solutionPath) {
  const straight = new Set()
  for (let i = 1; i < solutionPath.length - 1; i++) {
    const prev = solutionPath[i - 1]
    const curr = solutionPath[i]
    const next = solutionPath[i + 1]
    // straight if prev→curr→next is the same direction
    const dx1 = curr.x - prev.x
    const dy1 = curr.y - prev.y
    const dx2 = next.x - curr.x
    const dy2 = next.y - curr.y
    if (dx1 === dx2 && dy1 === dy2) {
      straight.add(`${curr.x},${curr.y}`)
    }
  }
  return straight
}

// place modifiers along or near the solution path for maximum suffering
function placeModifiers(grid, solutionPath, modifierTypes, count, rng, avoidStart, avoidEnd) {
  const straightCells = getStraightCells(solutionPath)

  const candidates = solutionPath.filter((p, i) => {
    if (avoidStart && i < 3) return false
    if (avoidEnd && i > solutionPath.length - 4) return false
    const cell = getCell(grid, p.x, p.y)
    return cell && !cell.modifier
  })

  // shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  const placed = Math.min(count, candidates.length)
  for (let i = 0; i < placed; i++) {
    let mod = modifierTypes[Math.floor(rng() * modifierTypes.length)]
    const key = `${candidates[i].x},${candidates[i].y}`

    // ice only on straight segments — placing ice on turns makes levels unbeatable
    // (ball slides past the turn and can never reach the exit)
    if (mod === 'ice' && !straightCells.has(key)) {
      // swap to a non-ice modifier
      const nonIce = modifierTypes.filter((m) => m !== 'ice')
      if (nonIce.length > 0) {
        mod = nonIce[Math.floor(rng() * nonIce.length)]
      } else {
        continue // skip if ice is the only option and cell is a turn
      }
    }

    grid = setModifier(grid, candidates[i].x, candidates[i].y, mod)
  }

  return grid
}

// place modifiers OFF the solution path (dead ends, wrong turns)
function placeModifiersOffPath(grid, solutionPath, modifierTypes, count, rng) {
  const pathSet = new Set(solutionPath.map((p) => `${p.x},${p.y}`))
  const candidates = grid.cells.filter((c) =>
    !pathSet.has(`${c.x},${c.y}`) && !c.modifier &&
    !(c.x === grid.start.x && c.y === grid.start.y) &&
    !(c.x === grid.end.x && c.y === grid.end.y)
  )

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  const placed = Math.min(count, candidates.length)
  for (let i = 0; i < placed; i++) {
    const mod = modifierTypes[Math.floor(rng() * modifierTypes.length)]
    grid = setModifier(grid, candidates[i].x, candidates[i].y, mod)
  }

  return grid
}

// ensure teleporters come in pairs
function placeTeleporterPair(grid, solutionPath, rng) {
  const candidates = solutionPath.filter((p, i) => {
    if (i < 2 || i > solutionPath.length - 2) return false
    const cell = getCell(grid, p.x, p.y)
    return cell && !cell.modifier
  })

  if (candidates.length < 2) return grid

  const idx1 = Math.floor(rng() * candidates.length)
  let idx2 = Math.floor(rng() * candidates.length)
  while (idx2 === idx1) idx2 = Math.floor(rng() * candidates.length)

  grid = setModifier(grid, candidates[idx1].x, candidates[idx1].y, 'teleporter')
  grid = setModifier(grid, candidates[idx2].x, candidates[idx2].y, 'teleporter')
  return grid
}

const CHAPTER_NAMES = [
  null, // 0 — unused
  'Baby Steps',         // ch1: levels 1-10 (hand-crafted, already exist)
  'Combinations',       // ch2: 11-20
  'The Corridors',      // ch3: 21-30
  'Counterintuitive',   // ch4: 31-40
  'Memory',             // ch5: 41-50
  'Deception',          // ch6: 51-60
  'Timing',             // ch7: 61-70
  'Scale',              // ch8: 71-80
  'Chaos',              // ch9: 81-90
  'Impossible',         // ch10: 91-100
]

const LEVEL_WORDS = [
  // 11-20 (Combinations)
  'COMBO', 'MIXED', 'DOUBLE', 'TANGLED', 'MESHED', 'LAYERED', 'STACKED', 'WOVEN', 'FUSED', 'BONDED',
  // 21-30 (Corridors)
  'NARROW', 'SNAKE', 'WINDING', 'TWISTED', 'SPIRAL', 'COILED', 'THREAD', 'NEEDLE', 'WIRE', 'VEIN',
  // 31-40 (Counterintuitive)
  'WRONG', 'TRICK', 'MIRROR', 'INVERT', 'DETOUR', 'PARADOX', 'LOOP', 'KNOT', 'TWIST', 'FLIP',
  // 41-50 (Memory)
  'DARK', 'SHADOW', 'VOID', 'ABYSS', 'CAVE', 'DEPTH', 'MURK', 'GLOOM', 'FOG', 'DUSK',
  // 51-60 (Deception)
  'FALSE', 'MIRAGE', 'DECOY', 'PHANTOM', 'GHOST', 'BAIT', 'TRAP', 'HOAX', 'SHAM', 'RUSE',
  // 61-70 (Timing)
  'PULSE', 'RHYTHM', 'CLOCK', 'TEMPO', 'SYNC', 'BEAT', 'WAVE', 'CYCLE', 'FLUX', 'SHIFT',
  // 71-80 (Scale)
  'VAST', 'SPRAWL', 'OCEAN', 'DESERT', 'EXPANSE', 'TITAN', 'GIANT', 'IMMENSE', 'COLOSSAL', 'MASSIVE',
  // 81-90 (Chaos)
  'STORM', 'MAYHEM', 'HAVOC', 'BEDLAM', 'FRENZY', 'TURMOIL', 'FURY', 'RAMPAGE', 'RIOT', 'ANARCHY',
  // 91-100 (Impossible)
  'DOOM', 'AGONY', 'TORMENT', 'DESPAIR', 'DREAD', 'SORROW', 'ANGUISH', 'MISERY', 'WRATH', 'MAZOCHIST',
]

const LEVEL_DESCRIPTIONS = {
  2: [
    'Ice + reverse. Pick your poison.',
    'Farts on ice. Good luck stopping.',
    'Teleporters into reverse zones.',
    'Gravity wells on ice. Physics hates you.',
    'Blackout + ice. Sliding blind.',
    'Reverse + gravity. Nothing works right.',
    'Teleporters into fart zones. Chain reaction.',
    'Ice corridors with gravity traps.',
    'Reverse blackout. Controls lie, eyes lie.',
    'Everything from this chapter at once.',
  ],
  3: [
    'Long and narrow. No shortcuts.',
    'The snake path. Every turn matters.',
    'Winding corridors with ice patches.',
    'Twisted path through reverse zones.',
    'Spiral inward. Then spiral out.',
    'Coiled path with fart traps.',
    'Thread the needle through gravity wells.',
    'Precise movement required. No room for error.',
    'Wire-thin path through blackout.',
    'The longest path yet. Every modifier.',
  ],
  4: [
    'The exit is behind you.',
    'Go right to go left.',
    'The obvious path is wrong.',
    'Teleporters reverse your progress. Or do they?',
    'The long way is the short way.',
    'Two steps back, one step forward.',
    'The loop that isn\'t a loop.',
    'Everything points wrong.',
    'Trust nothing. Especially the obvious.',
    'The most counterintuitive maze yet.',
  ],
  5: [
    'Lights out. Remember the walls.',
    'Brief glimpses. Memorize fast.',
    'Dark corridors. No landmarks.',
    'Blackout with ice. Sliding blind.',
    'Memorize, then navigate. No second look.',
    'Deep darkness. Trust your hands.',
    'Fog of war. Tiny spotlight.',
    'Blackout + reverse. Memory fails too.',
    'Almost entirely dark. Almost.',
    'Total darkness. Pure memory.',
  ],
  6: [
    'One real exit. Five fakes.',
    'The trophy lies.',
    'Every good path has a decoy.',
    'Fake exits guard the real one.',
    'Trust issues, the level.',
    'Bait and switch. Then switch again.',
    'The trap that looks like salvation.',
    'Nothing is what it seems.',
    'Paranoia is a survival strategy.',
    'The most dishonest maze ever built.',
  ],
  7: [
    'Walls that breathe. Time your moves.',
    'Spinning walls. Wait for the gap.',
    'Slide walls + spinners. Rhythm game.',
    'Fast spinners. Split-second windows.',
    'The walls never stop moving.',
    'Every surface shifts. Find the beat.',
    'Syncopated walls. Off-rhythm on purpose.',
    'Timing + ice. Momentum carries you through or past.',
    'The fastest walls yet. React, don\'t think.',
    'Every wall moves. Every second counts.',
  ],
  8: [
    'Bigger grid. More wrong turns.',
    'The maze sprawls. Patience required.',
    'So many paths. Only one works.',
    'Scale breeds confusion.',
    'The further you go, the more you forget.',
    'A titan of a maze.',
    'Giant grid with scattered modifiers.',
    'Immense. Disorienting. Relentless.',
    'You will get lost. Accept it.',
    'The biggest maze before chaos.',
  ],
  9: [
    'Every modifier. Random placement.',
    'Chaos with a side of chaos.',
    'The rules change every cell.',
    'Bedlam. No pattern. No mercy.',
    'Frenzy of traps, all active.',
    'Turbulent. Unpredictable. Cruel.',
    'Fury in maze form.',
    'A rampage of mechanics.',
    'Riotous. Every cell is hostile.',
    'Anarchy. The maze has no rules.',
  ],
  10: [
    'This was designed to hurt.',
    'Agony is the only path.',
    'Suffering is the curriculum.',
    'Despair is a valid strategy.',
    'Fear the maze. The maze fears nothing.',
    'Sorrow. But also: ice + farts + blackout.',
    'Anguish in every direction.',
    'Misery loves company. You\'re alone.',
    'Wrath of the maze gods.',
    'The last maze. The worst maze. MAZOCHIST.',
  ],
}

function generateLevel(levelNumber) {
  const seed = levelNumber * 7919 + 42
  const rng = mulberry32(seed)

  const chapter = Math.floor((levelNumber - 1) / 10) + 1
  const indexInChapter = (levelNumber - 1) % 10
  const word = LEVEL_WORDS[levelNumber - 11] || 'PAIN'
  const desc = LEVEL_DESCRIPTIONS[chapter]
    ? LEVEL_DESCRIPTIONS[chapter][indexInChapter]
    : 'Good luck.'

  // grid size scales with chapter
  const sizeMap = {
    2: 10, 3: 12, 4: 10, 5: 10,
    6: 12, 7: 12, 8: 14 + indexInChapter, 9: 16, 10: 18 + Math.floor(indexInChapter / 3),
  }
  const size = sizeMap[chapter] || 10

  // generate base maze
  let grid = generateMaze(size, size, seed)

  // place start at top-left area, end at bottom-right area
  const startX = Math.floor(rng() * Math.floor(size / 4))
  const startY = Math.floor(rng() * Math.floor(size / 4))
  const endX = size - 1 - Math.floor(rng() * Math.floor(size / 4))
  const endY = size - 1 - Math.floor(rng() * Math.floor(size / 4))
  grid = setStart(grid, startX, startY)
  grid = setEnd(grid, endX, endY)
  grid = setHiddenWord(grid, word)

  // find solution for modifier placement
  const solution = solveMaze(grid)

  // difficulty scaling
  const modCountBase = 3 + indexInChapter
  const modCountOff = 1 + Math.floor(indexInChapter / 2)

  // chapter-specific modifier placement
  switch (chapter) {
    case 2: { // Combinations
      const combos = [
        ['ice', 'reverse'],
        ['fart', 'ice'],
        ['teleporter', 'reverse'],
        ['gravity', 'ice'],
        ['blackout', 'ice'],
        ['reverse', 'gravity'],
        ['teleporter', 'fart'],
        ['ice', 'gravity'],
        ['reverse', 'blackout'],
        ['ice', 'reverse', 'fart', 'gravity'],
      ]
      const mods = combos[indexInChapter]
      grid = placeModifiers(grid, solution, mods, modCountBase, rng, true, true)
      if (mods.includes('teleporter')) grid = placeTeleporterPair(grid, solution, rng)
      break
    }

    case 3: { // Corridors — fewer modifiers but placed precisely on the path
      const mods = ['ice', 'reverse', 'fart', 'gravity'][indexInChapter % 4]
      grid = placeModifiers(grid, solution, [mods], 2 + Math.floor(indexInChapter / 2), rng, true, true)
      break
    }

    case 4: { // Counterintuitive — teleporters that force backtracking
      grid = placeTeleporterPair(grid, solution, rng)
      if (indexInChapter > 3) grid = placeTeleporterPair(grid, solution, rng)
      const mods = ['reverse', 'fart']
      grid = placeModifiers(grid, solution, mods, 2 + indexInChapter, rng, true, true)
      break
    }

    case 5: { // Memory — heavy blackout
      const blackoutCount = 4 + indexInChapter * 2
      grid = placeModifiers(grid, solution, ['blackout'], blackoutCount, rng, true, false)
      if (indexInChapter > 4) {
        grid = placeModifiers(grid, solution, ['ice', 'reverse'], 3, rng, true, true)
      }
      break
    }

    case 6: { // Deception — fake exits everywhere
      const fakeCount = 2 + indexInChapter
      grid = placeModifiers(grid, solution, ['fakeExit'], fakeCount, rng, true, true)
      grid = placeModifiersOffPath(grid, solution, ['fakeExit'], 2, rng)
      if (indexInChapter > 5) {
        grid = placeModifiers(grid, solution, ['reverse', 'fart'], 3, rng, true, true)
      }
      break
    }

    case 7: { // Timing — spinners and slide walls
      const timingMods = indexInChapter < 5
        ? ['slideWall', 'spinner']
        : ['slideWall', 'spinner', 'ice']
      grid = placeModifiers(grid, solution, timingMods, modCountBase, rng, true, true)
      if (indexInChapter > 7) {
        grid = placeModifiers(grid, solution, ['fart', 'reverse'], 2, rng, true, true)
      }
      break
    }

    case 8: { // Scale — bigger grids, mixed modifiers
      const scaleMods = ['ice', 'reverse', 'gravity', 'blackout', 'fart']
      grid = placeModifiers(grid, solution, scaleMods, modCountBase + 2, rng, true, true)
      grid = placeTeleporterPair(grid, solution, rng)
      if (indexInChapter > 4) {
        grid = placeModifiers(grid, solution, ['fakeExit'], 2, rng, true, true)
      }
      break
    }

    case 9: { // Chaos — every modifier
      const allMods = ['ice', 'reverse', 'gravity', 'blackout', 'fart', 'fakeExit', 'spinner', 'slideWall', 'fatCursor']
      grid = placeModifiers(grid, solution, allMods, 8 + indexInChapter * 2, rng, true, true)
      grid = placeTeleporterPair(grid, solution, rng)
      grid = placeModifiersOffPath(grid, solution, allMods, 4 + indexInChapter, rng)
      break
    }

    case 10: { // Impossible — maxed everything
      const allMods = ['ice', 'reverse', 'gravity', 'blackout', 'fart', 'fakeExit', 'spinner', 'slideWall', 'fatCursor']
      const count = 12 + indexInChapter * 3
      grid = placeModifiers(grid, solution, allMods, count, rng, true, true)
      grid = placeTeleporterPair(grid, solution, rng)
      grid = placeTeleporterPair(grid, solution, rng)
      grid = placeModifiersOffPath(grid, solution, allMods, 6 + indexInChapter * 2, rng)
      break
    }
  }

  const chapterName = CHAPTER_NAMES[chapter] || 'Unknown'

  return {
    name: `${levelNumber}. ${word}`,
    description: desc,
    chapter: chapterName,
    chapterNumber: chapter,
    grid,
  }
}

export { generateLevel, CHAPTER_NAMES }
