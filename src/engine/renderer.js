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
  const { showModifiers = true, showGrid = true, collectedFakeExits = new Set() } = options
  const width = grid.cols * cellSize
  const height = grid.rows * cellSize

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, width, height)

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

  if (showModifiers) {
    for (const cell of grid.cells) {
      if (!cell.modifier) continue
      // fake exits: uncollected look like the real exit, collected are dimmed
      if (cell.modifier === 'fakeExit') {
        const key = `${cell.x},${cell.y}`
        if (collectedFakeExits.has(key)) {
          ctx.fillStyle = '#333333'
          ctx.fillRect(
            cell.x * cellSize + 2,
            cell.y * cellSize + 2,
            cellSize - 4,
            cellSize - 4
          )
          ctx.font = `${cellSize * 0.4}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#555'
          ctx.fillText('\u{2713}', cell.x * cellSize + cellSize / 2, cell.y * cellSize + cellSize / 2)
        } else {
          ctx.fillStyle = COLORS.end
          ctx.fillRect(
            cell.x * cellSize + 2,
            cell.y * cellSize + 2,
            cellSize - 4,
            cellSize - 4
          )
        }
        continue
      }
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
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = 12
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export { COLORS, MODIFIER_LABELS, drawMaze, drawBall }
