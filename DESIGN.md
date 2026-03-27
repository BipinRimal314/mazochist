# Mazochist — The Maze That Fights Back

## What is it

A browser app where you build absurd, hostile mazes and share them with people to suffer through. Two modes: Build and Suffer. No backend. Maze data lives in the URL.

## Build mode

Grid-based maze editor. You place:
- **Walls** — normal walls, click to toggle
- **Start and End** — drag to place
- **Hidden word/image** — the solution path traces out a word or shape (revealed on completion)

Then you add **modifiers** to cells or zones:
- **Gravity well** — pulls the ball toward a point
- **Reverse zone** — controls flip (up=down, left=right)
- **Spinner** — rotates that section of the maze 90 degrees on a timer
- **Blackout** — maze goes dark, tiny spotlight around the ball
- **Fake exit** — "You Win!" screen, then teleports back to start
- **Slide walls** — walls that move on a timer
- **Fat cursor** — ball becomes 3x bigger in this zone
- **Fart tile** — plays a sound, reverses controls for 2 seconds
- **Teleporter pair** — step on one, appear at the other
- **Ice** — ball slides and doesn't stop until it hits a wall

When done, click Share. Maze state serializes to a URL hash. Copy link, send to victim.

## Suffer mode

Open a shared link. Ball at start. Get to the end. That's it.
- Timer counts up
- Death counter increments on every fail state (hitting a trap, falling into gravity well, etc.)
- Modifiers activate as you enter zones
- When you finish: hidden word/image revealed, stats shown (time, deaths, path taken vs solution path)
- Rage quit button that shows a sympathy message and your death count
- Share your attempt (time + deaths encoded in URL)

## The absurd modifiers (full list for v1)

| Modifier | What it does | Icon |
|----------|-------------|------|
| Gravity well | Pulls ball toward center of zone | Spiral |
| Reverse | Flip controls | Arrows crossed |
| Spinner | Rotates section 90deg every 3s | Rotating arrow |
| Blackout | Dark except spotlight around ball | Moon |
| Fake exit | Fake win screen, teleport to start | Trophy |
| Slide wall | Wall moves back and forth | Double arrow |
| Fat cursor | Ball 3x size | Circle big |
| Fart tile | Sound + 2s reverse | Cloud |
| Teleporter | Paired portals | Two dots |
| Ice | No friction, slide until wall | Snowflake |

## Tech

- React 19 + Vite
- Canvas for maze rendering and ball physics
- No backend — URL hash encoding for maze data (base64 compressed JSON)
- Sound effects: Web Audio API (procedural, no assets needed)
- Touch support (drag on mobile to solve, but build mode is desktop-first)

## Architecture

```
src/
  App.jsx              — Route between Build/Suffer based on URL hash
  components/
    MazeBuilder.jsx    — Grid editor, modifier palette, share button
    MazeSolver.jsx     — Ball physics, modifier effects, timer, death counter
    ModifierPalette.jsx — Draggable modifier icons
    VictoryScreen.jsx  — Stats, hidden word reveal, share attempt
    RageQuit.jsx       — Sympathy message
  engine/
    maze.js            — Grid data structure, serialization/deserialization
    physics.js         — Ball movement, collision, modifier effects
    modifiers.js       — Each modifier as a function (apply effect, render overlay)
    sound.js           — Procedural sound effects (fart, victory, fail, teleport)
  utils/
    serialize.js       — Compress maze to URL hash, decompress back
```

## What success looks like

Someone opens the link, laughs within 5 seconds, dies 47 times, sees "BIPIN" traced by the solution path, screenshots their death count, and sends it to their friend.
