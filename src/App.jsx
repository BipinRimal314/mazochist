import { useState, useEffect } from 'react'
import MazeBuilder from './components/MazeBuilder'
import MazeSolver from './components/MazeSolver'

function App() {
  const [mode, setMode] = useState('build')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setMode('suffer')
  }, [])

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'monospace' }}>
      {mode === 'build' ? <MazeBuilder /> : <MazeSolver />}
    </div>
  )
}

export default App
