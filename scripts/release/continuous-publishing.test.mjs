import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assertPromotionAuthorization,
  assertMergedReleaseProof,
  assertMigrationChangesAreAdditive,
  assertPreviewBuildBootstrap,
  assertPreviewDeployment,
  assertPreviewDeploymentProtectionResponse,
  assertPreviewPrReady,
  assertPreviewProjectProtection,
  assertPreviewSupabaseCredentialProbe,
  assertPreviewSupabaseEnvironment,
  classifyReleaseFiles,
  githubMaskCommand,
  parseEnvironmentFile,
  previewSupabaseProbeHeaders,
  resolveAndVerifyVercelPreview,
} from './continuous-publishing.mjs'
import { resolveProductionBaseline, vercelDeploymentProjectId } from './production-baseline.mjs'

const repository = 'eliaspaco18-web/Fintrack'
const sha = 'a'.repeat(40)
const tree = 'b'.repeat(40)
const projectRef = 'abcdefghijklmnopqrst'
const realReadyPreview = JSON.parse(readFileSync(new URL('./fixtures/vercel/ready-preview.json', import.meta.url), 'utf8'))
const realCanceledPreview = JSON.parse(readFileSync(new URL('./fixtures/vercel/canceled-preview.json', import.meta.url), 'utf8'))
const realReadyProduction = JSON.parse(readFileSync(new URL('./fixtures/vercel/ready-production.json', import.meta.url), 'utf8'))
const previewBuildCommand = 'node scripts/release/verify-preview-build-env.mjs && npm run build'
const trustedPreviewVercelConfig = JSON.stringify({ buildCommand: previewBuildCommand, crons: [] })
const trustedPreviewBuildVerifier = readFileSync(new URL('./verify-preview-build-env.mjs', import.meta.url), 'utf8')

function jwt(role, ref = projectRef) {
  return `header.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.signature`
}

function previewEnv(overrides = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'),
    // `vercel pull` returns this marker for a Vercel Secret. The runner must
    // validate its presence without materializing the credential.
    SUPABASE_SERVICE_ROLE_KEY: '[SENSITIVE]',
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
    previewEnv({ CRON_SECRET: 'never-log-this' }),
    previewEnv({ RESEND_API_KEY: 'never-log-this' }),
    previewEnv({ EXCHANGE_RATE_API_KEY: 'never-log-this' }),
    previewEnv({ EXCHANGE_RATE_API_URL: 'https://production-rates.invalid' }),
    previewEnv({ NEXT_PUBLIC_APP_URL: 'https://fintrack-eta-silk.vercel.app' }),
    previewEnv({ SUPABASE_URL: 'https://production.supabase.co' }),
    previewEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_inheritedvalue' }),
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

test('Preview pull accepts only the non-retrievable service-role Secret marker', () => {
  const common = {
    previewProjectRef: projectRef,
    productionProjectRef: 'zyxwvutsrqponmlkjihg',
    shellFlag: '1',
  }
  assert.equal(assertPreviewSupabaseEnvironment(previewEnv(), common), true)
  assert.throws(() => assertPreviewSupabaseEnvironment(previewEnv({ SUPABASE_SERVICE_ROLE_KEY: '' }), common), /SUPABASE_SERVICE_ROLE_KEY/)

  const accidentallyMaterializedSecret = 'sb_secret_synthetic_not_for_use_0123456789'
  assert.throws(
    () => assertPreviewSupabaseEnvironment(previewEnv({ SUPABASE_SERVICE_ROLE_KEY: accidentallyMaterializedSecret }), common),
    error => error.message.includes('cannot be materialized') && !error.message.includes(accidentallyMaterializedSecret),
  )
})

test('Preview bootstrap guard rejects a legacy candidate without the approved remote build command', () => {
  assert.throws(() => assertPreviewBuildBootstrap({
    candidateVercelConfig: JSON.stringify({ crons: [] }),
    trustedVercelConfig: trustedPreviewVercelConfig,
    candidateVerifier: '',
    trustedVerifier: trustedPreviewBuildVerifier,
  }), /Candidate is missing the approved Preview remote build command/)
})

test('Preview bootstrap guard rejects a changed verifier and alternate Vercel TypeScript config', () => {
  const candidateVercelConfig = JSON.stringify({ buildCommand: previewBuildCommand, crons: [] })
  assert.throws(() => assertPreviewBuildBootstrap({
    candidateVercelConfig,
    trustedVercelConfig: trustedPreviewVercelConfig,
    candidateVerifier: `${trustedPreviewBuildVerifier}\n// changed candidate content`,
    trustedVerifier: trustedPreviewBuildVerifier,
  }), /differs from trusted main/)
  assert.throws(() => assertPreviewBuildBootstrap({
    candidateVercelConfig,
    trustedVercelConfig: trustedPreviewVercelConfig,
    candidateVerifier: trustedPreviewBuildVerifier,
    trustedVerifier: trustedPreviewBuildVerifier,
    candidateHasVercelTs: true,
  }), /vercel\.ts/)
})

test('Preview bootstrap guard accepts the exact approved command and verifier without modifying candidate input', () => {
  const candidateVercelConfig = JSON.stringify({ buildCommand: previewBuildCommand, crons: [] })
  const originalConfig = candidateVercelConfig
  const originalVerifier = trustedPreviewBuildVerifier
  assert.equal(assertPreviewBuildBootstrap({
    candidateVercelConfig,
    trustedVercelConfig: trustedPreviewVercelConfig,
    candidateVerifier: originalVerifier,
    trustedVerifier: originalVerifier,
  }), true)
  assert.equal(candidateVercelConfig, originalConfig)
  assert.equal(originalVerifier, trustedPreviewBuildVerifier)
})

test('Preview environment allowlist reports variable names only and masks all values safely', () => {
  assert.throws(() => assertPreviewSupabaseEnvironment(previewEnv({ CRON_SECRET: 'redacted-cron-value' }), {
    previewProjectRef: projectRef, productionProjectRef: 'zyxwvutsrqponmlkjihg',
  }), error => error.message.includes('CRON_SECRET') && !error.message.includes('redacted-cron-value'))
  assert.equal(githubMaskCommand('line1%\nline2\r'), '::add-mask::line1%25%0Aline2%0D')
})

test('Preview accepts documented Vercel SSO project shapes and fails closed on missing or insufficient protection', () => {
  // Vercel GET /v9/projects/{id} documents this raw REST shape.
  const documentedApiResponse = {
    id: 'prj_test',
    ssoProtection: { deploymentType: 'all_except_custom_domains' },
  }
  // The account connector may normalize the same API setting with enabled:true.
  const normalizedResponse = {
    id: 'prj_test',
    ssoProtection: { enabled: true, deploymentType: 'all_except_custom_domains' },
  }

  assert.equal(assertPreviewProjectProtection(documentedApiResponse, 'prj_test'), true)
  assert.equal(assertPreviewProjectProtection(normalizedResponse, 'prj_test'), true)

  for (const deploymentType of [
    'all_except_custom_domains',
    'prod_deployment_urls_and_all_previews',
    'all',
    'preview',
  ]) {
    assert.equal(assertPreviewProjectProtection({
      id: 'prj_test',
      ssoProtection: { deploymentType },
    }, 'prj_test'), true, deploymentType)
  }

  assert.throws(() => assertPreviewProjectProtection({ id: 'prj_other', ssoProtection: { deploymentType: 'all' } }, 'prj_test'), /project ID/)
  for (const ssoProtection of [
    undefined,
    null,
    {},
    { deploymentType: 'unknown' },
    { deploymentType: 'production' },
    { enabled: false, deploymentType: 'all_except_custom_domains' },
    { enabled: null, deploymentType: 'all_except_custom_domains' },
    { enabled: 'true', deploymentType: 'all_except_custom_domains' },
  ]) {
    assert.throws(() => assertPreviewProjectProtection({ id: 'prj_test', ssoProtection }, 'prj_test'), /SSO/)
  }

  // READY deployment URLs are still checked independently for unauthenticated blocking.
  assert.equal(assertPreviewDeploymentProtectionResponse(new Response(null, { status: 302, headers: { location: 'https://vercel.com/sso-api?url=preview' } })), true)
  assert.equal(assertPreviewDeploymentProtectionResponse(new Response(null, { status: 403 })), true)
  assert.throws(() => assertPreviewDeploymentProtectionResponse(new Response('public', { status: 200 })), /not blocked/)
})

test('real anonymized Vercel Preview response accepts READY with target null and nested project identity', () => {
  // The response shape is anonymized from the Vercel deployment-details API; the PR/tree fields are the workflow metadata we attach.
  const deployment = {
    ...realReadyPreview,
    meta: { ...realReadyPreview.meta, githubPullRequest: '71', gitTreeSha: tree },
  }
  const expected = {
    projectId: 'prj_test', commitSha: realReadyPreview.meta.githubCommitSha, treeSha: tree,
    headRef: realReadyPreview.meta.githubCommitRef, githubRepo: 'fintrack-redacted', githubOrg: 'example-org',
    pullRequestNumber: 71, hostname: realReadyPreview.url, aliases: realReadyPreview.alias,
    productionDomain: 'fintrack-eta-silk.vercel.app',
  }
  assert.equal(assertPreviewDeployment(deployment, expected), true)
  for (const wrong of [
    { ...deployment, ...realCanceledPreview },
    { ...deployment, readyState: 'BUILDING' },
    { ...deployment, target: 'production' },
    { ...deployment, project: { id: 'prj_other' } },
    { ...deployment, projectId: 'prj_other' },
    { ...deployment, meta: { ...deployment.meta, githubCommitSha: 'c'.repeat(40) } },
    { ...deployment, meta: { ...deployment.meta, githubPullRequest: '72' } },
    { ...deployment, meta: { ...deployment.meta, gitTreeSha: 'd'.repeat(40) } },
    { ...deployment, meta: { ...deployment.meta, githubRepo: 'other-repository' } },
    { ...deployment, meta: { ...deployment.meta, githubCommitRef: 'other-branch' } },
    { ...deployment, projectId: 'prj_other', project: { id: 'prj_test' } },
  ]) assert.throws(() => assertPreviewDeployment(wrong, expected))
  assert.throws(() => assertPreviewDeployment(deployment, { ...expected, aliases: ['fintrack-eta-silk.vercel.app'] }), /official Production domain/)
  assert.throws(() => assertPreviewDeployment({ ...deployment, alias: undefined }, { ...expected, aliases: null }), /aliases/)
  assert.throws(() => assertPreviewDeployment({ ...deployment, target: undefined }, expected), /eligible Preview/)
})

test('Preview accepts Vercel CLI detached-HEAD metadata but rejects a different reported branch', () => {
  // `vercel deploy --prebuilt` can report HEAD when the verified checkout is detached.
  const deployment = {
    ...realReadyPreview,
    meta: {
      ...realReadyPreview.meta,
      githubCommitRef: 'HEAD',
      githubPullRequest: '71',
      gitTreeSha: tree,
    },
  }
  const expected = {
    projectId: 'prj_test', commitSha: realReadyPreview.meta.githubCommitSha, treeSha: tree,
    headRef: 'codex/continuous-publishing-r1', githubRepo: 'fintrack-redacted', githubOrg: 'example-org',
    pullRequestNumber: 71, hostname: realReadyPreview.url, aliases: realReadyPreview.alias,
    productionDomain: 'fintrack-eta-silk.vercel.app',
  }

  assert.equal(assertPreviewDeployment(deployment, expected), true)
  assert.throws(() => assertPreviewDeployment({
    ...deployment,
    meta: { ...deployment.meta, githubCommitRef: 'codex/unrelated-branch' },
  }, expected), /branch metadata does not match/)
})

test('Preview API verification handles real target-null response and separately proves the official alias is absent', async () => {
  const deployment = { ...realReadyPreview, meta: { ...realReadyPreview.meta, githubPullRequest: '71', gitTreeSha: tree } }
  const seen = []
  const verified = await resolveAndVerifyVercelPreview({
    projectId: 'prj_test', teamId: 'team_test',
    deploymentUrl: `https://${deployment.url}`,
    commitSha: deployment.meta.githubCommitSha, treeSha: tree, headRef: deployment.meta.githubCommitRef,
    pullRequestNumber: 71, repository: 'example-org/fintrack-redacted', token: 'redacted-vercel-token',
    fetchImpl: async url => {
      const parsed = new URL(String(url))
      seen.push(parsed.pathname)
      if (parsed.pathname === '/v9/projects/prj_test') return new Response(JSON.stringify({ id: 'prj_test', ssoProtection: { enabled: true, deploymentType: 'all' } }))
      if (parsed.pathname === `/v13/deployments/${deployment.url}`) return new Response(JSON.stringify(deployment))
      if (parsed.pathname === `/v2/deployments/${deployment.id}/aliases`) return new Response(JSON.stringify({ aliases: deployment.alias.map(alias => ({ alias })) }))
      throw new Error(`Unexpected Vercel endpoint: ${parsed.pathname}`)
    },
  })
  assert.equal(verified.readyState, 'READY')
  assert.deepEqual(seen, [`/v9/projects/prj_test`, `/v13/deployments/${deployment.url}`, `/v2/deployments/${deployment.id}/aliases`])
  await assert.rejects(resolveAndVerifyVercelPreview({
    projectId: 'prj_test', teamId: 'team_test', deploymentUrl: `https://${deployment.url}`,
    commitSha: deployment.meta.githubCommitSha, treeSha: tree, headRef: deployment.meta.githubCommitRef,
    pullRequestNumber: 71, repository: 'example-org/fintrack-redacted', token: 'redacted-vercel-token',
    fetchImpl: async url => String(url).includes('/v9/projects/')
      ? new Response(JSON.stringify({ id: 'prj_test', ssoProtection: { enabled: true, deploymentType: 'all' } }))
      : String(url).includes('/v13/deployments/')
        ? new Response(JSON.stringify({ ...deployment, project: { id: 'prj_wrong' } }))
        : new Response(JSON.stringify({ aliases: deployment.alias.map(alias => ({ alias })) })),
  }), /different Vercel project/)
})

test('Preview accepts only an open, ready same-repo PR with exact-head approval and successful CI', () => {
  const reviewerPath = assertPreviewPrReady({
    pr: prFixture(), reviews: [approval], workflowRuns: [ciRun], repository, pullRequestNumber: 71,
  })
  assert.equal(reviewerPath.commitSha, sha)
  assert.equal(reviewerPath.authorizationMethod, 'independent-review')
  const ownerPath = assertPreviewPrReady({
    pr: prFixture(), reviews: [], workflowRuns: [ciRun], repository, pullRequestNumber: 71,
    ownerAuthorization: { ownerAuthorizedSha: sha, actorId: '268006031' },
  })
  assert.equal(ownerPath.authorizationMethod, 'repository-owner')
  assert.throws(() => assertPreviewPrReady({
    pr: prFixture(), reviews: [], workflowRuns: [ciRun], repository, pullRequestNumber: 71,
    ownerAuthorization: { ownerAuthorizedSha: sha, actorId: '999999999' },
  }), /not the registered repository owner/)
  assert.throws(() => assertPreviewPrReady({
    pr: prFixture(), reviews: [], workflowRuns: [ciRun], repository, pullRequestNumber: 71,
    ownerAuthorization: { ownerAuthorizedSha: 'c'.repeat(40), actorId: '268006031' },
  }), /exact full SHA/)
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

test('merge-commit and squash-commit release SHAs retain source-head CI and exact reviewer provenance', () => {
  for (const [method, releaseSha] of [['merge commit', 'd'.repeat(40)], ['squash commit', 'e'.repeat(40)]]) {
    const pr = prFixture({ state: 'closed', merged_at: '2026-11-07T12:00:00Z', merge_commit_sha: releaseSha })
    const proof = assertMergedReleaseProof({
      pr, reviews: [approval], workflowRuns: [ciRun], repository, releaseSha, releaseTreeSha: tree,
    })
    assert.equal(proof.sourceSha, sha, `${method} retains the reviewed source head`)
    assert.equal(proof.releaseSha, releaseSha, `${method} is the exact GitHub merge_commit_sha`)
    assert.equal(proof.authorizationMethod, 'independent-review')
    const ownerProof = assertMergedReleaseProof({
      pr, reviews: [], workflowRuns: [ciRun], repository, releaseSha, releaseTreeSha: tree,
      ownerAuthorization: { ownerAuthorizedSha: releaseSha, actorId: '268006031' },
    })
    assert.equal(ownerProof.authorizationMethod, 'repository-owner')
  }
})

test('merged-release checks reject unassociated SHAs, missing authorization and failed source-head CI', () => {
  const releaseSha = 'd'.repeat(40)
  const pr = prFixture({ state: 'closed', merged_at: '2026-11-07T12:00:00Z', merge_commit_sha: releaseSha })
  assert.throws(() => assertMergedReleaseProof({
    pr, reviews: [approval], workflowRuns: [ciRun], repository, releaseSha: 'c'.repeat(40), releaseTreeSha: tree,
  }), /exact merge or squash commit/)
  assert.throws(() => assertMergedReleaseProof({
    pr, reviews: [], workflowRuns: [ciRun], repository, releaseSha, releaseTreeSha: tree,
  }), /exact independent PR approval or explicit repository-owner SHA authorization/)
  assert.throws(() => assertMergedReleaseProof({
    pr, reviews: [approval], workflowRuns: [{ ...ciRun, conclusion: 'failure' }], repository, releaseSha, releaseTreeSha: tree,
  }), /CI did not pass/)
})

test('promotion uses verified Stage authorization and rejects a replayed or unauthorized owner action', () => {
  assert.equal(assertPromotionAuthorization({ releaseSha: sha, stageAuthorizationMethod: 'independent-review' }).authorizationMethod, 'independent-review')
  assert.equal(assertPromotionAuthorization({
    releaseSha: sha, stageAuthorizationMethod: 'repository-owner',
    ownerAuthorization: { ownerAuthorizedSha: sha, actorId: '268006031' },
  }).authorizationMethod, 'repository-owner')
  assert.throws(() => assertPromotionAuthorization({ releaseSha: sha, stageAuthorizationMethod: 'repository-owner' }), /exact independent PR approval or explicit repository-owner SHA authorization/)
  assert.throws(() => assertPromotionAuthorization({
    releaseSha: sha, stageAuthorizationMethod: 'repository-owner',
    ownerAuthorization: { ownerAuthorizedSha: sha, actorId: '999999999' },
  }), /not the registered repository owner/)
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
          { uid: 'dpl_staged', state: 'READY', target: 'production', project: { id: 'prj_test' } },
          { uid: 'dpl_live', state: 'READY', target: 'production', project: { id: 'prj_test' } },
        ] })
      }
      if (String(url).includes('/dpl_staged/aliases')) return response({ aliases: [] })
      if (String(url).includes('/dpl_live/aliases')) return response({ aliases: [{ alias: 'fintrack-eta-silk.vercel.app' }] })
      if (String(url).includes('/v13/deployments/dpl_live')) return response({
        ...realReadyProduction, id: 'dpl_live', project: { id: 'prj_test' }, readyState: 'READY', target: 'production',
        url: 'fintrack-live.vercel.app', meta: { ...realReadyProduction.meta, githubCommitSha: activeSha },
      })
      throw new Error(`Unexpected URL ${url}`)
    },
  })
  assert.equal(result.releaseSha, activeSha)
  assert.equal(result.deploymentId, 'dpl_live')
  assert.equal(vercelDeploymentProjectId(realReadyProduction), 'prj_test')
  assert.equal(calls.every(call => call.options.method === undefined || call.options.method === 'GET'), true)
  await assert.rejects(resolveProductionBaseline({ projectId: 'prj_test', teamId: 'team_test', token: '' }), /token/)
  await assert.rejects(resolveProductionBaseline({
    projectId: 'prj_test', teamId: 'team_test', token: 'redacted-token',
    fetchImpl: async url => String(url).includes('/v7/deployments?')
      ? response({ deployments: [{ uid: 'dpl_bad', projectId: 'prj_other', project: { id: 'prj_test' }, state: 'READY', target: 'production' }] })
      : response({ aliases: [] }),
  }), /conflicting project IDs/)
})
