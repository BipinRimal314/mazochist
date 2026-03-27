import { LEVELS } from '../engine/levels'
import { generateLevel, CHAPTER_NAMES } from '../engine/generator'

const MODIFIER_TAGS = {
  ice: '\u{2744}\u{FE0F}',
  reverse: '\u{1F500}',
  blackout: '\u{1F311}',
  fart: '\u{1F4A8}',
  spinner: '\u{1F504}',
  teleporter: '\u{1F52E}',
  fakeExit: '\u{1F3C6}',
  gravity: '\u{1F300}',
  fatCursor: '\u{2B55}',
  slideWall: '\u{2194}\u{FE0F}',
}

function getModifiersInGrid(grid) {
  const mods = new Set()
  for (const cell of grid.cells) {
    if (cell.modifier) mods.add(cell.modifier)
  }
  return [...mods]
}

function getAllLevels() {
  const all = []

  // chapter 1: hand-crafted levels 1-10
  for (let i = 0; i < LEVELS.length; i++) {
    all.push({
      ...LEVELS[i],
      chapter: 'Baby Steps',
      chapterNumber: 1,
    })
  }

  // chapters 2-10: generated levels 11-100
  for (let i = 11; i <= 100; i++) {
    all.push(generateLevel(i))
  }

  return all
}

const ALL_LEVELS = getAllLevels()

function LevelSelect({ onSelectLevel, onBuild }) {
  const chapters = []
  let currentChapter = null

  for (let i = 0; i < ALL_LEVELS.length; i++) {
    const level = ALL_LEVELS[i]
    const cn = level.chapterNumber
    if (cn !== currentChapter) {
      chapters.push({
        number: cn,
        name: level.chapter,
        levels: [],
      })
      currentChapter = cn
    }
    chapters[chapters.length - 1].levels.push({ ...level, index: i })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px 20px', minHeight: '100vh', overflowY: 'auto' }}>
      <h1 style={{ fontSize: '32px', letterSpacing: '3px' }}>MAZOCHIST</h1>
      <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', maxWidth: '400px' }}>
        100 levels. 10 chapters. Each one introduces something worse.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '500px' }}>
        {chapters.map((ch) => (
          <div key={ch.number}>
            <div style={{
              fontSize: '11px', color: '#ffcc00', letterSpacing: '2px',
              padding: '4px 0', marginBottom: '8px', borderBottom: '1px solid #222',
              textTransform: 'uppercase',
            }}>
              Chapter {ch.number}: {ch.name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {ch.levels.map((level) => {
                const mods = getModifiersInGrid(level.grid)
                return (
                  <button
                    key={level.index}
                    onClick={() => onSelectLevel(level.index)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '8px 12px', background: '#111', border: '1px solid #1a1a1a',
                      borderRadius: '4px', cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#ffcc00'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1a1a1a'}
                  >
                    <span style={{ color: '#555', fontSize: '12px', fontFamily: 'monospace', width: '28px', textAlign: 'right' }}>
                      {level.index + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#ccc', fontSize: '13px', fontFamily: 'monospace' }}>
                        {level.name}
                      </div>
                      <div style={{ color: '#444', fontSize: '10px', fontFamily: 'monospace', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {level.description}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', fontSize: '12px', flexShrink: 0 }}>
                      {mods.slice(0, 5).map((m) => (
                        <span key={m}>{MODIFIER_TAGS[m] || '?'}</span>
                      ))}
                      {mods.length > 5 && <span style={{ color: '#555' }}>+{mods.length - 5}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '12px', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '80px', height: '1px', background: '#333' }} />
        <button
          onClick={onBuild}
          style={{
            padding: '10px 24px', background: 'transparent',
            border: '1px solid #444', borderRadius: '4px', cursor: 'pointer',
            color: '#888', fontFamily: 'monospace', fontSize: '13px',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ffcc00'; e.currentTarget.style.color = '#ffcc00' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#888' }}
        >
          or build your own
        </button>
      </div>
    </div>
  )
}

export { ALL_LEVELS }
export default LevelSelect
