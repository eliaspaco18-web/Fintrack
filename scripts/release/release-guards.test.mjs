import test from 'node:test'
import assert from 'node:assert/strict'
import { assertStagedDeployment } from './verify-staged-deployment.mjs'
import { assertStageEvidence } from './verify-stage-evidence.mjs'
import { assertReleasePreflightEvidence } from './verify-preflight-evidence.mjs'
import { sanitizeBuildEnvironment } from './sanitize-build-env.mjs'
import { assertMigrationEvidence } from './continuous-publishing.mjs'
import { assertRemoteMigrationLedger, assertCompleteMigrationLedger, assertMigrationPlanMatchesDryRun, digestMigrationIds } from './assert-migration-ledger.mjs'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { validateSupabasePublicBuildEnvironment } = require('./validate-supabase-public-build-env.cjs')

test('migration apply accepts only the exact pending IDs identified by the protected ledger', () => {
  const dryRun = [
    'Would push these migrations:',
    ' • 20261026000001_harden_user_scoped_rpc_permissions.sql',
    ' • 20261025000002_atomic_exchange_rate_default_null.sql',
  ].join('\n')
  const expected = ['20261025000002', '20261026000001']
  assert.deepEqual(assertMigrationPlanMatchesDryRun(dryRun, expected), expected)
  assert.throws(() => assertMigrationPlanMatchesDryRun('No migrations to apply.', expected), /does not match/)
  assert.throws(() => assertMigrationPlanMatchesDryRun(`${dryRun}\n • 20261026000001_duplicate.sql`, expected), /duplicate/)
  assert.throws(() => assertMigrationPlanMatchesDryRun(`${dryRun}\n • 20261027000001_unreviewed.sql`, expected), /does not match/)
})

const realReadyProduction = JSON.parse(readFileSync(new URL('./fixtures/vercel/ready-production.json', import.meta.url), 'utf8'))
const expectedDeployment = {
  ...realReadyProduction,
  id: 'dpl_abcdef12345',
  meta: { ...realReadyProduction.meta, githubCommitSha: 'a'.repeat(40), gitTreeSha: 'b'.repeat(40), githubPullRequest: '71' },
  url: 'fintrack-abc.vercel.app',
}

test('accepts the exact staged production deployment', () => {
  assert.equal(assertStagedDeployment(expectedDeployment, {
    projectId: 'prj_test', releaseSha: 'a'.repeat(40), treeSha: 'b'.repeat(40), sourcePrNumber: '71', url: 'fintrack-abc.vercel.app',
  }), true)
})

test('rejects wrong project, SHA, target, URL, or deployment state', () => {
  const expected = { projectId: 'prj_test', releaseSha: 'a'.repeat(40), treeSha: 'b'.repeat(40), sourcePrNumber: '71', url: 'fintrack-abc.vercel.app' }
  for (const [key, value] of [
    ['project', { id: 'prj_other' }], ['target', 'preview'], ['readyState', 'BUILDING'], ['url', 'other.vercel.app'],
  ]) {
    assert.throws(() => assertStagedDeployment({ ...expectedDeployment, [key]: value }, expected))
  }
  assert.throws(() => assertStagedDeployment({ ...expectedDeployment, meta: { githubCommitSha: 'b'.repeat(40) } }, expected))
  assert.throws(() => assertStagedDeployment({ ...expectedDeployment, meta: { ...expectedDeployment.meta, gitTreeSha: 'c'.repeat(40) } }, expected))
  assert.throws(() => assertStagedDeployment({ ...expectedDeployment, id: 'dpl_different' }, { ...expected, deploymentId: 'dpl_other' }))
  assert.throws(() => assertStagedDeployment({ ...expectedDeployment, projectId: 'prj_other' }, expected), /conflicting project IDs/)
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

test('Stage and Promotion consume exact-tree evidence while retaining production gates and Cron checks', () => {
  const workflowPath = new URL('../../.github/workflows/production-stage.yml', import.meta.url)
  const workflow = readFileSync(workflowPath, 'utf8')
  const deployCommand = workflow.match(/^\s+vercel deploy .*$/m)?.[0] ?? ''
  assert.match(deployCommand, /--prod\s+--skip-domain/)
  assert.match(workflow, /--meta\s+"githubCommitSha=\$RELEASE_SHA"/)
  assert.doesNotMatch(deployCommand, /--prebuilt/)
  assert.doesNotMatch(workflow, /vercel pull --yes --environment=production|vercel build --prod/)
  assert.match(workflow, /npm run test:release-guards/)
  assert.match(workflow, /FINTRACK_PRODUCTION_STAGE_ENABLED/)
  assert.match(workflow, /confirm_cron_jobs_disabled/)
  assert.match(workflow, /fintrack-release-migration-evidence/)
  assert.match(workflow, /merged-release-proof/)
  assert.match(workflow, /fintrack-production-stage-evidence/)
  assert.match(workflow, /fintrack-release-preflight-evidence/)
  assert.match(workflow, /preflight_run_id/)
  assert.match(workflow, /PRODUCTION_BASE_SHA: \$\{\{ steps\.baseline\.outputs\.production_base_sha \}\}/)
  assert.match(workflow, /assert-migration-evidence\.mjs[\s\S]*\$RISK_LEVEL[\s\S]*\$FINANCIAL_SENSITIVE/)
  const promotion = readFileSync(new URL('../../.github/workflows/production-promote.yml', import.meta.url), 'utf8')
  assert.match(promotion, /FINTRACK_PRODUCTION_PROMOTION_ENABLED/)
  assert.match(promotion, /stage_run_id/)
  assert.match(promotion, /verify-stage-evidence\.mjs/)
  assert.match(promotion, /promotion-authorization/)
  assert.match(promotion, /environment: production-promotion/)
  assert.match(promotion, /vercel promote --yes/)
  assert.match(readFileSync(new URL('../../next.config.js', import.meta.url), 'utf8'), /validate-supabase-public-build-env\.cjs/)
})

test('Stage manifest is bound to release, Production baseline, project, Vercel deployment and Cron confirmation', () => {
  const manifest = {
    release_sha: 'a'.repeat(40), tree_sha: 'b'.repeat(40), production_base_sha: 'c'.repeat(40),
    change_type: 'code-only', risk_level: 'elevated', stage_workflow_run_id: '12345', migration_evidence_run_id: '1234',
    source_pr_number: '71', ci_run_id: '991', vercel_project_id: 'prj_test', vercel_deployment_id: 'dpl_abcdef12345',
    authorization_method: 'repository-owner', authorized_actor_id: '268006031', preflight_workflow_run_id: '98765',
    deployment_url: 'https://fintrack-preview.vercel.app', deployment_ready_state: 'READY', deployment_target: 'production',
    cron_jobs_disabled_confirmation: true,
  }
  const expected = { releaseSha: 'a'.repeat(40), treeSha: 'b'.repeat(40), productionBaseSha: 'c'.repeat(40), stageRunId: '12345' }
  assert.equal(assertStageEvidence(manifest, expected), true)
  for (const invalid of [
    { ...manifest, production_base_sha: 'd'.repeat(40) },
    { ...manifest, deployment_ready_state: 'BUILDING' },
    { ...manifest, cron_jobs_disabled_confirmation: false },
    { ...manifest, stage_workflow_run_id: '12346' },
  ]) assert.throws(() => assertStageEvidence(invalid, expected))
})

test('post-merge preflight evidence covers exact-tree reuse and full suites after merge or squash tree changes', () => {
  const base = {
    release_sha: 'a'.repeat(40), tree_sha: 'b'.repeat(40), preflight_workflow_run_id: '98765',
    source_pr_number: '71', source_head_sha: 'c'.repeat(40), ci_run_id: '991',
    authorization_method: 'repository-owner', authorized_actor_id: '268006031', reviewed_head_tree_matches_release: true,
    release_ci_run_id: '991', result: 'exact-pr-ci-reused',
  }
  assert.equal(assertReleasePreflightEvidence(base, { releaseSha: 'a'.repeat(40), treeSha: 'b'.repeat(40), runId: '98765' }), true)
  assert.equal(assertReleasePreflightEvidence({
    ...base, reviewed_head_tree_matches_release: false, release_ci_run_id: '', result: 'full-post-merge-suite-passed',
  }, { releaseSha: 'a'.repeat(40), treeSha: 'b'.repeat(40), runId: '98765' }), true)
  for (const invalid of [
    { ...base, preflight_workflow_run_id: '00001' },
    { ...base, tree_sha: 'd'.repeat(40) },
    { ...base, authorized_actor_id: '999999999' },
    { ...base, release_ci_run_id: '992' },
    { ...base, result: 'failed' },
  ]) assert.throws(() => assertReleasePreflightEvidence(invalid, { releaseSha: 'a'.repeat(40), treeSha: 'b'.repeat(40), runId: '98765' }))
})

test('binds release evidence to exact SHA and tree, risk, change type and full ledger digest', () => {
  const ledgerMigrations = ['20261025000001', '20261025000002', '20261026000001']
  const evidence = {
    release_sha: 'c'.repeat(40),
    tree_sha: 'd'.repeat(40),
    production_base_sha: 'e'.repeat(40),
    change_type: 'migration',
    risk_level: 'elevated',
    financial_sensitive: true,
    migrations: ['20261107000001'],
    ledger_migrations: [...ledgerMigrations],
    ledger_migration_count: 3,
    ledger_sha256: digestMigrationIds(ledgerMigrations),
    result: 'supabase-db-push-succeeded',
    db_push_executed: true,
  }
  const expected = { releaseSha: 'c'.repeat(40), treeSha: 'd'.repeat(40), productionBaseSha: 'e'.repeat(40), changeType: 'migration', riskLevel: 'elevated', financialSensitive: true }
  assert.equal(assertMigrationEvidence(evidence, expected), true)
  assert.throws(() => assertMigrationEvidence(evidence, { ...expected, releaseSha: 'f'.repeat(40) }), /different release SHA/)
  assert.throws(() => assertMigrationEvidence(evidence, { ...expected, treeSha: 'f'.repeat(40) }), /different release tree/)
  assert.throws(() => assertMigrationEvidence(evidence, { ...expected, productionBaseSha: 'f'.repeat(40) }), /different active Production baseline/)
  assert.throws(() => assertMigrationEvidence(evidence, { ...expected, riskLevel: 'standard' }), /risk classification/)
  assert.throws(() => assertMigrationEvidence({ ...evidence, financial_sensitive: false }, expected), /financial-sensitivity classification/)
  assert.throws(() => assertMigrationEvidence({ ...evidence, result: 'failed' }, expected), /read-only ledger certification or explicitly approved migration apply/)
  assert.throws(() => assertMigrationEvidence({ ...evidence, migrations: [] }, expected), /at least one/)
  assert.throws(() => assertMigrationEvidence({ ...evidence, db_push_executed: false }, expected), /read-only ledger certification or explicitly approved migration apply/)
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
  assert.throws(() => assertRemoteMigrationLedger(output.replace('REMOTE', 'OTHER')), /Could not identify/)
  assert.throws(() => assertRemoteMigrationLedger(`${output}\n20261025000001 | 20261025000001 | duplicate`), /duplicate version IDs/)
})

test('parses Supabase CLI backtick-quoted migration ledger and certifies exact synchronization', () => {
  const output = [
    ' Local          | Remote         | Time (UTC)',
    '----------------|----------------|---------------------',
    ' `20261025000001` | `20261025000001` | 2026-10-25 00:00:01',
    ' `20261025000002` | `20261025000002` | 2026-10-25 00:00:02',
    ' `20261026000001` | `20261026000001` | 2026-10-26 00:00:01',
  ].join('\n')
  assert.equal(assertRemoteMigrationLedger(output).length, 3)
  assert.equal(assertCompleteMigrationLedger(output, ['20261025000001', '20261025000002', '20261026000001']).migrationIds.length, 3)
  assert.throws(() => assertCompleteMigrationLedger(output, ['20261025000001', '20261025000002']), /local ledger does not match/)
  assert.throws(() => assertCompleteMigrationLedger(output.replace('`20261026000001` | `20261026000001`', '`20261026000001` |'), ['20261025000001', '20261025000002', '20261026000001']), /mismatch/)
  assert.throws(() => assertCompleteMigrationLedger(output.replace('`20261026000001` | `20261026000001`', '| `20261026000001`'), ['20261025000001', '20261025000002', '20261026000001']), /mismatch/)
  assert.throws(() => assertCompleteMigrationLedger(output.replace('`20261026000001` | `20261026000001`', '`20261025000002` | `20261026000001`'), ['20261025000001', '20261025000002', '20261026000001']), /duplicate version IDs/)
})

test('accepts a code-only ledger certificate and rejects db push or migration claims', () => {
  const ledgerMigrations = ['20261025000001', '20261025000002', '20261026000001']
  const good = {
    release_sha: 'c'.repeat(40),
    tree_sha: 'd'.repeat(40),
    production_base_sha: 'e'.repeat(40),
    change_type: 'code-only',
    risk_level: 'standard',
    financial_sensitive: false,
    migrations: [],
    ledger_migrations: ledgerMigrations,
    ledger_migration_count: 3,
    ledger_sha256: digestMigrationIds(ledgerMigrations),
    result: 'supabase-ledger-certified',
    certification: 'protected-production-migration-ledger',
    db_push_executed: false,
  }
  const expected = { releaseSha: 'c'.repeat(40), treeSha: 'd'.repeat(40), productionBaseSha: 'e'.repeat(40), changeType: 'code-only', riskLevel: 'standard', financialSensitive: false }
  assert.equal(assertMigrationEvidence(good, expected), true)
  assert.throws(() => assertMigrationEvidence({ ...good, db_push_executed: true }, expected), /must not run db push/)
  assert.throws(() => assertMigrationEvidence({ ...good, migrations: ['20261107000001'] }, expected), /must not run db push/)
  assert.throws(() => assertMigrationEvidence({ ...good, ledger_migration_count: 35 }, expected), /count or digest/)
})

test('Preview dispatch resolves a PR and reuses CI instead of accepting manual SHAs or branch overrides', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/v3-preview.yml', import.meta.url), 'utf8')
  assert.match(workflow, /pull_request_number/)
  assert.match(workflow, /environment: preview/)
  assert.match(workflow, /preview-pr/)
  assert.match(workflow, /check-preview-environment/)
  assert.match(workflow, /verify-preview-project/)
  assert.match(workflow, /verify-preview-deployment/)
  assert.match(workflow, /owner_authorized_sha/)
  assert.match(workflow, /AUTHORIZED_ACTOR_ID: \$\{\{ github\.actor_id \}\}/)
  assert.match(workflow, /vercel pull --yes --environment=preview/)
  assert.match(workflow, /vercel deploy --yes --target=preview/)
  assert.doesNotMatch(workflow, /vercel deploy[^\n]*--prebuilt/)
  assert.match(workflow, /FINTRACK_PREVIEW_BUILD_VERIFICATION=1/)
  assert.match(workflow, /Remove the pulled environment snapshot before remote deployment/)
  const bootstrapCheck = workflow.indexOf('node release-tools/scripts/release/continuous-publishing.mjs verify-preview-build-bootstrap candidate release-tools')
  const remoteDeploy = workflow.indexOf('vercel deploy --yes --target=preview')
  assert.ok(bootstrapCheck >= 0 && remoteDeploy > bootstrapCheck, 'trusted main must verify the candidate bootstrap immediately before remote deployment')
  assert.match(workflow, /git branch --show-current/)
  assert.match(readFileSync(new URL('./continuous-publishing.mjs', import.meta.url), 'utf8'), /auth\/v1\/settings/)
  assert.doesNotMatch(workflow, /commit_sha:\s*\n\s+description:/)
  assert.doesNotMatch(workflow, /--git-branch|npm run lint|npm run typecheck|npm run test:unit/)
  assert.doesNotMatch(workflow, /vercel deploy[^\n]*--prod/)
  assert.match(readFileSync(new URL('./continuous-publishing.mjs', import.meta.url), 'utf8'), /PREVIEW_SUPABASE_PROJECT_REF/)
  assert.match(readFileSync(new URL('./continuous-publishing.mjs', import.meta.url), 'utf8'), /PREVIEW_ENV_ALLOWLIST/)
  const vercelConfig = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  assert.equal(vercelConfig.buildCommand, 'node scripts/release/verify-preview-build-env.mjs && npm run build')
  const previewBuildCheck = readFileSync(new URL('./verify-preview-build-env.mjs', import.meta.url), 'utf8')
  assert.match(previewBuildCheck, /VERCEL_ENV !== 'preview'/)
  assert.match(previewBuildCheck, /auth\/v1\/settings/)
  assert.match(previewBuildCheck, /method: 'GET'/)
  assert.match(readFileSync(new URL('./continuous-publishing.mjs', import.meta.url), 'utf8'), /candidateVerifier !== trustedVerifier/)
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY=.*\$\{\{\s*secrets\./)
  const certification = readFileSync(new URL('../../.github/workflows/production-migration-certification.yml', import.meta.url), 'utf8')
  assert.match(certification, /merged-release-proof/)
  assert.match(certification, /owner_authorized_sha/)
  assert.doesNotMatch(certification, /\bnpx\s+(?:--yes\s+)?supabase@\S+\s+db push\b/)
  const preflight = readFileSync(new URL('../../.github/workflows/production-preflight.yml', import.meta.url), 'utf8')
  assert.match(preflight, /fintrack-release-preflight-evidence/)
  assert.match(preflight, /\[\[ "\$GITHUB_SHA" == "\$RELEASE_SHA" \]\]/)
})

test('code-only certification has no SQL apply command; migration apply stays explicit and protected', () => {
  const certification = readFileSync(new URL('../../.github/workflows/production-migration-certification.yml', import.meta.url), 'utf8')
  const apply = readFileSync(new URL('../../.github/workflows/production-migrations.yml', import.meta.url), 'utf8')
  assert.doesNotMatch(certification, /^\s*run:.*\bdb push\b/m)
  assert.match(certification, /migration list --linked/)
  assert.match(certification, /FINTRACK_PRODUCTION_MIGRATIONS_ENABLED/)
  assert.match(apply, /inputs\.apply_migrations == true/)
  assert.match(apply, /db push --linked --dry-run/)
  assert.match(apply, /db push --linked$/m)
  assert.match(apply, /assertMigrationPlanMatchesDryRun/)
  assert.doesNotMatch(apply, /20261025000001|20261025000002|20261026000001/)
})
