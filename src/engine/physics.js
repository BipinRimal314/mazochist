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

  const cellX = Math.floor(x / cellSize)
  const cellY = Math.floor(y / cellSize)
  const cell = getCell(grid, cellX, cellY)
  const onIce = cell && cell.modifier === 'ice'

  vx += dx * speed * 0.3
  vy += dy * speed * 0.3

  if (cell && cell.modifier === 'gravity') {
    const centerX = (cellX + 0.5) * cellSize
    const centerY = (cellY + 0.5) * cellSize
    vx += (centerX - x) * 0.02
    vy += (centerY - y) * 0.02
  }

  const fric = onIce ? iceFriction : friction
  vx *= fric
  vy *= fric

  const maxSpeed = cellSize * 0.4
  const spd = Math.sqrt(vx * vx + vy * vy)
  if (spd > maxSpeed) {
    vx = (vx / spd) * maxSpeed
    vy = (vy / spd) * maxSpeed
  }

  const newX = x + vx
  const newY = y + vy
  const result = resolveCollisions(newX, newY, ball.radius, grid, cellSize)

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

  const totalW = grid.cols * cellSize
  const totalH = grid.rows * cellSize
  if (x - radius < 0) { x = radius; hitX = true }
  if (x + radius > totalW) { x = totalW - radius; hitX = true }
  if (y - radius < 0) { y = radius; hitY = true }
  if (y + radius > totalH) { y = totalH - radius; hitY = true }

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

      if (cell.walls.top) {
        if (x + radius > wallLeft && x - radius < wallRight) {
          if (y - radius < wallTop && y > wallTop - cellSize) {
            y = wallTop + radius; hitY = true
          }
        }
      }
      if (cell.walls.bottom) {
        if (x + radius > wallLeft && x - radius < wallRight) {
          if (y + radius > wallBottom && y < wallBottom + cellSize) {
            y = wallBottom - radius; hitY = true
          }
        }
      }
      if (cell.walls.left) {
        if (y + radius > wallTop && y - radius < wallBottom) {
          if (x - radius < wallLeft && x > wallLeft - cellSize) {
            x = wallLeft + radius; hitX = true
          }
        }
      }
      if (cell.walls.right) {
        if (y + radius > wallTop && y - radius < wallBottom) {
          if (x + radius > wallRight && x < wallRight + cellSize) {
            x = wallRight - radius; hitX = true
          }
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

export { createBallState, updateBall, checkModifierTrigger, checkWin, resetBall, getAnimatedGrid }
