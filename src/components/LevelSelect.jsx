import { LEVELS } from '../engine/levels'
import { generateLevel, CHAPTER_NAMES } from '../engine/generator'

const MODIFIER_TAGS = {
  ice: '\u{2744}\u{FE0F}',
  reverse: '\u{1F500}',
  blackout: '\u{1F311}',
  fart: '\u{1F4A8}',
  spinner: '\u{1F504}',
  teleporter: '\u{1F52E}',
  fakeExit: '\u{1F534}',
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
  for (let i = 0; i < LEVELS.length; i++) {
    all.push({ ...LEVELS[i], chapter: 'Baby Steps', chapterNumber: 1 })
  }
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
      chapters.push({ number: cn, name: level.chapter, levels: [] })
      currentChapter = cn
    }
    chapters[chapters.length - 1].levels.push({ ...level, index: i })
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '24px', padding: '48px 20px 60px', minHeight: '100vh',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: '40px', fontWeight: 800, letterSpacing: '1px',
          color: 'var(--text)', marginBottom: '8px',
        }}>
          mazochist
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '320px' }}>
          100 lovingly crafted levels of suffering.
          <br />Each chapter teaches you a new way to fail.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', maxWidth: '480px' }}>
        {chapters.map((ch) => (
          <div key={ch.number}>
            <div style={{
              fontSize: '11px', fontWeight: 700, color: 'var(--accent)',
              letterSpacing: '1.5px', textTransform: 'uppercase',
              padding: '0 4px 8px', borderBottom: '1px solid #ede6dd',
            }}>
              Chapter {ch.number}: {ch.name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
              {ch.levels.map((level) => {
                const mods = getModifiersInGrid(level.grid)
                return (
                  <button
                    key={level.index}
                    onClick={() => onSelectLevel(level.index)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '10px 14px', background: 'var(--bg-card)',
                      border: '1px solid #ede6dd', borderRadius: 'var(--radius)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: 'var(--shadow)',
                      fontFamily: 'var(--font)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = 'var(--shadow-hover)'
                      e.currentTarget.style.background = 'var(--bg-card-hover)'
                      e.currentTarget.style.borderColor = 'var(--accent-light)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'var(--shadow)'
                      e.currentTarget.style.background = 'var(--bg-card)'
                      e.currentTarget.style.borderColor = '#ede6dd'
                    }}
                  >
                    <span style={{
                      color: 'var(--accent)', fontSize: '16px', fontWeight: 700,
                      width: '28px', textAlign: 'right',
                    }}>
                      {level.index + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 600 }}>
                        {level.name}
                      </div>
                      <div style={{
                        color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {level.description}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', fontSize: '13px', flexShrink: 0 }}>
                      {mods.slice(0, 5).map((m) => (
                        <span key={m}>{MODIFIER_TAGS[m] || '?'}</span>
                      ))}
                      {mods.length > 5 && (
                        <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>+{mods.length - 5}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '60px', height: '1px', background: '#ede6dd' }} />
        <button
          onClick={onBuild}
          style={{
            padding: '10px 28px', background: 'transparent',
            border: '1.5px solid #ede6dd', borderRadius: 'var(--radius)',
            cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)',
            fontSize: '14px', fontWeight: 600, transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.color = 'var(--accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#ede6dd'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          or build your own
        </button>
      </div>
    </div>
  )
}

export { ALL_LEVELS }
export default LevelSelect
