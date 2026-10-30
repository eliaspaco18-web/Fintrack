import test from 'node:test'
import assert from 'node:assert/strict'
import { assertV3MigrationPlan } from './assert-v3-migration-plan.mjs'
import { assertStagedDeployment } from './verify-staged-deployment.mjs'
import { sanitizeBuildEnvironment } from './sanitize-build-env.mjs'
import { assertMigrationEvidence, REQUIRED_MIGRATION_IDS } from './assert-migration-evidence.mjs'
import { assertRemoteMigrationLedger } from './assert-migration-ledger.mjs'
import { preparePrebuiltDeployEnv } from './prepare-prebuilt-deploy-env.mjs'
import fs, { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test('accepts only the exact ordered V3 migration set, regardless of dry-run order', () => {
  const dryRun = [
    'Would push these migrations:',
    ' • 20261026000001_harden_user_scoped_rpc_permissions.sql',
    ' • 20261025000001_dashboard_fx_completeness.sql',
    ' • 20261025000002_atomic_exchange_rate_default_null.sql',
  ].join('\n')
  assert.equal(assertV3MigrationPlan(dryRun).length, 3)
})

test('rejects missing, additional, or duplicate migration IDs', () => {
  assert.throws(() => assertV3MigrationPlan('No migrations to apply.'), /Expected/)
  assert.throws(() => assertV3MigrationPlan('20261025000001_a.sql\n20261025000002_b.sql'), /Expected/)
  assert.throws(() => assertV3MigrationPlan([
    '20261025000001_a.sql', '20261025000001_a.sql',
    '20261025000002_b.sql', '20261026000001_c.sql',
  ].join('\n')), /duplicate/i)
  assert.throws(() => assertV3MigrationPlan([
    '20261025000001_a.sql', '20261025000002_b.sql',
    '20261026000001_c.sql', '20261027000001_unreviewed.sql',
  ].join('\n')), /Expected/)
})

const expectedDeployment = {
  readyState: 'READY',
  target: 'production',
  projectId: 'prj_test',
  meta: { githubCommitSha: 'a'.repeat(40) },
  url: 'fintrack-abc.vercel.app',
}

test('accepts the exact staged production deployment', () => {
  assert.equal(assertStagedDeployment(expectedDeployment, {
    projectId: 'prj_test', releaseSha: 'a'.repeat(40), url: 'fintrack-abc.vercel.app',
  }), true)
})

test('rejects wrong project, SHA, target, URL, or deployment state', () => {
  const expected = { projectId: 'prj_test', releaseSha: 'a'.repeat(40), url: 'fintrack-abc.vercel.app' }
  for (const [key, value] of [
    ['projectId', 'prj_other'], ['target', 'preview'], ['readyState', 'BUILDING'], ['url', 'other.vercel.app'],
  ]) {
    assert.throws(() => assertStagedDeployment({ ...expectedDeployment, [key]: value }, expected))
  }
  assert.throws(() => assertStagedDeployment({ ...expectedDeployment, meta: { githubCommitSha: 'b'.repeat(40) } }, expected))
})

test('keeps public build variables, strips runtime secrets, and fixes the bridge shell off', () => {
  const sanitized = sanitizeBuildEnvironment([
    'NEXT_PUBLIC_SUPABASE_URL=https://qa.supabase.co',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=public-value',
    'FINTRACK_V3_SHELL_PRODUCTION=0',
    'SUPABASE_SERVICE_ROLE_KEY=server-secret',
    'RESEND_API_KEY=email-secret',
    'EXCHANGE_RATE_API_KEY=rate-secret',
  ].join('\n'), 'v2-bridge')
  assert.match(sanitized, /NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(sanitized, /FINTRACK_V3_SHELL_PRODUCTION=0/)
  assert.doesNotMatch(sanitized, /server-secret|email-secret|rate-secret|SUPABASE_SERVICE_ROLE_KEY/)
  assert.throws(() => sanitizeBuildEnvironment('FINTRACK_V3_SHELL_PRODUCTION=1', 'v2-bridge'), /blocked/)
  assert.throws(() => sanitizeBuildEnvironment('FINTRACK_V3_SHELL_PRODUCTION=0', 'v3'), /requires/)
  assert.throws(() => sanitizeBuildEnvironment('NEXT_PUBLIC_SUPABASE_URL=a\nNEXT_PUBLIC_SUPABASE_URL=b', 'v2-bridge'), /Duplicate/)
  assert.match(sanitizeBuildEnvironment('FINTRACK_V3_SHELL_PRODUCTION=1', 'v3'), /FINTRACK_V3_SHELL_PRODUCTION=1/)
})

test('removes pulled secrets and leaves only an empty private env path for Vercel prebuilt upload', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fintrack-prebuilt-env-'))
  const vercelDir = path.join(projectRoot, '.vercel')
  const outputDir = path.join(vercelDir, 'output')
  fs.mkdirSync(outputDir, { recursive: true })
  const pulledEnv = [
    'NEXT_PUBLIC_SUPABASE_URL=https://qa.example.invalid',
    'FINTRACK_V3_SHELL_PRODUCTION=0',
    'SUPABASE_SERVICE_ROLE_KEY=runtime-secret',
    'RESEND_API_KEY=email-secret',
  ].join('\n')
  const sanitizedEnv = sanitizeBuildEnvironment(pulledEnv, 'v2-bridge')
  fs.writeFileSync(path.join(vercelDir, '.env.production.local'), sanitizedEnv, { mode: 0o600 })
  fs.writeFileSync(path.join(projectRoot, '.env.local'), 'VERCEL_OIDC_TOKEN=local-secret')
  fs.writeFileSync(path.join(outputDir, 'config.json'), JSON.stringify({ version: 3, buildEnv: sanitizedEnv }))

  try {
    preparePrebuiltDeployEnv(projectRoot)

    const envPath = path.join(projectRoot, '.env.local')
    const envStat = fs.lstatSync(envPath)
    assert.equal(fs.existsSync(path.join(vercelDir, '.env.production.local')), false)
    assert.equal(envStat.isFile(), true)
    assert.equal(envStat.isSymbolicLink(), false)
    assert.equal(envStat.size, 0)
    assert.equal(envStat.mode & 0o077, 0)

    const artifactText = fs.readFileSync(path.join(outputDir, 'config.json'), 'utf8')
    assert.doesNotMatch(artifactText, /runtime-secret|local-secret|SUPABASE_SERVICE_ROLE_KEY|VERCEL_OIDC_TOKEN/)
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true })
  }
})

test('runs secret-free prebuilt env preparation after build and before Vercel upload', () => {
  const workflowPath = new URL('../../.github/workflows/production-stage.yml', import.meta.url)
  const workflow = readFileSync(workflowPath, 'utf8')
  const buildIndex = workflow.indexOf('name: Build the exact release artifact')
  const prepareIndex = workflow.indexOf('node scripts/release/prepare-prebuilt-deploy-env.mjs')
  const deployIndex = workflow.indexOf('vercel deploy --prebuilt --prod --skip-domain')

  assert.ok(buildIndex >= 0 && prepareIndex > buildIndex && deployIndex > prepareIndex)
  assert.doesNotMatch(workflow, /rm\s+-f\s+\.vercel\/\.env\.production\.local\s+\.env\.local/)
})

test('binds a V3 stage to the exact successful migration SHA and set', () => {
  const evidence = {
    release_sha: 'c'.repeat(40),
    migrations: [...REQUIRED_MIGRATION_IDS],
    result: 'supabase-db-push-succeeded',
  }
  assert.equal(assertMigrationEvidence(evidence, 'c'.repeat(40)), true)
  assert.throws(() => assertMigrationEvidence(evidence, 'd'.repeat(40)), /different release SHA/)
  assert.throws(() => assertMigrationEvidence({ ...evidence, result: 'failed' }, 'c'.repeat(40)), /successful apply/)
  assert.throws(() => assertMigrationEvidence({ ...evidence, migrations: REQUIRED_MIGRATION_IDS.slice(1) }, 'c'.repeat(40)), /exact required/)
})

test('requires the exact migrations to appear in the remote ledger column', () => {
  const output = [
    'LOCAL          | REMOTE         | TIME (UTC)',
    '---------------|----------------|---------------------',
    '20261025000001 | 20261025000001 | 2026-10-25 00:00:01',
    '20261025000002 | 20261025000002 | 2026-10-25 00:00:02',
    '20261026000001 | 20261026000001 | 2026-10-26 00:00:01',
  ].join('\n')
  assert.equal(assertRemoteMigrationLedger(output).length, 3)
  assert.throws(() => assertRemoteMigrationLedger(output.replace('20261026000001 | 20261026000001', '20261026000001 |')), /missing required/)
  assert.throws(() => assertRemoteMigrationLedger(output.replace('REMOTE', 'OTHER')), /Could not identify/)
  assert.throws(() => assertRemoteMigrationLedger(`${output}\n20261025000001 | 20261025000001 | duplicate`), /duplicate IDs/)
})
