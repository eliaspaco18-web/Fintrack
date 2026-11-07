import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assertMigrationEvidence,
  assertPreviewPrReady,
  assertPromotionAuthorization,
  findSuccessfulCiForMergedTree,
  resolveMergedReleaseProof,
} from './continuous-publishing.mjs'
import { assertStageEvidence } from './verify-stage-evidence.mjs'
import { assertReleasePreflightEvidence } from './verify-preflight-evidence.mjs'
import { digestMigrationIds } from './assert-migration-ledger.mjs'

const repository = 'eliaspaco18-web/Fintrack'
const sourceSha = 'a'.repeat(40)
const releaseTree = 'b'.repeat(40)
const sourceTree = releaseTree
const ciRun = {
  id: 4238,
  name: 'Release Candidate CI (No Production Access)',
  path: '.github/workflows/release-ci.yml',
  head_sha: sourceSha,
  event: 'pull_request',
  status: 'completed',
  conclusion: 'success',
  run_number: 27,
}

function mergedPr(releaseSha) {
  return {
    number: 64,
    state: 'closed',
    draft: false,
    merged_at: '2026-11-07T15:00:00Z',
    merge_commit_sha: releaseSha,
    base: { ref: 'main', repo: { full_name: repository } },
    head: { ref: 'codex/continuous-publishing-r1', sha: sourceSha, repo: { full_name: repository } },
    user: { login: 'eliaspaco18-web' },
  }
}

function apiResponse(value) {
  return new Response(JSON.stringify(value), { status: 200 })
}

function githubFixture(releaseSha, pr = mergedPr(releaseSha), reviews = [], { sourceTreeSha = sourceTree, releaseTreeSha = releaseTree } = {}) {
  return async url => {
    const path = new URL(String(url)).pathname
    if (path.endsWith(`/commits/${releaseSha}/pulls`)) return apiResponse([pr])
    if (path.endsWith('/actions/workflows/release-ci.yml')) return apiResponse({ id: 22, path: '.github/workflows/release-ci.yml', state: 'active' })
    if (path.endsWith(`/commits/${sourceSha}`)) return apiResponse({ commit: { tree: { sha: sourceTreeSha } } })
    if (path.endsWith(`/commits/${releaseSha}`)) return apiResponse({ commit: { tree: { sha: releaseTreeSha } } })
    if (path.endsWith(`/pulls/${pr.number}/reviews`)) return apiResponse(reviews)
    if (path.includes('/actions/workflows/22/runs')) return apiResponse({ workflow_runs: [ciRun] })
    throw new Error(`Unexpected GitHub read endpoint: ${path}`)
  }
}

test('single-owner Preview path requires owner actor, exact SHA, same-repo ready PR and successful exact-head CI', () => {
  const pr = {
    number: 64, state: 'open', draft: false, merged_at: null,
    base: { ref: 'main', repo: { full_name: repository } },
    head: { ref: 'codex/continuous-publishing-r1', sha: sourceSha, repo: { full_name: repository } },
    user: { login: 'eliaspaco18-web' },
  }
  const authorization = { ownerAuthorizedSha: sourceSha, actorId: '268006031' }
  assert.equal(assertPreviewPrReady({ pr, reviews: [], workflowRuns: [ciRun], repository, pullRequestNumber: 64, ownerAuthorization: authorization }).authorizationMethod, 'repository-owner')
  assert.throws(() => assertPreviewPrReady({
    pr, reviews: [], workflowRuns: [ciRun], repository, pullRequestNumber: 64,
    ownerAuthorization: { ...authorization, actorId: '123456789' },
  }), /not the registered repository owner/)
  assert.throws(() => assertPreviewPrReady({
    pr, reviews: [], workflowRuns: [{ ...ciRun, conclusion: 'failure' }], repository, pullRequestNumber: 64,
    ownerAuthorization: authorization,
  }), /latest Release Candidate CI/)
})

test('single-owner certification accepts actual GitHub merge and squash SHA shapes, not the PR head SHA', async () => {
  for (const [method, releaseSha] of [['merge', 'd'.repeat(40)], ['squash', 'e'.repeat(40)]]) {
    const proof = await resolveMergedReleaseProof({
      repository,
      releaseSha,
      releaseTreeSha: releaseTree,
      token: 'redacted-github-token',
      ownerAuthorization: { ownerAuthorizedSha: releaseSha, actorId: '268006031' },
      fetchImpl: async url => githubFixture(releaseSha)(url),
    })
    assert.equal(proof.releaseSha, releaseSha, `${method} SHA is pinned`)
    assert.equal(proof.sourceSha, sourceSha, 'source review/CI remain bound to the PR head')
    assert.equal(proof.authorizationMethod, 'repository-owner')
    assert.equal(proof.treeMatchesReviewedHead, true)
    assert.equal(proof.ciRunId, String(ciRun.id))
  }
  await assert.rejects(resolveMergedReleaseProof({
    repository,
    releaseSha: 'd'.repeat(40),
    releaseTreeSha: releaseTree,
    token: 'redacted-github-token',
    ownerAuthorization: { ownerAuthorizedSha: 'd'.repeat(40), actorId: '999999999' },
    fetchImpl: async url => githubFixture('d'.repeat(40))(url),
  }), /not the registered repository owner/)
})

test('merge or squash release tree differences never reuse source-head CI for the final release tree', async () => {
  const releaseSha = 'f'.repeat(40)
  const releaseOnlyTree = '9'.repeat(40)
  const proof = await resolveMergedReleaseProof({
    repository,
    releaseSha,
    releaseTreeSha: releaseOnlyTree,
    token: 'redacted-github-token',
    ownerAuthorization: { ownerAuthorizedSha: releaseSha, actorId: '268006031' },
    fetchImpl: async url => githubFixture(releaseSha, mergedPr(releaseSha), [], {
      sourceTreeSha: releaseTree,
      releaseTreeSha: releaseOnlyTree,
    })(url),
  })
  assert.equal(proof.treeMatchesReviewedHead, false)

  const reuse = await findSuccessfulCiForMergedTree({
    repository,
    releaseSha,
    releaseTreeSha: releaseOnlyTree,
    token: 'redacted-github-token',
    ownerAuthorization: { ownerAuthorizedSha: releaseSha, actorId: '268006031' },
    fetchImpl: async url => githubFixture(releaseSha, mergedPr(releaseSha), [], {
      sourceTreeSha: releaseTree,
      releaseTreeSha: releaseOnlyTree,
    })(url),
  })
  assert.equal(reuse.reusable, false)
  assert.equal(reuse.reason, 'tree-sha-mismatch')
})

test('code-only certificate remains read-only and rejects any db-push claim', () => {
  const ledger = ['20261025000001', '20261026000001']
  const evidence = {
    release_sha: 'd'.repeat(40), tree_sha: releaseTree, production_base_sha: 'c'.repeat(40),
    change_type: 'code-only', risk_level: 'elevated', financial_sensitive: true,
    migrations: [], ledger_migrations: ledger, ledger_migration_count: ledger.length,
    ledger_sha256: digestMigrationIds(ledger), result: 'supabase-ledger-certified',
    certification: 'protected-production-migration-ledger', db_push_executed: false,
  }
  assert.equal(assertMigrationEvidence(evidence, {
    releaseSha: evidence.release_sha, treeSha: evidence.tree_sha, productionBaseSha: evidence.production_base_sha,
    changeType: 'code-only', riskLevel: 'elevated', financialSensitive: true,
  }), true)
  assert.throws(() => assertMigrationEvidence({ ...evidence, db_push_executed: true }, {
    releaseSha: evidence.release_sha, treeSha: evidence.tree_sha, productionBaseSha: evidence.production_base_sha,
    changeType: 'code-only', riskLevel: 'elevated', financialSensitive: true,
  }), /must not run db push/)
})

test('owner-only Stage and Promotion require exact successful preflight, ledger, protected run, and repeated release SHA authorization', () => {
  const releaseSha = 'd'.repeat(40)
  const preflight = {
    release_sha: releaseSha, tree_sha: releaseTree, preflight_workflow_run_id: '70001',
    source_pr_number: '64', source_head_sha: sourceSha, ci_run_id: String(ciRun.id),
    authorization_method: 'repository-owner', authorized_actor_id: '268006031',
    reviewed_head_tree_matches_release: true, release_ci_run_id: String(ciRun.id), result: 'exact-pr-ci-reused',
  }
  assert.equal(assertReleasePreflightEvidence(preflight, { releaseSha, treeSha: releaseTree, runId: '70001' }), true)
  const stage = {
    release_sha: releaseSha, tree_sha: releaseTree, production_base_sha: 'c'.repeat(40),
    change_type: 'code-only', risk_level: 'elevated', stage_workflow_run_id: '70002',
    migration_evidence_run_id: '70000', preflight_workflow_run_id: '70001', source_pr_number: '64', ci_run_id: String(ciRun.id),
    vercel_project_id: 'prj_test', vercel_deployment_id: 'dpl_test12345',
    deployment_url: 'https://fintrack-stage-fixture.vercel.app', deployment_ready_state: 'READY',
    deployment_target: 'production', cron_jobs_disabled_confirmation: true,
    authorization_method: 'repository-owner', authorized_actor_id: '268006031',
  }
  assert.equal(assertStageEvidence(stage, { releaseSha, treeSha: releaseTree, productionBaseSha: 'c'.repeat(40), stageRunId: '70002' }), true)
  assert.equal(assertPromotionAuthorization({
    releaseSha, stageAuthorizationMethod: stage.authorization_method,
    ownerAuthorization: { ownerAuthorizedSha: releaseSha, actorId: '268006031' },
  }).authorizationMethod, 'repository-owner')
  assert.throws(() => assertPromotionAuthorization({ releaseSha, stageAuthorizationMethod: stage.authorization_method }), /exact independent PR approval or explicit repository-owner/)
  assert.throws(() => assertStageEvidence({ ...stage, authorized_actor_id: '123456789' }, {
    releaseSha, treeSha: releaseTree, productionBaseSha: 'c'.repeat(40), stageRunId: '70002',
  }), /registered repository owner/)
})

test('all protected release paths keep their environment and explicit owner input; Preview remains non-Production', () => {
  const paths = [
    ['preview', '../../.github/workflows/v3-preview.yml'],
    ['production-migrations', '../../.github/workflows/production-migration-certification.yml'],
    ['production-stage', '../../.github/workflows/production-stage.yml'],
    ['production-promotion', '../../.github/workflows/production-promote.yml'],
  ]
  for (const [environment, path] of paths) {
    const workflow = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(workflow, new RegExp(`environment: ${environment}`))
    assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/)
    assert.match(workflow, /owner_authorized_sha/)
    assert.match(workflow, /github\.actor_id/)
  }
  for (const path of [
    '../../.github/workflows/production-migration-certification.yml',
    '../../.github/workflows/production-migrations.yml',
    '../../.github/workflows/production-preflight.yml',
    '../../.github/workflows/production-stage.yml',
  ]) {
    const workflow = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(workflow, /pull-requests: read/)
    assert.match(workflow, /actions: read/)
  }
  const preview = readFileSync(new URL('../../.github/workflows/v3-preview.yml', import.meta.url), 'utf8')
  assert.doesNotMatch(preview, /vercel deploy[^\n]*--prod/)
  assert.match(preview, /check-preview-environment/)
  const certification = readFileSync(new URL('../../.github/workflows/production-migration-certification.yml', import.meta.url), 'utf8')
  assert.doesNotMatch(certification, /\bnpx\s+(?:--yes\s+)?supabase@\S+\s+db push\b/)
})
