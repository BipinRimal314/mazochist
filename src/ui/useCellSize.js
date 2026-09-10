import { useState, useEffect } from 'react'

/**
 * Pick a cell size that fits the board on screen.
 *
 * The original hardcoded `const CELL_SIZE = 30`, so a 12x12 level was a 360px
 * postage stamp on a desktop monitor while a 20x20 level overflowed a phone
 * with no way to scroll to the rest of it. Physics is in cell units now, so
 * this only affects presentation and can change at any time — including
 * mid-level on an orientation change.
 */

const MIN_CELL = 14
const MAX_CELL = 72

/**
 * Below this the board stops being readable, so rather than shrink further the
 * view becomes a window onto it that follows the hat. The late fields are
 * 38 cells wide: on a desktop they fit whole, on a phone they scroll.
 */
const VIEW_CELL = 26

function measure(cols, rows, reservedHeight) {
  // Boards are landscape now, so width is the dimension worth spending. The
  // old 900px ceiling left a wide window with a stamp in the middle of it.
  const availableWidth = Math.min(window.innerWidth - 32, 1400)
  const availableHeight = Math.max(160, window.innerHeight - reservedHeight)

  const fit = Math.floor(Math.min(availableWidth / cols, availableHeight / rows))
  if (fit >= VIEW_CELL) {
    const cellSize = Math.min(MAX_CELL, fit)
    return { cellSize, viewCols: cols, viewRows: rows, scrolls: false }
  }

  // too big to show whole: a window that follows the hat
  const cellSize = VIEW_CELL
  return {
    cellSize,
    viewCols: Math.min(cols, Math.max(6, Math.floor(availableWidth / cellSize))),
    viewRows: Math.min(rows, Math.max(5, Math.floor(availableHeight / cellSize))),
    scrolls: true,
  }
}

const same = (a, b) =>
  a.cellSize === b.cellSize && a.viewCols === b.viewCols && a.viewRows === b.viewRows

/** @returns {{ cellSize, viewCols, viewRows, scrolls }} */
function useCellSize(cols, rows, reservedHeight = 260) {
  const [view, setView] = useState(() => measure(cols, rows, reservedHeight))

  useEffect(() => {
    const update = () => {
      const next = measure(cols, rows, reservedHeight)
      setView((prev) => (same(prev, next) ? prev : next))
    }
    update()

    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [cols, rows, reservedHeight])

  return view
}

export { useCellSize, MIN_CELL, MAX_CELL, VIEW_CELL }
