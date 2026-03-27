import { useState, useRef, useEffect, useCallback } from 'react'
import { createGrid, toggleWallBetween, setModifier, setStart, setEnd, setHiddenWord, getCell } from '../engine/maze'
import { encodeToHash } from '../utils/serialize'
import { drawMaze } from '../engine/renderer'

const MODIFIERS = [
  { id: 'gravity', label: '\u{1F300}', name: 'Gravity Well' },
  { id: 'reverse', label: '\u{1F500}', name: 'Reverse' },
  { id: 'spinner', label: '\u{1F504}', name: 'Spinner' },
  { id: 'blackout', label: '\u{1F311}', name: 'Blackout' },
  { id: 'fakeExit', label: '\u{1F3C6}', name: 'Fake Exit' },
  { id: 'slideWall', label: '\u{2194}\u{FE0F}', name: 'Slide Wall' },
  { id: 'fatCursor', label: '\u{2B55}', name: 'Fat Cursor' },
  { id: 'fart', label: '\u{1F4A8}', name: 'Fart Tile' },
  { id: 'teleporter', label: '\u{1F52E}', name: 'Teleporter' },
  { id: 'ice', label: '\u{2744}\u{FE0F}', name: 'Ice' },
]

const TOOLS = [
  { id: 'wall', label: '\u{1F9F1}', name: 'Wall' },
  { id: 'start', label: '\u{1F7E2}', name: 'Start' },
  { id: 'end', label: '\u{1F534}', name: 'End' },
  { id: 'eraser', label: '\u{1F9F9}', name: 'Eraser' },
]

const CELL_SIZE = 30

function MazeBuilder() {
  const [grid, setGrid] = useState(() => createGrid(20, 20))
  const [tool, setTool] = useState('wall')
  const [copied, setCopied] = useState(false)
  const [hiddenWord, setHiddenWordState] = useState('')
  const canvasRef = useRef(null)
  const lastCellRef = useRef(null)
  const isDrawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = grid.cols * CELL_SIZE
    canvas.height = grid.rows * CELL_SIZE
    drawMaze(ctx, grid, CELL_SIZE)
  }, [grid])

  const getCellFromEvent = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE)
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE)
    if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) return null
    return { x, y }
  }, [grid.cols, grid.rows])

  const applyTool = useCallback((cellPos) => {
    if (!cellPos) return

    if (tool === 'start') {
      setGrid((g) => setStart(g, cellPos.x, cellPos.y))
      return
    }
    if (tool === 'end') {
      setGrid((g) => setEnd(g, cellPos.x, cellPos.y))
      return
    }
    if (tool === 'eraser') {
      setGrid((g) => setModifier(g, cellPos.x, cellPos.y, null))
      return
    }

    const isModifier = MODIFIERS.some((m) => m.id === tool)
    if (isModifier) {
      setGrid((g) => {
        const cell = getCell(g, cellPos.x, cellPos.y)
        const newMod = cell && cell.modifier === tool ? null : tool
        return setModifier(g, cellPos.x, cellPos.y, newMod)
      })
    }
  }, [tool])

  const handleMouseDown = useCallback((e) => {
    isDrawingRef.current = true
    const cellPos = getCellFromEvent(e)
    lastCellRef.current = cellPos

    if (tool === 'wall') return
    applyTool(cellPos)
  }, [getCellFromEvent, tool, applyTool])

  const handleMouseMove = useCallback((e) => {
    if (!isDrawingRef.current) return
    const cellPos = getCellFromEvent(e)
    if (!cellPos) return

    if (tool === 'wall') {
      const last = lastCellRef.current
      if (last && (last.x !== cellPos.x || last.y !== cellPos.y)) {
        const dx = cellPos.x - last.x
        const dy = cellPos.y - last.y
        if (Math.abs(dx) + Math.abs(dy) === 1) {
          setGrid((g) => toggleWallBetween(g, last.x, last.y, cellPos.x, cellPos.y))
        }
      }
      lastCellRef.current = cellPos
      return
    }

    applyTool(cellPos)
    lastCellRef.current = cellPos
  }, [getCellFromEvent, tool, applyTool])

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false
    lastCellRef.current = null
  }, [])

  const handleShare = useCallback(() => {
    const finalGrid = setHiddenWord(grid, hiddenWord)
    const hash = encodeToHash(finalGrid)
    const url = `${window.location.origin}${window.location.pathname}#${hash}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [grid, hiddenWord])

  const toolbarStyle = {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    background: '#111',
    borderRadius: '8px',
    flexWrap: 'wrap',
    maxWidth: grid.cols * CELL_SIZE,
  }

  const btnStyle = (active) => ({
    padding: '6px 10px',
    background: active ? '#333' : '#1a1a1a',
    border: active ? '1px solid #ffcc00' : '1px solid #333',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'monospace',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', letterSpacing: '2px' }}>MAZOCHIST</h1>
      <p style={{ color: '#666', fontSize: '12px' }}>build a maze. share the link. watch them suffer.</p>

      <div style={toolbarStyle}>
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} style={btnStyle(tool === t.id)}>
            {t.label} {t.name}
          </button>
        ))}
        <div style={{ width: '100%', height: '1px', background: '#333' }} />
        {MODIFIERS.map((m) => (
          <button key={m.id} onClick={() => setTool(m.id)} style={btnStyle(tool === m.id)}>
            {m.label} {m.name}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ border: '1px solid #333', cursor: 'crosshair' }}
      />

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Hidden word (revealed on solve)"
          value={hiddenWord}
          onChange={(e) => setHiddenWordState(e.target.value)}
          style={{
            background: '#111', border: '1px solid #333', color: '#fff',
            padding: '8px 12px', borderRadius: '4px', fontFamily: 'monospace', width: '260px',
          }}
        />
        <button
          onClick={handleShare}
          style={{
            padding: '8px 20px', background: copied ? '#00ff88' : '#ffcc00',
            color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px',
          }}
        >
          {copied ? 'COPIED!' : 'SHARE MAZE'}
        </button>
      </div>
    </div>
  )
}

export default MazeBuilder
