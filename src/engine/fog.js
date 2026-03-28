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
    const pulse = 0.75 + Math.sin(now / 500 + x * 0.5 + y * 0.3) * 0.15
    ctx.fillStyle = `rgba(50, 47, 35, ${pulse})`
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
    ctx.fillStyle = `rgba(153, 56, 98, ${pulse * 0.2})`
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
  }
}

function drawTrapFlash(ctx, cellSize, trapX, trapY) {
  ctx.fillStyle = '#f74b6d'
  const x = trapX * cellSize + 3
  const y = trapY * cellSize + 3
  const w = cellSize - 6
  const h = cellSize - 6
  const r = 5
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
      if (nx === grid.end.x && ny === grid.end.y) continue
      newCorrupted.add(key)
      newFrontier.push({ x: nx, y: ny })
    }
  }

  return { corruptedCells: newCorrupted, frontier: newFrontier }
}

export { drawFog, drawCorruption, drawTrapFlash, spreadCorruption }
