const COLORS = {
  bg: '#fef6e4',
  wall: '#322f23',
  grid: '#eae2cc',
  start: '#0d656e',
  end: '#993862',
  ball: '#fed701',
  ballHighlight: 'rgba(255, 255, 255, 0.4)',
  modifier: {
    gravity: '#b8a9d4',
    reverse: '#f74b6d',
    spinner: '#0d656e',
    blackout: '#322f23',
    fakeExit: '#993862',
    slideWall: '#e8985a',
    fatCursor: '#a3ecf6',
    fart: '#8a7550',
    teleporter: '#b8a9d4',
    ice: '#a3ecf6',
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
  const { showModifiers = true, showGrid = true, collectedFakeExits = new Set() } = options
  const width = grid.cols * cellSize
  const height = grid.rows * cellSize

  // cream background
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, width, height)

  // subtle grid
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

  // start — teal rounded square
  ctx.fillStyle = COLORS.start
  roundRect(ctx, grid.start.x * cellSize + 3, grid.start.y * cellSize + 3, cellSize - 6, cellSize - 6, 5)
  ctx.fill()
  // play icon
  ctx.fillStyle = '#ffffff'
  const sx = grid.start.x * cellSize + cellSize * 0.4
  const sy = grid.start.y * cellSize + cellSize * 0.3
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(sx + cellSize * 0.3, sy + cellSize * 0.2)
  ctx.lineTo(sx, sy + cellSize * 0.4)
  ctx.closePath()
  ctx.fill()

  // end — pink rounded square
  ctx.fillStyle = COLORS.end
  roundRect(ctx, grid.end.x * cellSize + 3, grid.end.y * cellSize + 3, cellSize - 6, cellSize - 6, 5)
  ctx.fill()
  // flag icon
  ctx.fillStyle = '#ffffff'
  const fx = grid.end.x * cellSize + cellSize * 0.35
  const fy = grid.end.y * cellSize + cellSize * 0.25
  ctx.fillRect(fx, fy, 2, cellSize * 0.5)
  ctx.beginPath()
  ctx.moveTo(fx + 2, fy)
  ctx.lineTo(fx + cellSize * 0.35, fy + cellSize * 0.12)
  ctx.lineTo(fx + 2, fy + cellSize * 0.25)
  ctx.closePath()
  ctx.fill()

  // one-way gates
  for (const cell of grid.cells) {
    if (!cell.gate || !cell.gate.open) continue
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

  // mimic tiles — look identical to the real exit
  for (const cell of grid.cells) {
    if (!cell.mimic) continue
    ctx.fillStyle = COLORS.end
    roundRect(ctx, cell.x * cellSize + 3, cell.y * cellSize + 3, cellSize - 6, cellSize - 6, 5)
    ctx.fill()
    // flag icon (same as real exit)
    ctx.fillStyle = '#ffffff'
    const mfx = cell.x * cellSize + cellSize * 0.35
    const mfy = cell.y * cellSize + cellSize * 0.25
    ctx.fillRect(mfx, mfy, 2, cellSize * 0.5)
    ctx.beginPath()
    ctx.moveTo(mfx + 2, mfy)
    ctx.lineTo(mfx + cellSize * 0.35, mfy + cellSize * 0.12)
    ctx.lineTo(mfx + 2, mfy + cellSize * 0.25)
    ctx.closePath()
    ctx.fill()
  }

  // memory wipe zones — subtle shimmer
  for (const cell of grid.cells) {
    if (!cell.memoryWipe) continue
    ctx.fillStyle = 'rgba(184, 169, 212, 0.15)'
    roundRect(ctx, cell.x * cellSize + 1, cell.y * cellSize + 1, cellSize - 2, cellSize - 2, 4)
    ctx.fill()
  }

  // modifiers
  if (showModifiers) {
    for (const cell of grid.cells) {
      if (!cell.modifier) continue

      // fake exits
      if (cell.modifier === 'fakeExit') {
        const key = `${cell.x},${cell.y}`
        if (collectedFakeExits.has(key)) {
          ctx.fillStyle = '#e5dcc6'
          roundRect(ctx, cell.x * cellSize + 3, cell.y * cellSize + 3, cellSize - 6, cellSize - 6, 5)
          ctx.fill()
          ctx.font = `600 ${cellSize * 0.35}px 'Plus Jakarta Sans', sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#b3ad9c'
          ctx.fillText('\u{2713}', cell.x * cellSize + cellSize / 2, cell.y * cellSize + cellSize / 2)
        } else {
          // looks identical to the real exit
          ctx.fillStyle = COLORS.end
          roundRect(ctx, cell.x * cellSize + 3, cell.y * cellSize + 3, cellSize - 6, cellSize - 6, 5)
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          const efx = cell.x * cellSize + cellSize * 0.35
          const efy = cell.y * cellSize + cellSize * 0.25
          ctx.fillRect(efx, efy, 2, cellSize * 0.5)
          ctx.beginPath()
          ctx.moveTo(efx + 2, efy)
          ctx.lineTo(efx + cellSize * 0.35, efy + cellSize * 0.12)
          ctx.lineTo(efx + 2, efy + cellSize * 0.25)
          ctx.closePath()
          ctx.fill()
        }
        continue
      }

      const color = COLORS.modifier[cell.modifier] || '#b3ad9c'
      ctx.fillStyle = color + '25'
      roundRect(ctx, cell.x * cellSize + 2, cell.y * cellSize + 2, cellSize - 4, cellSize - 4, 4)
      ctx.fill()
      ctx.font = `${cellSize * 0.42}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        MODIFIER_LABELS[cell.modifier] || '?',
        cell.x * cellSize + cellSize / 2,
        cell.y * cellSize + cellSize / 2
      )
    }
  }

  // walls — deep plum, rounded caps
  // liar walls: visually show walls that don't exist, hide walls that do
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  for (const cell of grid.cells) {
    const cx = cell.x * cellSize
    const cy = cell.y * cellSize
    const liar = cell.liarWalls

    // what to DRAW (visual): real walls XOR liar overrides
    // if liar says top=true, draw top even if real wall is false (fake wall)
    // if liar says top=false (or undefined), draw real wall
    const drawTop = liar ? (liar.top !== undefined ? liar.top : cell.walls.top) : cell.walls.top
    const drawRight = liar ? (liar.right !== undefined ? liar.right : cell.walls.right) : cell.walls.right
    const drawBottom = liar ? (liar.bottom !== undefined ? liar.bottom : cell.walls.bottom) : cell.walls.bottom
    const drawLeft = liar ? (liar.left !== undefined ? liar.left : cell.walls.left) : cell.walls.left

    ctx.strokeStyle = COLORS.wall
    if (drawTop) {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cellSize, cy); ctx.stroke()
    }
    if (drawRight) {
      ctx.beginPath(); ctx.moveTo(cx + cellSize, cy); ctx.lineTo(cx + cellSize, cy + cellSize); ctx.stroke()
    }
    if (drawBottom) {
      ctx.beginPath(); ctx.moveTo(cx, cy + cellSize); ctx.lineTo(cx + cellSize, cy + cellSize); ctx.stroke()
    }
    if (drawLeft) {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cellSize); ctx.stroke()
    }
  }
}

function drawBall(ctx, x, y, radius, color = COLORS.ball) {
  // warm ambient shadow
  ctx.save()
  ctx.shadowColor = 'rgba(45, 51, 74, 0.15)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // white border
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()

  // shine highlight
  ctx.fillStyle = COLORS.ballHighlight
  ctx.beginPath()
  ctx.arc(x - radius * 0.2, y - radius * 0.2, radius * 0.35, 0, Math.PI * 2)
  ctx.fill()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
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
}

export { COLORS, MODIFIER_LABELS, drawMaze, drawBall }
