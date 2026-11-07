import fs from 'node:fs'

function deploymentProjectId(deployment) {
  const direct = deployment?.projectId ? String(deployment.projectId) : ''
  const nested = deployment?.project?.id ? String(deployment.project.id) : ''
  if (direct && nested && direct !== nested) throw new Error('Vercel deployment contains conflicting project IDs.')
  return direct || nested
}

export function assertStagedDeployment(deployment, expected) {
  if (!deployment || typeof deployment !== 'object') throw new Error('Vercel returned no deployment object.')
  if (deployment.readyState !== 'READY') throw new Error(`Deployment is not READY: ${deployment.readyState ?? 'unknown'}`)
  if (deployment.target !== 'production') throw new Error(`Deployment target is not Production: ${deployment.target ?? 'unknown'}`)
  if (deploymentProjectId(deployment) !== expected.projectId) throw new Error('Deployment belongs to a different Vercel project.')
  if (expected.deploymentId && deployment.id !== expected.deploymentId) throw new Error('Vercel deployment ID differs from the protected Stage evidence.')
  if (deployment.meta?.githubCommitSha !== expected.releaseSha) throw new Error('Deployment Git SHA does not match the approved release SHA.')
  if (deployment.meta?.gitTreeSha !== expected.treeSha) throw new Error('Deployment Git tree does not match the approved release tree.')
  if (String(deployment.meta?.githubPullRequest) !== String(expected.sourcePrNumber)) throw new Error('Deployment source PR does not match the approved release evidence.')
  if (deployment.url !== expected.url) throw new Error('Vercel returned a different deployment URL.')
  return true
}

function requireValue(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

async function main() {
  const token = requireValue('VERCEL_TOKEN')
  const projectId = requireValue('VERCEL_PROJECT_ID')
  const teamId = requireValue('VERCEL_ORG_ID')
  const releaseSha = requireValue('RELEASE_SHA')
  const treeSha = requireValue('RELEASE_TREE_SHA')
  const sourcePrNumber = requireValue('SOURCE_PR_NUMBER')
  const deploymentId = process.env.EXPECTED_DEPLOYMENT_ID?.trim()
  const url = requireValue('DEPLOYMENT_URL')

  if (!/^[0-9a-f]{40}$/.test(releaseSha)) throw new Error('RELEASE_SHA must be a full commit SHA.')
  if (!/^[0-9a-f]{40}$/.test(treeSha)) throw new Error('RELEASE_TREE_SHA must be a full Git tree SHA.')
  if (!/^[0-9]+$/.test(sourcePrNumber)) throw new Error('SOURCE_PR_NUMBER must be numeric.')
  const parsedUrl = new URL(url)
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.vercel.app') || parsedUrl.pathname !== '/') {
    throw new Error('DEPLOYMENT_URL must be a Vercel deployment hostname without a path.')
  }

  const endpoint = new URL(`https://api.vercel.com/v13/deployments/${encodeURIComponent(parsedUrl.hostname)}`)
  endpoint.searchParams.set('projectId', projectId)
  endpoint.searchParams.set('teamId', teamId)
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`Vercel deployment lookup failed with HTTP ${response.status}.`)
  const deployment = await response.json()
  assertStagedDeployment(deployment, { projectId, deploymentId, releaseSha, treeSha, sourcePrNumber, url: parsedUrl.hostname })
  const outputPath = process.env.GITHUB_OUTPUT
  if (outputPath) fs.appendFileSync(outputPath, `deployment_id=${deployment.id}\n`)
  process.stdout.write(`Verified staged Production deployment for ${releaseSha} and tree ${treeSha}: ${parsedUrl.hostname}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
