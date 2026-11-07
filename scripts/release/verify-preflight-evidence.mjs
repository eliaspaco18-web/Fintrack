import fs from 'node:fs'
import { TRUSTED_RELEASE_OWNER_ACTOR_ID } from './continuous-publishing.mjs'

function fail(message) {
  throw new Error(message)
}

export function assertReleasePreflightEvidence(manifest, expected) {
  if (!manifest || typeof manifest !== 'object') fail('Release preflight evidence is missing or malformed.')
  if (manifest.release_sha !== expected.releaseSha) fail('Release preflight evidence belongs to a different release SHA.')
  if (manifest.tree_sha !== expected.treeSha) fail('Release preflight evidence belongs to a different release tree.')
  if (manifest.preflight_workflow_run_id !== String(expected.runId)) fail('Preflight evidence is not bound to the supplied workflow run.')
  if (!/^[0-9]+$/.test(String(manifest.source_pr_number ?? '')) || !/^[0-9]+$/.test(String(manifest.ci_run_id ?? ''))) {
    fail('Release preflight evidence is missing its source PR or exact-head CI reference.')
  }
  if (!/^[0-9a-f]{40}$/.test(String(manifest.source_head_sha ?? ''))) fail('Release preflight evidence has no valid reviewed PR head SHA.')
  if (!['independent-review', 'repository-owner'].includes(manifest.authorization_method)) fail('Release preflight evidence has no valid authorization method.')
  if (manifest.authorization_method === 'repository-owner' && String(manifest.authorized_actor_id) !== TRUSTED_RELEASE_OWNER_ACTOR_ID) {
    fail('Release preflight owner authorization does not match the registered repository owner.')
  }
  if (manifest.authorization_method === 'independent-review' && manifest.authorized_actor_id) fail('Independent-review evidence must not claim an owner actor authorization.')
  if (typeof manifest.reviewed_head_tree_matches_release !== 'boolean') fail('Release preflight evidence does not state whether the reviewed tree matched the release tree.')
  if (manifest.result === 'exact-pr-ci-reused') {
    if (manifest.reviewed_head_tree_matches_release !== true || String(manifest.release_ci_run_id ?? '') !== String(manifest.ci_run_id)) {
      fail('CI reuse requires a successful exact-tree Release Candidate CI run.')
    }
  } else if (manifest.result === 'full-post-merge-suite-passed') {
    if (manifest.release_ci_run_id && !/^[0-9]+$/.test(String(manifest.release_ci_run_id))) fail('Full preflight contains an invalid optional reusable CI run reference.')
  } else {
    fail('Release preflight result is not a recognized successful verification mode.')
  }
  return true
}

async function main() {
  const [manifestPath, releaseSha, treeSha, runId] = process.argv.slice(2)
  const localOnly = process.argv[6] === '--local-only'
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  if (!manifestPath || !/^[0-9a-f]{40}$/.test(releaseSha ?? '') || !/^[0-9a-f]{40}$/.test(treeSha ?? '') || !/^[0-9]+$/.test(runId ?? '')) {
    fail('Usage: verify-preflight-evidence.mjs <manifest.json> <release-sha> <tree-sha> <run-id> (with GitHub API access unless --local-only).')
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assertReleasePreflightEvidence(manifest, { releaseSha, treeSha, runId })
  if (localOnly) {
    process.stdout.write(`Release preflight manifest is internally consistent for ${releaseSha}.\n`)
    return
  }
  if (!repository || !token) fail('GITHUB_REPOSITORY and GITHUB_TOKEN are required to verify the protected preflight run.')
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${runId}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
  })
  if (!response.ok) fail(`GitHub preflight run lookup failed with HTTP ${response.status}.`)
  const run = await response.json()
  if (String(run.path ?? '').split('@')[0] !== '.github/workflows/production-preflight.yml' || run.head_branch !== 'main' || run.head_sha !== releaseSha || run.event !== 'workflow_dispatch' || run.status !== 'completed' || run.conclusion !== 'success') {
    fail('The supplied preflight run is not a successful workflow_dispatch on main for the exact release SHA.')
  }
  const outputPath = process.env.GITHUB_OUTPUT
  if (outputPath) fs.appendFileSync(outputPath, `preflight_run_id=${runId}\nsource_pr_number=${manifest.source_pr_number}\nsource_head_sha=${manifest.source_head_sha}\nci_run_id=${manifest.ci_run_id}\nauthorization_method=${manifest.authorization_method}\n`)
  process.stdout.write(`Verified completed release preflight run ${runId} for exact release SHA ${releaseSha}.\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
