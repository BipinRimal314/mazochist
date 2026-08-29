# Handoff

Where *Journey to Maizy* is, what is decided, and what is not. Read this and
`README.md` and you have the whole picture.

Last updated after the neurotypical-player pass (see *Phase 6* below).

---

## What it is

A farmer follows a trail of dropped corn to the daughter who dropped it. You
steer a small yellow shape through mazes you mostly cannot see, gathering maize,
avoiding invisible traps, and — later — outrunning something. The yellow shape
turns out to be his hat.

Twenty-six levels in eleven chapters, plus a second act that races one field
from each. Every level is **generated from a seed and proven beatable by a
simulated player before it ships**; no maze geometry is hand-authored anywhere
in the repo.

## Where it is running

| | |
|---|---|
| Web | <https://maizes-bipin314.vercel.app> — **stale, predates the cut to 26** |
| Repo | <https://github.com/BipinRimal314/maizes> |
| Desktop | builds locally on macOS (4.3 MB, Tauri). Windows and Linux **never built** |
| Telemetry | written, tested, **switched off** — no Supabase project exists |

```bash
npm run dev              # web, localhost:5173 — add ?dev to unlock everything
npm run levels           # regenerate the campaign
npm test                 # 401 tests: engine properties + every level re-judged
npm run desktop          # Tauri dev
npm run desktop:build    # a bundle for the OS you are on
vercel deploy --prod --yes
```

---

## The rules that hold the whole thing up

Break one of these and the repo stops meaning anything. They are all enforced by
tests, not by discipline.

1. **No level geometry is authored.** Everything comes from a seed, is judged,
   and is kept or discarded. Nothing is ever patched into fairness — the version
   before this one did that and every patch had an edge it did not cover.
2. **A perfect player finishes with zero deaths and is never caught.** That is
   the correctness gate. The blind player is *only* a difficulty estimate and is
   never allowed to gate correctness.
3. **One new variable at a time.** The level a mechanic arrives on is identical
   to the one before it in every other respect — including its *shape*.
4. **Picked maize is never lost to a trap.** Only the hunter can undo progress,
   and that is what makes the countdown worth watching.
5. **Silence early, instruments late, tutorials never.**
6. **The game may only judge a number it showed you.** Act two turns on the
   player having been slow, so the deadline is named in act one and the clock
   is on the level list from the first field.
7. **Assist settings never reach the simulation.** `createGame` defaults to
   `NEUTRAL` and the solvers pass nothing. See `engine/assist.test.js`.

---

## Where everything lives

```
src/
  content.js       EVERY WORD THE PLAYER READS. Edit this for text changes.
  engine/          no React in here
    assist.js      the three help dials, and why they cannot reach the proof
    grid.js        walls as a mirrored bitmask; setWall is the only writer
    physics.js     ball movement in cell units, fixed timestep, surface factors
    hunter.js      the ghost: pathing, waking, the two fairness invariants
    game.js        the rules, and nothing else
    render.js      the only module that thinks in pixels; terrains and neon
    sound.js       procedural audio: one-shots, footfalls, ambience, proximity
  generate/
    maze.js        seeded carve + loop injection
    analysis.js    graph facts: routes, safe reachability, branch depth
    metrics.js     the SHAPE of a level, and how far apart two levels are
    solvers.js     the two simulated players
    oracle.js      every rule a level must satisfy to be fair
    teaching.js    the extra rule on the level a mechanic first appears
    generate.js    tiers, intents, build/judge/discard
  ui/              React shell
    story.js       sequencing only — which beat is owed when
    progress.js    bests, beats seen, speedrun par, unlock state
    persist.js     save file on desktop, localStorage on web
  scripts/
    buildLevels.js the campaign: chapters, intents, blurbs, terrain
```

**Chapter names and blurbs are in `buildLevels.js`**, not `content.js`, because
they are baked into `levels.json`. Change one and run `npm run levels`.

---

## Done, phase by phase

- **Phase 1 — every level asks its own question.** Levels have a `tier`
  (mechanics) and an `intent` (shape): artery, warren, detour, gauntlet,
  bottleneck, circuit. `metrics.js` measures shape; no two levels in a chapter
  may sit within 0.55 of each other. **Went from 11 distinct configurations of
  39 to 39 of 39.** Perfect play is capped at 40s.
- **Phase 2 — teaching.** Warm Up has no caption; no blurb names a mechanic
  (tested). `teaching.js` adds one constraint to the *first* level of each
  mechanic. Surface patches outlined. The ghost countdown deliberately **stays**.
- **Phase 3 — story.** Trail map; a losing ending you must *choose*; the bandit
  counts across five chapters so the payoff at the camp is earned; Maizy's voice
  thins to nothing by the fires.
- **Phase 4 — sound and feel.** Footfalls carry the ground (sand bright, snow
  dull) which teaches the surfaces with no text. Ghost proximity drone. Ambience
  per terrain. Trail behind the hat, screen jolt.
- **Phase 5 — desktop.** Tauri, 4.3 MB. Save became a real file with a
  synchronous in-memory cache. Gamepad, master volume. CI matrix written.
- **Phase 6 — the player contract.** A critique from the seat of a mainstream
  player rather than from inside the design doctrine. The finding was that the
  game knew what it wanted you to *feel* and never told you what it wanted you
  to *do*. Seven fixes: the cut to 26; act two down to eleven fields; the
  deadline planted in act one and a walked-time clock on the level list; the
  hat planted in the prologue so its reveal is a payoff rather than news;
  deaths off the board; the oaths thinned out and de-repeated; one name; the
  prologue leading into the first field instead of onto a menu; and the assist
  layer.

---

## Not done, and why

### Open decisions — these are the user's, not mine

*Nothing is currently blocked on a decision.*

**Resolved, 2026-08-29:**

- **Art direction** — **lit from within**. Every ground dark, every wall
  emitting, a hue per terrain. Not tilesets: most of the board is under fog, so
  illustrated tiles buy detail the game denies the player. Decided by *looking*
  — see `npm run shots` — rather than by argument, which is the first time that
  has been possible in this repo.

- **Length** — cut from 39 to **26**. Levels 20–39 were mechanically identical
  and the distinctness metric could not see it, because it measures topology
  and a player perceives size, threat count and new verbs.
- **The speedrun** stays mandatory, but races **eleven fields, not thirty-nine**,
  and the deadline it judges is now planted in act one.
- **The name** is **Journey to Maizy**. Storage keys and the Tauri bundle
  identifier deliberately stay `maizes`/`com.bipinrimal.maizes` so no existing
  save is orphaned. The repo directory is still `mazochist`; renaming it is a
  GitHub-side call.

### Known gaps

- **Windows and Linux binaries do not exist.** `.github/workflows/desktop.yml`
  is written but has never run. Push a `v*` tag or trigger it manually.
- **Code signing.** Unsigned builds trip Gatekeeper and SmartScreen. Apple
  Developer $99/yr, Windows cert $200–400/yr.
- **Telemetry inert.** Create a Supabase project, run
  `supabase/migrations/0001_play_events.sql`, put the URL + anon key in
  `.env.local`. Roughly twenty minutes, and it turns every difficulty argument
  into a number.
- **Off-route discoveries** (Phase 3's fifth item) were skipped deliberately
  rather than half-built. They need a new grid content type, placement,
  rendering, persistence and text.
- **No achievements**, no Steam integration, no store page.
- **The light-theme screens have never been re-checked against the dark board.**
  The level list, story cards and trail map are still warm paper by design, but
  only the board has been looked at.

---

## Things that will bite a new session

- **Nothing visual has ever been seen by me.** The Chrome extension has still
  not connected for this project — tried again 2026-08-29, "extension is not
  connected". Every layout, colour and animation is reasoned from code and
  verified headlessly. The neon, the trail map, the typing cards and now the
  **assist panel in the pause menu** have never been looked at. Ask the user
  before assuming they are right.
- **No audio has ever been heard.** Mix levels are reasoned, not tuned.
- **`fog` does not affect the solvers.** `playBlind` has its own map and no
  vision model, so tightening fog carries zero generation risk *and* produces no
  difficulty signal. Same for fading memory. The README says so; do not quietly
  start claiming otherwise.
- **Three teaching lessons are regression guards, not shaping constraints.**
  `hunter`, `memory` and `traps` currently pass on every level. That is stated
  in the README on purpose.
- **The distinctness threshold (0.55) is calibrated, not chosen.** Raising it
  fails the build. If you change the metric vector, re-measure before changing
  the number.
- **`src-tauri/target` is ~1 GB.** It is in `.gitignore` and `.vercelignore`.
  Leaving it out of either breaks that deploy path.
- **Tests re-judge the shipped `levels.json`, not the generator.** If you change
  generation, run `npm run levels` *and* `npm test`.
- The user directs AI agents rather than writing the code; **do not describe the
  code as his work.** Docs are the exception.

---

## If you are picking this up

The next honest step is **turning the telemetry on and putting it in front of
twenty people.** Every difficulty call in this repo is still one simulation and
one person's playthrough, and the phase just finished changed the shape of the
game on reasoning alone — the cut to 26 and the eleven-field act two are the
two calls most worth checking against real `level_quit` data.

Two things to look at first when someone does play it:

- the **assist panel** has never been seen rendered, only tested
- the deployed web build is **stale** — it is still the 39-level campaign

Everything else waits on the art decision.
