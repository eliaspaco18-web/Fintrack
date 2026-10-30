import fs from 'node:fs'

export const REQUIRED_MIGRATION_IDS = Object.freeze([
  '20261025000001',
  '20261025000002',
  '20261026000001',
])

function extractMigrationVersion(value) {
  const match = String(value ?? '').trim().match(/^(?:`(\d{14})`|(\d{14}))$/)
  return match?.[1] ?? match?.[2] ?? null
}

export function parseRemoteMigrationIds(output) {
  const lines = String(output).split(/\r?\n/)
  const headerIndex = lines.findIndex(line => {
    const columns = line.split('|').map(value => value.trim().toLowerCase())
    return columns.includes('local') && columns.includes('remote')
  })
  if (headerIndex < 0) throw new Error('Could not identify LOCAL/REMOTE columns in Supabase migration list output.')

  const headers = lines[headerIndex].split('|').map(value => value.trim().toLowerCase())
  const remoteIndex = headers.indexOf('remote')
  const found = []
  for (const line of lines.slice(headerIndex + 1)) {
    const columns = line.split('|').map(value => value.trim())
    if (columns.length <= remoteIndex) continue
    const id = extractMigrationVersion(columns[remoteIndex])
    if (id) found.push(id)
  }
  return found
}

export function assertRemoteMigrationLedger(output) {
  const found = parseRemoteMigrationIds(output)
  const duplicates = found.filter((id, index) => found.indexOf(id) !== index)
  if (duplicates.length) throw new Error(`Remote migration ledger contains duplicate IDs: ${[...new Set(duplicates)].join(', ')}`)
  const missing = REQUIRED_MIGRATION_IDS.filter(id => !found.includes(id))
  if (missing.length) throw new Error(`Remote migration ledger is missing required IDs: ${missing.join(', ')}`)
  return found
}

/**
 * Read-only certification: require an exact, fully-synchronized local/remote
 * ledger, including the 3 V3 migrations, with no pending local-only entries.
 * The expected 37 entries are fixed to this already-applied release.
 */
export function assertCompleteMigrationLedger(output, expectedCount = 37) {
  const remoteIds = assertRemoteMigrationLedger(output)
  const lines = String(output).split(/\r?\n/)
  const headerIndex = lines.findIndex(line => {
    const columns = line.split('|').map(value => value.trim().toLowerCase())
    return columns.includes('local') && columns.includes('remote')
  })
  if (headerIndex < 0) throw new Error('Could not identify LOCAL/REMOTE columns in Supabase migration list output.')
  const headers = lines[headerIndex].split('|').map(value => value.trim().toLowerCase())
  const localIndex = headers.indexOf('local')
  const remoteIndex = headers.indexOf('remote')
  let rows = 0
  for (const line of lines.slice(headerIndex + 1)) {
    const columns = line.split('|').map(value => value.trim())
    if (columns.length <= Math.max(localIndex, remoteIndex)) continue
    const local = extractMigrationVersion(columns[localIndex])
    const remote = extractMigrationVersion(columns[remoteIndex])
    if (!local && !remote) continue
    if (!local || !remote || local !== remote) {
      throw new Error('Migration ledger has a local/remote mismatch or a pending migration.')
    }
    rows++
  }
  if (remoteIds.length !== expectedCount || rows !== expectedCount) {
    throw new Error(`Expected exactly ${expectedCount} synchronized migrations; found ${rows} rows and ${remoteIds.length} remote versions.`)
  }
  return remoteIds
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const path = process.argv[2]
    const output = path ? fs.readFileSync(path, 'utf8') : fs.readFileSync(0, 'utf8')
    assertRemoteMigrationLedger(output)
    process.stdout.write(`Remote migration ledger verified for required IDs: ${REQUIRED_MIGRATION_IDS.join(', ')}.\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
