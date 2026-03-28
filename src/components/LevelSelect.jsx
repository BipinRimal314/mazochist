import { useState, useEffect } from 'react'
import { loadAllLevels } from '../engine/levelLoader'

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

function getObstacleCount(grid) {
  let traps = 0, gates = 0, fakes = 0
  for (const cell of grid.cells) {
    if (cell.trap) traps++
    if (cell.gate) gates++
    if (cell.modifier === 'fakeExit') fakes++
  }
  return { traps, gates, fakes }
}

function LevelSelect({ onSelectLevel, onBuild, allLevels, loading }) {
  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', fontFamily: 'var(--font-headline)',
      }}>
        <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px' }}>
          mazochist
        </div>
        <div style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}>
          loading suffering...
        </div>
      </div>
    )
  }

  const chapters = []
  let currentChapter = null
  for (let i = 0; i < allLevels.length; i++) {
    const level = allLevels[i]
    const cn = level.chapterNumber
    if (cn !== currentChapter) {
      chapters.push({ number: cn, name: level.chapter, levels: [] })
      currentChapter = cn
    }
    chapters[chapters.length - 1].levels.push({ ...level, index: i })
  }

  const chapterDescriptions = {
    1: '5 levels. learn the controls. enjoy it while it lasts.',
    2: '12 mazes bred by genetic algorithm over 25,000 simulated playthroughs. sorted by cruelty.',
    3: '20 mazes where an RL agent learned to place traps for maximum suffering. it watched 10,000 simulated players die.',
    4: '15 mazes dreamed by a neural network and armed by an RL agent. topology invented, not designed. 67% of simulated players couldn\'t finish these.',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', padding: '0 20px 80px',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ textAlign: 'center', padding: '60px 0 40px', maxWidth: '480px' }}>
        <h1 style={{
          fontFamily: 'var(--font-headline)', fontWeight: 800,
          fontSize: 'clamp(48px, 12vw, 80px)', color: 'var(--primary)',
          letterSpacing: '-2px', lineHeight: 1, textTransform: 'lowercase',
        }}>
          mazochist
        </h1>
        <p style={{
          fontFamily: 'var(--font-headline)', fontWeight: 600,
          fontSize: '16px', color: 'var(--on-surface-variant)', opacity: 0.8,
          marginTop: '12px',
        }}>
          {allLevels.length} levels. 3 chapters. each one worse than the last.
        </p>
        <button
          onClick={onBuild}
          style={{
            marginTop: '24px', display: 'inline-block',
            background: 'linear-gradient(180deg, var(--primary-container) 0%, var(--primary) 100%)',
            color: '#fff', fontFamily: 'var(--font-headline)', fontWeight: 700,
            fontSize: '18px', padding: '16px 40px', borderRadius: '9999px',
            border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-gummy)',
            transition: 'transform 0.3s var(--bounce)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          BUILD A MAZE
        </button>
        <span style={{
          display: 'block', marginTop: '8px',
          fontFamily: 'var(--font-body)', fontSize: '12px',
          color: 'var(--primary)', opacity: 0.5, fontStyle: 'italic',
        }}>
          no account needed. just cruelty.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '480px' }}>
        {chapters.map((ch) => {
          const desc = chapterDescriptions[ch.number] || ''
          return (
            <div key={ch.number}>
              <div style={{
                fontFamily: 'var(--font-headline)', fontSize: '11px', fontWeight: 700,
                color: 'var(--primary)', letterSpacing: '1.5px', textTransform: 'uppercase',
                padding: '0 4px 6px',
              }}>
                Chapter {ch.number}: {ch.name}
              </div>
              {desc && (
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: '11px', fontStyle: 'italic',
                  color: 'var(--on-surface-variant)', opacity: 0.7,
                  padding: '0 4px 10px',
                }}>
                  {desc}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ch.levels.map((level) => {
                  const mods = getModifiersInGrid(level.grid)
                  const obs = getObstacleCount(level.grid)
                  const tags = []
                  if (obs.traps > 0) tags.push(`${obs.traps} traps`)
                  if (obs.gates > 0) tags.push(`${obs.gates} gates`)
                  if (obs.fakes > 0) tags.push(`${obs.fakes} fakes`)
                  if (level.fogRadius) tags.push('fog')

                  return (
                    <button
                      key={level.index}
                      onClick={() => onSelectLevel(level.index)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '12px 16px', background: 'var(--surface-container-lowest)',
                        border: 'none', borderRadius: 'var(--radius)',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        boxShadow: 'var(--shadow-gummy)',
                        transition: 'all 0.4s var(--bounce)',
                        fontFamily: 'var(--font-body)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'
                        e.currentTarget.style.boxShadow = '0px 16px 40px rgba(45, 51, 74, 0.12)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)'
                        e.currentTarget.style.boxShadow = 'var(--shadow-gummy)'
                      }}
                    >
                      <span style={{
                        fontFamily: 'var(--font-headline)', color: 'var(--primary)',
                        fontSize: '16px', fontWeight: 800, width: '28px', textAlign: 'right',
                      }}>
                        {level.index + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          color: 'var(--on-surface)', fontSize: '14px',
                          fontFamily: 'var(--font-headline)', fontWeight: 700,
                        }}>
                          {level.name}
                        </div>
                        <div style={{
                          color: 'var(--on-surface-variant)', fontSize: '10px',
                          marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {level.grid.cols}x{level.grid.rows}
                          {tags.length > 0 && ` · ${tags.join(' · ')}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '3px', fontSize: '13px', flexShrink: 0 }}>
                        {mods.slice(0, 4).map((m) => (
                          <span key={m}>{MODIFIER_TAGS[m] || '?'}</span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p style={{
        marginTop: '32px', textAlign: 'center',
        fontFamily: 'var(--font-body)', fontSize: '10px',
        color: 'var(--primary)', opacity: 0.5, fontStyle: 'italic',
      }}>
        made with love and a concerning amount of spite.
      </p>
    </div>
  )
}

export default LevelSelect
