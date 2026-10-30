import test from 'node:test'
import assert from 'node:assert/strict'
import { assertV3MigrationPlan } from './assert-v3-migration-plan.mjs'
import { assertStagedDeployment } from './verify-staged-deployment.mjs'
import { sanitizeBuildEnvironment } from './sanitize-build-env.mjs'
import { assertMigrationEvidence, REQUIRED_MIGRATION_IDS } from './assert-migration-evidence.mjs'
import { assertRemoteMigrationLedger } from './assert-migration-ledger.mjs'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { validateSupabasePublicBuildEnvironment } = require('./validate-supabase-public-build-env.cjs')

test('accepts exactly the two remaining V3 migrations after the first was applied', () => {
  const dryRun = [
    'Would push these migrations:',
    ' • 20261026000001_harden_user_scoped_rpc_permissions.sql',
    ' • 20261025000002_atomic_exchange_rate_default_null.sql',
  ].join('\n')
  assert.equal(assertV3MigrationPlan(dryRun).length, 2)
})

test('rejects missing, already-applied, additional, or duplicate migration IDs', () => {
  assert.throws(() => assertV3MigrationPlan('No migrations to apply.'), /Expected/)
  assert.throws(() => assertV3MigrationPlan('20261025000002_b.sql'), /Expected/)
  assert.throws(() => assertV3MigrationPlan([
    '20261025000002_b.sql', '20261025000002_b.sql', '20261026000001_c.sql',
  ].join('\n')), /duplicate/i)
  assert.throws(() => assertV3MigrationPlan([
    '20261025000001_a.sql', '20261025000002_b.sql', '20261026000001_c.sql',
  ].join('\n')), /Expected/)
  assert.throws(() => assertV3MigrationPlan([
    '20261025000002_b.sql', '20261026000001_c.sql', '20261027000001_unreviewed.sql',
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

test('sanitizer preserves Vercel redaction placeholders in allowlisted public values', () => {
  const sanitized = sanitizeBuildEnvironment([
    'NEXT_PUBLIC_SUPABASE_URL=[SENSITIVE]',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=[SENSITIVE]',
    'FINTRACK_V3_SHELL_PRODUCTION=0',
  ].join('\n'), 'v2-bridge')

  assert.match(sanitized, /NEXT_PUBLIC_SUPABASE_URL=\[SENSITIVE\]/)
  assert.match(sanitized, /NEXT_PUBLIC_SUPABASE_ANON_KEY=\[SENSITIVE\]/)
})

const validLegacyAnonKey = `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`
const validVercelBuildEnv = {
  VERCEL_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://qa.example.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: validLegacyAnonKey,
}

test('allows supported Supabase URL and anon key formats in Vercel builds', () => {
  assert.deepEqual(validateSupabasePublicBuildEnvironment(validVercelBuildEnv), { skipped: false })
  assert.deepEqual(validateSupabasePublicBuildEnvironment({
    ...validVercelBuildEnv,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_0123456789abcdefghijkl',
  }), { skipped: false })
})

test('rejects masked or invalid Supabase public variables without printing their values', () => {
  for (const invalidEnv of [
    { ...validVercelBuildEnv, NEXT_PUBLIC_SUPABASE_URL: '[SENSITIVE]' },
    { ...validVercelBuildEnv, NEXT_PUBLIC_SUPABASE_URL: 'https://[SENSITIVE]' },
    { ...validVercelBuildEnv, NEXT_PUBLIC_SUPABASE_URL: 'file:///tmp/supabase' },
    { ...validVercelBuildEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: '[SENSITIVE]' },
    { ...validVercelBuildEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'invalid-public-key' },
    { ...validVercelBuildEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_...' },
    { ...validVercelBuildEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_0123456789abcdefghijkl' },
    {
      ...validVercelBuildEnv,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`,
    },
  ]) {
    assert.throws(
      () => validateSupabasePublicBuildEnvironment(invalidEnv),
      error => !error.message.includes('[SENSITIVE]') && !error.message.includes('service_role'),
    )
  }
})

test('does not impose Vercel environment requirements on ordinary local or GitHub builds', () => {
  assert.deepEqual(validateSupabasePublicBuildEnvironment({}), { skipped: true })
})

test('Next.js build config fails closed on Vercel placeholders without echoing values', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./next.config.js')"], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      VERCEL: '1',
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: '[SENSITIVE]',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '[SENSITIVE]',
    },
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /NEXT_PUBLIC_SUPABASE_URL/)
  assert.doesNotMatch(result.stderr, /\[SENSITIVE\]/)
})

test('stages with a Vercel remote build, no prebuilt artifact, and the exact checked-out SHA', () => {
  const workflowPath = new URL('../../.github/workflows/production-stage.yml', import.meta.url)
  const workflow = readFileSync(workflowPath, 'utf8')
  const deployCommand = workflow.match(/^\s+vercel deploy .*$/m)?.[0] ?? ''
  assert.match(deployCommand, /--prod\s+--skip-domain/)
  assert.match(deployCommand, /--meta\s+"githubCommitSha=\$RELEASE_SHA"/)
  assert.doesNotMatch(deployCommand, /--prebuilt/)
  assert.doesNotMatch(workflow, /vercel pull --yes --environment=production|vercel build --prod/)
  assert.match(workflow, /npm run test:release-guards/)
  assert.match(readFileSync(new URL('../../next.config.js', import.meta.url), 'utf8'), /validate-supabase-public-build-env\.cjs/)
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
