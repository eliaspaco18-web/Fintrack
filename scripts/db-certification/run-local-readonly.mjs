#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const queries = {
  snapshot: resolve(root, 'scripts/db-certification/integrity-snapshot.sql'),
  ledger: resolve(root, 'scripts/db-certification/migration-ledger.sql'),
  inventory: resolve(root, 'scripts/db-certification/schema-inventory.sql'),
  preflight: resolve(root, 'scripts/db-certification/target-preflight.sql'),
  'usd-rate-one': resolve(root, 'scripts/db-certification/usd-rate-one.sql'),
}

const [, , mode, outputArg] = process.argv
if (!queries[mode] || !outputArg || !isAbsolute(outputArg)) {
  console.error('Usage: CERT_DATABASE_URL and CERT_TARGET_ID must be provided by a protected local environment; then run <snapshot|ledger|inventory|preflight|usd-rate-one> /absolute/path/output')
  process.exit(2)
}

const databaseUrl = process.env.CERT_DATABASE_URL
const expectedTargetId = process.env.CERT_TARGET_ID
if (!databaseUrl) {
  console.error('CERT_DATABASE_URL is required; no connection string was supplied.')
  process.exit(2)
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expectedTargetId || '')) {
  console.error('CERT_TARGET_ID must be the UUID marker assigned to the verified isolated database.')
  process.exit(2)
}

let parsed
try {
  parsed = new URL(databaseUrl)
} catch {
  console.error('CERT_DATABASE_URL is not a valid PostgreSQL URL.')
  process.exit(2)
}

const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
if (!localHosts.has(parsed.hostname.toLowerCase())) {
  console.error('Refusing to connect: certification runner permits loopback hosts only.')
  process.exit(3)
}
if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
  console.error('Refusing to connect: expected a PostgreSQL URL.')
  process.exit(3)
}

const output = resolve(outputArg)
const relativeOutput = relative(root, output)
if (!relativeOutput.startsWith(`..${sep}`) && relativeOutput !== '..') {
  console.error('Refusing to write certification output inside the repository.')
  process.exit(3)
}
if (existsSync(output)) {
  console.error('Refusing to overwrite an existing certification artifact.')
  process.exit(3)
}

const env = {
  ...process.env,
  PGHOST: parsed.hostname.replace(/^\[|\]$/g, ''),
  PGPORT: parsed.port || '5432',
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
  PGCONNECT_TIMEOUT: '3',
  PGSSLMODE: 'disable',
  PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=3000',
}
delete env.CERT_DATABASE_URL
delete env.PGHOSTADDR
delete env.PGSERVICE
delete env.PGSERVICEFILE

const markerCheck = spawnSync('psql', [
  '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t',
  '-c', "SELECT coalesce(current_setting('fintrack.certification_target_id', true), '')",
], {
  cwd: root,
  env,
  encoding: 'utf8',
  maxBuffer: 1024 * 1024,
})
if (markerCheck.error || markerCheck.status !== 0) {
  console.error('Could not verify the isolated-target marker; output was not saved.')
  process.exit(4)
}
if (markerCheck.stdout.trim() !== expectedTargetId) {
  console.error('Refusing to run: isolated-target marker is absent or does not match CERT_TARGET_ID.')
  process.exit(3)
}

const result = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-f', queries[mode]], {
  cwd: root,
  env,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
})
if (result.error) {
  console.error(`Could not run psql: ${result.error.message}`)
  process.exit(4)
}
if (result.status !== 0) {
  console.error(`Read-only query failed (psql exit ${result.status}). Output was not saved.`)
  if (result.stderr?.trim()) console.error(result.stderr.trim())
  process.exit(result.status || 4)
}

mkdirSync(dirname(output), { recursive: true, mode: 0o700 })
writeFileSync(output, result.stdout, { flag: 'wx', mode: 0o600 })
console.log(`Saved ${mode} output to ${output}; URL host was loopback and the database marker matched. Server identity still requires the documented independent checks.`)
