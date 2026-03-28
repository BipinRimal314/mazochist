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

  // walls — deep plum, rounded caps, slightly thicker
  ctx.strokeStyle = COLORS.wall
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  for (const cell of grid.cells) {
    const cx = cell.x * cellSize
    const cy = cell.y * cellSize
    if (cell.walls.top) {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cellSize, cy); ctx.stroke()
    }
    if (cell.walls.right) {
      ctx.beginPath(); ctx.moveTo(cx + cellSize, cy); ctx.lineTo(cx + cellSize, cy + cellSize); ctx.stroke()
    }
    if (cell.walls.bottom) {
      ctx.beginPath(); ctx.moveTo(cx, cy + cellSize); ctx.lineTo(cx + cellSize, cy + cellSize); ctx.stroke()
    }
    if (cell.walls.left) {
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
