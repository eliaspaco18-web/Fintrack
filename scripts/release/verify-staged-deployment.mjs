export function assertStagedDeployment(deployment, expected) {
  if (!deployment || typeof deployment !== 'object') throw new Error('Vercel returned no deployment object.')
  if (deployment.readyState !== 'READY') throw new Error(`Deployment is not READY: ${deployment.readyState ?? 'unknown'}`)
  if (deployment.target !== 'production') throw new Error(`Deployment target is not Production: ${deployment.target ?? 'unknown'}`)
  if (deployment.projectId !== expected.projectId) throw new Error('Deployment belongs to a different Vercel project.')
  if (deployment.meta?.githubCommitSha !== expected.releaseSha) throw new Error('Deployment Git SHA does not match the approved release SHA.')
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
  const url = requireValue('DEPLOYMENT_URL')

  if (!/^[0-9a-f]{40}$/.test(releaseSha)) throw new Error('RELEASE_SHA must be a full commit SHA.')
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
  assertStagedDeployment(deployment, { projectId, releaseSha, url: parsedUrl.hostname })
  process.stdout.write(`Verified staged Production deployment for ${releaseSha}: ${parsedUrl.hostname}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
