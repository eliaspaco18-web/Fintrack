import fs from 'node:fs'

export const REQUIRED_MIGRATION_IDS = Object.freeze([
  '20261025000001',
  '20261025000002',
  '20261026000001',
])

export function assertMigrationEvidence(evidence, expectedSha) {
  if (!evidence || typeof evidence !== 'object') throw new Error('Migration evidence is missing or malformed.')
  if (evidence.release_sha !== expectedSha) throw new Error('Migration evidence belongs to a different release SHA.')
  if (evidence.result === 'supabase-ledger-certified') {
    if (evidence.certification !== 'protected-production-migration-ledger' || evidence.observed_migration_count !== 37) {
      throw new Error('Read-only migration certification is missing its required provenance or exact ledger count.')
    }
  } else if (evidence.result !== 'supabase-db-push-succeeded') {
    throw new Error('Migration evidence does not record a successful apply or protected read-only certification.')
  }
  const actual = Array.isArray(evidence.migrations) ? [...evidence.migrations].sort() : []
  const expected = [...REQUIRED_MIGRATION_IDS].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Migration evidence does not contain the exact required V3 migration set.')
  return true
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const path = process.argv[2]
    const expectedSha = process.argv[3]
    if (!path || !/^[0-9a-f]{40}$/.test(expectedSha ?? '')) throw new Error('Usage: node assert-migration-evidence.mjs <evidence.json> <full-release-sha>')
    assertMigrationEvidence(JSON.parse(fs.readFileSync(path, 'utf8')), expectedSha)
    process.stdout.write(`Migration evidence verified for ${expectedSha}.\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
