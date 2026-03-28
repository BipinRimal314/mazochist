# True Suffering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Mazochist into a genuinely punishing puzzle game with fog of war, trap tiles, one-way gates, imperfect maze generation, and progressive death punishment.

**Architecture:** Five new systems layered onto existing engine. Maze data model gains `trap` and `gate` cell properties. Generator produces imperfect mazes with loops and seductive dead ends. Renderer gets fog-of-war and corruption post-processing. MazeSolver manages punishment state escalation per death.

**Tech Stack:** React 19, Vite, HTML5 Canvas, existing engine modules

---

## File Map

| File | Responsibility | Changes |
|------|---------------|---------|
| `src/engine/maze.js` | Grid data structure | Add `trap`, `gate` cell properties |
| `src/engine/generator.js` | Level generation | Imperfect maze algo, loop addition, dead end extension, trap/gate placement, era config |
| `src/engine/renderer.js` | Canvas drawing | Fog of war pass, trap flash, gate arrows, corruption overlay |
| `src/engine/physics.js` | Ball movement + collision | Gate collision logic, trap detection |
| `src/engine/modifiers.js` | Modifier trigger effects | Trap effect, gate pass-through |
| `src/engine/fog.js` | **NEW** — Fog of war + corruption | Fog rendering, visited cell tracking, corruption BFS spread |
| `src/components/MazeSolver.jsx` | Game UI + state | Punishment state, fog radius, gate states, corruption timer, era detection |

---

### Task 1: Extend maze data model with trap and gate properties

**Files:**
- Modify: `src/engine/maze.js`

- [ ] **Step 1: Add `setTrap` and `setGate` functions to maze.js**

Add after the existing `setHiddenWord` function in `src/engine/maze.js`:

```js
function setTrap(grid, x, y) {
  const newCells = grid.cells.map((c) =>
    c.x === x && c.y === y ? { ...c, trap: true } : c
  )
  return { ...grid, cells: newCells }
}

function setGate(grid, x, y, direction) {
  const newCells = grid.cells.map((c) =>
    c.x === x && c.y === y ? { ...c, gate: { direction, open: true } } : c
  )
  return { ...grid, cells: newCells }
}
```

- [ ] **Step 2: Update `createGrid` to include `trap` and `gate` defaults**

In the cell creation inside `createGrid`, change:
```js
cells.push({
  x,
  y,
  walls: { top: false, right: false, bottom: false, left: false },
  modifier: null,
  trap: false,
  gate: null,
})
```

- [ ] **Step 3: Update exports**

```js
export {
  GRID_SIZE,
  createGrid,
  getCell,
  toggleWallBetween,
  setModifier,
  setStart,
  setEnd,
  setHiddenWord,
  setTrap,
  setGate,
}
```

- [ ] **Step 4: Update serialization to handle trap and gate**

In `src/utils/serialize.js`, update `gridToJSON` — in the loop where entries are built:

```js
const entry = [cell.x, cell.y, wallBits]
if (cell.modifier) entry.push(cell.modifier)
else entry.push(null)
if (cell.trap) entry.push(1)
else entry.push(0)
if (cell.gate) entry.push(cell.gate.direction)
else entry.push(null)
compact.d.push(entry)
```

Change the skip condition to:
```js
if (wallBits === 0 && !cell.modifier && !cell.trap && !cell.gate) continue
```

Update `jsonToGrid` deserialization to match:
```js
for (const entry of compact.d) {
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
```

- [ ] **Step 5: Verify build**

```bash
npx vite build
```

Expected: clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/maze.js src/utils/serialize.js
git commit -m "feat: extend maze data model with trap tiles and one-way gates"
```

---

### Task 2: Imperfect maze generator with loops and seductive dead ends

**Files:**
- Modify: `src/engine/generator.js`

- [ ] **Step 1: Add loop creation function**

Add after the existing `solveMaze` function in `src/engine/generator.js`:

```js
function addLoops(grid, rng, percentage) {
  const interiorWalls = []
  for (const cell of grid.cells) {
    const { x, y } = cell
    if (cell.walls.right && x < grid.cols - 1) {
      interiorWalls.push({ x1: x, y1: y, x2: x + 1, y2: y })
    }
    if (cell.walls.bottom && y < grid.rows - 1) {
      interiorWalls.push({ x1: x, y1: y, x2: x, y2: y + 1 })
    }
  }

  // shuffle
  for (let i = interiorWalls.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [interiorWalls[i], interiorWalls[j]] = [interiorWalls[j], interiorWalls[i]]
  }

  const toRemove = Math.floor(interiorWalls.length * percentage)
  for (let i = 0; i < toRemove; i++) {
    const w = interiorWalls[i]
    grid = toggleWallBetween(grid, w.x1, w.y1, w.x2, w.y2)
  }

  return grid
}
```

- [ ] **Step 2: Add dead end extension function**

```js
function extendDeadEnds(grid, rng, maxExtension, solutionPath) {
  const pathSet = new Set(solutionPath.map((p) => `${p.x},${p.y}`))

  // find dead ends (cells with 3 walls = only one opening)
  const deadEnds = grid.cells.filter((c) => {
    const wallCount = [c.walls.top, c.walls.right, c.walls.bottom, c.walls.left]
      .filter(Boolean).length
    return wallCount === 3 && !pathSet.has(`${c.x},${c.y}`)
  })

  for (const de of deadEnds) {
    if (rng() > 0.6) continue // only extend 40% of dead ends

    let cx = de.x
    let cy = de.y
    const extended = new Set([`${cx},${cy}`])

    for (let step = 0; step < maxExtension; step++) {
      // find which direction to extend (prefer toward exit for seduction)
      const dirs = [
        { dx: 0, dy: -1, wall: 'top', opp: 'bottom' },
        { dx: 1, dy: 0, wall: 'right', opp: 'left' },
        { dx: 0, dy: 1, wall: 'bottom', opp: 'top' },
        { dx: -1, dy: 0, wall: 'left', opp: 'right' },
      ].filter((d) => {
        const nx = cx + d.dx
        const ny = cy + d.dy
        const key = `${nx},${ny}`
        if (nx < 0 || nx >= grid.cols || ny < 0 || ny >= grid.rows) return false
        if (pathSet.has(key)) return false
        if (extended.has(key)) return false
        const neighbor = getCell(grid, nx, ny)
        // only extend into cells that are fully walled (untouched)
        const nWalls = [neighbor.walls.top, neighbor.walls.right, neighbor.walls.bottom, neighbor.walls.left]
          .filter(Boolean).length
        return nWalls === 4
      })

      if (dirs.length === 0) break

      // bias toward exit direction for seduction
      const towardExit = dirs.filter((d) => {
        const nx = cx + d.dx
        const ny = cy + d.dy
        const distNow = Math.abs(cx - grid.end.x) + Math.abs(cy - grid.end.y)
        const distNext = Math.abs(nx - grid.end.x) + Math.abs(ny - grid.end.y)
        return distNext < distNow
      })

      const chosen = towardExit.length > 0 && rng() < 0.7
        ? towardExit[Math.floor(rng() * towardExit.length)]
        : dirs[Math.floor(rng() * dirs.length)]

      grid = toggleWallBetween(grid, cx, cy, cx + chosen.dx, cy + chosen.dy)
      cx = cx + chosen.dx
      cy = cy + chosen.dy
      extended.add(`${cx},${cy}`)
    }
  }

  return grid
}
```

- [ ] **Step 3: Add era configuration**

Add at the top of the file after imports:

```js
function getEraConfig(levelNumber) {
  if (levelNumber <= 30) {
    return {
      era: 'learning',
      loopPercent: 0.05,
      deadEndMax: 3 + Math.floor((levelNumber - 1) / 10) * 2,
      trapCount: 0,
      gateCount: 0,
      fogRadius: null,
      deathMode: 'progress',
    }
  }
  if (levelNumber <= 60) {
    const idx = levelNumber - 31
    return {
      era: 'punishing',
      loopPercent: 0.08 + idx * 0.001,
      deadEndMax: 8 + Math.floor(idx / 5),
      trapCount: 2 + Math.floor(idx / 8),
      gateCount: 1 + Math.floor(idx / 10),
      fogRadius: 4,
      deathMode: 'full',
    }
  }
  const idx = levelNumber - 61
  return {
    era: 'sadistic',
    loopPercent: 0.12 + idx * 0.001,
    deadEndMax: 12 + Math.floor(idx / 4),
    trapCount: 5 + Math.floor(idx / 5),
    gateCount: 3 + Math.floor(idx / 8),
    fogRadius: 2.5,
    deathMode: 'cumulative',
  }
}
```

- [ ] **Step 4: Add trap placement function**

```js
function placeTraps(grid, solutionPath, count, rng) {
  const pathSet = new Set(solutionPath.map((p) => `${p.x},${p.y}`))

  // find cells that are NOT on solution, NOT start/end, and adjacent to solution (tempting wrong turns)
  const candidates = grid.cells.filter((c) => {
    const key = `${c.x},${c.y}`
    if (pathSet.has(key)) return false
    if (c.x === grid.start.x && c.y === grid.start.y) return false
    if (c.x === grid.end.x && c.y === grid.end.y) return false
    if (c.trap || c.modifier) return false
    // must be reachable (not fully walled)
    const wallCount = [c.walls.top, c.walls.right, c.walls.bottom, c.walls.left].filter(Boolean).length
    return wallCount < 4
  })

  // sort by proximity to solution path (closest first = most tempting)
  candidates.sort((a, b) => {
    const aDist = Math.min(...solutionPath.map((p) => Math.abs(p.x - a.x) + Math.abs(p.y - a.y)))
    const bDist = Math.min(...solutionPath.map((p) => Math.abs(p.x - b.x) + Math.abs(p.y - b.y)))
    return aDist - bDist
  })

  const placed = Math.min(count, candidates.length)
  for (let i = 0; i < placed; i++) {
    grid = setTrap(grid, candidates[i].x, candidates[i].y)
  }

  return grid
}
```

- [ ] **Step 5: Add gate placement function**

```js
function placeGates(grid, solutionPath, count, rng) {
  // place gates on the solution path at points where direction changes
  const gateCandidates = []
  for (let i = 2; i < solutionPath.length - 2; i++) {
    const prev = solutionPath[i - 1]
    const curr = solutionPath[i]
    const next = solutionPath[i + 1]
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    // direction entering this cell
    let direction = null
    if (dx === 1) direction = 'right'
    if (dx === -1) direction = 'left'
    if (dy === 1) direction = 'down'
    if (dy === -1) direction = 'up'
    if (direction) {
      gateCandidates.push({ x: curr.x, y: curr.y, direction, pathIndex: i })
    }
  }

  // shuffle and pick
  for (let i = gateCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [gateCandidates[i], gateCandidates[j]] = [gateCandidates[j], gateCandidates[i]]
  }

  // space gates apart (at least 5 cells between them on the path)
  const placed = []
  for (const cand of gateCandidates) {
    if (placed.length >= count) break
    const tooClose = placed.some((p) => Math.abs(p.pathIndex - cand.pathIndex) < 5)
    if (tooClose) continue
    grid = setGate(grid, cand.x, cand.y, cand.direction)
    placed.push(cand)
  }

  return grid
}
```

- [ ] **Step 6: Update `generateLevel` to use new systems**

Replace the maze generation section inside `generateLevel` (after the seed/rng/chapter setup, before the modifier placement switch). Add this before the chapter switch:

```js
  const era = getEraConfig(levelNumber)

  // generate base maze
  let grid = generateMaze(size, size, seed)

  // place start/end
  const startX = Math.floor(rng() * Math.floor(size / 4))
  const startY = Math.floor(rng() * Math.floor(size / 4))
  const endX = size - 1 - Math.floor(rng() * Math.floor(size / 4))
  const endY = size - 1 - Math.floor(rng() * Math.floor(size / 4))
  grid = setStart(grid, startX, startY)
  grid = setEnd(grid, endX, endY)
  grid = setHiddenWord(grid, word)

  // find initial solution
  let solution = solveMaze(grid)

  // add loops (creates alternate routes, most wrong)
  grid = addLoops(grid, rng, era.loopPercent)

  // extend dead ends (makes wrong turns longer and more seductive)
  grid = extendDeadEnds(grid, rng, era.deadEndMax, solution)

  // re-solve after modifications
  solution = solveMaze(grid)

  // place traps (off solution, on tempting wrong paths)
  if (era.trapCount > 0) {
    grid = placeTraps(grid, solution, era.trapCount, rng)
  }

  // place one-way gates (on solution path)
  if (era.gateCount > 0) {
    grid = placeGates(grid, solution, era.gateCount, rng)
  }
```

Update the return object to include era config:

```js
  return {
    name: `${levelNumber}. ${word}`,
    description: desc,
    chapter: chapterName,
    chapterNumber: chapter,
    grid,
    era: era.era,
    fogRadius: era.fogRadius,
    deathMode: era.deathMode,
  }
```

- [ ] **Step 7: Add necessary imports**

At the top of `generator.js`, update the import:

```js
import { createGrid, setModifier, setStart, setEnd, setHiddenWord, getCell, toggleWallBetween, setTrap, setGate } from './maze'
```

- [ ] **Step 8: Export `getEraConfig`**

```js
export { generateLevel, CHAPTER_NAMES, getEraConfig }
```

- [ ] **Step 9: Verify build**

```bash
npx vite build
```

- [ ] **Step 10: Commit**

```bash
git add src/engine/maze.js src/engine/generator.js src/utils/serialize.js
git commit -m "feat: imperfect maze generation — loops, seductive dead ends, traps, one-way gates, era config"
```

---

### Task 3: Fog of war and corruption renderer

**Files:**
- Create: `src/engine/fog.js`

- [ ] **Step 1: Create fog.js**

```js
// src/engine/fog.js

function drawFog(ctx, grid, cellSize, ballX, ballY, fogRadius, visitedCells) {
  if (fogRadius === null) return

  const ballCellX = ballX / cellSize
  const ballCellY = ballY / cellSize

  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const dist = Math.sqrt(
        Math.pow(x + 0.5 - ballCellX, 2) + Math.pow(y + 0.5 - ballCellY, 2)
      )

      let opacity = 0
      if (dist > fogRadius + 0.5) {
        opacity = 1
      } else if (dist > fogRadius - 0.5) {
        opacity = (dist - (fogRadius - 0.5)) / 1
      }

      // visited cells show as memory trail (dimmer fog)
      const key = `${x},${y}`
      if (opacity > 0 && visitedCells.has(key)) {
        opacity = Math.max(opacity * 0.85, 0.15)
      }

      if (opacity > 0) {
        ctx.fillStyle = `rgba(50, 47, 35, ${opacity})`
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }
  }
}

function drawCorruption(ctx, grid, cellSize, corruptedCells, now) {
  if (corruptedCells.size === 0) return

  for (const key of corruptedCells) {
    const [x, y] = key.split(',').map(Number)
    // pulsing opacity
    const pulse = 0.75 + Math.sin(now / 500 + x * 0.5 + y * 0.3) * 0.15
    ctx.fillStyle = `rgba(50, 47, 35, ${pulse})`
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)

    // purple tint on top
    ctx.fillStyle = `rgba(153, 56, 98, ${pulse * 0.2})`
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
  }
}

function drawTrapFlash(ctx, cellSize, trapX, trapY) {
  ctx.fillStyle = '#f74b6d'
  ctx.beginPath()
  const x = trapX * cellSize + 3
  const y = trapY * cellSize + 3
  const w = cellSize - 6
  const h = cellSize - 6
  const r = 5
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function spreadCorruption(corruptedCells, frontier, grid) {
  if (frontier.length === 0) return { corruptedCells, frontier }

  const newCorrupted = new Set(corruptedCells)
  const newFrontier = []

  for (const cell of frontier) {
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
    ]
    for (const d of dirs) {
      const nx = cell.x + d.dx
      const ny = cell.y + d.dy
      const key = `${nx},${ny}`
      if (nx < 0 || nx >= grid.cols || ny < 0 || ny >= grid.rows) continue
      if (newCorrupted.has(key)) continue
      // don't corrupt the end cell
      if (nx === grid.end.x && ny === grid.end.y) continue
      newCorrupted.add(key)
      newFrontier.push({ x: nx, y: ny })
    }
  }

  return { corruptedCells: newCorrupted, frontier: newFrontier }
}

export { drawFog, drawCorruption, drawTrapFlash, spreadCorruption }
```

- [ ] **Step 2: Verify build**

```bash
npx vite build
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/fog.js
git commit -m "feat: fog of war renderer, corruption spread, trap flash overlay"
```

---

### Task 4: Gate arrows and trap detection in renderer

**Files:**
- Modify: `src/engine/renderer.js`

- [ ] **Step 1: Add gate arrow rendering to `drawMaze`**

In the modifiers loop inside `drawMaze` (the `for (const cell of grid.cells)` block), add this BEFORE the modifier check:

```js
      // one-way gates
      if (cell.gate && cell.gate.open) {
        const cx = cell.x * cellSize + cellSize / 2
        const cy = cell.y * cellSize + cellSize / 2
        const s = cellSize * 0.2
        ctx.fillStyle = 'rgba(13, 101, 110, 0.5)'
        ctx.beginPath()
        switch (cell.gate.direction) {
          case 'right':
            ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx - s, cy + s); break
          case 'left':
            ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy); ctx.lineTo(cx + s, cy + s); break
          case 'down':
            ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx, cy + s); ctx.lineTo(cx + s, cy - s); break
          case 'up':
            ctx.moveTo(cx - s, cy + s); ctx.lineTo(cx, cy - s); ctx.lineTo(cx + s, cy + s); break
        }
        ctx.closePath()
        ctx.fill()
      }
```

- [ ] **Step 2: Verify build**

```bash
npx vite build
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/renderer.js
git commit -m "feat: one-way gate arrow rendering in maze"
```

---

### Task 5: Trap and gate physics

**Files:**
- Modify: `src/engine/physics.js`
- Modify: `src/engine/modifiers.js`

- [ ] **Step 1: Add trap detection to physics.js**

Add a new exported function after `checkModifierTrigger`:

```js
function checkTrap(ball, grid, cellSize) {
  const cellX = Math.floor(ball.x / cellSize)
  const cellY = Math.floor(ball.y / cellSize)
  const cell = getCell(grid, cellX, cellY)
  if (!cell || !cell.trap) return null
  return { cellX, cellY }
}
```

Update the export:
```js
export { createBallState, updateBall, checkModifierTrigger, checkWin, resetBall, getAnimatedGrid, checkTrap }
```

- [ ] **Step 2: Add gate collision to `resolveCollisions`**

Inside the `resolveCollisions` function, after the current cell wall checks and before the edge cell checks, add:

```js
    // one-way gate: if cell has a closed gate, treat it as a wall in the blocked direction
    if (cell.gate && !cell.gate.open) {
      const gd = cell.gate.direction
      if (gd === 'right' && x - radius < left) { x = left + radius; hitX = true }
      if (gd === 'left' && x + radius > right) { x = right - radius; hitX = true }
      if (gd === 'down' && y - radius < top) { y = top + radius; hitY = true }
      if (gd === 'up' && y + radius > bottom) { y = bottom - radius; hitY = true }
    }
```

- [ ] **Step 3: Add gate pass-through to modifiers.js**

Add a new case in the switch in `applyModifierEffect`, before the `default`:

```js
    case 'gate': {
      // gate pass-through is handled by MazeSolver state management
      // this is a no-op — the solver closes the gate after the ball passes
      return ball
    }
```

- [ ] **Step 4: Verify build**

```bash
npx vite build
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/physics.js src/engine/modifiers.js
git commit -m "feat: trap detection + gate collision blocking in physics"
```

---

### Task 6: Wire everything into MazeSolver

**Files:**
- Modify: `src/components/MazeSolver.jsx`

- [ ] **Step 1: Update imports**

```jsx
import { createBallState, updateBall, checkModifierTrigger, checkWin, getAnimatedGrid, checkTrap } from '../engine/physics'
import { drawFog, drawCorruption, drawTrapFlash, spreadCorruption } from '../engine/fog'
```

- [ ] **Step 2: Update state initialization**

Replace the existing `useState` for state with:

```jsx
  const [state, setState] = useState(() => {
    const fakeExits = grid.cells.filter((c) => c.modifier === 'fakeExit').map((c) => `${c.x},${c.y}`)

    // determine era from level props or default
    const eraType = levelGrid ? (levelNumber >= 60 ? 'sadistic' : levelNumber >= 30 ? 'punishing' : 'learning') : 'learning'
    const baseFogRadius = eraType === 'sadistic' ? 2.5 : eraType === 'punishing' ? 4 : null

    return {
      ball: createBallState(grid, CELL_SIZE),
      startTime: Date.now(),
      won: false,
      psycheUntil: 0,
      fakeExitsTotal: fakeExits.length,
      fakeExitsCollected: new Set(),
      exitUnlocked: fakeExits.length === 0,
      lastQuip: '',
      // new suffering state
      eraType,
      baseFogRadius: baseFogRadius,
      fogRadius: baseFogRadius,
      visitedCells: new Set(),
      trapFlashPos: null,
      trapFlashUntil: 0,
      gateStates: new Map(),
      corruptedCells: new Set(),
      corruptionFrontier: [],
      lastCorruptionTick: 0,
      deathsThisLevel: 0,
      corruptionActive: false,
    }
  })
```

- [ ] **Step 3: Add trap and gate checks to game loop**

In the game loop (the `setState` callback inside the `requestAnimationFrame` loop), add these checks AFTER the modifier trigger check and BEFORE the win check:

```jsx
        // trap check
        const trap = checkTrap(ball, animatedGrid, CELL_SIZE)
        if (trap) {
          playSound('death')
          const newDeaths = prev.deathsThisLevel + 1
          const fogShrink = prev.eraType === 'sadistic' && newDeaths > 3
            ? Math.max((prev.baseFogRadius || 2.5) - (newDeaths - 3) * 0.5, 1.0)
            : prev.fogRadius
          const corruptionActive = prev.eraType === 'sadistic' && newDeaths >= 10

          // full reset for punishing+, progress reset for learning
          const resetFakeExits = prev.eraType !== 'learning'
          return {
            ...prev,
            ball: createBallState(grid, CELL_SIZE),
            trapFlashPos: { x: trap.cellX, y: trap.cellY },
            trapFlashUntil: Date.now() + 500,
            deathsThisLevel: newDeaths,
            fogRadius: fogShrink,
            corruptionActive,
            corruptionFrontier: corruptionActive && prev.corruptionFrontier.length === 0
              ? [{ x: grid.start.x, y: grid.start.y }] : prev.corruptionFrontier,
            lastCorruptionTick: corruptionActive && !prev.corruptionActive ? Date.now() : prev.lastCorruptionTick,
            fakeExitsCollected: resetFakeExits ? new Set() : prev.fakeExitsCollected,
            exitUnlocked: resetFakeExits ? prev.fakeExitsTotal === 0 : prev.exitUnlocked,
            gateStates: resetFakeExits ? new Map() : prev.gateStates,
            lastQuip: DEATH_QUIPS[newDeaths % DEATH_QUIPS.length],
          }
        }

        // gate check — close gate behind ball
        const ballCellX = Math.floor(ball.x / CELL_SIZE)
        const ballCellY = Math.floor(ball.y / CELL_SIZE)
        const currentCell = animatedGrid.cells[ballCellY * animatedGrid.cols + ballCellX]
        if (currentCell && currentCell.gate && currentCell.gate.open) {
          const gateKey = `${ballCellX},${ballCellY}`
          if (!prev.gateStates.has(gateKey)) {
            const newGates = new Map(prev.gateStates)
            newGates.set(gateKey, true)
            // close the gate in the grid
            const newCells = animatedGrid.cells.map((c) => {
              if (c.x === ballCellX && c.y === ballCellY && c.gate) {
                const dir = c.gate.direction
                const newWalls = { ...c.walls }
                // wall behind the ball (opposite of gate direction)
                if (dir === 'right') newWalls.left = true
                if (dir === 'left') newWalls.right = true
                if (dir === 'down') newWalls.top = true
                if (dir === 'up') newWalls.bottom = true
                return { ...c, gate: { ...c.gate, open: false }, walls: newWalls }
              }
              return c
            })
            grid.cells = newCells
            return { ...prev, ball, gateStates: newGates }
          }
        }

        // track visited cells for fog memory trail
        const visitedKey = `${ballCellX},${ballCellY}`
        if (!prev.visitedCells.has(visitedKey)) {
          const newVisited = new Set(prev.visitedCells)
          newVisited.add(visitedKey)
          return { ...prev, ball, visitedCells: newVisited }
        }

        // corruption spread
        if (prev.corruptionActive && now - prev.lastCorruptionTick > 10000) {
          const { corruptedCells, frontier } = spreadCorruption(
            prev.corruptedCells, prev.corruptionFrontier, grid
          )
          // check if ball is in corrupted cell
          if (corruptedCells.has(visitedKey)) {
            return {
              ...prev,
              ball: createBallState(grid, CELL_SIZE),
              deathsThisLevel: prev.deathsThisLevel + 1,
              corruptedCells,
              corruptionFrontier: frontier,
              lastCorruptionTick: now,
              lastQuip: 'the void consumed you.',
            }
          }
          return { ...prev, ball, corruptedCells, corruptionFrontier: frontier, lastCorruptionTick: now }
        }
```

- [ ] **Step 4: Update death handling for existing fake exit resets**

In the existing `applyModifierEffect` call for `fakeExit`, the modifier already handles teleporting. But we need to apply the same death escalation. Update the death counter tracking in the `useEffect` that watches `state.ball.deaths`:

Replace the existing death quip effect with:
```jsx
  useEffect(() => {
    if (state.ball.deaths > prevDeathsRef.current || state.deathsThisLevel > prevDeathsRef.current) {
      const deaths = Math.max(state.ball.deaths, state.deathsThisLevel)
      setState((s) => ({ ...s, lastQuip: DEATH_QUIPS[deaths % DEATH_QUIPS.length] }))
      prevDeathsRef.current = deaths
    }
  }, [state.ball.deaths, state.deathsThisLevel])
```

- [ ] **Step 5: Update render pass to include fog, corruption, and trap flash**

In the render `useEffect`, add after `drawBall`:

```jsx
    // fog of war
    if (state.fogRadius !== null) {
      drawFog(ctx, grid, CELL_SIZE, state.ball.x, state.ball.y, state.fogRadius, state.visitedCells)
    }

    // corruption overlay
    drawCorruption(ctx, grid, CELL_SIZE, state.corruptedCells, Date.now())

    // trap flash (renders above fog so player sees where they died)
    if (state.trapFlashPos && Date.now() < state.trapFlashUntil) {
      drawTrapFlash(ctx, CELL_SIZE, state.trapFlashPos.x, state.trapFlashPos.y)
    }
```

- [ ] **Step 6: Add punishment indicator to HUD**

After the fake exit counter in the playing UI, add:

```jsx
      {state.eraType === 'sadistic' && state.deathsThisLevel >= 4 && (
        <div style={{
          background: 'var(--error-container)', color: '#fff',
          borderRadius: '9999px', padding: '4px 12px', fontSize: '10px',
          fontFamily: "var(--font-headline)", fontWeight: 700,
        }}>
          {state.deathsThisLevel >= 10
            ? '\u{1F525} void spreading'
            : state.deathsThisLevel >= 7
            ? '\u{26A0}\u{FE0F} +' + ((state.deathsThisLevel - 6) * 2) + ' traps added'
            : '\u{1F441}\u{FE0F} fog shrinking'}
        </div>
      )}
```

- [ ] **Step 7: Verify build**

```bash
npx vite build
```

- [ ] **Step 8: Commit**

```bash
git add src/components/MazeSolver.jsx
git commit -m "feat: full suffering integration — fog, traps, gates, corruption, progressive punishment in solver"
```

---

### Task 7: Update LevelSelect to pass era config

**Files:**
- Modify: `src/components/LevelSelect.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Update ALL_LEVELS to include era data**

The `generateLevel` function now returns `era`, `fogRadius`, and `deathMode`. These are already in the level objects. No change needed to LevelSelect.

- [ ] **Step 2: Pass era props through App.jsx to MazeSolver**

In `src/App.jsx`, update the MazeSolver render for playing mode:

```jsx
      {mode === 'playing' && currentLevel != null && (
        <MazeSolver
          key={currentLevel}
          levelGrid={ALL_LEVELS[currentLevel].grid}
          levelNumber={currentLevel}
          levelEra={ALL_LEVELS[currentLevel].era}
          levelFogRadius={ALL_LEVELS[currentLevel].fogRadius}
          levelDeathMode={ALL_LEVELS[currentLevel].deathMode}
          onBack={handleBack}
          onNextLevel={currentLevel < ALL_LEVELS.length - 1 ? handleNextLevel : null}
        />
      )}
```

- [ ] **Step 3: Update MazeSolver to use passed era props instead of computing from level number**

Replace the era detection in the state initialization:

```jsx
    const eraType = levelGrid ? (props.levelEra || 'learning') : 'learning'
    const baseFogRadius = props.levelFogRadius || null
```

Update the function signature:
```jsx
function MazeSolver({ levelGrid, levelNumber, levelEra, levelFogRadius, levelDeathMode, onBack, onNextLevel }) {
```

And reference `levelDeathMode` instead of computing from era for the death reset logic:

In the trap check section, replace:
```jsx
          const resetFakeExits = prev.eraType !== 'learning'
```
with:
```jsx
          const deathMode = levelDeathMode || 'progress'
          const resetFakeExits = deathMode !== 'progress'
```

- [ ] **Step 4: Verify build**

```bash
npx vite build
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/MazeSolver.jsx
git commit -m "feat: pass era config from level data to solver — fog, death mode, punishment scaling"
```

---

### Task 8: Validate and final build

**Files:**
- No new files

- [ ] **Step 1: Production build**

```bash
npx vite build
```

Expected: clean build, no errors, bundle under 250KB.

- [ ] **Step 2: Manual test progression**

Test these specific levels:
- Level 1: no fog, no traps, no gates. Simple maze. Should be easy.
- Level 31: fog appears (4-cell radius). Traps present. Full reset on death.
- Level 61: tight fog (2.5 cells). 5+ traps. Gates. Cumulative punishment.
- Level 91: massive grid, fog shrinks with deaths, corruption after 10 deaths.

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final adjustments after testing"
git push origin main
```
