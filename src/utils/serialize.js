function gridToJSON(grid) {
  const compact = {
    c: grid.cols,
    r: grid.rows,
    s: [grid.start.x, grid.start.y],
    e: [grid.end.x, grid.end.y],
    w: grid.hiddenWord,
    d: [],
  }

  for (const cell of grid.cells) {
    const wallBits =
      (cell.walls.top ? 1 : 0) |
      (cell.walls.right ? 2 : 0) |
      (cell.walls.bottom ? 4 : 0) |
      (cell.walls.left ? 8 : 0)

    if (wallBits === 0 && !cell.modifier) continue

    const entry = [cell.x, cell.y, wallBits]
    if (cell.modifier) entry.push(cell.modifier)
    compact.d.push(entry)
  }

  return JSON.stringify(compact)
}

function jsonToGrid(json) {
  const compact = JSON.parse(json)
  const cols = compact.c
  const rows = compact.r

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

  for (const entry of compact.d) {
    const [x, y, wallBits, modifier] = entry
    const cell = cells[y * cols + x]
    cell.walls.top = !!(wallBits & 1)
    cell.walls.right = !!(wallBits & 2)
    cell.walls.bottom = !!(wallBits & 4)
    cell.walls.left = !!(wallBits & 8)
    if (modifier) cell.modifier = modifier
  }

  return {
    cols,
    rows,
    cells,
    start: { x: compact.s[0], y: compact.s[1] },
    end: { x: compact.e[0], y: compact.e[1] },
    hiddenWord: compact.w || '',
  }
}

function encodeToHash(grid) {
  const json = gridToJSON(grid)
  return btoa(encodeURIComponent(json))
}

function decodeFromHash(hash) {
  const json = decodeURIComponent(atob(hash))
  return jsonToGrid(json)
}

export { gridToJSON, jsonToGrid, encodeToHash, decodeFromHash }
