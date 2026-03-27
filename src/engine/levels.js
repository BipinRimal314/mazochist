import { createGrid, toggleWallBetween, setModifier, setStart, setEnd, setHiddenWord } from './maze'

function buildLevel(size, startPos, endPos, walls, modifiers, word) {
  let grid = createGrid(size, size)
  grid = setStart(grid, startPos[0], startPos[1])
  grid = setEnd(grid, endPos[0], endPos[1])
  if (word) grid = setHiddenWord(grid, word)

  for (const [x1, y1, x2, y2] of walls) {
    grid = toggleWallBetween(grid, x1, y1, x2, y2)
  }

  for (const [x, y, mod] of modifiers) {
    grid = setModifier(grid, x, y, mod)
  }

  return grid
}

const LEVELS = [
  // Level 1: Baby steps
  {
    name: 'Baby Steps',
    description: 'Just walls. You got this.',
    grid: buildLevel(8, [0, 0], [7, 7], [
      [0, 0, 1, 0], [1, 0, 2, 0], [2, 0, 2, 1],
      [0, 1, 0, 2], [1, 1, 1, 2], [3, 0, 3, 1],
      [4, 1, 4, 2], [5, 1, 5, 2], [5, 2, 6, 2],
      [2, 3, 3, 3], [3, 3, 3, 4], [1, 4, 2, 4],
      [5, 3, 5, 4], [6, 4, 7, 4], [6, 4, 6, 5],
      [3, 5, 4, 5], [4, 5, 4, 6], [1, 6, 1, 7],
      [2, 6, 3, 6], [5, 6, 5, 7], [6, 6, 7, 6],
    ], [], 'HELLO'),
  },

  // Level 2: Corridors
  {
    name: 'The Corridor',
    description: 'Longer path. Still just walls.',
    grid: buildLevel(10, [0, 0], [9, 9], [
      [1, 0, 1, 1], [1, 1, 1, 2], [1, 2, 1, 3],
      [0, 3, 1, 3], [2, 1, 3, 1], [3, 1, 3, 2],
      [3, 2, 3, 3], [3, 3, 4, 3], [5, 0, 5, 1],
      [5, 1, 5, 2], [5, 2, 6, 2], [7, 0, 7, 1],
      [7, 1, 7, 2], [7, 2, 7, 3], [8, 3, 8, 4],
      [6, 4, 7, 4], [5, 4, 5, 5], [4, 5, 4, 6],
      [3, 5, 3, 6], [2, 5, 2, 6], [2, 6, 2, 7],
      [1, 7, 1, 8], [3, 7, 3, 8], [4, 7, 5, 7],
      [6, 6, 6, 7], [7, 6, 7, 7], [8, 6, 8, 7],
      [5, 8, 5, 9], [6, 8, 7, 8], [8, 8, 8, 9],
    ], [], 'NICE'),
  },

  // Level 3: Slippery
  {
    name: 'Black Ice',
    description: 'Ice tiles. No brakes.',
    grid: buildLevel(8, [0, 0], [7, 7], [
      [1, 0, 1, 1], [0, 2, 1, 2], [2, 1, 2, 2],
      [3, 0, 3, 1], [4, 2, 4, 3], [5, 1, 6, 1],
      [6, 2, 7, 2], [3, 3, 3, 4], [1, 4, 2, 4],
      [5, 4, 5, 5], [6, 5, 7, 5], [2, 5, 2, 6],
      [4, 6, 4, 7], [6, 6, 6, 7],
    ], [
      [2, 0, 'ice'], [3, 2, 'ice'], [5, 2, 'ice'],
      [1, 3, 'ice'], [4, 4, 'ice'], [6, 3, 'ice'],
      [3, 6, 'ice'], [5, 7, 'ice'],
    ], 'WHEEE'),
  },

  // Level 4: Wrong way
  {
    name: 'Backwards Day',
    description: 'Reverse zones flip your controls.',
    grid: buildLevel(8, [0, 0], [7, 7], [
      [1, 0, 1, 1], [0, 2, 0, 3], [2, 1, 3, 1],
      [3, 2, 3, 3], [5, 0, 5, 1], [5, 2, 6, 2],
      [4, 3, 4, 4], [2, 4, 3, 4], [6, 4, 6, 5],
      [1, 5, 1, 6], [3, 6, 4, 6], [5, 5, 5, 6],
      [7, 5, 7, 6], [6, 7, 7, 7],
    ], [
      [2, 2, 'reverse'], [4, 1, 'reverse'], [6, 3, 'reverse'],
      [1, 4, 'reverse'], [5, 6, 'reverse'],
    ], 'OOPS'),
  },

  // Level 5: Portal maze
  {
    name: 'Portal Thinking',
    description: 'Teleporters. Think with portals.',
    grid: buildLevel(10, [0, 0], [9, 9], [
      [2, 0, 2, 1], [2, 1, 2, 2], [0, 3, 1, 3],
      [1, 3, 1, 4], [3, 2, 3, 3], [4, 1, 4, 2],
      [5, 0, 5, 1], [6, 2, 7, 2], [7, 2, 7, 3],
      [8, 1, 8, 2], [4, 4, 5, 4], [5, 4, 5, 5],
      [3, 5, 3, 6], [2, 6, 2, 7], [6, 5, 6, 6],
      [7, 5, 7, 6], [8, 6, 8, 7], [4, 7, 5, 7],
      [1, 7, 1, 8], [6, 8, 7, 8], [8, 8, 8, 9],
      [3, 8, 3, 9],
    ], [
      [1, 1, 'teleporter'], [8, 5, 'teleporter'],
      [6, 1, 'teleporter'], [2, 8, 'teleporter'],
      [4, 3, 'teleporter'], [7, 8, 'teleporter'],
    ], 'WARP'),
  },

  // Level 6: Lights out
  {
    name: 'Lights Out',
    description: 'Blackout zones. Trust your memory.',
    grid: buildLevel(8, [0, 0], [7, 7], [
      [1, 0, 1, 1], [0, 2, 1, 2], [2, 1, 2, 2],
      [3, 0, 4, 0], [4, 1, 4, 2], [5, 2, 6, 2],
      [6, 0, 6, 1], [3, 3, 3, 4], [1, 3, 1, 4],
      [5, 4, 6, 4], [7, 3, 7, 4], [2, 5, 3, 5],
      [4, 5, 4, 6], [6, 5, 6, 6], [1, 6, 1, 7],
      [3, 7, 4, 7], [5, 6, 5, 7],
    ], [
      [2, 2, 'blackout'], [3, 2, 'blackout'], [4, 3, 'blackout'],
      [5, 3, 'blackout'], [2, 5, 'blackout'], [3, 5, 'blackout'],
      [4, 6, 'blackout'], [5, 6, 'blackout'], [6, 6, 'blackout'],
    ], 'BLIND'),
  },

  // Level 7: Gas chamber
  {
    name: 'The Gas Chamber',
    description: 'Fart tiles. Your controls will betray you.',
    grid: buildLevel(10, [0, 0], [9, 9], [
      [1, 0, 1, 1], [0, 2, 1, 2], [2, 1, 3, 1],
      [3, 2, 3, 3], [4, 0, 4, 1], [5, 2, 5, 3],
      [6, 1, 7, 1], [8, 0, 8, 1], [7, 3, 7, 4],
      [4, 4, 5, 4], [2, 4, 2, 5], [1, 5, 1, 6],
      [3, 6, 4, 6], [5, 5, 5, 6], [6, 6, 7, 6],
      [8, 5, 8, 6], [9, 6, 9, 7], [3, 7, 3, 8],
      [5, 8, 6, 8], [7, 7, 7, 8], [1, 8, 1, 9],
    ], [
      [2, 0, 'fart'], [5, 1, 'fart'], [8, 2, 'fart'],
      [3, 4, 'fart'], [6, 4, 'fart'], [1, 7, 'fart'],
      [4, 7, 'fart'], [8, 8, 'fart'],
    ], 'GROSS'),
  },

  // Level 8: The spinner
  {
    name: 'Spin Cycle',
    description: 'Walls rotate. Timing is everything.',
    grid: buildLevel(10, [0, 0], [9, 9], [
      [1, 0, 1, 1], [2, 1, 2, 2], [0, 3, 1, 3],
      [3, 0, 3, 1], [4, 2, 5, 2], [6, 1, 6, 2],
      [7, 0, 7, 1], [8, 2, 9, 2], [3, 3, 3, 4],
      [5, 3, 5, 4], [7, 3, 8, 3], [1, 5, 2, 5],
      [4, 5, 4, 6], [6, 5, 6, 6], [8, 5, 8, 6],
      [2, 7, 3, 7], [5, 7, 5, 8], [7, 7, 7, 8],
      [1, 8, 1, 9], [3, 8, 4, 8], [8, 8, 9, 8],
    ], [
      [2, 3, 'spinner'], [4, 1, 'spinner'], [8, 1, 'spinner'],
      [1, 4, 'spinner'], [6, 4, 'spinner'], [3, 6, 'spinner'],
      [7, 6, 'spinner'], [5, 8, 'spinner'],
    ], 'DIZZY'),
  },

  // Level 9: Fake it
  {
    name: 'Trust Issues',
    description: 'Not every exit is real.',
    grid: buildLevel(10, [0, 0], [9, 9], [
      [1, 0, 1, 1], [2, 1, 2, 2], [3, 0, 4, 0],
      [4, 1, 4, 2], [6, 0, 6, 1], [7, 1, 8, 1],
      [0, 3, 1, 3], [2, 3, 2, 4], [4, 3, 5, 3],
      [6, 3, 6, 4], [8, 3, 8, 4], [1, 5, 1, 6],
      [3, 5, 4, 5], [5, 5, 5, 6], [7, 5, 7, 6],
      [9, 5, 9, 6], [2, 7, 3, 7], [4, 7, 4, 8],
      [6, 7, 7, 7], [8, 7, 8, 8], [3, 9, 4, 9],
      [6, 8, 6, 9],
    ], [
      [3, 2, 'fakeExit'], [7, 2, 'fakeExit'], [5, 5, 'fakeExit'],
      [2, 7, 'fakeExit'], [8, 6, 'fakeExit'],
      [4, 4, 'ice'], [6, 6, 'reverse'], [1, 8, 'fart'],
    ], 'LIAR'),
  },

  // Level 10: Everything
  {
    name: 'The Gauntlet',
    description: 'Everything. Good luck.',
    grid: buildLevel(12, [0, 0], [11, 11], [
      [1, 0, 1, 1], [2, 0, 2, 1], [3, 1, 3, 2],
      [0, 2, 0, 3], [4, 0, 4, 1], [5, 1, 6, 1],
      [7, 0, 7, 1], [8, 1, 8, 2], [9, 0, 10, 0],
      [10, 1, 11, 1], [2, 2, 2, 3], [4, 2, 4, 3],
      [6, 2, 6, 3], [9, 2, 9, 3], [11, 2, 11, 3],
      [1, 3, 1, 4], [3, 4, 4, 4], [5, 3, 5, 4],
      [7, 4, 8, 4], [10, 3, 10, 4], [0, 5, 1, 5],
      [2, 5, 2, 6], [4, 5, 4, 6], [6, 5, 7, 5],
      [8, 5, 8, 6], [10, 5, 10, 6], [1, 7, 2, 7],
      [3, 6, 3, 7], [5, 7, 6, 7], [7, 6, 7, 7],
      [9, 7, 10, 7], [11, 6, 11, 7], [0, 8, 0, 9],
      [2, 8, 3, 8], [4, 8, 4, 9], [6, 8, 6, 9],
      [8, 8, 9, 8], [10, 8, 10, 9], [1, 9, 1, 10],
      [3, 10, 4, 10], [5, 9, 5, 10], [7, 10, 8, 10],
      [9, 9, 9, 10], [11, 10, 11, 11],
    ], [
      [3, 0, 'ice'], [6, 0, 'ice'], [10, 0, 'ice'],
      [1, 2, 'reverse'], [5, 2, 'reverse'],
      [8, 3, 'blackout'], [9, 3, 'blackout'],
      [0, 4, 'fart'], [6, 4, 'fart'],
      [3, 5, 'spinner'], [9, 5, 'spinner'],
      [1, 6, 'teleporter'], [10, 9, 'teleporter'],
      [5, 6, 'teleporter'], [8, 10, 'teleporter'],
      [7, 8, 'fakeExit'], [2, 9, 'fakeExit'],
      [4, 10, 'gravity'], [9, 11, 'fatCursor'],
      [6, 10, 'ice'], [3, 11, 'fart'],
      [8, 11, 'slideWall'],
    ], 'MAZOCHIST'),
  },
]

export { LEVELS }
