const GRID_SIZE = 20

function createGrid(cols = GRID_SIZE, rows = GRID_SIZE) {
  const cells = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({
        x,
        y,
        walls: { top: false, right: false, bottom: false, left: false },
        modifier: null,
      })
    }
  }
  return {
    cols,
    rows,
    cells,
    start: { x: 0, y: 0 },
    end: { x: cols - 1, y: rows - 1 },
    hiddenWord: '',
  }
}

function getCell(grid, x, y) {
  if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) return null
  return grid.cells[y * grid.cols + x]
}

function toggleWallBetween(grid, x1, y1, x2, y2) {
  const cellA = getCell(grid, x1, y1)
  const cellB = getCell(grid, x2, y2)
  if (!cellA || !cellB) return grid

  const dx = x2 - x1
  const dy = y2 - y1

  const newCells = grid.cells.map((c) => {
    if (c.x === x1 && c.y === y1) {
      const walls = { ...c.walls }
      if (dx === 1) walls.right = !walls.right
      if (dx === -1) walls.left = !walls.left
      if (dy === 1) walls.bottom = !walls.bottom
      if (dy === -1) walls.top = !walls.top
      return { ...c, walls }
    }
    if (c.x === x2 && c.y === y2) {
      const walls = { ...c.walls }
      if (dx === 1) walls.left = !walls.left
      if (dx === -1) walls.right = !walls.right
      if (dy === 1) walls.top = !walls.top
      if (dy === -1) walls.bottom = !walls.bottom
      return { ...c, walls }
    }
    return c
  })

  return { ...grid, cells: newCells }
}

function setModifier(grid, x, y, modifier) {
  const newCells = grid.cells.map((c) =>
    c.x === x && c.y === y ? { ...c, modifier } : c
  )
  return { ...grid, cells: newCells }
}

function setStart(grid, x, y) {
  return { ...grid, start: { x, y } }
}

function setEnd(grid, x, y) {
  return { ...grid, end: { x, y } }
}

function setHiddenWord(grid, word) {
  return { ...grid, hiddenWord: word }
}

export {
  GRID_SIZE,
  createGrid,
  getCell,
  toggleWallBetween,
  setModifier,
  setStart,
  setEnd,
  setHiddenWord,
}
