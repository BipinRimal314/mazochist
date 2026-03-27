const COLORS = {
  bg: '#faf6f0',
  wall: '#3d3229',
  grid: '#ede6dd',
  start: '#7eb88a',
  end: '#d97373',
  ball: '#e8b84a',
  modifier: {
    gravity: '#b8a9d4',
    reverse: '#d97373',
    spinner: '#7eb0c9',
    blackout: '#5c5148',
    fakeExit: '#d97373',
    slideWall: '#e8985a',
    fatCursor: '#a3cce0',
    fart: '#c4a574',
    teleporter: '#b8a9d4',
    ice: '#a3cce0',
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

  // start — rounded square
  ctx.fillStyle = COLORS.start
  roundRect(ctx, grid.start.x * cellSize + 3, grid.start.y * cellSize + 3, cellSize - 6, cellSize - 6, 4)
  ctx.fill()

  // end — rounded square
  ctx.fillStyle = COLORS.end
  roundRect(ctx, grid.end.x * cellSize + 3, grid.end.y * cellSize + 3, cellSize - 6, cellSize - 6, 4)
  ctx.fill()

  if (showModifiers) {
    for (const cell of grid.cells) {
      if (!cell.modifier) continue

      if (cell.modifier === 'fakeExit') {
        const key = `${cell.x},${cell.y}`
        if (collectedFakeExits.has(key)) {
          ctx.fillStyle = '#ede6dd'
          roundRect(ctx, cell.x * cellSize + 3, cell.y * cellSize + 3, cellSize - 6, cellSize - 6, 4)
          ctx.fill()
          ctx.font = `${cellSize * 0.4}px Nunito, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = 'var(--text-muted)'
          ctx.fillText('\u{2713}', cell.x * cellSize + cellSize / 2, cell.y * cellSize + cellSize / 2)
        } else {
          ctx.fillStyle = COLORS.end
          roundRect(ctx, cell.x * cellSize + 3, cell.y * cellSize + 3, cellSize - 6, cellSize - 6, 4)
          ctx.fill()
        }
        continue
      }

      const color = COLORS.modifier[cell.modifier] || '#a89888'
      ctx.fillStyle = color + '30'
      roundRect(ctx, cell.x * cellSize + 2, cell.y * cellSize + 2, cellSize - 4, cellSize - 4, 4)
      ctx.fill()
      ctx.font = `${cellSize * 0.45}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        MODIFIER_LABELS[cell.modifier] || '?',
        cell.x * cellSize + cellSize / 2,
        cell.y * cellSize + cellSize / 2
      )
    }
  }

  // walls — rounded caps, warm brown
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
  // soft shadow
  ctx.save()
  ctx.shadowColor = 'rgba(61, 50, 41, 0.2)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.beginPath()
  ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.4, 0, Math.PI * 2)
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
