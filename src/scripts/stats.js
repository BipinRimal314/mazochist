/**
 * Read the playtest back.
 *
 * Run:  npm run stats                 # the funnel, and the ramp against its prediction
 *       npm run stats -- --build p2   # only rows tagged with that build
 *       npm run stats -- --raw        # every event, newest first
 *
 * WHY A SCRIPT RATHER THAN THE DASHBOARD
 *
 * The interesting question is not "what happened" — the Supabase table view
 * answers that. It is "where was the simulation wrong". Every level in this
 * repo ships with a *predicted* difficulty: `blindDeaths` from the blind solver
 * and `perfectSeconds` from the perfect one. This puts the prediction and the
 * measurement in the same row, which is the whole reason the telemetry exists
 * and something no generic dashboard can do.
 *
 * KEYS
 *
 * Reads `SUPABASE_SERVICE_KEY` from `.env.local`. That key bypasses row-level
 * security, which is exactly why it has no `VITE_` prefix: Vite only exposes
 * `VITE_*` to the bundle, so this one cannot be shipped to a browser by
 * accident. The anon key that does ship can insert and cannot read — see the
 * migration.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')

function env() {
  const out = {}
  for (const name of ['.env.local', '.env']) {
    let text
    try { text = readFileSync(resolve(ROOT, name), 'utf8') } catch { continue }
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
      if (match) out[match[1]] ??= match[2].replace(/^["']|["']$/g, '')
    }
  }
  return { ...out, ...process.env }
}

const config = env()
const url = config.SUPABASE_URL || config.VITE_SUPABASE_URL
const key = config.SUPABASE_SERVICE_KEY

if (!url || !key) {
  console.error(`No database configured.

Put both in .env.local (it is gitignored):

  VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
  VITE_SUPABASE_ANON_KEY=...      # ships in the page, insert-only
  SUPABASE_SERVICE_KEY=...        # stays here, reads everything

Both keys are in the Supabase dashboard under Project Settings, API.`)
  process.exit(1)
}

const args = process.argv.slice(2)
const buildFilter = args.includes('--build') ? args[args.indexOf('--build') + 1] : null

async function query(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} on ${path}\n${await response.text()}`)
  }
  return response.json()
}

const pad = (v, n) => String(v ?? '').padEnd(n)
const num = (v, n) => String(v ?? '·').padStart(n)
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`

/** A tiny bar, so a column of numbers has a shape. */
function bar(value, max, width = 12) {
  if (!max || !Number.isFinite(value)) return ' '.repeat(width)
  const filled = Math.round((value / max) * width)
  return '█'.repeat(Math.max(0, filled)) + dim('·'.repeat(Math.max(0, width - filled)))
}

const levels = JSON.parse(readFileSync(resolve(ROOT, 'public/levels.json'), 'utf8'))

const where = buildFilter ? `&build=eq.${encodeURIComponent(buildFilter)}` : ''
const rows = await query(`play_events?select=*&order=created_at.desc&limit=50000${where}`)

if (rows.length === 0) {
  console.log('No events yet. Nobody has played this build.')
  process.exit(0)
}

if (args.includes('--raw')) {
  for (const row of rows.slice(0, 200)) {
    console.log(
      `${row.created_at.slice(0, 19).replace('T', ' ')}  ${pad(row.event, 18)} ` +
      `${pad(row.level_name, 17)} deaths=${num(row.deaths, 3)} ms=${num(row.ms, 7)} ` +
      dim(`${row.player_id.slice(0, 8)} ${row.build}`)
    )
  }
  process.exit(0)
}

// ------------------------------------------------------------------ summary

const players = new Set(rows.map((r) => r.player_id))
const builds = [...new Set(rows.map((r) => r.build))]
const finished = new Set(rows.filter((r) => r.event === 'campaign_finished').map((r) => r.player_id))
const raced = new Set(rows.filter((r) => r.event === 'speedrun_started').map((r) => r.player_id))
const conceded = new Set(rows.filter((r) => r.event === 'speedrun_conceded').map((r) => r.player_id))
const rescued = new Set(rows.filter((r) => r.event === 'speedrun_finished').map((r) => r.player_id))
const touch = new Set(rows.filter((r) => r.touch === true).map((r) => r.player_id))
const span = [rows.at(-1).created_at, rows[0].created_at].map((t) => t.slice(0, 10))

console.log('')
console.log(bold('  Journey to Maizy — playtest'))
console.log(dim(`  ${rows.length} events · ${span[0]} to ${span[1]} · builds: ${builds.join(', ')}`))
console.log('')
console.log(`  ${bold(String(players.size))} players · ${touch.size} on touch · ` +
  `${finished.size} finished act one · ${raced.size} started the race · ` +
  `${rescued.size} got her back · ${conceded.size} stopped looking`)

// ------------------------------------------------------------------- funnel

const byLevel = new Map()
for (const row of rows) {
  if (row.level_index === null) continue
  const at = byLevel.get(row.level_index) ?? {
    name: row.level_name, started: new Set(), won: new Set(), quit: 0, lost: 0,
    deaths: [], seconds: [],
  }
  if (row.event === 'level_started') at.started.add(row.player_id)
  if (row.event === 'level_quit') at.quit += 1
  if (row.event === 'level_lost') at.lost += 1
  if (row.event === 'level_won') {
    at.won.add(row.player_id)
    if (row.deaths !== null) at.deaths.push(row.deaths)
    if (row.ms !== null) at.seconds.push(row.ms / 1000)
  }
  byLevel.set(row.level_index, at)
}

// median rather than mean throughout: one tester who wandered off mid-level
// with the tab open drags an average badly, and the question here is what a
// typical run looked like
const median = (xs) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

console.log('')
console.log(bold('  Where they went'))
console.log(dim('  #   field              reached  cleared  gave up   deaths (sim)   seconds (perfect)'))

const peak = Math.max(...[...byLevel.values()].map((l) => l.started.size), 1)

for (const [index, at] of [...byLevel].sort((a, b) => a[0] - b[0])) {
  const level = levels[index]
  const predictedDeaths = level?.difficulty?.blindDeaths
  const predictedSeconds = level?.difficulty?.perfectSeconds
  const actualDeaths = median(at.deaths)
  const actualSeconds = median(at.seconds)

  // a level nobody cleared, or one where the median player dies far more than
  // the blind solver did, is where the ramp is wrong
  const clearRate = at.started.size ? at.won.size / at.started.size : 0
  const harsh = at.started.size >= 3 && clearRate < 0.5
  const surprising = actualDeaths !== null && predictedDeaths !== undefined
    && actualDeaths > predictedDeaths + 3

  const flag = harsh ? '\x1b[31m◀ they stop here\x1b[0m'
    : surprising ? '\x1b[33m◀ harder than the sim thought\x1b[0m' : ''

  console.log(
    `  ${num(index + 1, 2)}  ${pad(at.name, 17)} ` +
    `${bar(at.started.size, peak, 8)} ${num(at.won.size, 3)}/${num(at.started.size, 3)} ` +
    `${num(at.quit, 4)}     ` +
    `${num(actualDeaths, 4)} ${dim(`(${num(predictedDeaths, 2)})`)}   ` +
    `${num(actualSeconds?.toFixed(0), 5)} ${dim(`(${num(predictedSeconds?.toFixed(0), 3)})`)}  ${flag}`
  )
}

// --------------------------------------------------------------- the cliffs

const reachedBy = (index) => byLevel.get(index)?.started.size ?? 0
const drops = []
for (let i = 1; i < levels.length; i++) {
  const before = reachedBy(i - 1)
  const after = reachedBy(i)
  if (before >= 3 && after < before) drops.push({ i, lost: before - after, before, after })
}
drops.sort((a, b) => b.lost - a.lost)

if (drops.length > 0) {
  console.log('')
  console.log(bold('  Biggest drop-offs'))
  for (const drop of drops.slice(0, 5)) {
    const level = levels[drop.i - 1]
    console.log(
      `  ${num(drop.lost, 3)} players stopped after ${bold(level?.name ?? `#${drop.i}`)}` +
      dim(` — ${drop.before} reached it, ${drop.after} went on`)
    )
  }
}

// ------------------------------------------------- the rule we changed today

const firstHunted = levels.findIndex((l) => l.h)
if (firstHunted >= 0 && byLevel.has(firstHunted)) {
  const at = byLevel.get(firstHunted)
  const before = byLevel.get(firstHunted - 1)
  console.log('')
  console.log(bold('  The trap rule'))
  console.log(dim(`  From ${levels[firstHunted].name} a trap costs the maize. Watch for a jump here.`))
  const rate = (l) => (l && l.started.size ? `${Math.round((l.won.size / l.started.size) * 100)}%` : '·')
  console.log(
    `  ${pad(before?.name ?? '—', 17)} cleared by ${rate(before)}` +
    `${dim(` · median ${num(median(before?.deaths ?? []), 2)} deaths`)}`
  )
  console.log(
    `  ${pad(at.name, 17)} cleared by ${rate(at)}` +
    `${dim(` · median ${num(median(at.deaths), 2)} deaths · ${at.lost} caught`)}`
  )
}

console.log('')
console.log(dim('  npm run stats -- --raw       every event'))
console.log(dim('  npm run stats -- --build X   one build only'))
console.log('')
