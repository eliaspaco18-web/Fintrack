import fs from 'node:fs'

// Production ledger already contains 20261025000001 from the partial 2026-10-30 run.
// Fail closed unless dry-run shows precisely the two still-pending migrations.
export const EXPECTED_V3_MIGRATIONS = Object.freeze([
  '20261025000002',
  '20261026000001',
])

export function parseMigrationIds(output) {
  return Array.from(String(output).matchAll(/^\s*(?:[-*•]\s*)?(\d{14})(?=[_\s]|$)/gm), match => match[1])
}

export function assertV3MigrationPlan(output) {
  const found = parseMigrationIds(output)
  const expected = [...EXPECTED_V3_MIGRATIONS].sort()
  const actual = [...found].sort()

  if (new Set(found).size !== found.length) {
    throw new Error(`Migration dry run contains duplicate IDs: ${found.join(', ')}`)
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Refusing migration plan. Expected ${expected.join(', ')}; got ${actual.join(', ') || '(none)'}.`)
  }
  return found
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const output = fs.readFileSync(0, 'utf8')
    const migrations = assertV3MigrationPlan(output)
    process.stdout.write(`Migration plan accepted: ${migrations.join(', ')}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
