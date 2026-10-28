import fs from 'node:fs'

export const REQUIRED_MIGRATION_IDS = Object.freeze([
  '20261025000001',
  '20261025000002',
  '20261026000001',
])

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
    const match = columns[remoteIndex].match(/^(\d{14})(?:\b|$)/)
    if (match) found.push(match[1])
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
