import fs from 'node:fs'
import { TRUSTED_RELEASE_OWNER_ACTOR_ID } from './continuous-publishing.mjs'

function fail(message) {
  throw new Error(message)
}

export function assertStageEvidence(manifest, expected) {
  if (!manifest || typeof manifest !== 'object') fail('Stage evidence is missing or malformed.')
  if (manifest.release_sha !== expected.releaseSha) fail('Stage evidence belongs to a different release SHA.')
  if (manifest.tree_sha !== expected.treeSha) fail('Stage evidence belongs to a different Git tree.')
  if (manifest.production_base_sha !== expected.productionBaseSha) fail('Stage evidence was classified against a different Production baseline.')
  if (!['code-only', 'migration'].includes(manifest.change_type)) fail('Stage evidence has an invalid change classification.')
  if (!['standard', 'elevated'].includes(manifest.risk_level)) fail('Stage evidence has an invalid risk classification.')
  if (manifest.stage_workflow_run_id !== String(expected.stageRunId)) fail('Stage evidence is not bound to the supplied protected Stage run.')
  if (!/^[0-9]+$/.test(String(manifest.migration_evidence_run_id ?? ''))) fail('Stage evidence has no migration ledger certification or apply run ID.')
  if (!/^[0-9]+$/.test(String(manifest.preflight_workflow_run_id ?? ''))) fail('Stage evidence has no successful exact-SHA release preflight run ID.')
  if (!/^[0-9]+$/.test(String(manifest.source_pr_number ?? '')) || !/^[0-9]+$/.test(String(manifest.ci_run_id ?? ''))) {
    fail('Stage evidence is missing its source PR or CI run reference.')
  }
  if (!['independent-review', 'repository-owner'].includes(manifest.authorization_method)) fail('Stage evidence has no valid authorization method.')
  if (manifest.authorization_method === 'repository-owner' && String(manifest.authorized_actor_id) !== TRUSTED_RELEASE_OWNER_ACTOR_ID) {
    fail('Stage owner-authorization evidence does not match the registered repository owner.')
  }
  if (manifest.authorization_method === 'independent-review' && manifest.authorized_actor_id) fail('Independent-review evidence must not claim an owner actor authorization.')
  if (!/^prj_[A-Za-z0-9]+$/.test(String(manifest.vercel_project_id ?? ''))) fail('Stage evidence has an invalid Vercel project ID.')
  if (manifest.deployment_ready_state !== 'READY' || manifest.deployment_target !== 'production') fail('Stage deployment was not verified READY for the protected Production staging target.')
  if (manifest.cron_jobs_disabled_confirmation !== true) fail('Stage evidence lacks the explicit Cron-disabled confirmation.')
  const deploymentUrl = new URL(manifest.deployment_url)
  if (deploymentUrl.protocol !== 'https:' || deploymentUrl.pathname !== '/' || !deploymentUrl.hostname.endsWith('.vercel.app')) {
    fail('Stage evidence has an invalid Vercel deployment URL.')
  }
  if (!/^[A-Za-z0-9_-]{5,}$/.test(String(manifest.vercel_deployment_id ?? ''))) fail('Stage evidence has no Vercel deployment ID.')
  return true
}

async function main() {
  const [manifestPath, releaseSha, treeSha, stageRunId] = process.argv.slice(2)
  const localOnly = process.argv[6] === '--local-only'
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  const productionBaseSha = process.env.PRODUCTION_BASE_SHA
  if (!manifestPath || !/^[0-9a-f]{40}$/.test(releaseSha ?? '') || !/^[0-9a-f]{40}$/.test(treeSha ?? '') || !/^[0-9a-f]{40}$/.test(productionBaseSha ?? '') || !/^[0-9]+$/.test(stageRunId ?? '')) {
    fail('Usage: verify-stage-evidence.mjs <manifest.json> <release-sha> <tree-sha> <stage-run-id> (with PRODUCTION_BASE_SHA).')
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assertStageEvidence(manifest, { releaseSha, treeSha, productionBaseSha, stageRunId })
  if (localOnly) {
    process.stdout.write(`Stage evidence manifest is internally consistent for ${releaseSha}; the completed run will be verified at Promotion.\n`)
    return
  }
  if (!repository || !token) fail('GITHUB_REPOSITORY and GITHUB_TOKEN are required to verify the protected Stage run.')
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${stageRunId}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
  })
  if (!response.ok) fail(`GitHub Stage run lookup failed with HTTP ${response.status}.`)
  const run = await response.json()
  if (String(run.path ?? '').split('@')[0] !== '.github/workflows/production-stage.yml' || run.head_branch !== 'main' || run.head_sha !== releaseSha || run.status !== 'completed' || run.conclusion !== 'success') {
    fail('The supplied Stage run is not a successful protected run for the exact main SHA.')
  }
  const outputPath = process.env.GITHUB_OUTPUT
  if (outputPath) fs.appendFileSync(outputPath, `deployment_url=${manifest.deployment_url}\ndeployment_id=${manifest.vercel_deployment_id}\ntree_sha=${manifest.tree_sha}\nproduction_base_sha=${manifest.production_base_sha}\nchange_type=${manifest.change_type}\nrisk_level=${manifest.risk_level}\nsource_pr_number=${manifest.source_pr_number}\nauthorization_method=${manifest.authorization_method}\nauthorized_actor_id=${manifest.authorized_actor_id ?? ''}\npreflight_run_id=${manifest.preflight_workflow_run_id}\n`)
  process.stdout.write(`Verified Stage artifact and successful protected run ${stageRunId} for ${releaseSha}.\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
