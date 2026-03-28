/**
 * The Stalker — a shadow that follows the player's exact path on a delay.
 *
 * Records every position the ball visits. After a delay (default 10s),
 * the shadow starts replaying that path. If the shadow reaches the ball, death.
 *
 * The shadow is visible through fog (you can always see it coming).
 * Speed matches the player's average speed — it doesn't cheat, it just
 * never stops and never hesitates.
 */

const STALKER_DELAY_MS = 10000
const STALKER_SAMPLE_INTERVAL = 100  // record position every 100ms
const STALKER_CATCH_RADIUS = 1.2     // cells — how close before death

function createStalker(enabled = false) {
  return {
    enabled,
    path: [],               // recorded positions: [{x, y, t}]
    shadowIndex: 0,          // current position in path replay
    shadowX: null,
    shadowY: null,
    startTime: Date.now(),
    lastSample: 0,
    active: false,           // becomes true after delay
    caught: false,
  }
}

function recordStalkerPosition(stalker, ballX, ballY, cellSize) {
  if (!stalker.enabled) return stalker

  const now = Date.now()
  if (now - stalker.lastSample < STALKER_SAMPLE_INTERVAL) return stalker

  const cellX = ballX / cellSize
  const cellY = ballY / cellSize

  return {
    ...stalker,
    path: [...stalker.path, { x: cellX, y: cellY, t: now }],
    lastSample: now,
  }
}

function updateStalker(stalker, ballX, ballY, cellSize) {
  if (!stalker.enabled) return stalker
  if (stalker.path.length === 0) return stalker

  const now = Date.now()
  const elapsed = now - stalker.startTime

  // stalker activates after delay
  if (elapsed < STALKER_DELAY_MS) {
    return { ...stalker, active: false }
  }

  if (!stalker.active) {
    return { ...stalker, active: true, shadowIndex: 0 }
  }

  // find the path position that corresponds to (now - delay)
  const targetTime = now - STALKER_DELAY_MS
  let idx = stalker.shadowIndex
  while (idx < stalker.path.length - 1 && stalker.path[idx + 1].t <= targetTime) {
    idx++
  }

  if (idx >= stalker.path.length) {
    // shadow has caught up to the end of recorded path
    // it stops and waits (player is still moving, recording new positions)
    idx = stalker.path.length - 1
  }

  const shadowPos = stalker.path[idx]
  const shadowX = shadowPos.x
  const shadowY = shadowPos.y

  // check if shadow caught the ball
  const ballCellX = ballX / cellSize
  const ballCellY = ballY / cellSize
  const dist = Math.sqrt(
    Math.pow(shadowX - ballCellX, 2) + Math.pow(shadowY - ballCellY, 2)
  )

  const caught = dist < STALKER_CATCH_RADIUS

  return {
    ...stalker,
    shadowIndex: idx,
    shadowX,
    shadowY,
    caught,
    active: true,
  }
}

function drawStalker(ctx, stalker, cellSize, now) {
  if (!stalker.enabled || !stalker.active || stalker.shadowX === null) return

  const x = stalker.shadowX * cellSize
  const y = stalker.shadowY * cellSize
  const radius = cellSize * 0.4

  // pulsing dark shadow
  const pulse = 0.6 + Math.sin(now / 300) * 0.2

  // shadow trail (last few positions)
  const trailStart = Math.max(0, stalker.shadowIndex - 8)
  for (let i = trailStart; i < stalker.shadowIndex; i++) {
    const pos = stalker.path[i]
    if (!pos) continue
    const trailAlpha = 0.05 + ((i - trailStart) / 8) * 0.15
    ctx.fillStyle = `rgba(50, 47, 35, ${trailAlpha})`
    ctx.beginPath()
    ctx.arc(pos.x * cellSize, pos.y * cellSize, radius * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }

  // main shadow body
  ctx.save()
  ctx.shadowColor = 'rgba(153, 56, 98, 0.5)'
  ctx.shadowBlur = 15
  ctx.fillStyle = `rgba(50, 47, 35, ${pulse})`
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // eyes (two small dots)
  ctx.fillStyle = `rgba(247, 75, 109, ${pulse})`
  ctx.beginPath()
  ctx.arc(x - radius * 0.25, y - radius * 0.1, radius * 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + radius * 0.25, y - radius * 0.1, radius * 0.15, 0, Math.PI * 2)
  ctx.fill()
}

function resetStalker(stalker) {
  if (!stalker.enabled) return stalker
  return {
    ...stalker,
    path: [],
    shadowIndex: 0,
    shadowX: null,
    shadowY: null,
    startTime: Date.now(),
    lastSample: 0,
    active: false,
    caught: false,
  }
}

// countdown display — seconds until stalker activates
function stalkerCountdown(stalker) {
  if (!stalker.enabled) return null
  if (stalker.active) return 0
  const elapsed = Date.now() - stalker.startTime
  const remaining = Math.max(0, Math.ceil((STALKER_DELAY_MS - elapsed) / 1000))
  return remaining
}

export {
  createStalker,
  recordStalkerPosition,
  updateStalker,
  drawStalker,
  resetStalker,
  stalkerCountdown,
  STALKER_DELAY_MS,
}
