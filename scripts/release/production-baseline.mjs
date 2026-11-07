const OFFICIAL_PRODUCTION_DOMAIN = 'fintrack-eta-silk.vercel.app'

function fail(message) {
  throw new Error(message)
}

export function vercelDeploymentProjectId(deployment) {
  const direct = deployment?.projectId ? String(deployment.projectId) : ''
  const nested = deployment?.project?.id ? String(deployment.project.id) : ''
  if (direct && nested && direct !== nested) fail('Vercel deployment contains conflicting project IDs.')
  return direct || nested
}

async function request(url, token, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) fail(`Vercel read request failed with HTTP ${response.status}.`)
  return response.json()
}

export async function resolveProductionBaseline({ projectId, teamId, token, domain = OFFICIAL_PRODUCTION_DOMAIN, fetchImpl = fetch }) {
  if (!/^prj_[A-Za-z0-9]+$/.test(projectId ?? '') || !/^team_[A-Za-z0-9]+$/.test(teamId ?? '') || !token) {
    fail('A valid Vercel project, team and token are required to resolve the active Production deployment.')
  }
  const listUrl = new URL('https://api.vercel.com/v7/deployments')
  listUrl.searchParams.set('projectId', projectId)
  listUrl.searchParams.set('teamId', teamId)
  listUrl.searchParams.set('target', 'production')
  listUrl.searchParams.set('state', 'READY')
  listUrl.searchParams.set('limit', '50')
  const list = await request(listUrl, token, fetchImpl)
  const deployments = Array.isArray(list.deployments) ? list.deployments : []
  for (const candidate of deployments) {
    if (candidate.state !== 'READY' || candidate.target !== 'production' || vercelDeploymentProjectId(candidate) !== projectId) continue
    const id = candidate.uid ?? candidate.id
    if (!id) continue
    const aliasesUrl = new URL(`https://api.vercel.com/v2/deployments/${encodeURIComponent(id)}/aliases`)
    aliasesUrl.searchParams.set('teamId', teamId)
    const aliasResponse = await request(aliasesUrl, token, fetchImpl)
    if (!(aliasResponse.aliases ?? []).some(alias => alias.alias === domain)) continue

    const detailUrl = new URL(`https://api.vercel.com/v13/deployments/${encodeURIComponent(id)}`)
    detailUrl.searchParams.set('projectId', projectId)
    detailUrl.searchParams.set('teamId', teamId)
    const deployment = await request(detailUrl, token, fetchImpl)
    if (vercelDeploymentProjectId(deployment) !== projectId || deployment.readyState !== 'READY' || deployment.target !== 'production') {
      fail('Official Production alias did not resolve to a READY deployment in the approved Vercel project.')
    }
    const releaseSha = String(deployment.meta?.githubCommitSha ?? '')
    if (!/^[0-9a-f]{40}$/.test(releaseSha)) fail('Active Production deployment has no verifiable GitHub commit SHA metadata.')
    return {
      releaseSha,
      deploymentId: deployment.id ?? id,
      deploymentUrl: `https://${deployment.url}`,
      domain,
      projectId,
    }
  }
  fail('Could not resolve the official Production domain to an active READY deployment in the approved project.')
}

async function main() {
  const result = await resolveProductionBaseline({
    projectId: process.env.VERCEL_PROJECT_ID,
    teamId: process.env.VERCEL_ORG_ID,
    token: process.env.VERCEL_TOKEN,
  })
  const outputPath = process.env.GITHUB_OUTPUT
  if (outputPath) {
    const lines = [`production_base_sha=${result.releaseSha}`, `production_base_deployment_id=${result.deploymentId}`, `production_domain=${result.domain}`]
    const fs = await import('node:fs')
    fs.appendFileSync(outputPath, `${lines.join('\n')}\n`)
  }
  process.stdout.write(`Resolved active Production baseline ${result.releaseSha} from READY Vercel deployment ${result.deploymentId}.\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
