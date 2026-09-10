import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')

/**
 * The events the game sends and the events the table accepts must be the same
 * set.
 *
 * This exists because they were not. `speedrun_conceded` — the player choosing
 * to stop looking, which is the single most interesting thing a tester can do —
 * was recorded by the game and rejected by the table's check constraint. The
 * failure mode is silent by construction: the insert 400s, `record` queues the
 * row, and every later flush re-sends it and is refused again. Nobody sees an
 * error, and the one event you would most want is the one you never get.
 *
 * Read out of the files rather than from a shared constant on purpose. A
 * constant would have to be imported by the migration, which is SQL and cannot
 * import anything, so the two would drift again the moment someone adds an
 * event. Parsing both is the only check that actually holds.
 */

function eventsTheGameSends() {
  const found = new Set()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) { walk(path); continue }
      if (!/\.jsx?$/.test(entry.name) || entry.name.includes('.test.')) continue
      for (const [, event] of readFileSync(path, 'utf8').matchAll(/\brecord\(\s*'([a-z_]+)'/g)) {
        found.add(event)
      }
    }
  }
  walk(resolve(ROOT, 'src'))
  return found
}

function eventsTheTableAccepts() {
  const sql = readFileSync(resolve(ROOT, 'supabase/migrations/0001_play_events.sql'), 'utf8')
  const clause = sql.match(/play_events_event_known\s+check\s*\(([\s\S]*?)\)\s*,/)
  expect(clause, 'the check constraint has been renamed or removed').toBeTruthy()
  return new Set([...clause[1].matchAll(/'([a-z_]+)'/g)].map(([, event]) => event))
}

describe('the game and the table agree on what an event is', () => {
  const sends = eventsTheGameSends()
  const accepts = eventsTheTableAccepts()

  it('finds the calls and the constraint at all', () => {
    expect(sends.size, 'no record() calls found — did the call shape change?').toBeGreaterThan(4)
    expect(accepts.size, 'no events parsed out of the migration').toBeGreaterThan(4)
  })

  it('accepts every event the game actually sends', () => {
    const rejected = [...sends].filter((event) => !accepts.has(event)).sort()
    expect(rejected, `the table would refuse these, silently and forever: ${rejected.join(', ')}`)
      .toEqual([])
  })

  it('does not reserve room for events nothing sends', () => {
    // not a correctness bug, but a constraint listing an event no code emits is
    // either a leftover or a call that got renamed and lost its data
    const unused = [...accepts].filter((event) => !sends.has(event)).sort()
    expect(unused, `nothing in the game sends these: ${unused.join(', ')}`).toEqual([])
  })
})
