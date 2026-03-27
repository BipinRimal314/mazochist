import { useState, useEffect } from 'react'
import LevelSelect, { ALL_LEVELS } from './components/LevelSelect'
import MazeBuilder from './components/MazeBuilder'
import MazeSolver from './components/MazeSolver'

function App() {
  const [mode, setMode] = useState('levels')
  const [currentLevel, setCurrentLevel] = useState(null)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setMode('shared')
  }, [])

  const handleSelectLevel = (index) => {
    setCurrentLevel(index)
    setMode('playing')
  }

  const handleNextLevel = () => {
    if (currentLevel != null && currentLevel < ALL_LEVELS.length - 1) {
      const next = currentLevel + 1
      setCurrentLevel(next)
      setMode('levels')
      setTimeout(() => setMode('playing'), 0)
    } else {
      setMode('levels')
    }
  }

  const handleBack = () => {
    setCurrentLevel(null)
    setMode('levels')
  }

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'monospace' }}>
      {mode === 'levels' && (
        <LevelSelect
          onSelectLevel={handleSelectLevel}
          onBuild={() => setMode('build')}
        />
      )}
      {mode === 'build' && <MazeBuilder />}
      {mode === 'shared' && <MazeSolver />}
      {mode === 'playing' && currentLevel != null && (
        <MazeSolver
          key={currentLevel}
          levelGrid={ALL_LEVELS[currentLevel].grid}
          levelNumber={currentLevel}
          onBack={handleBack}
          onNextLevel={currentLevel < ALL_LEVELS.length - 1 ? handleNextLevel : null}
        />
      )}
    </div>
  )
}

export default App
