import fs from 'node:fs'
import crypto from 'node:crypto'

function extractVersion(value) {
  const match = String(value ?? '').trim().match(/^(?:`(\d{14})`|(\d{14}))$/)
  return match?.[1] ?? match?.[2] ?? null
}

export function migrationIdsFromPaths(paths) {
  const ids = []
  for (const path of paths ?? []) {
    const normalized = String(path).replace(/\\/g, '/')
    const match = normalized.match(/^supabase\/migrations\/(\d{14})_[^/]+\.sql$/)
    if (!match) continue
    ids.push(match[1])
  }
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length) throw new Error(`Migration directory contains duplicate version IDs: ${[...new Set(duplicates)].join(', ')}`)
  return [...ids].sort()
}

export function parseMigrationLedger(output) {
  const lines = String(output).split(/\r?\n/)
  const headerIndex = lines.findIndex(line => {
    const columns = line.split('|').map(value => value.trim().toLowerCase())
    return columns.includes('local') && columns.includes('remote')
  })
  if (headerIndex < 0) throw new Error('Could not identify LOCAL/REMOTE columns in Supabase migration list output.')

  const headers = lines[headerIndex].split('|').map(value => value.trim().toLowerCase())
  const localIndex = headers.indexOf('local')
  const remoteIndex = headers.indexOf('remote')
  const localIds = []
  const remoteIds = []
  const mismatches = []
  for (const line of lines.slice(headerIndex + 1)) {
    const columns = line.split('|').map(value => value.trim())
    if (columns.length <= Math.max(localIndex, remoteIndex)) continue
    const local = extractVersion(columns[localIndex])
    const remote = extractVersion(columns[remoteIndex])
    if (!local && !remote) continue
    if (local) localIds.push(local)
    if (remote) remoteIds.push(remote)
    if (local !== remote) mismatches.push({ local, remote })
  }
  const duplicates = list => list.filter((id, index) => list.indexOf(id) !== index)
  if (duplicates(localIds).length || duplicates(remoteIds).length) throw new Error('Supabase migration ledger contains duplicate version IDs.')
  return { localIds: localIds.sort(), remoteIds: remoteIds.sort(), mismatches }
}

export function assertRemoteMigrationLedger(output) {
  const { remoteIds } = parseMigrationLedger(output)
  return remoteIds
}

export function assertCompleteMigrationLedger(output, expectedLocalIds) {
  if (!Array.isArray(expectedLocalIds) || expectedLocalIds.some(id => !/^\d{14}$/.test(String(id)))) {
    throw new Error('Expected local migrations must be supplied as version IDs from the release tree.')
  }
  const expected = [...new Set(expectedLocalIds.map(String))].sort()
  if (expected.length !== expectedLocalIds.length) throw new Error('Release migration manifest contains duplicate IDs.')
  const { localIds, remoteIds, mismatches } = parseMigrationLedger(output)
  if (mismatches.length) throw new Error('Migration ledger has a local/remote mismatch or a pending migration.')
  if (JSON.stringify(localIds) !== JSON.stringify(expected)) throw new Error('Supabase local ledger does not match migration files in the release tree.')
  if (JSON.stringify(remoteIds) !== JSON.stringify(expected)) throw new Error('Production remote ledger does not match migration files in the release tree.')
  return { migrationIds: expected, ledgerSha256: digestMigrationIds(expected) }
}

export function parsePendingMigrationIds(output) {
  const matches = String(output).match(/(?:^|[^0-9])(\d{14})_[A-Za-z0-9._-]+\.sql\b/g) ?? []
  const ids = matches.map(value => value.match(/(\d{14})_/)[1])
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length) throw new Error('Supabase dry-run contains duplicate migration version IDs.')
  return [...ids].sort()
}

export function assertMigrationPlanMatchesDryRun(dryRunOutput, expectedPendingIds) {
  const expected = [...new Set((expectedPendingIds ?? []).map(String))].sort()
  const actual = parsePendingMigrationIds(dryRunOutput)
  if (expected.length !== (expectedPendingIds ?? []).length || expected.some(id => !/^\d{14}$/.test(id))) {
    throw new Error('Expected pending migration manifest is invalid or contains duplicate IDs.')
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Supabase dry-run does not match the exact release migration manifest (expected ${expected.length}, found ${actual.length}).`)
  }
  return actual
}

export function digestMigrationIds(ids) {
  return crypto.createHash('sha256').update([...ids].sort().join('\n')).digest('hex')
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const [mode, arg] = process.argv.slice(2)
    if (mode === 'manifest') {
      const paths = fs.readFileSync(arg ?? 0, 'utf8').split(/\r?\n/).filter(Boolean)
      process.stdout.write(`${JSON.stringify({ migrations: migrationIdsFromPaths(paths) })}\n`)
    } else if (mode === 'ledger') {
      const output = fs.readFileSync(arg ?? 0, 'utf8')
      process.stdout.write(`${JSON.stringify(parseMigrationLedger(output))}\n`)
    } else {
      throw new Error('Usage: assert-migration-ledger.mjs <manifest|ledger> <input-file>')
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
