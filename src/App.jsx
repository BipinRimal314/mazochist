import { useState, useEffect } from 'react'
import LevelSelect from './components/LevelSelect'
import MazeBuilder from './components/MazeBuilder'
import MazeSolver from './components/MazeSolver'
import { loadAllLevels } from './engine/levelLoader'

function App() {
  const [mode, setMode] = useState('levels')
  const [currentLevel, setCurrentLevel] = useState(null)
  const [allLevels, setAllLevels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      setMode('shared')
      setLoading(false)
      return
    }

    loadAllLevels().then((levels) => {
      setAllLevels(levels)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (mode === 'playing' || mode === 'shared') {
      document.body.classList.add('playing')
    } else {
      document.body.classList.remove('playing')
    }
  }, [mode])

  const handleSelectLevel = (index) => {
    setCurrentLevel(index)
    setMode('playing')
  }

  const handleNextLevel = () => {
    if (currentLevel != null && currentLevel < allLevels.length - 1) {
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

  const level = currentLevel != null ? allLevels[currentLevel] : null

  return (
    <div style={{ width: '100vw', minHeight: '100vh' }}>
      {mode === 'levels' && (
        <LevelSelect
          onSelectLevel={handleSelectLevel}
          onBuild={() => setMode('build')}
          allLevels={allLevels}
          loading={loading}
        />
      )}
      {mode === 'build' && <MazeBuilder />}
      {mode === 'shared' && <MazeSolver />}
      {mode === 'playing' && level && (
        <MazeSolver
          key={currentLevel}
          levelGrid={level.grid}
          levelNumber={currentLevel}
          levelName={level.name}
          levelEra={level.era}
          levelFogRadius={level.fogRadius}
          levelDeathMode={level.deathMode}
          onBack={handleBack}
          onNextLevel={currentLevel < allLevels.length - 1 ? handleNextLevel : null}
        />
      )}
    </div>
  )
}

export default App
