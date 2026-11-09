import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assertMainQaPreviewDeployment,
  assertMainQaWorkflowContext,
  resolveMainQaPreview,
} from './continuous-publishing.mjs'

const repository = 'eliaspaco18-web/Fintrack'
const mainSha = 'a'.repeat(40)
const mainTree = 'b'.repeat(40)
const sourceSha = 'c'.repeat(40)
const ownerId = '268006031'
const workflowId = 77
const prNumber = 166
const ciRunId = 991
const run = {
  id: ciRunId, name: 'Release Candidate CI (No Production Access)',
  path: '.github/workflows/release-ci.yml', head_sha: sourceSha,
  event: 'pull_request', status: 'completed', conclusion: 'success', run_number: 42,
}
const pr = {
  number: prNumber, state: 'closed', draft: false, merged_at: '2026-11-08T10:00:00Z',
  merge_commit_sha: mainSha,
  base: { ref: 'main', repo: { full_name: repository } },
  head: { ref: 'codex/release-r1', sha: sourceSha, repo: { full_name: repository } },
  user: { login: 'owner' },
}
function json(value) { return new Response(JSON.stringify(value), { status: 200 }) }
function fixture({ heads = [mainSha, mainSha], currentPr = pr, sourceTree = mainTree, mainTreeValue = mainTree, runs = [run] } = {}) {
  let refIndex = 0
  return async input => {
    const path = new URL(String(input)).pathname
    if (path === '/repos/' + repository + '/git/ref/heads/main') {
      const sha = heads[Math.min(refIndex++, heads.length - 1)]
      return json({ ref: 'refs/heads/main', object: { type: 'commit', sha } })
    }
    if (path === '/repos/' + repository + '/commits/' + mainSha + '/pulls') return json([currentPr])
    if (path === '/repos/' + repository + '/actions/workflows/release-ci.yml') return json({ id: workflowId, path: '.github/workflows/release-ci.yml', state: 'active' })
    if (path === '/repos/' + repository + '/commits/' + mainSha) return json({ sha: mainSha, commit: { tree: { sha: mainTreeValue } } })
    if (path === '/repos/' + repository + '/commits/' + sourceSha) return json({ sha: sourceSha, commit: { tree: { sha: sourceTree } } })
    if (path === '/repos/' + repository + '/pulls/' + prNumber + '/reviews') return json([])
    if (path === '/repos/' + repository + '/actions/workflows/' + workflowId + '/runs') return json({ workflow_runs: runs })
    throw new Error('Unexpected GitHub API request: ' + path)
  }
}
const input = {
  repository, ownerAuthorizedSha: mainSha, workflowRef: 'refs/heads/main',
  eventName: 'workflow_dispatch', dispatchSha: mainSha, actorId: ownerId,
  token: 'synthetic-github-token',
}

test('MAIN_QA requires main workflow_dispatch and exact owner authorization', () => {
  assert.equal(assertMainQaWorkflowContext({ ...input, currentMainSha: mainSha }).authorizationMethod, 'repository-owner')
  for (const invalid of [
    { ...input, workflowRef: 'refs/heads/codex/test' },
    { ...input, eventName: 'pull_request' },
    { ...input, repository: 'attacker/Fork' },
    { ...input, actorId: '123456789' },
    { ...input, ownerAuthorizedSha: 'd'.repeat(40) },
    { ...input, dispatchSha: 'd'.repeat(40) },
  ]) assert.throws(() => assertMainQaWorkflowContext({ ...invalid, currentMainSha: mainSha }))
})

test('MAIN_QA verifies exact current main, merged PR, matching tree and successful CI twice', async () => {
  const first = await resolveMainQaPreview({ ...input, fetchImpl: fixture() })
  assert.deepEqual(first, {
    pullRequestNumber: prNumber, commitSha: mainSha, treeSha: mainTree,
    ciRunId: String(ciRunId), headRef: 'main', sourceSha,
    authorizationMethod: 'repository-owner', authorizedActorId: ownerId,
  })
  const second = await resolveMainQaPreview({
    ...input,
    expected: {
      commitSha: first.commitSha, treeSha: first.treeSha, ciRunId: first.ciRunId,
      pullRequestNumber: first.pullRequestNumber, sourceSha: first.sourceSha,
    },
    fetchImpl: fixture(),
  })
  assert.deepEqual(second, first)
})

test('MAIN_QA fails closed on moved main, missing integration, different tree or failed CI', async () => {
  await assert.rejects(resolveMainQaPreview({ ...input, fetchImpl: fixture({ heads: [mainSha, 'd'.repeat(40)] }) }), /main HEAD changed/)
  await assert.rejects(resolveMainQaPreview({ ...input, fetchImpl: fixture({ currentPr: { ...pr, merged_at: null } }) }), /No merged same-repository PR/)
  await assert.rejects(resolveMainQaPreview({ ...input, fetchImpl: fixture({ sourceTree: 'e'.repeat(40) }) }), /exact integrated main tree/)
  await assert.rejects(resolveMainQaPreview({ ...input, fetchImpl: fixture({ runs: [{ ...run, conclusion: 'failure' }] }) }), /Release Candidate CI did not pass/)
})

test('post-approval MAIN_QA revalidation rejects SHA or CI evidence changes', async () => {
  await assert.rejects(resolveMainQaPreview({ ...input, expected: { commitSha: 'd'.repeat(40) }, fetchImpl: fixture() }), /evidence changed/)
  await assert.rejects(resolveMainQaPreview({ ...input, expected: { ciRunId: 'different-run' }, fetchImpl: fixture() }), /evidence changed/)
})

test('MAIN_QA deployment requires READY Preview identity, SHA, tree, detached/main ref, SSO metadata and no production alias', () => {
  const expected = {
    projectId: 'prj_fintrack', commitSha: mainSha, treeSha: mainTree,
    hostname: 'fintrack-main-qa.vercel.app',
    aliases: ['fintrack-main-qa.vercel.app'],
    productionDomain: 'fintrack-eta-silk.vercel.app',
  }
  const ready = {
    id: 'dpl_fixture', readyState: 'READY', target: null,
    project: { id: expected.projectId }, url: expected.hostname,
    meta: { githubCommitSha: mainSha, gitTreeSha: mainTree, fintrackPreviewMode: 'MAIN_QA', githubCommitRef: 'HEAD' },
  }
  assert.equal(assertMainQaPreviewDeployment(ready, expected), true)
  assert.equal(assertMainQaPreviewDeployment({ ...ready, target: 'preview', projectId: expected.projectId, project: undefined, meta: { ...ready.meta, githubCommitRef: 'main' } }, expected), true)
  for (const bad of [
    { ...ready, readyState: 'CANCELED' }, { ...ready, target: 'production' },
    { ...ready, projectId: 'prj_other' },
    { ...ready, meta: { ...ready.meta, githubCommitSha: 'd'.repeat(40) } },
    { ...ready, meta: { ...ready.meta, gitTreeSha: 'e'.repeat(40) } },
    { ...ready, meta: { ...ready.meta, githubCommitRef: 'codex/old-branch' } },
    { ...ready, meta: { ...ready.meta, fintrackPreviewMode: undefined } },
    { ...ready, meta: { ...ready.meta, githubPullRequest: '63' } },
  ]) assert.throws(() => assertMainQaPreviewDeployment(bad, expected))
  assert.throws(() => assertMainQaPreviewDeployment(ready, { ...expected, aliases: ['fintrack-eta-silk.vercel.app'] }), /Production domain/)
  assert.throws(() => assertMainQaPreviewDeployment(ready, { ...expected, aliases: null }), /did not return aliases/)
})

test('Preview workflow keeps MAIN_QA on main, behind preview approval, and uses only verified Preview deploy flags', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/v3-preview.yml', import.meta.url), 'utf8')
  assert.match(workflow, /mode:[\s\S]*?options:[\s\S]*?- pr[\s\S]*?- main_qa/)
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/)
  assert.match(workflow, /run: node scripts\/release\/continuous-publishing\.mjs main-qa/)
  assert.match(workflow, /environment: preview/)
  assert.match(workflow, /Revalidate current main HEAD,[\s\S]*?after environment approval/)
  assert.match(workflow, /FINTRACK_PREVIEW_BUILD_VERIFICATION=1/)
  assert.match(workflow, /FINTRACK_PREVIEW_EXPECTED_PROJECT_REF=\$PREVIEW_SUPABASE_PROJECT_REF/)
  assert.match(workflow, /FINTRACK_PREVIEW_PRODUCTION_PROJECT_REF=\$PRODUCTION_SUPABASE_PROJECT_REF/)
  assert.match(workflow, /verify-main-qa-preview-deployment/)
  const begin = workflow.indexOf('      - name: Build remotely')
  const end = workflow.indexOf('      - name: Verify deployment identity', begin)
  assert.ok(begin >= 0 && end > begin)
  const deployment = workflow.slice(begin, end)
  assert.match(deployment, /vercel deploy/)
  assert.match(deployment, /--target=preview/)
  assert.doesNotMatch(deployment, /--prod|--prebuilt/)
  assert.ok(workflow.indexOf('Revalidate current main HEAD') < workflow.indexOf('VERCEL_TOKEN: '))
})
