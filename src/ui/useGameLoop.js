import { useEffect, useRef, useState } from 'react'

/* eslint-disable react-hooks/immutability --
 * `game` is the imperative engine instance, mutated in place hundreds of
 * times a second by the loop this hook starts. The camera and the cell size
 * it records here are presentation state on that object, read by the renderer
 * and the touch stick, never by React.
 */
import { startLoop } from '../engine/loop.js'
import { stepGame, snapshot } from '../engine/game.js'
import { setupCanvas, drawScene } from '../engine/render.js'

/**
 * Drives simulation and drawing, and publishes a HUD snapshot to React about
 * ten times a second rather than sixty.
 *
 * Simulation lives outside React entirely. The previous version called setState
 * from inside requestAnimationFrame with an object full of Sets, so it
 * re-rendered the whole tree every frame and allocated new collections on each.
 */

const HUD_INTERVAL_MS = 100

/**
 * How quickly the window catches up with the hat, per frame. Low enough that
 * a respawn across the board is a glide and not a cut; high enough that the
 * hat never reaches the edge of the window at a walk.
 */
const CAMERA_EASE = 0.14

/**
 * Where the window should be so the hat is in the middle of it, clamped to
 * the board. Snaps on the first frame, eases after.
 */
function aimCamera(game, view) {
  const { cols, rows } = game.grid
  const wantX = Math.max(0, Math.min(cols - view.viewCols, game.ball.x - view.viewCols / 2))
  const wantY = Math.max(0, Math.min(rows - view.viewRows, game.ball.y - view.viewRows / 2))
  if (!game.camera) {
    game.camera = { x: wantX, y: wantY }
    return
  }
  game.camera.x += (wantX - game.camera.x) * CAMERA_EASE
  game.camera.y += (wantY - game.camera.y) * CAMERA_EASE
}

function useGameLoop(game, canvasRef, view) {
  const [hud, setHud] = useState(() => snapshot(game))
  const lastRef = useRef(0)
  const { cellSize, viewCols, viewRows, scrolls } = view

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = setupCanvas(canvas, viewCols * cellSize, viewRows * cellSize)
    game.camera = null
    game.cellPx = cellSize   // for the touch stick, which measures in pixels

    return startLoop({
      step: () => stepGame(game),
      render: () => {
        if (scrolls) aimCamera(game, { viewCols, viewRows })
        drawScene(ctx, game, cellSize)
      },
      onFrame: () => {
        const now = performance.now()
        if (now - lastRef.current < HUD_INTERVAL_MS) return
        lastRef.current = now
        setHud(snapshot(game))
      },
    })
  }, [game, canvasRef, cellSize, viewCols, viewRows, scrolls])

  return hud
}

export { useGameLoop, aimCamera, CAMERA_EASE, HUD_INTERVAL_MS }
