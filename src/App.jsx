import { useState, useEffect } from 'react'
import MazeBuilder from './components/MazeBuilder'

function App() {
  const [mode, setMode] = useState('build')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setMode('suffer')
  }, [])

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'monospace' }}>
      {mode === 'build' ? (
        <MazeBuilder />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <h1>Loading maze...</h1>
        </div>
      )}
    </div>
  )
}

export default App
