import { LEVELS } from '../engine/levels'

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

function getModifiersInLevel(level) {
  const mods = new Set()
  for (const cell of level.grid.cells) {
    if (cell.modifier) mods.add(cell.modifier)
  }
  return [...mods]
}

function LevelSelect({ onSelectLevel, onBuild }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px 20px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '32px', letterSpacing: '3px' }}>MAZOCHIST</h1>
      <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', maxWidth: '400px' }}>
        10 levels. Each one introduces something worse.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '500px' }}>
        {LEVELS.map((level, i) => {
          const mods = getModifiersInLevel(level)
          return (
            <button
              key={i}
              onClick={() => onSelectLevel(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', background: '#111', border: '1px solid #222',
                borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#ffcc00'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#222'}
            >
              <span style={{ color: '#ffcc00', fontSize: '20px', fontFamily: 'monospace', width: '32px', textAlign: 'center' }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: '15px', fontFamily: 'monospace' }}>
                  {level.name}
                </div>
                <div style={{ color: '#555', fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>
                  {level.description}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', fontSize: '16px' }}>
                {mods.map((m) => (
                  <span key={m} title={m}>{MODIFIER_TAGS[m] || '?'}</span>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
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

export default LevelSelect
