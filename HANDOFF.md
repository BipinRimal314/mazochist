# Handoff

Where *Journey to Maizy* is, what is decided, and what is not. Read this and
`README.md` and you have the whole picture.

Last updated after the feel pass (see *Phase 8* below).

---

## What it is

A farmer follows a trail of dropped corn to the daughter who dropped it. You
steer a small yellow shape through mazes you mostly cannot see, gathering maize,
avoiding invisible traps, and — later — outrunning something. The yellow shape
turns out to be his hat.

Thirty levels in thirteen chapters, plus a second act that races one field
from each. The last two chapters are big — 28x16 and 38x21 against 18x11
everywhere before — and on a screen too small to hold them the view scrolls
with the hat. Every level is **generated from a seed and proven beatable by a
simulated player before it ships**; no maze geometry is hand-authored anywhere
in the repo.

## Where it is running

| | |
|---|---|
| Web | <https://maizes-bipin314.vercel.app> — **stale, predates the cut to 26** |
| Repo | <https://github.com/BipinRimal314/maizes> |
| Desktop | builds locally on macOS (4.3 MB, Tauri). Windows and Linux **never built** |
| Telemetry | **live.** Supabase `maizes` (`qhetlsrtbpaobvpxwqkt`, ap-south-1) |

```bash
npm run dev              # web, localhost:5173 — add ?dev to unlock everything
npm run levels           # regenerate the campaign
npm test                 # 401 tests: engine properties + every level re-judged
npm run desktop          # Tauri dev
npm run desktop:build    # a bundle for the OS you are on
npm run stats            # read the playtest back: funnel, and sim vs. reality
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
4. **Picked maize is never lost to a trap — until something is hunting.** On
   a field with no ghost a fall costs the walk back and nothing else. From the
   level the ghost arrives, a fall costs every picked ear, the same as being
   caught, and that never steps back down. Decided 2026-09-10: the stakes
   should rise with the campaign, and a hunted field is where a player has
   already learned to keep the walk short. Tested in `hunter.test.js`.
5. **Silence early, instruments late, tutorials never.**
6. **The game may only judge a number it showed you.** Act two races the
   player against their own act-one times, and those were on the level list
   from the first field. The *hour* — first light, the cart — is deliberately
   **not** named until the camp: act one never says "late", the player is
   told they were slow only when it is too late to matter, and act two is
   what he does about it. (Reversed 2026-09-10; it used to be planted in the
   Two Trips beat and the whispers.)
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
    fx.js          timestamped presentation events the rules never read
    render.js      the only module that thinks in pixels; terrains, neon, effects
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
- **Phase 7 — the lantern.** Walls occlude the light. Shadows cut sight and
  never memory; what he sees is warm, what he remembers is cold. Safe because
  `fog` reaches no solver. 2.96 ms/frame on the biggest board, so canvas stays.
- **Phase 9 — the arc, and the big dark.** Three things the user asked for
  on 2026-09-10 after playing. *The deadline moved to act two*: "first light"
  is gone from act one's beats and whispers, and lands in `TOO_LATE` as the
  twist. *The stakes rise*: on hunted fields a trap costs the maize (rule 4,
  above). *The fields get big*: two new tiers, `vast` (28x16) and `endless`
  (38x21), two new chapters, The Long Dark and The Fires, with a per-tier
  `patience` that lifts the 40 s perfect-play cap for them only, and a camera
  in `useGameLoop` that follows the hat when the board will not fit at 26 px
  a cell. Detour placement now scales its angular spacing with the ear count
  (five ears at 75° apart is more than a circle holds, and was why the last
  chapter refused to build for nine minutes).
- **Phase 8 — feel.** Every state change used to be a hard cut: the hat
  teleported on a trap, an ear vanished, a win snapped to a card, a level
  started with the clock already running. Now there is an effects layer
  (`engine/fx.js`: a list of timestamped events the renderer reads and the
  rules never do) and the board animates the fall, the arrival back at the
  start, the pick, the way opening, the ghost standing up, a knock against a
  wall, and the hat going into the exit. The hat leans into its walk and bobs;
  the maize breathes; the ghost drifts. A title card holds the field paused
  for 1.3 s or until the first input, so the clock never counts reading time.
  The touch stick is drawn. Every screen rises in rather than cutting. The
  determinism guard is `fx.test.js`: a game whose effects are stripped every
  step plays identically to one that keeps them. `npm run shots` now writes
  five extra frames (`11-fall` to `15-stick`) with each effect mid-flight.
  **Then pulled back, same day**, after the user saw it: "the sound and the
  lights, it all feels a little bit too much." Wall bloom is one tight pass
  at half the alpha, the hat and maize glow are small, the maize no longer
  wobbles or pulses, every effect has fewer and smaller motes and one ring
  instead of two, one-shots are triangles at roughly 60% of their old gain,
  footfalls and ambience are 30% quieter, the default volume is 0.55, and
  the CSS lost its bounce easing. The register he asked for was restrained
  and orderly — keep it there. Do not add bloom back.
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
- **Telemetry is on, and nobody has played it yet.** The database exists and
  the pipeline is verified end to end (real browser, real insert, read back
  through `npm run stats`). What is missing is players. See *Telemetry* below.
- **Off-route discoveries** (Phase 3's fifth item) were skipped deliberately
  rather than half-built. They need a new grid content type, placement,
  rendering, persistence and text.
- **No achievements**, no Steam integration, no store page.
- **The light-theme screens have never been re-checked against the dark board.**
  The level list, story cards and trail map are still warm paper by design, but
  only the board has been looked at.

---

## Telemetry

Supabase project **`maizes`** — `qhetlsrtbpaobvpxwqkt`, ap-south-1, created
2026-09-10. Dashboard:
<https://supabase.com/dashboard/project/qhetlsrtbpaobvpxwqkt>

Two keys, and the difference between them is the whole security model:

| | prefix | can | lives in |
|---|---|---|---|
| anon | `VITE_` | INSERT only | the built page, publicly |
| service_role | no prefix | read everything | `.env.local`, gitignored |

Vite only exposes `VITE_*` to the bundle, so the service key cannot reach a
browser by accident. That is verified, not assumed — the build was grepped for
it. Row-level security on `play_events` grants anon INSERT and no SELECT, so a
reader of the page cannot pull back other testers' rows. Also verified:
inserting with the anon key returns 201, selecting with it returns `[]`.

`npm run stats` puts the *prediction* next to the *measurement* — each level's
`blindDeaths` and `perfectSeconds` from the solvers, beside what real players
actually did. That comparison is the reason the telemetry exists and is the
thing the Supabase dashboard cannot show you.

**The events the game sends and the events the table accepts must match.** They
did not: `speedrun_conceded` — the player choosing to stop looking, the single
most interesting thing a tester can do — was recorded by the game and refused by
the check constraint. Silent by construction: the insert 400s, the row is
queued, every later flush re-sends it and is refused again. Fixed 2026-09-10 and
guarded by `telemetry.schema.test.js`, which parses both files and compares
them.

## Things that will bite a new session

- **The Chrome extension connects now (2026-09-10), but its tab sits in a
  background window, so `requestAnimationFrame` never fires there and the
  game cannot be *played* through it** — `document.hidden` is true and the
  clock stays at 00:00. It is not a game bug. Screenshots of the DOM work
  (level list, story cards, title card, pause menu have all been seen and two
  layout bugs fixed from them). Moving frames still come from `npm run
  shots`. The trail map, the result card and the finale have still not been
  seen rendered.
- **`game.paused` is set true at creation in `Play.jsx`** for the title card,
  and the menu toggles off its own ref rather than off `game.paused` for that
  reason. If the menu ever stops opening, look there first.
- **`game.now` stops on a win; `game.outro` is the clock that runs after.**
  The card waits `OUTRO_MS` for the hat to go in. Tests pin both.
- **No audio has ever been heard.** Mix levels are reasoned, not tuned.
- **`fog` does not affect the solvers.** `playBlind` has its own map and no
  vision model, so tightening fog carries zero generation risk *and* produces no
  difficulty signal. Same for fading memory. The README says so; do not quietly
  start claiming otherwise.
- **Three teaching lessons are regression guards, not shaping constraints.**
  `hunter`, `memory` and `traps` currently pass on every level. That is stated
  in the README on purpose.
- **The camera is presentation only.** `game.camera` is set by the render
  loop, read by `drawScene` and the touch stick, and never by a solver. When
  the board fits, it stays `null` and nothing translates — `feel.test.js`
  counts on that.
- **The distinctness threshold (0.55) is calibrated, not chosen.** Raising it
  fails the build. If you change the metric vector, re-measure before changing
  the number.
- **The Vercel project is on a different Google identity than the Vercel CLI.**
  `.vercel/project.json` points at `team_BEGT2xmKtBDdKl1m7iRAB7Zn`, which the
  logged-in CLI account (`bipinrimal1@gmail.com`) cannot read — `vercel env ls`
  fails with "Could not retrieve Project Settings", which reads like a broken
  link and is not one. The live site is up and serving from that other account.
  See [[vercel-author-block]]; this is the same tangle of identities.
- **`.env.local` is loaded by vitest, exactly as Vite loads it.** The telemetry
  tests that assert "an unconfigured build sends nothing" therefore stub the
  environment empty rather than trusting it to be empty — before that they
  passed only on machines with no telemetry configured, and broke the moment
  the database went live.
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
