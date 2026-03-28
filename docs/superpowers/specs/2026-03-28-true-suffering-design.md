# True Suffering — Mazochist Difficulty Overhaul

## Goal

Transform Mazochist from a casual maze navigator into a genuinely punishing puzzle game where every level is solvable but demands thinking, memorization, precision, and composure under pressure. Difficulty scales incrementally from "hard but fair" to "sadistic."

## Architecture

Three eras across 10 chapters (100 levels). Each era introduces mechanics that compound with previous ones. The game teaches you a mechanic, then uses it against you.

## Difficulty Curve

| Era | Chapters | Levels | Grid Size | Fog | Death Cost | Target Deaths |
|-----|----------|--------|-----------|-----|------------|---------------|
| Learning | 1-3 | 1-30 | 8-12 | None | Progress reset | 10-20 |
| Punishing | 4-6 | 31-60 | 12-16 | 4-cell radius | Full reset | 30-50 |
| Sadistic | 7-10 | 61-100 | 16-20 | 2.5-cell radius | Cumulative + time decay | 100+ |

## New Mechanics

### 1. Fog of War

Player can only see cells within a radius of the ball. Everything outside renders as solid dark (#322f23). Edge cells fade at 50% opacity. Visited cells leave a faint "memory trail" at 15% opacity showing where you've been but not what's currently there.

- Learning era (1-30): No fog. Full visibility.
- Punishing era (31-60): 4-cell radius.
- Sadistic era (61-100): 2.5-cell radius. Shrinks further with cumulative punishment.

Implementation: `drawMaze` receives a `fogRadius` and `ballPosition` parameter. Cells outside radius get a dark overlay drawn on top. The fog is a post-processing pass after the maze and ball are drawn.

### 2. Trap Tiles

Invisible cells that teleport the ball back to start on contact. They look identical to normal floor. The only way to learn their locations is to die on them, then memorize and avoid.

- Not present in Learning era (1-30).
- Punishing era (31-60): 2-4 per level.
- Sadistic era (61-100): 5-10 per level.

Placement rules:
- Never on the solution path.
- Always on the most tempting wrong paths (near solution, pointing toward exit).
- Never within 2 cells of start or end.
- At the end of long dead ends (maximum frustration after a long walk).

Rendering:
- Completely invisible until triggered.
- On death from trap: tile flashes red (#f74b6d) for 0.5 seconds before reset. Player sees WHERE they died.
- After reset, trap locations are NOT persistently revealed. Player must remember.

Implementation: New cell property `trap: true`. `checkModifierTrigger` checks for trap. On trigger, play death sound, flash position, reset ball, increment deaths.

### 3. One-Way Gates

Passages that can only be entered from one direction. After passing through, a wall appears behind the ball. No backtracking. Forces commitment and forward planning.

- Not present in Learning era (1-30).
- Introduced chapter 4. 1-2 per level initially.
- Sadistic era: 3-5 per level, placed at critical junctions.

Placement rules:
- Always on the solution path (forces player through them).
- Direction follows the solution path direction at that cell.
- Never creates an unsolvable state (validated by BFS after placement).

Rendering:
- Small arrow (triangle) showing passable direction, rendered in teal (#0d656e) at 50% opacity.
- After passing: wall animates closed (instant in logic, 0.3s visual fade).
- Closed gate renders as a normal wall.

Implementation: New cell property `gate: { direction: 'right'|'left'|'up'|'down', open: true }`. Physics checks gate direction on entry. On pass-through, gate.open set to false, corresponding wall set to true. State tracked per-attempt.

### 4. Imperfect Maze Generation

Current recursive backtracker creates "perfect" mazes with exactly one path between any two cells. This makes navigation trivial — every dead end is obvious within one cell.

New algorithm:
1. Generate base maze with recursive backtracker (guarantees solvability).
2. Find solution path via BFS.
3. Add loops: randomly remove 5-15% of interior walls to create alternate routes.
4. Extend dead ends: tunnel existing dead ends deeper (3-15 cells depending on era).
5. Validate: BFS confirms solution still exists.

Dead end seduction — dead ends are designed to be convincing:
- Point toward the exit initially (player thinks they're going the right way).
- Run parallel to the solution path (tantalizingly close but wrong).
- Contain modifiers (player assumes "they wouldn't put a teleporter on a dead end").

Solution path complexity requirements:
- At least 2 direction reversals (must go away from exit to reach exit).
- Pass through at least 1 one-way gate in Punishing+ eras.
- Cross at least 1 modifier zone in Punishing+ eras.

Era scaling:
- Learning (1-30): Short dead ends (3-5 cells), 5% wall removal for loops.
- Punishing (31-60): Medium dead ends (8-12 cells), 10% wall removal, traps at dead end termini.
- Sadistic (61-100): Dead ends longer than the solution path, 15% wall removal, traps and fake exits at termini.

### 5. Progressive Death Punishment

Death consequences escalate with era AND with death count within a level.

**Learning era (levels 1-30):**
- Progress reset only. Ball returns to start. Collected fake exits preserved. No additional penalty.

**Punishing era (levels 31-60):**
- Full reset. Ball returns to start. All collected fake exits reset. One-way gates reopen. Every attempt starts clean.

**Sadistic era (levels 61-100):**
- Deaths 1-3: Full reset (same as Punishing).
- Deaths 4-6: Full reset + fog radius shrinks by 0.5 cells per death beyond 3. (Starting at 2.5, drops to 2.0, 1.5, 1.0.)
- Deaths 7-9: Above + 2 new random trap tiles spawn per death beyond 6. Placed off-solution-path.
- Deaths 10+: Above + time decay activates. Darkness spreads from the start cell at 1 cell per 10 seconds, consuming the maze. Corrupted cells become impassable walls. The maze literally shrinks behind you. You're racing the void.

Implementation: `deathPenalty` object in game state tracks current death count and active punishments. Each frame checks if time decay is active and expands corruption. Fog radius computed from base radius minus penalty.

### 6. Time Decay (Sadistic Era, 10+ Deaths)

A "corruption" spreads from the start position. Corrupted cells are impassable (treated as walls in collision). The spreading is a BFS from start that advances 1 cell every 10 seconds.

Rendering:
- Corrupted cells render with a dark purple pulsing overlay (#322f23 at 90% opacity with a subtle animation).
- The corruption edge has a gradient fade.
- Corruption is visible even through fog (you can see the darkness growing behind you).

Trigger: Only activates at 10+ deaths in Sadistic era levels. Resets with each new attempt but re-activates immediately if death count >= 10.

## Rendering Changes

### Fog of War Pass
Applied as a post-processing step after `drawMaze` and `drawBall`:
1. For each cell, compute distance from ball center to cell center.
2. If distance > fogRadius + 0.5: draw solid dark rectangle over cell.
3. If distance > fogRadius - 0.5 and <= fogRadius + 0.5: draw dark rectangle at interpolated opacity (fade edge).
4. If cell was previously visited (ball center was in this cell at any point): draw at 15% opacity instead of 100% (memory trail).

### Trap Tile Flash
On trap trigger:
1. Store `trapFlashPosition` and `trapFlashUntil = Date.now() + 500` in state.
2. Render pass: if flash active, draw red (#f74b6d) rounded rectangle at flash position.
3. Flash renders ABOVE fog (player must see where they died even in fog).

### One-Way Gate Arrows
Rendered during modifier pass in `drawMaze`:
- Open gate: small triangle arrow in passable direction, teal at 50% opacity.
- Closed gate: no special rendering (looks like a normal wall).

### Time Decay Overlay
Rendered as a separate pass after fog:
- Corrupted cells: dark purple (#322f23) at 90% opacity.
- Edge cells: pulsing opacity between 60-90% using `sin(now / 500)`.
- Renders above fog so corruption is always visible.

## File Changes

### Modified Files
- `src/engine/generator.js` — New imperfect maze algorithm, loop addition, dead end extension, trap/gate placement, era-based difficulty parameters.
- `src/engine/physics.js` — One-way gate collision logic, trap tile detection.
- `src/engine/renderer.js` — Fog of war pass, trap flash, gate arrows, time decay overlay.
- `src/engine/modifiers.js` — Trap tile effect (reset + flash), gate pass-through effect.
- `src/components/MazeSolver.jsx` — Death punishment state management, fog radius tracking, corruption timer, visited cells tracking, gate state per attempt.

### New State in MazeSolver
```
{
  // existing...
  fogRadius: number | null,        // null = no fog, number = cell radius
  visitedCells: Set<string>,        // "x,y" keys of cells ball has entered
  trapFlashPos: {x, y} | null,     // position of last trap death
  trapFlashUntil: number,           // timestamp when flash ends
  gateStates: Map<string, boolean>, // "x,y" -> open/closed per attempt
  corruptedCells: Set<string>,      // cells consumed by time decay
  corruptionFrontier: [{x,y}],      // BFS frontier for spreading
  lastCorruptionTick: number,       // timestamp of last spread
  deathsThisLevel: number,          // cumulative for punishment calc
  eraType: 'learning'|'punishing'|'sadistic',
}
```

## Validation

Every generated level MUST pass these checks:
1. BFS finds a path from start to end avoiding traps and respecting one-way gate directions.
2. Solution path does not pass through any trap tile.
3. One-way gates on solution path face the correct direction.
4. Solution path length is at least 2x the Manhattan distance from start to end (no trivially short solutions).
5. At least one dead end is longer than 3 cells (ensures exploration).

## What Success Looks Like

- Level 1: A new player figures it out in 2-3 minutes with 5-10 deaths. They understand walls and modifiers.
- Level 30: A practiced player takes 5-8 minutes, dies 15-20 times. They've mastered modifiers but the maze requires thinking.
- Level 60: A determined player takes 15-20 minutes, dies 40-50 times. Fog makes them memorize. Traps punish exploration. One-way gates force commitment. Full reset means every attempt must be near-perfect.
- Level 100: A masochist takes 30+ minutes, dies 100+ times. The fog is suffocating. Traps multiply with each death. The maze is eating itself behind them. They can barely see. They know the solution but executing it with shrunken fog, extra traps, and corruption chasing them is a nightmare. Completing it is a genuine achievement.
