import { LEVELS } from '../engine/levels'
import { generateLevel } from '../engine/generator'

const MODIFIER_TAGS = {
  ice: '\u{2744}\u{FE0F}', reverse: '\u{1F500}', blackout: '\u{1F311}',
  fart: '\u{1F4A8}', spinner: '\u{1F504}', teleporter: '\u{1F52E}',
  fakeExit: '\u{1F534}', gravity: '\u{1F300}', fatCursor: '\u{2B55}',
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

  const s = {
    page: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', padding: '0 20px 80px',
      fontFamily: "var(--font-body)",
    },
    hero: {
      textAlign: 'center', padding: '60px 0 40px', maxWidth: '480px',
    },
    title: {
      fontFamily: "var(--font-headline)", fontWeight: 800,
      fontSize: 'clamp(48px, 12vw, 80px)', color: 'var(--primary)',
      letterSpacing: '-2px', lineHeight: 1, textTransform: 'lowercase',
    },
    subtitle: {
      fontFamily: "var(--font-headline)", fontWeight: 600,
      fontSize: '16px', color: 'var(--on-surface-variant)', opacity: 0.8,
      marginTop: '12px',
    },
    buildBtn: {
      marginTop: '24px', display: 'inline-block',
      background: 'linear-gradient(180deg, var(--primary-container) 0%, var(--primary) 100%)',
      color: '#fff', fontFamily: "var(--font-headline)", fontWeight: 700,
      fontSize: '18px', padding: '16px 40px', borderRadius: '9999px',
      border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-gummy)',
      transition: 'transform 0.3s var(--bounce)',
    },
    buildSubtext: {
      display: 'block', marginTop: '8px',
      fontFamily: "var(--font-body)", fontSize: '12px',
      color: 'var(--primary)', opacity: 0.5, fontStyle: 'italic',
    },
    statsRow: {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
      width: '100%', maxWidth: '480px', marginBottom: '32px',
    },
    statCard: (bg, color) => ({
      background: bg, color: color, borderRadius: 'var(--radius-lg)',
      padding: '20px', textAlign: 'center',
      boxShadow: 'var(--shadow-gummy)',
      transition: 'transform 0.5s var(--bounce)',
      cursor: 'default',
    }),
    statNum: {
      fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: '28px',
    },
    statLabel: {
      fontFamily: "var(--font-headline)", fontSize: '11px',
      textTransform: 'lowercase', fontWeight: 500, marginTop: '4px',
    },
    chapterHeader: {
      fontFamily: "var(--font-headline)", fontSize: '11px', fontWeight: 700,
      color: 'var(--primary)', letterSpacing: '1.5px', textTransform: 'uppercase',
      padding: '0 4px 8px', borderBottom: '2px solid var(--surface-container)',
      marginBottom: '8px',
    },
    levelBtn: {
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '12px 16px', background: 'var(--surface-container-lowest)',
      border: 'none', borderRadius: 'var(--radius)',
      cursor: 'pointer', textAlign: 'left', width: '100%',
      boxShadow: 'var(--shadow-gummy)',
      transition: 'all 0.4s var(--bounce)',
      fontFamily: "var(--font-body)",
    },
    levelNum: {
      fontFamily: "var(--font-headline)", color: 'var(--primary)',
      fontSize: '16px', fontWeight: 800, width: '28px', textAlign: 'right',
    },
    levelName: {
      color: 'var(--on-surface)', fontSize: '14px',
      fontFamily: "var(--font-headline)", fontWeight: 700,
    },
    levelDesc: {
      color: 'var(--on-surface-variant)', fontSize: '11px',
      fontFamily: "var(--font-body)", marginTop: '2px', fontStyle: 'italic',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },
    footer: {
      marginTop: '32px', textAlign: 'center',
      fontFamily: "var(--font-body)", fontSize: '10px',
      color: 'var(--primary)', opacity: 0.5, fontStyle: 'italic',
    },
  }

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <h1 style={s.title}>mazochist</h1>
        <p style={s.subtitle}>Build absurd mazes. Share links. Watch people fail.</p>
        <button
          style={s.buildBtn}
          onClick={onBuild}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          BUILD A MAZE
        </button>
        <span style={s.buildSubtext}>no account needed. just cruelty.</span>
      </div>

      <div style={s.statsRow}>
        <div
          style={s.statCard('var(--secondary-container)', 'var(--on-secondary-container)')}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={s.statNum}>100</div>
          <div style={s.statLabel}>levels of suffering</div>
        </div>
        <div
          style={s.statCard('var(--tertiary-container)', 'var(--on-tertiary-container)')}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={s.statNum}>99.9%</div>
          <div style={s.statLabel}>failure rate</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', maxWidth: '480px' }}>
        {chapters.map((ch) => (
          <div key={ch.number}>
            <div style={s.chapterHeader}>Chapter {ch.number}: {ch.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ch.levels.map((level) => {
                const mods = getModifiersInGrid(level.grid)
                return (
                  <button
                    key={level.index}
                    onClick={() => onSelectLevel(level.index)}
                    style={s.levelBtn}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'
                      e.currentTarget.style.boxShadow = '0px 16px 40px rgba(45, 51, 74, 0.12)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-gummy)'
                    }}
                  >
                    <span style={s.levelNum}>{level.index + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.levelName}>{level.name}</div>
                      <div style={s.levelDesc}>{level.description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '3px', fontSize: '13px', flexShrink: 0 }}>
                      {mods.slice(0, 4).map((m) => (
                        <span key={m}>{MODIFIER_TAGS[m] || '?'}</span>
                      ))}
                      {mods.length > 4 && (
                        <span style={{ color: 'var(--on-surface-variant)', fontSize: '10px', fontWeight: 600 }}>+{mods.length - 4}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <p style={s.footer}>made with love and a concerning amount of spite.</p>
    </div>
  )
}

export { ALL_LEVELS }
export default LevelSelect
