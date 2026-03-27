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
