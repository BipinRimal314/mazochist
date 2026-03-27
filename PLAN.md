# Mazochist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser app where you create absurd hostile mazes and share links for people to suffer through.

**Architecture:** React 19 + Vite SPA. Canvas renders the maze grid and ball. Maze data serializes to a URL hash (no backend). Two views: Build (editor + modifier palette) and Suffer (physics + timer + death counter). Engine layer handles grid data, physics, and modifier effects separately from React components.

**Tech Stack:** React 19, Vite, HTML5 Canvas, Web Audio API

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/index.css`

- [ ] **Step 1: Initialize Vite + React project**

```bash
cd /Users/bipinrimal/Downloads/Website/Projects/mazochist
npm create vite@latest . -- --template react
```

Select: React, JavaScript

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

- [ ] **Step 3: Replace App.jsx with route shell**

```jsx
import { useState, useEffect } from 'react'

function App() {
  const [mode, setMode] = useState('build')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setMode('suffer')
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'monospace' }}>
      {mode === 'build' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <h1>Mazochist — Build Mode</h1>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <h1>Mazochist — Suffer Mode</h1>
        </div>
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 4: Replace index.css with reset**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { overflow: hidden; background: #0a0a0a; }
```

- [ ] **Step 5: Verify it runs**

```bash
npm run dev
```

Open browser. Should see "Mazochist — Build Mode" on black background. Add `#test` to URL, reload — should see "Suffer Mode".

- [ ] **Step 6: Commit**

```bash
git init
echo "node_modules\ndist\n.DS_Store" > .gitignore
git add -A
git commit -m "feat: scaffold Mazochist — Vite + React shell with hash routing"
```

---

### Task 2: Maze grid data structure + serialization

**Files:**
- Create: `src/engine/maze.js`
- Create: `src/utils/serialize.js`

- [ ] **Step 1: Create maze grid data structure**

```js
// src/engine/maze.js

const GRID_SIZE = 20

function createGrid(cols = GRID_SIZE, rows = GRID_SIZE) {
  const cells = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({
        x,
        y,
        walls: { top: false, right: false, bottom: false, left: false },
        modifier: null,
      })
    }
  }
  return {
    cols,
    rows,
    cells,
    start: { x: 0, y: 0 },
    end: { x: cols - 1, y: rows - 1 },
    hiddenWord: '',
  }
}

function getCell(grid, x, y) {
  if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) return null
  return grid.cells[y * grid.cols + x]
}

function toggleWallBetween(grid, x1, y1, x2, y2) {
  const cellA = getCell(grid, x1, y1)
  const cellB = getCell(grid, x2, y2)
  if (!cellA || !cellB) return grid

  const dx = x2 - x1
  const dy = y2 - y1

  const newCells = grid.cells.map((c) => {
    if (c.x === x1 && c.y === y1) {
      const walls = { ...c.walls }
      if (dx === 1) walls.right = !walls.right
      if (dx === -1) walls.left = !walls.left
      if (dy === 1) walls.bottom = !walls.bottom
      if (dy === -1) walls.top = !walls.top
      return { ...c, walls }
    }
    if (c.x === x2 && c.y === y2) {
      const walls = { ...c.walls }
      if (dx === 1) walls.left = !walls.left
      if (dx === -1) walls.right = !walls.right
      if (dy === 1) walls.top = !walls.top
      if (dy === -1) walls.bottom = !walls.bottom
      return { ...c, walls }
    }
    return c
  })

  return { ...grid, cells: newCells }
}

function setModifier(grid, x, y, modifier) {
  const newCells = grid.cells.map((c) =>
    c.x === x && c.y === y ? { ...c, modifier } : c
  )
  return { ...grid, cells: newCells }
}

function setStart(grid, x, y) {
  return { ...grid, start: { x, y } }
}

function setEnd(grid, x, y) {
  return { ...grid, end: { x, y } }
}

function setHiddenWord(grid, word) {
  return { ...grid, hiddenWord: word }
}

export {
  GRID_SIZE,
  createGrid,
  getCell,
  toggleWallBetween,
  setModifier,
  setStart,
  setEnd,
  setHiddenWord,
}
```

- [ ] **Step 2: Create serialization utilities**

```js
// src/utils/serialize.js

function gridToJSON(grid) {
  const compact = {
    c: grid.cols,
    r: grid.rows,
    s: [grid.start.x, grid.start.y],
    e: [grid.end.x, grid.end.y],
    w: grid.hiddenWord,
    d: [],
  }

  for (const cell of grid.cells) {
    const wallBits =
      (cell.walls.top ? 1 : 0) |
      (cell.walls.right ? 2 : 0) |
      (cell.walls.bottom ? 4 : 0) |
      (cell.walls.left ? 8 : 0)

    if (wallBits === 0 && !cell.modifier) continue

    const entry = [cell.x, cell.y, wallBits]
    if (cell.modifier) entry.push(cell.modifier)
    compact.d.push(entry)
  }

  return JSON.stringify(compact)
}

function jsonToGrid(json) {
  const compact = JSON.parse(json)
  const cols = compact.c
  const rows = compact.r

  const cells = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({
        x,
        y,
        walls: { top: false, right: false, bottom: false, left: false },
        modifier: null,
      })
    }
  }

  for (const entry of compact.d) {
    const [x, y, wallBits, modifier] = entry
    const cell = cells[y * cols + x]
    cell.walls.top = !!(wallBits & 1)
    cell.walls.right = !!(wallBits & 2)
    cell.walls.bottom = !!(wallBits & 4)
    cell.walls.left = !!(wallBits & 8)
    if (modifier) cell.modifier = modifier
  }

  return {
    cols,
    rows,
    cells,
    start: { x: compact.s[0], y: compact.s[1] },
    end: { x: compact.e[0], y: compact.e[1] },
    hiddenWord: compact.w || '',
  }
}

function encodeToHash(grid) {
  const json = gridToJSON(grid)
  return btoa(encodeURIComponent(json))
}

function decodeFromHash(hash) {
  const json = decodeURIComponent(atob(hash))
  return jsonToGrid(json)
}

export { gridToJSON, jsonToGrid, encodeToHash, decodeFromHash }
```

- [ ] **Step 3: Verify serialization round-trips**

Add a quick test at the bottom of `App.jsx` temporarily:

```jsx
// temporary test — remove after verifying
import { createGrid, toggleWallBetween, setModifier } from './engine/maze'
import { encodeToHash, decodeFromHash } from './utils/serialize'

const testGrid = setModifier(
  toggleWallBetween(createGrid(5, 5), 0, 0, 1, 0),
  2, 2, 'gravity'
)
const hash = encodeToHash(testGrid)
const decoded = decodeFromHash(hash)
console.log('Round-trip OK:', JSON.stringify(testGrid) === JSON.stringify(decoded))
console.log('Hash length:', hash.length, 'chars')
```

Run `npm run dev`, open console. Should see `Round-trip OK: true` and a hash length. Remove the test code after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/engine/maze.js src/utils/serialize.js
git commit -m "feat: maze grid data structure + URL hash serialization"
```

---

### Task 3: Canvas maze renderer

**Files:**
- Create: `src/engine/renderer.js`

This is a pure function module — takes a canvas context and grid, draws the maze. No React in this file.

- [ ] **Step 1: Create the renderer**

```js
// src/engine/renderer.js

const COLORS = {
  bg: '#0a0a0a',
  wall: '#ffffff',
  grid: '#1a1a1a',
  start: '#00ff88',
  end: '#ff4444',
  ball: '#ffcc00',
  modifier: {
    gravity: '#9b59b6',
    reverse: '#e74c3c',
    spinner: '#3498db',
    blackout: '#2c3e50',
    fakeExit: '#f1c40f',
    slideWall: '#e67e22',
    fatCursor: '#1abc9c',
    fart: '#8b4513',
    teleporter: '#00bcd4',
    ice: '#a8d8ea',
  },
}

const MODIFIER_LABELS = {
  gravity: '\u{1F300}',
  reverse: '\u{1F500}',
  spinner: '\u{1F504}',
  blackout: '\u{1F311}',
  fakeExit: '\u{1F3C6}',
  slideWall: '\u{2194}\u{FE0F}',
  fatCursor: '\u{2B55}',
  fart: '\u{1F4A8}',
  teleporter: '\u{1F52E}',
  ice: '\u{2744}\u{FE0F}',
}

function drawMaze(ctx, grid, cellSize, options = {}) {
  const { showModifiers = true, showGrid = true } = options
  const width = grid.cols * cellSize
  const height = grid.rows * cellSize

  // background
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, width, height)

  // grid lines
  if (showGrid) {
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 0.5
    for (let x = 0; x <= grid.cols; x++) {
      ctx.beginPath()
      ctx.moveTo(x * cellSize, 0)
      ctx.lineTo(x * cellSize, height)
      ctx.stroke()
    }
    for (let y = 0; y <= grid.rows; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * cellSize)
      ctx.lineTo(width, y * cellSize)
      ctx.stroke()
    }
  }

  // start and end
  ctx.fillStyle = COLORS.start
  ctx.fillRect(
    grid.start.x * cellSize + 2,
    grid.start.y * cellSize + 2,
    cellSize - 4,
    cellSize - 4
  )
  ctx.fillStyle = COLORS.end
  ctx.fillRect(
    grid.end.x * cellSize + 2,
    grid.end.y * cellSize + 2,
    cellSize - 4,
    cellSize - 4
  )

  // modifiers
  if (showModifiers) {
    for (const cell of grid.cells) {
      if (!cell.modifier) continue
      const color = COLORS.modifier[cell.modifier] || '#666'
      ctx.fillStyle = color + '44'
      ctx.fillRect(
        cell.x * cellSize + 1,
        cell.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      )
      ctx.font = `${cellSize * 0.5}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        MODIFIER_LABELS[cell.modifier] || '?',
        cell.x * cellSize + cellSize / 2,
        cell.y * cellSize + cellSize / 2
      )
    }
  }

  // walls
  ctx.strokeStyle = COLORS.wall
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  for (const cell of grid.cells) {
    const cx = cell.x * cellSize
    const cy = cell.y * cellSize
    if (cell.walls.top) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + cellSize, cy)
      ctx.stroke()
    }
    if (cell.walls.right) {
      ctx.beginPath()
      ctx.moveTo(cx + cellSize, cy)
      ctx.lineTo(cx + cellSize, cy + cellSize)
      ctx.stroke()
    }
    if (cell.walls.bottom) {
      ctx.beginPath()
      ctx.moveTo(cx, cy + cellSize)
      ctx.lineTo(cx + cellSize, cy + cellSize)
      ctx.stroke()
    }
    if (cell.walls.left) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx, cy + cellSize)
      ctx.stroke()
    }
  }
}

function drawBall(ctx, x, y, radius, color = COLORS.ball) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  // glow
  ctx.shadowColor = color
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

export { COLORS, MODIFIER_LABELS, drawMaze, drawBall }
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/renderer.js
git commit -m "feat: canvas maze renderer with wall, modifier, and ball drawing"
```

---

### Task 4: Maze Builder component

**Files:**
- Create: `src/components/MazeBuilder.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create MazeBuilder**

```jsx
// src/components/MazeBuilder.jsx

import { useState, useRef, useEffect, useCallback } from 'react'
import { createGrid, toggleWallBetween, setModifier, setStart, setEnd, setHiddenWord, getCell } from '../engine/maze'
import { encodeToHash } from '../utils/serialize'
import { drawMaze } from '../engine/renderer'

const MODIFIERS = [
  { id: 'gravity', label: '\u{1F300}', name: 'Gravity Well' },
  { id: 'reverse', label: '\u{1F500}', name: 'Reverse' },
  { id: 'spinner', label: '\u{1F504}', name: 'Spinner' },
  { id: 'blackout', label: '\u{1F311}', name: 'Blackout' },
  { id: 'fakeExit', label: '\u{1F3C6}', name: 'Fake Exit' },
  { id: 'slideWall', label: '\u{2194}\u{FE0F}', name: 'Slide Wall' },
  { id: 'fatCursor', label: '\u{2B55}', name: 'Fat Cursor' },
  { id: 'fart', label: '\u{1F4A8}', name: 'Fart Tile' },
  { id: 'teleporter', label: '\u{1F52E}', name: 'Teleporter' },
  { id: 'ice', label: '\u{2744}\u{FE0F}', name: 'Ice' },
]

const TOOLS = [
  { id: 'wall', label: '\u{1F9F1}', name: 'Wall' },
  { id: 'start', label: '\u{1F7E2}', name: 'Start' },
  { id: 'end', label: '\u{1F534}', name: 'End' },
  { id: 'eraser', label: '\u{1F9F9}', name: 'Eraser' },
]

const CELL_SIZE = 30

function MazeBuilder() {
  const [grid, setGrid] = useState(() => createGrid(20, 20))
  const [tool, setTool] = useState('wall')
  const [copied, setCopied] = useState(false)
  const [hiddenWord, setHiddenWordState] = useState('')
  const canvasRef = useRef(null)
  const lastCellRef = useRef(null)
  const isDrawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = grid.cols * CELL_SIZE
    canvas.height = grid.rows * CELL_SIZE
    drawMaze(ctx, grid, CELL_SIZE)
  }, [grid])

  const getCellFromEvent = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE)
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE)
    if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) return null
    return { x, y }
  }, [grid.cols, grid.rows])

  const applyTool = useCallback((cellPos) => {
    if (!cellPos) return

    if (tool === 'start') {
      setGrid((g) => setStart(g, cellPos.x, cellPos.y))
      return
    }
    if (tool === 'end') {
      setGrid((g) => setEnd(g, cellPos.x, cellPos.y))
      return
    }
    if (tool === 'eraser') {
      setGrid((g) => setModifier(g, cellPos.x, cellPos.y, null))
      return
    }

    const isModifier = MODIFIERS.some((m) => m.id === tool)
    if (isModifier) {
      setGrid((g) => {
        const cell = getCell(g, cellPos.x, cellPos.y)
        const newMod = cell && cell.modifier === tool ? null : tool
        return setModifier(g, cellPos.x, cellPos.y, newMod)
      })
      return
    }
  }, [tool])

  const handleMouseDown = useCallback((e) => {
    isDrawingRef.current = true
    const cellPos = getCellFromEvent(e)
    lastCellRef.current = cellPos

    if (tool === 'wall') return
    applyTool(cellPos)
  }, [getCellFromEvent, tool, applyTool])

  const handleMouseMove = useCallback((e) => {
    if (!isDrawingRef.current) return
    const cellPos = getCellFromEvent(e)
    if (!cellPos) return

    if (tool === 'wall') {
      const last = lastCellRef.current
      if (last && (last.x !== cellPos.x || last.y !== cellPos.y)) {
        const dx = cellPos.x - last.x
        const dy = cellPos.y - last.y
        if (Math.abs(dx) + Math.abs(dy) === 1) {
          setGrid((g) => toggleWallBetween(g, last.x, last.y, cellPos.x, cellPos.y))
        }
      }
      lastCellRef.current = cellPos
      return
    }

    applyTool(cellPos)
    lastCellRef.current = cellPos
  }, [getCellFromEvent, tool, applyTool])

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false
    lastCellRef.current = null
  }, [])

  const handleShare = useCallback(() => {
    const finalGrid = setHiddenWord(grid, hiddenWord)
    const hash = encodeToHash(finalGrid)
    const url = `${window.location.origin}${window.location.pathname}#${hash}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [grid, hiddenWord])

  const toolbarStyle = {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    background: '#111',
    borderRadius: '8px',
    flexWrap: 'wrap',
    maxWidth: grid.cols * CELL_SIZE,
  }

  const btnStyle = (active) => ({
    padding: '6px 10px',
    background: active ? '#333' : '#1a1a1a',
    border: active ? '1px solid #ffcc00' : '1px solid #333',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'monospace',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', letterSpacing: '2px' }}>MAZOCHIST</h1>
      <p style={{ color: '#666', fontSize: '12px' }}>build a maze. share the link. watch them suffer.</p>

      <div style={toolbarStyle}>
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} style={btnStyle(tool === t.id)}>
            {t.label} {t.name}
          </button>
        ))}
        <div style={{ width: '100%', height: '1px', background: '#333' }} />
        {MODIFIERS.map((m) => (
          <button key={m.id} onClick={() => setTool(m.id)} style={btnStyle(tool === m.id)}>
            {m.label} {m.name}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ border: '1px solid #333', cursor: 'crosshair' }}
      />

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Hidden word (revealed on solve)"
          value={hiddenWord}
          onChange={(e) => setHiddenWordState(e.target.value)}
          style={{
            background: '#111', border: '1px solid #333', color: '#fff',
            padding: '8px 12px', borderRadius: '4px', fontFamily: 'monospace', width: '260px',
          }}
        />
        <button
          onClick={handleShare}
          style={{
            padding: '8px 20px', background: copied ? '#00ff88' : '#ffcc00',
            color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px',
          }}
        >
          {copied ? 'COPIED!' : 'SHARE MAZE'}
        </button>
      </div>
    </div>
  )
}

export default MazeBuilder
```

- [ ] **Step 2: Update App.jsx to use MazeBuilder**

```jsx
// src/App.jsx

import { useState, useEffect } from 'react'
import MazeBuilder from './components/MazeBuilder'

function App() {
  const [mode, setMode] = useState('build')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setMode('suffer')
  }, [])

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'monospace' }}>
      {mode === 'build' ? (
        <MazeBuilder />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <h1>Loading maze...</h1>
        </div>
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 3: Verify builder works**

```bash
npm run dev
```

Open browser. Should see grid, toolbar, modifier buttons. Draw walls by clicking and dragging between cells. Place start/end. Place modifiers (emoji icons appear on cells). Click "SHARE MAZE" — URL copied to clipboard.

- [ ] **Step 4: Commit**

```bash
git add src/components/MazeBuilder.jsx src/App.jsx
git commit -m "feat: maze builder with wall drawing, modifiers, and share link"
```

---

### Task 5: Ball physics engine

**Files:**
- Create: `src/engine/physics.js`

- [ ] **Step 1: Create physics module**

```js
// src/engine/physics.js

import { getCell } from './maze'

function createBallState(grid, cellSize) {
  return {
    x: (grid.start.x + 0.5) * cellSize,
    y: (grid.start.y + 0.5) * cellSize,
    vx: 0,
    vy: 0,
    radius: cellSize * 0.3,
    baseRadius: cellSize * 0.3,
    deaths: 0,
    reversed: false,
    reversedUntil: 0,
    fat: false,
    onIce: false,
  }
}

function updateBall(ball, input, grid, cellSize, now) {
  const speed = 3
  const friction = 0.85
  const iceFriction = 0.995

  let { x, y, vx, vy } = ball
  const reversed = ball.reversed && now < ball.reversedUntil

  // input
  let dx = 0
  let dy = 0
  if (input.up) dy = -1
  if (input.down) dy = 1
  if (input.left) dx = -1
  if (input.right) dx = 1

  if (reversed) {
    dx = -dx
    dy = -dy
  }

  // current cell
  const cellX = Math.floor(x / cellSize)
  const cellY = Math.floor(y / cellSize)
  const cell = getCell(grid, cellX, cellY)
  const onIce = cell && cell.modifier === 'ice'

  // acceleration
  vx += dx * speed * 0.3
  vy += dy * speed * 0.3

  // gravity modifier
  if (cell && cell.modifier === 'gravity') {
    const centerX = (cellX + 0.5) * cellSize
    const centerY = (cellY + 0.5) * cellSize
    vx += (centerX - x) * 0.02
    vy += (centerY - y) * 0.02
  }

  // friction
  const fric = onIce ? iceFriction : friction
  vx *= fric
  vy *= fric

  // clamp max speed
  const maxSpeed = cellSize * 0.4
  const spd = Math.sqrt(vx * vx + vy * vy)
  if (spd > maxSpeed) {
    vx = (vx / spd) * maxSpeed
    vy = (vy / spd) * maxSpeed
  }

  // move with collision
  const newX = x + vx
  const newY = y + vy
  const result = resolveCollisions(newX, newY, ball.radius, grid, cellSize)

  // fat cursor modifier
  const newCellX = Math.floor(result.x / cellSize)
  const newCellY = Math.floor(result.y / cellSize)
  const newCell = getCell(grid, newCellX, newCellY)
  const fat = newCell && newCell.modifier === 'fatCursor'
  const radius = fat ? ball.baseRadius * 3 : ball.baseRadius

  return {
    ...ball,
    x: result.x,
    y: result.y,
    vx: result.hitX ? vx * -0.3 : vx,
    vy: result.hitY ? vy * -0.3 : vy,
    radius,
    fat,
    onIce,
    reversed: reversed || ball.reversed,
    reversedUntil: ball.reversedUntil,
  }
}

function resolveCollisions(x, y, radius, grid, cellSize) {
  let hitX = false
  let hitY = false

  // border clamping
  const totalW = grid.cols * cellSize
  const totalH = grid.rows * cellSize
  if (x - radius < 0) { x = radius; hitX = true }
  if (x + radius > totalW) { x = totalW - radius; hitX = true }
  if (y - radius < 0) { y = radius; hitY = true }
  if (y + radius > totalH) { y = totalH - radius; hitY = true }

  // wall collisions — check cells around the ball
  const cellX = Math.floor(x / cellSize)
  const cellY = Math.floor(y / cellSize)

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = cellX + dx
      const cy = cellY + dy
      const cell = getCell(grid, cx, cy)
      if (!cell) continue

      const wallLeft = cx * cellSize
      const wallTop = cy * cellSize
      const wallRight = wallLeft + cellSize
      const wallBottom = wallTop + cellSize

      // check each wall of this cell
      if (cell.walls.top && y - radius < wallTop && y + radius > wallTop - 2) {
        if (x + radius > wallLeft && x - radius < wallRight) {
          if (y < wallTop) { y = wallTop - radius; hitY = true }
          else { y = wallTop + radius; hitY = true }
        }
      }
      if (cell.walls.bottom && y - radius < wallBottom && y + radius > wallBottom - 2) {
        if (x + radius > wallLeft && x - radius < wallRight) {
          if (y > wallBottom) { y = wallBottom + radius; hitY = true }
          else { y = wallBottom - radius; hitY = true }
        }
      }
      if (cell.walls.left && x - radius < wallLeft && x + radius > wallLeft - 2) {
        if (y + radius > wallTop && y - radius < wallBottom) {
          if (x < wallLeft) { x = wallLeft - radius; hitX = true }
          else { x = wallLeft + radius; hitX = true }
        }
      }
      if (cell.walls.right && x - radius < wallRight && x + radius > wallRight - 2) {
        if (y + radius > wallTop && y - radius < wallBottom) {
          if (x > wallRight) { x = wallRight + radius; hitX = true }
          else { x = wallRight - radius; hitX = true }
        }
      }
    }
  }

  return { x, y, hitX, hitY }
}

function checkModifierTrigger(ball, grid, cellSize) {
  const cellX = Math.floor(ball.x / cellSize)
  const cellY = Math.floor(ball.y / cellSize)
  const cell = getCell(grid, cellX, cellY)
  if (!cell || !cell.modifier) return null
  return { type: cell.modifier, cellX, cellY }
}

function checkWin(ball, grid, cellSize) {
  const cellX = Math.floor(ball.x / cellSize)
  const cellY = Math.floor(ball.y / cellSize)
  return cellX === grid.end.x && cellY === grid.end.y
}

function resetBall(ball, grid, cellSize) {
  return {
    ...createBallState(grid, cellSize),
    deaths: ball.deaths + 1,
  }
}

export { createBallState, updateBall, checkModifierTrigger, checkWin, resetBall }
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/physics.js
git commit -m "feat: ball physics with wall collision, gravity, ice, reverse, fat cursor"
```

---

### Task 6: Modifier effects + sound

**Files:**
- Create: `src/engine/modifiers.js`
- Create: `src/engine/sound.js`

- [ ] **Step 1: Create modifiers module**

```js
// src/engine/modifiers.js

import { playSound } from './sound'

function applyModifierEffect(type, ball, grid, cellSize, now, setState) {
  switch (type) {
    case 'fart':
      playSound('fart')
      return {
        ...ball,
        reversed: true,
        reversedUntil: now + 2000,
      }

    case 'fakeExit':
      playSound('victory')
      setState((s) => ({ ...s, showFakeWin: true }))
      setTimeout(() => {
        playSound('fail')
        setState((s) => ({
          ...s,
          showFakeWin: false,
          ball: {
            ...s.ball,
            x: (grid.start.x + 0.5) * cellSize,
            y: (grid.start.y + 0.5) * cellSize,
            vx: 0,
            vy: 0,
            deaths: s.ball.deaths + 1,
          },
        }))
      }, 1500)
      return ball

    case 'teleporter': {
      const currentCellX = Math.floor(ball.x / cellSize)
      const currentCellY = Math.floor(ball.y / cellSize)
      const other = grid.cells.find(
        (c) => c.modifier === 'teleporter' && (c.x !== currentCellX || c.y !== currentCellY)
      )
      if (other) {
        playSound('teleport')
        return {
          ...ball,
          x: (other.x + 0.5) * cellSize,
          y: (other.y + 0.5) * cellSize,
          vx: 0,
          vy: 0,
        }
      }
      return ball
    }

    default:
      return ball
  }
}

function renderModifierOverlay(ctx, type, ball, grid, cellSize, now) {
  if (type === 'blackout') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)'
    ctx.fillRect(0, 0, grid.cols * cellSize, grid.rows * cellSize)

    const gradient = ctx.createRadialGradient(
      ball.x, ball.y, 0,
      ball.x, ball.y, cellSize * 2.5
    )
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)')

    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, cellSize * 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  if (type === 'spinner') {
    const cellX = Math.floor(ball.x / cellSize)
    const cellY = Math.floor(ball.y / cellSize)
    const angle = ((now / 3000) * Math.PI * 2) % (Math.PI * 2)
    ctx.save()
    ctx.translate((cellX + 0.5) * cellSize, (cellY + 0.5) * cellSize)
    ctx.rotate(angle)
    ctx.strokeStyle = '#3498db44'
    ctx.lineWidth = 2
    ctx.strokeRect(-cellSize / 2, -cellSize / 2, cellSize, cellSize)
    ctx.restore()
  }
}

export { applyModifierEffect, renderModifierOverlay }
```

- [ ] **Step 2: Create sound module**

```js
// src/engine/sound.js

let audioCtx = null

function getAudioContext() {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playSound(type) {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  switch (type) {
    case 'fart': {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(120, now)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.4)
      break
    }
    case 'victory': {
      const notes = [523, 659, 784, 1047]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.2, now + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now + i * 0.12)
        osc.stop(now + i * 0.12 + 0.3)
      })
      break
    }
    case 'fail': {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.5)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.5)
      break
    }
    case 'teleport': {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.exponentialRampToValueAtTime(2000, now + 0.15)
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.3)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.3)
      break
    }
    case 'death': {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.3)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.3)
      break
    }
  }
}

export { playSound }
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/modifiers.js src/engine/sound.js
git commit -m "feat: modifier effects (fart, fake exit, teleporter, blackout, spinner) + procedural sounds"
```

---

### Task 7: Maze Solver component

**Files:**
- Create: `src/components/MazeSolver.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create MazeSolver**

```jsx
// src/components/MazeSolver.jsx

import { useState, useRef, useEffect, useCallback } from 'react'
import { decodeFromHash } from '../utils/serialize'
import { drawMaze, drawBall } from '../engine/renderer'
import { createBallState, updateBall, checkModifierTrigger, checkWin, resetBall } from '../engine/physics'
import { applyModifierEffect, renderModifierOverlay } from '../engine/modifiers'
import { playSound } from '../engine/sound'

const CELL_SIZE = 30

function MazeSolver() {
  const [grid] = useState(() => {
    const hash = window.location.hash.slice(1)
    return decodeFromHash(hash)
  })

  const [state, setState] = useState(() => ({
    ball: createBallState(grid, CELL_SIZE),
    startTime: Date.now(),
    won: false,
    showFakeWin: false,
  }))

  const canvasRef = useRef(null)
  const inputRef = useRef({ up: false, down: false, left: false, right: false })
  const lastTriggerRef = useRef(null)
  const animFrameRef = useRef(null)

  // keyboard input
  useEffect(() => {
    const keyMap = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
    }
    const onDown = (e) => {
      const dir = keyMap[e.key]
      if (dir) { inputRef.current[dir] = true; e.preventDefault() }
    }
    const onUp = (e) => {
      const dir = keyMap[e.key]
      if (dir) inputRef.current[dir] = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // game loop
  useEffect(() => {
    if (state.won) return

    const loop = () => {
      const now = Date.now()

      setState((prev) => {
        if (prev.won || prev.showFakeWin) return prev

        let ball = updateBall(prev.ball, inputRef.current, grid, CELL_SIZE, now)

        // check modifier triggers
        const trigger = checkModifierTrigger(ball, grid, CELL_SIZE)
        const triggerKey = trigger ? `${trigger.cellX},${trigger.cellY}` : null

        if (trigger && triggerKey !== lastTriggerRef.current) {
          if (trigger.type === 'fart' || trigger.type === 'fakeExit' || trigger.type === 'teleporter') {
            ball = applyModifierEffect(trigger.type, ball, grid, CELL_SIZE, now, setState)
          }
          lastTriggerRef.current = triggerKey
        }
        if (!trigger) lastTriggerRef.current = null

        // check win
        if (checkWin(ball, grid, CELL_SIZE)) {
          playSound('victory')
          return { ...prev, ball, won: true }
        }

        return { ...prev, ball }
      })

      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [grid, state.won])

  // render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = grid.cols * CELL_SIZE
    canvas.height = grid.rows * CELL_SIZE

    drawMaze(ctx, grid, CELL_SIZE)

    const trigger = checkModifierTrigger(state.ball, grid, CELL_SIZE)
    if (trigger) {
      renderModifierOverlay(ctx, trigger.type, state.ball, grid, CELL_SIZE, Date.now())
    }

    drawBall(ctx, state.ball.x, state.ball.y, state.ball.radius)
  }, [state.ball, grid])

  const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  if (state.won) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <h1 style={{ fontSize: '48px', color: '#00ff88' }}>YOU ESCAPED</h1>
        {grid.hiddenWord && (
          <p style={{ fontSize: '24px', color: '#ffcc00' }}>
            The maze said: "{grid.hiddenWord}"
          </p>
        )}
        <p style={{ fontSize: '18px', color: '#888' }}>
          Time: {minutes}:{seconds.toString().padStart(2, '0')} | Deaths: {state.ball.deaths}
        </p>
        <button
          onClick={() => { window.location.hash = ''; window.location.reload() }}
          style={{
            padding: '12px 24px', background: '#ffcc00', color: '#000',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: '16px',
          }}
        >
          BUILD YOUR OWN
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: '#888' }}>
        <span>Time: {minutes}:{seconds.toString().padStart(2, '0')}</span>
        <span>Deaths: {state.ball.deaths}</span>
      </div>

      <canvas ref={canvasRef} style={{ border: '1px solid #333' }} />

      {state.showFakeWin && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.9)', zIndex: 100,
        }}>
          <h1 style={{ fontSize: '64px', color: '#00ff88' }}>YOU WIN!</h1>
        </div>
      )}

      <p style={{ color: '#444', fontSize: '11px' }}>WASD or arrow keys to move</p>

      <button
        onClick={() => {
          window.location.hash = ''
          window.location.reload()
        }}
        style={{
          padding: '8px 16px', background: 'transparent', color: '#ff4444',
          border: '1px solid #ff4444', borderRadius: '4px', cursor: 'pointer',
          fontFamily: 'monospace', fontSize: '12px',
        }}
      >
        RAGE QUIT (deaths: {state.ball.deaths})
      </button>
    </div>
  )
}

export default MazeSolver
```

- [ ] **Step 2: Update App.jsx to wire in MazeSolver**

```jsx
// src/App.jsx

import { useState, useEffect } from 'react'
import MazeBuilder from './components/MazeBuilder'
import MazeSolver from './components/MazeSolver'

function App() {
  const [mode, setMode] = useState('build')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setMode('suffer')
  }, [])

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'monospace' }}>
      {mode === 'build' ? <MazeBuilder /> : <MazeSolver />}
    </div>
  )
}

export default App
```

- [ ] **Step 3: End-to-end test**

```bash
npm run dev
```

1. Open browser — see builder
2. Draw some walls between cells
3. Place a fart tile and a teleporter pair
4. Click SHARE MAZE — URL copied
5. Open copied URL in new tab — solver loads
6. Use WASD to move the ball
7. Hit the fart tile — hear sound, controls reverse for 2s
8. Reach the end — victory screen with time and deaths
9. Click RAGE QUIT — redirects to builder

- [ ] **Step 4: Commit**

```bash
git add src/components/MazeSolver.jsx src/App.jsx
git commit -m "feat: maze solver with ball physics, modifier effects, timer, and victory screen"
```

---

### Task 8: Slide wall animation + spinner rotation in physics

**Files:**
- Modify: `src/engine/physics.js`
- Modify: `src/engine/renderer.js`

- [ ] **Step 1: Add slide wall logic to physics**

Add to `updateBall` in `src/engine/physics.js`, after the existing modifier checks:

```js
// Add this function to physics.js, exported

function getAnimatedGrid(grid, now) {
  const newCells = grid.cells.map((cell) => {
    if (cell.modifier === 'slideWall') {
      const phase = Math.sin(now / 1000) > 0
      return {
        ...cell,
        walls: {
          ...cell.walls,
          right: phase,
          left: !phase,
        },
      }
    }
    if (cell.modifier === 'spinner') {
      const tick = Math.floor(now / 3000) % 4
      const rotations = [
        { top: cell.walls.top, right: cell.walls.right, bottom: cell.walls.bottom, left: cell.walls.left },
        { top: cell.walls.left, right: cell.walls.top, bottom: cell.walls.right, left: cell.walls.bottom },
        { top: cell.walls.bottom, right: cell.walls.left, bottom: cell.walls.top, left: cell.walls.right },
        { top: cell.walls.right, right: cell.walls.bottom, bottom: cell.walls.left, left: cell.walls.top },
      ]
      return { ...cell, walls: rotations[tick] }
    }
    return cell
  })
  return { ...grid, cells: newCells }
}
```

Update the export:
```js
export { createBallState, updateBall, checkModifierTrigger, checkWin, resetBall, getAnimatedGrid }
```

- [ ] **Step 2: Use animated grid in MazeSolver game loop**

In `src/components/MazeSolver.jsx`, import `getAnimatedGrid` and use it in the loop:

Replace in the loop where `updateBall` is called:
```jsx
const animatedGrid = getAnimatedGrid(grid, now)
let ball = updateBall(prev.ball, inputRef.current, animatedGrid, CELL_SIZE, now)
```

And in the render `useEffect`, use `getAnimatedGrid(grid, Date.now())` for drawing.

- [ ] **Step 3: Verify**

Build a maze with slide walls and spinner. In solver, walls should oscillate and rotate.

- [ ] **Step 4: Commit**

```bash
git add src/engine/physics.js src/components/MazeSolver.jsx
git commit -m "feat: animated slide walls and spinner rotation"
```

---

### Task 9: Polish — timer tick, death sound, mobile touch

**Files:**
- Modify: `src/components/MazeSolver.jsx`

- [ ] **Step 1: Add timer re-render tick**

In MazeSolver, add a 1-second interval to force timer updates:

```jsx
// Add inside MazeSolver, after the game loop useEffect
useEffect(() => {
  if (state.won) return
  const id = setInterval(() => setState((s) => ({ ...s })), 1000)
  return () => clearInterval(id)
}, [state.won])
```

- [ ] **Step 2: Add touch controls**

Add touch input handling in MazeSolver, after the keyboard useEffect:

```jsx
useEffect(() => {
  let touchStartX = 0
  let touchStartY = 0

  const onTouchStart = (e) => {
    const touch = e.touches[0]
    touchStartX = touch.clientX
    touchStartY = touch.clientY
  }

  const onTouchMove = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY
    const threshold = 5

    inputRef.current = {
      up: dy < -threshold,
      down: dy > threshold,
      left: dx < -threshold,
      right: dx > threshold,
    }
  }

  const onTouchEnd = () => {
    inputRef.current = { up: false, down: false, left: false, right: false }
  }

  window.addEventListener('touchstart', onTouchStart)
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  return () => {
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
  }
}, [])
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MazeSolver.jsx
git commit -m "feat: timer display, touch controls, polish"
```

---

### Task 10: Build and deploy check

**Files:**
- Modify: `package.json` (add homepage if needed)

- [ ] **Step 1: Production build**

```bash
npm run build
```

Expected: no errors, `dist/` folder created.

- [ ] **Step 2: Preview production build**

```bash
npm run preview
```

Open browser. Build a maze, copy link, open in new tab, solve it.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: production build verified"
```
