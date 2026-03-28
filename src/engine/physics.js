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
  const speed = 3.6
  const friction = 0.82
  const iceFriction = 0.997

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

  if (onIce) {
    // on ice: ignore new input, preserve momentum, no friction
    // only apply input if ball is nearly stopped (to get unstuck)
    const currentSpeed = Math.sqrt(vx * vx + vy * vy)
    if (currentSpeed < 0.5) {
      vx += dx * speed * 0.5
      vy += dy * speed * 0.5
    }
    // no friction on ice — ball slides until it hits a wall
  } else {
    vx += dx * speed * 0.3
    vy += dy * speed * 0.3
    vx *= friction
    vy *= friction
  }

  if (cell && cell.modifier === 'gravity') {
    const centerX = (cellX + 0.5) * cellSize
    const centerY = (cellY + 0.5) * cellSize
    const pullDx = centerX - x
    const pullDy = centerY - y

    // strong pull that grabs you but can be escaped with sustained input
    vx += pullDx * 0.06
    vy += pullDy * 0.06
    // dampen velocity inside the well
    vx *= 0.95
    vy *= 0.95
  }

  const maxSpeed = cellSize * 0.42
  const spd = Math.sqrt(vx * vx + vy * vy)
  if (spd > maxSpeed) {
    vx = (vx / spd) * maxSpeed
    vy = (vy / spd) * maxSpeed
  }

  // sub-step movement to prevent tunneling
  const steps = 4
  const stepVx = vx / steps
  const stepVy = vy / steps
  let hitX = false
  let hitY = false

  for (let i = 0; i < steps; i++) {
    x += stepVx
    y += stepVy
    const resolved = resolveCollisions(x, y, ball.radius, grid, cellSize)
    if (resolved.hitX) hitX = true
    if (resolved.hitY) hitY = true
    x = resolved.x
    y = resolved.y
  }

  const newCellX = Math.floor(x / cellSize)
  const newCellY = Math.floor(y / cellSize)
  const newCell = getCell(grid, newCellX, newCellY)
  const fat = newCell && newCell.modifier === 'fatCursor'
  const radius = fat ? ball.baseRadius * 1.8 : ball.baseRadius

  return {
    ...ball,
    x,
    y,
    vx: hitX ? vx * -0.3 : vx,
    vy: hitY ? vy * -0.3 : vy,
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

  // check the cell the ball center is in — its walls constrain the ball
  // walls are mirrored (toggleWallBetween sets both sides), so checking
  // the current cell is sufficient
  for (let pass = 0; pass < 2; pass++) {
    const cx = Math.floor(x / cellSize)
    const cy = Math.floor(y / cellSize)
    const cell = getCell(grid, cx, cy)
    if (!cell) break

    const left = cx * cellSize
    const top = cy * cellSize
    const right = left + cellSize
    const bottom = top + cellSize

    if (cell.walls.right && x + radius > right) {
      x = right - radius
      hitX = true
    }
    if (cell.walls.left && x - radius < left) {
      x = left + radius
      hitX = true
    }
    if (cell.walls.bottom && y + radius > bottom) {
      y = bottom - radius
      hitY = true
    }
    if (cell.walls.top && y - radius < top) {
      y = top + radius
      hitY = true
    }

    // also check the cell the ball edge is reaching into
    // (handles case where ball center is near a cell boundary)
    const edgeRightCell = getCell(grid, Math.floor((x + radius) / cellSize), cy)
    if (edgeRightCell && edgeRightCell.walls.left) {
      const wallX = Math.floor((x + radius) / cellSize) * cellSize
      if (x + radius > wallX && x < wallX) {
        x = wallX - radius
        hitX = true
      }
    }

    const edgeLeftCell = getCell(grid, Math.floor((x - radius) / cellSize), cy)
    if (edgeLeftCell && edgeLeftCell.walls.right) {
      const wallX = (Math.floor((x - radius) / cellSize) + 1) * cellSize
      if (x - radius < wallX && x > wallX) {
        x = wallX + radius
        hitX = true
      }
    }

    const edgeBottomCell = getCell(grid, cx, Math.floor((y + radius) / cellSize))
    if (edgeBottomCell && edgeBottomCell.walls.top) {
      const wallY = Math.floor((y + radius) / cellSize) * cellSize
      if (y + radius > wallY && y < wallY) {
        y = wallY - radius
        hitY = true
      }
    }

    const edgeTopCell = getCell(grid, cx, Math.floor((y - radius) / cellSize))
    if (edgeTopCell && edgeTopCell.walls.bottom) {
      const wallY = (Math.floor((y - radius) / cellSize) + 1) * cellSize
      if (y - radius < wallY && y > wallY) {
        y = wallY + radius
        hitY = true
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
      const phase = Math.sin(now / 830) > 0
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
      const tick = Math.floor(now / 2500) % 4
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
