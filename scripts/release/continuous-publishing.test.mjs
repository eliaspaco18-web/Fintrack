import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertMergedReleaseProof,
  assertMigrationChangesAreAdditive,
  assertPreviewDeployment,
  assertPreviewDeploymentProtectionResponse,
  assertPreviewPrReady,
  assertPreviewProjectProtection,
  assertPreviewSupabaseCredentialProbe,
  assertPreviewSupabaseEnvironment,
  classifyReleaseFiles,
  parseEnvironmentFile,
  previewSupabaseProbeHeaders,
} from './continuous-publishing.mjs'
import { resolveProductionBaseline } from './production-baseline.mjs'

const repository = 'eliaspaco18-web/Fintrack'
const sha = 'a'.repeat(40)
const tree = 'b'.repeat(40)
const projectRef = 'abcdefghijklmnopqrst'

function jwt(role, ref = projectRef) {
  return `header.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.signature`
}

function previewEnv(overrides = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'),
    SUPABASE_SERVICE_ROLE_KEY: jwt('service_role'),
    SUPABASE_PROJECT_ID: projectRef,
    NEXT_PUBLIC_FINTRACK_V3_SHELL: '1',
    ...overrides,
  }
}

function prFixture(overrides = {}) {
  return {
    number: 71,
    state: 'open',
    draft: false,
    merged_at: null,
    base: { ref: 'main', repo: { full_name: repository } },
    head: { ref: 'codex/continuous-publishing-r1', sha, repo: { full_name: repository } },
    user: { login: 'author' },
    ...overrides,
  }
}

const approval = { user: { login: 'reviewer' }, state: 'APPROVED', commit_id: sha, submitted_at: '2026-11-07T10:00:00Z' }
const ciRun = { id: 991, name: 'Release Candidate CI (No Production Access)', path: '.github/workflows/release-ci.yml', head_sha: sha, event: 'pull_request', status: 'completed', conclusion: 'success', run_number: 22 }

test('parses Vercel env files without accepting duplicate variable definitions', () => {
  assert.deepEqual(parseEnvironmentFile('# comment\nA="quoted"\nB=plain\n'), { A: 'quoted', B: 'plain' })
  assert.throws(() => parseEnvironmentFile('A=first\nA=second'), /duplicate variable A/)
})

test('Preview accepts only credentials bound to the isolated QA Supabase project', () => {
  assert.equal(assertPreviewSupabaseEnvironment(previewEnv(), {
    previewProjectRef: projectRef,
    productionProjectRef: 'zyxwvutsrqponmlkjihg',
    shellFlag: '1',
  }), true)

  for (const invalid of [
    previewEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://zyxwvutsrqponmlkjihg.supabase.co' }),
    previewEnv({ SUPABASE_PROJECT_ID: 'zyxwvutsrqponmlkjihg' }),
    previewEnv({ SUPABASE_SERVICE_ROLE_KEY: jwt('service_role', 'zyxwvutsrqponmlkjihg') }),
    previewEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') }),
    previewEnv({ NEXT_PUBLIC_FINTRACK_V3_SHELL: '0' }),
    previewEnv({ SUPABASE_DB_PASSWORD: 'never-log-this' }),
    previewEnv({ PRODUCTION_SUPABASE_ACCESS_TOKEN: 'never-log-this' }),
  ]) {
    assert.throws(() => assertPreviewSupabaseEnvironment(invalid, {
      previewProjectRef: projectRef,
      productionProjectRef: 'zyxwvutsrqponmlkjihg',
      shellFlag: invalid.NEXT_PUBLIC_FINTRACK_V3_SHELL,
    }))
  }

  assert.equal(assertPreviewSupabaseCredentialProbe(200, 'SUPABASE_SERVICE_ROLE_KEY'), true)
  assert.throws(() => assertPreviewSupabaseCredentialProbe(401, 'SUPABASE_SERVICE_ROLE_KEY'), /isolated Preview/)
  const opaqueSecret = 'sb_secret_0123456789abcdefghijkl'
  assert.deepEqual(previewSupabaseProbeHeaders(opaqueSecret), { apikey: opaqueSecret })
  const legacyJwt = jwt('anon')
  assert.deepEqual(previewSupabaseProbeHeaders(legacyJwt), { apikey: legacyJwt, Authorization: `Bearer ${legacyJwt}` })
})

test('Preview fails closed unless project identity and Vercel Authentication protection are present', () => {
  assert.equal(assertPreviewProjectProtection({
    id: 'prj_test',
    ssoProtection: { enabled: true, deploymentType: 'all_except_custom_domains' },
  }, 'prj_test'), true)
  assert.throws(() => assertPreviewProjectProtection({ id: 'prj_other', ssoProtection: { enabled: true, deploymentType: 'all' } }, 'prj_test'), /project ID/)
  assert.throws(() => assertPreviewProjectProtection({ id: 'prj_test', ssoProtection: { enabled: false } }, 'prj_test'), /SSO/)
  assert.equal(assertPreviewDeploymentProtectionResponse(new Response(null, { status: 302, headers: { location: 'https://vercel.com/sso-api?url=preview' } })), true)
  assert.equal(assertPreviewDeploymentProtectionResponse(new Response(null, { status: 403 })), true)
  assert.throws(() => assertPreviewDeploymentProtectionResponse(new Response('public', { status: 200 })), /not blocked/)
})

test('Preview deployment must be READY, preview-targeted and tied to exact SHA and PR', () => {
  const deployment = {
    readyState: 'READY',
    target: 'preview',
    projectId: 'prj_test',
    url: 'fintrack-pr-71.vercel.app',
    meta: { githubCommitSha: sha, githubPullRequest: '71' },
  }
  const expected = { projectId: 'prj_test', commitSha: sha, pullRequestNumber: 71, hostname: deployment.url }
  assert.equal(assertPreviewDeployment(deployment, expected), true)
  for (const wrong of [
    { ...deployment, readyState: 'BUILDING' },
    { ...deployment, target: 'production' },
    { ...deployment, projectId: 'prj_other' },
    { ...deployment, meta: { ...deployment.meta, githubCommitSha: 'c'.repeat(40) } },
    { ...deployment, meta: { ...deployment.meta, githubPullRequest: '72' } },
  ]) assert.throws(() => assertPreviewDeployment(wrong, expected))
})

test('Preview accepts only an open, ready same-repo PR with exact-head approval and successful CI', () => {
  assert.equal(assertPreviewPrReady({
    pr: prFixture(), reviews: [approval], workflowRuns: [ciRun], repository, pullRequestNumber: 71,
  }).commitSha, sha)
  const cases = [
    [prFixture({ draft: true }), [approval], [ciRun]],
    [prFixture({ base: { ref: 'release', repo: { full_name: repository } } }), [approval], [ciRun]],
    [prFixture({ head: { ...prFixture().head, repo: { full_name: 'fork/Fintrack' } } }), [approval], [ciRun]],
    [prFixture(), [{ ...approval, commit_id: 'c'.repeat(40) }], [ciRun]],
    [prFixture(), [approval, { ...approval, state: 'CHANGES_REQUESTED', submitted_at: '2026-11-07T11:00:00Z' }], [ciRun]],
    [prFixture(), [approval], [{ ...ciRun, conclusion: 'failure' }]],
  ]
  for (const [pr, reviews, workflowRuns] of cases) {
    assert.throws(() => assertPreviewPrReady({ pr, reviews, workflowRuns, repository, pullRequestNumber: 71 }))
  }
})

test('Preview run matching accepts release-ci workflow ref suffixes and rejects a later failed run', () => {
  const withWorkflowRef = { ...ciRun, path: '.github/workflows/release-ci.yml@refs/pull/71/merge' }
  assert.equal(assertPreviewPrReady({
    pr: prFixture(), reviews: [approval], workflowRuns: [withWorkflowRef], repository, pullRequestNumber: 71,
  }).ciRunId, '991')
  assert.throws(() => assertPreviewPrReady({
    pr: prFixture(), reviews: [approval],
    workflowRuns: [withWorkflowRef, { ...withWorkflowRef, id: 992, conclusion: 'failure', run_number: 23 }],
    repository, pullRequestNumber: 71,
  }), /latest Release Candidate CI/)
})

test('merged release evidence is bound to exact SHA, tree, approval and full CI success', () => {
  const pr = prFixture({ state: 'closed', merged_at: '2026-11-07T12:00:00Z' })
  assert.equal(assertMergedReleaseProof({
    pr, reviews: [approval], workflowRuns: [ciRun], repository, releaseSha: sha, releaseTreeSha: tree,
  }).ciRunId, '991')
  assert.throws(() => assertMergedReleaseProof({
    pr, reviews: [approval], workflowRuns: [ciRun], repository, releaseSha: 'c'.repeat(40), releaseTreeSha: tree,
  }), /release source SHA/)
  assert.throws(() => assertMergedReleaseProof({
    pr, reviews: [], workflowRuns: [ciRun], repository, releaseSha: sha, releaseTreeSha: tree,
  }), /approval/)
  assert.throws(() => assertMergedReleaseProof({
    pr, reviews: [approval], workflowRuns: [{ ...ciRun, conclusion: 'failure' }], repository, releaseSha: sha, releaseTreeSha: tree,
  }), /CI did not pass/)
})

test('release classification treats uncertain application code as elevated and SQL/config as migrations', () => {
  assert.equal(classifyReleaseFiles(['docs/release.md']).riskLevel, 'standard')
  assert.deepEqual(classifyReleaseFiles(['app/(dashboard)/home/page.tsx']).changeType, 'code-only')
  assert.equal(classifyReleaseFiles(['app/(dashboard)/home/page.tsx']).riskLevel, 'elevated')
  assert.equal(classifyReleaseFiles(['lib/server/finance/summary.ts']).financialSensitive, true)
  assert.equal(classifyReleaseFiles(['supabase/migrations/20261107000000_new_check.sql']).changeType, 'migration')
  assert.equal(classifyReleaseFiles(['supabase/config.toml']).changeType, 'migration')
  assert.throws(() => classifyReleaseFiles(['database/policy.sql']), /versioned migration files/)
  assert.equal(assertMigrationChangesAreAdditive([{ status: 'A', path: 'supabase/migrations/20261107000000_new.sql' }]), true)
  assert.throws(() => assertMigrationChangesAreAdditive([{ status: 'M', path: 'supabase/migrations/20261025000001_old.sql' }]), /immutable/)
  assert.throws(() => assertMigrationChangesAreAdditive([{ status: 'D', path: 'supabase/migrations/20261025000001_old.sql' }]), /immutable/)
})

test('Production baseline comes from the official domain alias, never an unpromoted Stage deployment', async () => {
  const calls = []
  const activeSha = 'e'.repeat(40)
  const response = value => new Response(JSON.stringify(value), { status: 200 })
  const result = await resolveProductionBaseline({
    projectId: 'prj_test',
    teamId: 'team_test',
    token: 'redacted-token',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options })
      if (String(url).includes('/v7/deployments?')) {
        return response({ deployments: [
          { uid: 'dpl_staged', state: 'READY', target: 'production', projectId: 'prj_test' },
          { uid: 'dpl_live', state: 'READY', target: 'production', projectId: 'prj_test' },
        ] })
      }
      if (String(url).includes('/dpl_staged/aliases')) return response({ aliases: [] })
      if (String(url).includes('/dpl_live/aliases')) return response({ aliases: [{ alias: 'fintrack-eta-silk.vercel.app' }] })
      if (String(url).includes('/v13/deployments/dpl_live')) return response({
        id: 'dpl_live', projectId: 'prj_test', readyState: 'READY', target: 'production',
        url: 'fintrack-live.vercel.app', meta: { githubCommitSha: activeSha },
      })
      throw new Error(`Unexpected URL ${url}`)
    },
  })
  assert.equal(result.releaseSha, activeSha)
  assert.equal(result.deploymentId, 'dpl_live')
  assert.equal(calls.every(call => call.options.method === undefined || call.options.method === 'GET'), true)
  await assert.rejects(resolveProductionBaseline({ projectId: 'prj_test', teamId: 'team_test', token: '' }), /token/)
})
