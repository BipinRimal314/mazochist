import { useState, useEffect } from 'react'

function App() {
  const [mode, setMode] = useState('build')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setMode('suffer')
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'monospace' }}>
      {mode === 'build' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <h1>Mazochist — Build Mode</h1>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <h1>Mazochist — Suffer Mode</h1>
        </div>
      )}
    </div>
  )
}

export default App
