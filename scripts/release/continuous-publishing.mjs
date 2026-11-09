import fs from 'node:fs'
import { createHash } from 'node:crypto'

const GITHUB_API = 'https://api.github.com'
const RELEASE_CI_PATH = '.github/workflows/release-ci.yml'
const RELEASE_CI_NAME = 'Release Candidate CI (No Production Access)'
const PREVIEW_REMOTE_BUILD_COMMAND = 'node scripts/release/verify-preview-build-env.mjs && npm run build'
// GitHub account ID for the sole repository owner. Numeric IDs are stable if a login changes.
export const TRUSTED_RELEASE_OWNER_ACTOR_ID = '268006031'
const PREVIEW_ENV_ALLOWLIST = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_FINTRACK_V3_SHELL',
])

function fail(message) {
  throw new Error(message)
}

export function parseEnvironmentFile(text) {
  const values = new Map()
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, name] = match
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (values.has(name)) fail(`Preview environment contains duplicate variable ${name}.`)
    values.set(name, value)
  }
  return Object.fromEntries(values)
}

function decodeJwtClaims(value, name) {
  const parts = String(value ?? '').split('.')
  if (parts.length !== 3 || !parts[1]) fail(`${name} is not a verifiable project-scoped Supabase JWT.`)
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    fail(`${name} has an invalid JWT payload.`)
  }
}

export function assertPreviewSupabaseEnvironment(values, { previewProjectRef, productionProjectRef, shellFlag = '1' }) {
  if (!/^[a-z0-9]{20}$/.test(previewProjectRef ?? '')) fail('Preview Supabase project reference is missing or malformed.')
  if (!/^[a-z0-9]{20}$/.test(productionProjectRef ?? '')) fail('Production Supabase project reference is missing or malformed.')
  if (previewProjectRef === productionProjectRef) fail('Preview Supabase project must differ from Production.')

  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PROJECT_ID', 'SUPABASE_SERVICE_ROLE_KEY']
  for (const name of required) {
    if (!String(values?.[name] ?? '').trim()) fail(`Required Preview variable ${name} is missing.`)
  }

  let url
  try {
    url = new URL(values.NEXT_PUBLIC_SUPABASE_URL)
  } catch {
    fail('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.')
  }
  if (url.protocol !== 'https:' || url.hostname !== `${previewProjectRef}.supabase.co` || url.pathname !== '/') {
    fail('NEXT_PUBLIC_SUPABASE_URL does not match the isolated Preview Supabase project.')
  }
  if (url.hostname === `${productionProjectRef}.supabase.co`) fail('Production Supabase URL is forbidden in Preview.')
  if (values.SUPABASE_PROJECT_ID !== previewProjectRef) fail('SUPABASE_PROJECT_ID does not match the isolated Preview project.')

  if (String(values.NEXT_PUBLIC_SUPABASE_ANON_KEY).includes('.')) {
    const anonClaims = decodeJwtClaims(values.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (anonClaims.ref !== previewProjectRef || anonClaims.role !== 'anon') {
      fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is not an anon credential for the isolated Preview project.')
    }
  } else if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(values.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is not a supported Supabase public key format.')
  }
  // Vercel intentionally replaces Secret values with this marker in `pull`.
  // Require that behavior so the credential never enters the GitHub runner.
  // Its project binding and validity are checked from the protected remote
  // Preview build, where Vercel injects the Secret without exposing it.
  if (values.SUPABASE_SERVICE_ROLE_KEY !== '[SENSITIVE]') {
    fail('SUPABASE_SERVICE_ROLE_KEY must remain a non-retrievable Vercel Secret and cannot be materialized on the GitHub runner.')
  }
  if (shellFlag !== '1' || values.NEXT_PUBLIC_FINTRACK_V3_SHELL !== '1') fail('Preview must compile with the V3 shell enabled.')
  const unapprovedNames = Object.keys(values).filter(name => !PREVIEW_ENV_ALLOWLIST.has(name))
  if (unapprovedNames.length) {
    const names = unapprovedNames.sort().join(', ')
    fail(`Preview contains variables outside the QA-only allowlist (${names}); remove or separately classify them before Preview.`)
  }

  // The claim check gives a fast, non-disclosing project binding check. The
  // workflow also probes a non-data Auth settings endpoint using GET only so
  // opaque keys must be accepted by the QA project before build.
  return true
}

export function assertPreviewSupabaseCredentialProbe(status, keyName) {
  if (status < 200 || status >= 300) fail(`${keyName} was rejected by the isolated Preview Supabase project.`)
  return true
}

function parseVercelConfig(content, label) {
  try {
    return JSON.parse(String(content))
  } catch {
    fail(`${label} is missing or is not valid JSON.`)
  }
}

export function assertPreviewBuildBootstrap({
  candidateVercelConfig,
  trustedVercelConfig,
  candidateVerifier,
  trustedVerifier,
  candidateHasVercelTs = false,
}) {
  const trustedConfig = parseVercelConfig(trustedVercelConfig, 'Trusted main vercel.json')
  const candidateConfig = parseVercelConfig(candidateVercelConfig, 'Candidate vercel.json')
  if (trustedConfig.buildCommand !== PREVIEW_REMOTE_BUILD_COMMAND) {
    fail('Trusted main does not contain the approved Preview remote build command.')
  }
  if (candidateConfig.buildCommand !== PREVIEW_REMOTE_BUILD_COMMAND) {
    fail('Candidate is missing the approved Preview remote build command.')
  }
  if (candidateHasVercelTs) {
    fail('Candidate includes vercel.ts, which could override the verified vercel.json build command.')
  }
  if (typeof trustedVerifier !== 'string' || trustedVerifier.length === 0) {
    fail('Trusted main Preview build verifier is missing.')
  }
  if (typeof candidateVerifier !== 'string' || candidateVerifier.length === 0) {
    fail('Candidate Preview build verifier is missing.')
  }
  if (candidateVerifier !== trustedVerifier) {
    fail('Candidate Preview build verifier differs from trusted main.')
  }
  return true
}

export function previewSupabaseProbeHeaders(key) {
  const value = String(key ?? '')
  if (!value) fail('Preview Supabase API key is missing.')
  const headers = { apikey: value }
  // Opaque sb_* API keys are valid only in apikey. Legacy project JWT keys
  // retain the historical bearer form for credential compatibility checks.
  if (value.split('.').length === 3) headers.Authorization = `Bearer ${value}`
  return headers
}

export function authorizeReleaseAction({ expectedSha, ownerAuthorizedSha = '', actorId = '', independentApproval = false }) {
  if (ownerAuthorizedSha) {
    if (!/^[0-9a-f]{40}$/.test(String(expectedSha ?? '')) || ownerAuthorizedSha !== expectedSha) {
      fail('Owner authorization must repeat the exact full SHA being released.')
    }
    if (String(actorId) !== TRUSTED_RELEASE_OWNER_ACTOR_ID) {
      fail('Owner authorization was dispatched by an account that is not the registered repository owner.')
    }
    return { authorizationMethod: 'repository-owner', authorizedActorId: TRUSTED_RELEASE_OWNER_ACTOR_ID }
  }
  if (independentApproval) return { authorizationMethod: 'independent-review', authorizedActorId: '' }
  fail('An exact independent PR approval or explicit repository-owner SHA authorization is required.')
}

export function assertPromotionAuthorization({ releaseSha, stageAuthorizationMethod, ownerAuthorization = {} }) {
  if (stageAuthorizationMethod === 'repository-owner') {
    return authorizeReleaseAction({
      expectedSha: releaseSha,
      ownerAuthorizedSha: ownerAuthorization.ownerAuthorizedSha,
      actorId: ownerAuthorization.actorId,
    })
  }
  if (stageAuthorizationMethod === 'independent-review') {
    if (ownerAuthorization.ownerAuthorizedSha) {
      return authorizeReleaseAction({
        expectedSha: releaseSha,
        ownerAuthorizedSha: ownerAuthorization.ownerAuthorizedSha,
        actorId: ownerAuthorization.actorId,
      })
    }
    return { authorizationMethod: 'independent-review', authorizedActorId: '' }
  }
  fail('Promotion requires a verified Stage authorization method.')
}

function releaseAuthorizationFromReviews({ reviews, commitSha, authorLogin, ownerAuthorization }) {
  const reviewStates = latestReviewState(reviews).filter(review => review.commit_id === commitSha)
  if (reviewStates.some(review => review.state === 'CHANGES_REQUESTED')) {
    fail('A current review requests changes for the exact code SHA; authorization is blocked.')
  }
  const independentApproval = reviewStates.some(review => review.state === 'APPROVED' && review.user?.login !== authorLogin)
  return authorizeReleaseAction({
    expectedSha: ownerAuthorization?.expectedSha,
    ownerAuthorizedSha: ownerAuthorization?.ownerAuthorizedSha,
    actorId: ownerAuthorization?.actorId,
    independentApproval,
  })
}

function deploymentProjectId(deployment) {
  const direct = deployment?.projectId ? String(deployment.projectId) : ''
  const nested = deployment?.project?.id ? String(deployment.project.id) : ''
  if (direct && nested && direct !== nested) fail('Vercel deployment contains conflicting project IDs.')
  return direct || nested
}

export function githubMaskCommand(value) {
  return `::add-mask::${String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`
}

export function assertPreviewProjectProtection(project, expectedProjectId) {
  if (!project || project.id !== expectedProjectId) fail('Vercel project ID does not match the approved Preview project.')
  const enabled = project.ssoProtection?.enabled === true
  const scope = project.ssoProtection?.deploymentType
  if (!enabled || !['all', 'all_except_custom_domains'].includes(scope)) {
    fail('Vercel Preview deployment protection must keep SSO enabled for generated deployment URLs.')
  }
  return true
}

export function assertPreviewDeployment(deployment, expected) {
  if (!deployment || typeof deployment !== 'object') fail('Vercel returned no deployment record.')
  if (deployment.readyState !== 'READY') fail(`Preview deployment did not reach READY (state: ${deployment.readyState ?? 'unknown'}).`)
  if (deployment.target !== null && deployment.target !== 'preview') {
    fail(`Deployment target is not an eligible Preview (target: ${deployment.target ?? 'unknown'}).`)
  }
  if (deploymentProjectId(deployment) !== expected.projectId) fail('Preview deployment belongs to a different Vercel project.')
  if (deployment.meta?.githubCommitSha !== expected.commitSha) fail('Preview deployment SHA does not match the approved PR head.')
  if (String(deployment.meta?.githubPullRequest) !== String(expected.pullRequestNumber)) fail('Preview deployment is not bound to the approved PR number.')
  if (deployment.meta?.gitTreeSha !== expected.treeSha) fail('Preview deployment tree does not match the approved PR tree.')
  if (expected.githubRepo && deployment.meta?.githubRepo !== expected.githubRepo) fail('Preview deployment repository metadata does not match the approved repository.')
  if (expected.githubOrg && deployment.meta?.githubOrg !== expected.githubOrg) fail('Preview deployment owner metadata does not match the approved repository.')
  const deploymentRef = deployment.meta?.githubCommitRef
  if (expected.headRef && deploymentRef !== expected.headRef && deploymentRef !== 'HEAD') {
    fail('Preview deployment branch metadata does not match the approved PR head.')
  }
  const hostname = String(deployment.url ?? '').replace(/^https:\/\//, '')
  if (!hostname.endsWith('.vercel.app') || hostname.includes('/') || hostname !== expected.hostname) {
    fail('Preview deployment hostname is invalid or does not match the deployed URL.')
  }
  const aliases = Array.isArray(expected.aliases) ? expected.aliases : (Array.isArray(deployment.alias) ? deployment.alias : null)
  if (!aliases) fail('Vercel did not return deployment aliases needed to distinguish Preview from Production.')
  if (aliases.some(alias => String(typeof alias === 'string' ? alias : alias?.alias).toLowerCase() === String(expected.productionDomain ?? '').toLowerCase())) {
    fail('A Preview deployment unexpectedly owns the official Production domain.')
  }
  return true
}

export function assertPreviewDeploymentProtectionResponse(response) {
  if (!response || typeof response.status !== 'number') fail('Could not verify Preview deployment access protection.')
  if ([401, 403].includes(response.status)) return true
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    let location
    try { location = new URL(response.headers?.get?.('location') ?? '') } catch { /* fail below */ }
    if (location?.hostname === 'vercel.com' && /(?:sso|login|auth)/i.test(location.pathname)) return true
  }
  fail('Unauthenticated access to the Preview URL was not blocked by Vercel authentication; SSO protection may be disabled.')
}

const SAFE_LOW_RISK_PATH = /^(?:docs\/|public\/|.*\.(?:md|mdx|css|scss|svg|png|jpe?g|webp|ico))$/i
const FINANCIAL_SENSITIVE_PATH = /^(?:app\/(?:api\/|.*(?:transactions?|receivables?|payables?|credits?|budgets?|accounts?|assets?|currency|exchange|finance|auth|supabase))|lib\/server\/|lib\/(?:supabase|finance|financial|currency|money|exchange-rate|transaction|receivable|payable|credit|budget|account)|modules\/|middleware\.(?:ts|js)$|supabase\/(?:functions|migrations)\/|components\/(?:transactions|forms|credits|receivables|payables|budgets|accounts|management)\/|types\/database\.types\.)/i

export function classifyReleaseFiles(paths) {
  const normalized = [...new Set((paths ?? []).map(path => String(path).replace(/^\.\//, '').replace(/\\/g, '/')))].sort()
  if (normalized.some(path => !path || path.startsWith('/') || path.split('/').includes('..'))) {
    fail('Release change list contains an invalid repository path.')
  }
  if (!normalized.length) fail('Cannot classify an empty release change set.')

  const migrationFiles = normalized
    .map(path => path.match(/^supabase\/migrations\/(\d{14})_[^/]+\.sql$/)?.[1])
    .filter(Boolean)
  const migrationRelated = normalized.some(path => /^supabase\/migrations\//i.test(path) || /^supabase\/config\.toml$/i.test(path) || /\.sql$/i.test(path))
  const changeType = migrationRelated ? 'migration' : 'code-only'
  const sensitive = migrationRelated || normalized.some(path => FINANCIAL_SENSITIVE_PATH.test(path) || !SAFE_LOW_RISK_PATH.test(path))
  const migrationIds = [...new Set(migrationFiles)].sort()

  if (migrationRelated && !migrationIds.length && !normalized.some(path => /^supabase\/config\.toml$/i.test(path))) {
    fail('Supabase or SQL changes must include versioned migration files; classify and review them before release.')
  }
  if (migrationIds.length !== migrationFiles.length) fail('Release contains duplicate migration version IDs.')

  return {
    changeType,
    riskLevel: sensitive ? 'elevated' : 'standard',
    financialSensitive: normalized.some(path => FINANCIAL_SENSITIVE_PATH.test(path)) || migrationRelated,
    migrationIds,
    paths: normalized,
  }
}

export function assertMigrationChangesAreAdditive(changes) {
  for (const change of changes ?? []) {
    const status = String(change.status ?? '')
    const path = String(change.path ?? '')
    if (/^supabase\/migrations\/\d{14}_[^/]+\.sql$/i.test(path) && status !== 'A') {
      fail(`Existing migration files are immutable; ${path} has status ${status || 'unknown'}.`)
    }
  }
  return true
}

export function assertMigrationEvidence(evidence, expected) {
  if (!evidence || typeof evidence !== 'object') fail('Migration evidence is missing or malformed.')
  if (evidence.release_sha !== expected.releaseSha) fail('Migration evidence belongs to a different release SHA.')
  if (evidence.tree_sha !== expected.treeSha) fail('Migration evidence belongs to a different release tree.')
  if (evidence.production_base_sha !== expected.productionBaseSha) fail('Migration evidence was certified against a different active Production baseline.')
  if (evidence.change_type !== expected.changeType) fail('Migration evidence type does not match the classified release change.')
  if (!['standard', 'elevated'].includes(evidence.risk_level)) fail('Migration evidence has no valid risk classification.')
  if (expected.riskLevel && evidence.risk_level !== expected.riskLevel) fail('Migration evidence risk classification does not match the release tree.')
  if (typeof expected.financialSensitive === 'boolean' && evidence.financial_sensitive !== expected.financialSensitive) {
    fail('Migration evidence financial-sensitivity classification does not match the release tree.')
  }
  if (!Array.isArray(evidence.migrations) || !Array.isArray(evidence.ledger_migrations)) fail('Migration evidence has no verified migration lists.')
  const ids = [...evidence.migrations].map(String).sort()
  const ledgerIds = [...evidence.ledger_migrations].map(String).sort()
  if (new Set(ids).size !== ids.length || ids.some(id => !/^\d{14}$/.test(id))) fail('Migration evidence contains invalid or duplicate migration IDs.')
  if (new Set(ledgerIds).size !== ledgerIds.length || ledgerIds.some(id => !/^\d{14}$/.test(id))) fail('Migration evidence ledger contains invalid or duplicate IDs.')
  if (evidence.ledger_migration_count !== ledgerIds.length || evidence.ledger_sha256 !== createHash('sha256').update(ledgerIds.join('\n')).digest('hex')) {
    fail('Migration evidence ledger count or digest is invalid.')
  }
  if (expected.changeType === 'code-only') {
    if (ids.length || evidence.result !== 'supabase-ledger-certified' || evidence.certification !== 'protected-production-migration-ledger' || evidence.db_push_executed !== false) {
      fail('Code-only releases require read-only ledger certification and must not run db push.')
    }
  } else {
    if (!ids.length) fail('Migration releases must bind at least one exact new migration ID.')
    const readOnlyCertified = evidence.result === 'supabase-ledger-certified' && evidence.certification === 'protected-production-migration-ledger' && evidence.db_push_executed === false
    const applied = evidence.result === 'supabase-db-push-succeeded' && evidence.db_push_executed === true
    if (!readOnlyCertified && !applied) {
      fail('Migration releases require a successful read-only ledger certification or explicitly approved migration apply record.')
    }
  }
  return true
}

function latestRun(runs, expectedSha) {
  const candidates = (runs ?? []).filter(run =>
    run.head_sha === expectedSha &&
    run.event === 'pull_request' &&
    (run.name === RELEASE_CI_NAME || String(run.path ?? '').split('@')[0] === RELEASE_CI_PATH),
  )
  candidates.sort((a, b) =>
    (Number(b.run_number) - Number(a.run_number)) ||
    (Number(b.run_attempt) - Number(a.run_attempt)) ||
    String(b.run_started_at ?? b.created_at ?? '').localeCompare(String(a.run_started_at ?? a.created_at ?? '')),
  )
  return candidates[0] ?? null
}

function latestReviewState(reviews) {
  const current = new Map()
  for (const review of reviews ?? []) {
    const login = review.user?.login
    if (!login || !review.submitted_at) continue
    const previous = current.get(login)
    if (!previous || String(review.submitted_at) > String(previous.submitted_at)) current.set(login, review)
  }
  return [...current.values()]
}

export function assertPreviewPrReady({ pr, reviews, workflowRuns, repository, pullRequestNumber, ownerAuthorization = {} }) {
  if (!pr || Number(pr.number) !== Number(pullRequestNumber)) fail('GitHub returned a different PR than the requested number.')
  if (pr.state !== 'open' || pr.merged_at) fail('Preview requires an open, unmerged pull request.')
  if (pr.draft) fail('Preview is available only after the pull request is marked ready for review.')
  if (pr.base?.ref !== 'main') fail('Preview pull request must target main.')
  if (pr.head?.repo?.full_name !== repository) fail('Preview does not accept forked or external-repository code.')
  const commitSha = String(pr.head?.sha ?? '')
  if (!/^[0-9a-f]{40}$/.test(commitSha)) fail('Pull request head SHA is missing or malformed.')

  const authorization = releaseAuthorizationFromReviews({
    reviews,
    commitSha,
    authorLogin: pr.user?.login,
    ownerAuthorization: { ...ownerAuthorization, expectedSha: commitSha },
  })

  const run = latestRun(workflowRuns, commitSha)
  if (!run || run.status !== 'completed' || run.conclusion !== 'success') {
    fail('The latest Release Candidate CI run for the exact PR head SHA is not successful.')
  }
  return {
    pullRequestNumber: Number(pr.number),
    commitSha,
    headRef: pr.head.ref,
    ciRunId: String(run.id),
    ...authorization,
  }
}

export function assertMergedReleaseProof({ pr, reviews, workflowRuns, repository, releaseSha, releaseTreeSha, ownerAuthorization = {} }) {
  if (!pr?.merged_at || pr.base?.ref !== 'main' || pr.base?.repo?.full_name !== repository || pr.head?.repo?.full_name !== repository) {
    fail('Release SHA must be associated with a merged same-repository pull request targeting main.')
  }
  if (pr.merge_commit_sha !== releaseSha) fail('Release SHA is not the exact merge or squash commit recorded for the merged PR.')
  const sourceHeadSha = String(pr.head?.sha ?? '')
  if (!/^[0-9a-f]{40}$/.test(sourceHeadSha)) fail('Merged PR source head SHA is missing or malformed.')
  if (pr.draft) fail('A draft pull request cannot provide release evidence.')
  const authorization = releaseAuthorizationFromReviews({
    reviews,
    commitSha: sourceHeadSha,
    authorLogin: pr.user?.login,
    ownerAuthorization: { ...ownerAuthorization, expectedSha: releaseSha },
  })
  const run = latestRun(workflowRuns, sourceHeadSha)
  if (!run || run.status !== 'completed' || run.conclusion !== 'success') fail('Release Candidate CI did not pass for the exact merged PR source head SHA.')
  if (!/^[0-9a-f]{40}$/.test(String(releaseTreeSha ?? ''))) {
    fail('Release tree SHA is missing or malformed.')
  }
  return {
    sourcePullRequestNumber: Number(pr.number),
    sourceSha: sourceHeadSha,
    releaseSha,
    treeSha: releaseTreeSha,
    ciRunId: String(run.id),
    ...authorization,
  }
}

async function githubRequest(path, token, fetchImpl = fetch) {
  const response = await fetchImpl(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) fail(`GitHub read request failed with HTTP ${response.status}.`)
  return response.json()
}

async function githubList(path, token, fetchImpl = fetch) {
  const values = []
  let url = new URL(`${GITHUB_API}${path}`)
  for (let page = 0; page < 20; page++) {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!response.ok) fail(`GitHub read request failed with HTTP ${response.status}.`)
    const pageValue = await response.json()
    if (!Array.isArray(pageValue)) fail('GitHub returned an invalid list response.')
    values.push(...pageValue)
    const link = response.headers?.get?.('link') ?? ''
    const nextLink = link.split(',').map(part => part.trim()).find(part => /rel="next"/.test(part))
    if (!nextLink) return values
    const match = nextLink.match(/<([^>]+)>/)
    if (!match) fail('GitHub returned a malformed pagination link.')
    url = new URL(match[1])
  }
  fail('GitHub pagination exceeded its safety limit.')
}

export async function resolvePreviewPr({ repository, pullRequestNumber, token, ownerAuthorization = {}, fetchImpl = fetch }) {
  const [pr, reviews, workflow] = await Promise.all([
    githubRequest(`/repos/${repository}/pulls/${pullRequestNumber}`, token, fetchImpl),
    githubList(`/repos/${repository}/pulls/${pullRequestNumber}/reviews?per_page=100`, token, fetchImpl),
    githubRequest(`/repos/${repository}/actions/workflows/release-ci.yml`, token, fetchImpl),
  ])
  if (workflow.path !== RELEASE_CI_PATH || workflow.state !== 'active' || !workflow.id) {
    fail('The expected read-only Release Candidate CI workflow is not active.')
  }
  const workflowRuns = await githubRequest(`/repos/${repository}/actions/workflows/${workflow.id}/runs?head_sha=${pr.head?.sha}&event=pull_request&per_page=100`, token, fetchImpl)
  const candidate = assertPreviewPrReady({
    pr,
    reviews,
    workflowRuns: workflowRuns.workflow_runs,
    repository,
    pullRequestNumber,
    ownerAuthorization,
  })
  const commit = await githubRequest(`/repos/${repository}/commits/${candidate.commitSha}`, token, fetchImpl)
  candidate.treeSha = commit.commit?.tree?.sha ?? ''
  if (!/^[0-9a-f]{40}$/.test(candidate.treeSha)) fail('GitHub did not return a verifiable tree SHA for the PR head.')
  return candidate
}

export async function findSuccessfulCiForMergedTree({ repository, releaseSha, releaseTreeSha, token, ownerAuthorization = {}, fetchImpl = fetch }) {
  const pullRequests = await githubRequest(`/repos/${repository}/commits/${releaseSha}/pulls?per_page=100`, token, fetchImpl)
  const mergedPr = (pullRequests ?? []).find(pr =>
    pr.merged_at && pr.base?.ref === 'main' && pr.base?.repo?.full_name === repository && pr.head?.repo?.full_name === repository,
  )
  if (!mergedPr?.head?.sha || !mergedPr.number) return { reusable: false, reason: 'no-associated-merged-main-pr' }
  if (mergedPr.merge_commit_sha !== releaseSha) return { reusable: false, reason: 'release-sha-is-not-the-associated-merge-commit' }

  const [workflow, prCommit, reviews] = await Promise.all([
    githubRequest(`/repos/${repository}/actions/workflows/release-ci.yml`, token, fetchImpl),
    githubRequest(`/repos/${repository}/commits/${mergedPr.head.sha}`, token, fetchImpl),
    githubList(`/repos/${repository}/pulls/${mergedPr.number}/reviews?per_page=100`, token, fetchImpl),
  ])
  if (workflow.path !== RELEASE_CI_PATH || workflow.state !== 'active' || !workflow.id) {
    return { reusable: false, reason: 'release-ci-workflow-not-active' }
  }
  const runList = await githubRequest(`/repos/${repository}/actions/workflows/${workflow.id}/runs?head_sha=${mergedPr.head.sha}&event=pull_request&per_page=100`, token, fetchImpl)
  const run = latestRun(runList.workflow_runs, mergedPr.head.sha)
  if (prCommit.commit?.tree?.sha !== releaseTreeSha) return { reusable: false, reason: 'tree-sha-mismatch' }
  if (!run || run.status !== 'completed' || run.conclusion !== 'success') return { reusable: false, reason: 'release-ci-not-successful-for-tree' }
  let proof
  try {
    proof = assertMergedReleaseProof({
      pr: mergedPr,
      reviews,
      workflowRuns: runList.workflow_runs,
      repository,
      releaseSha,
      releaseTreeSha,
      ownerAuthorization,
    })
  } catch (error) {
    return { reusable: false, reason: error instanceof Error ? error.message : 'missing-pr-review-proof' }
  }
  return {
    reusable: true,
    ...proof,
    pullRequestNumber: proof.sourcePullRequestNumber,
    prHeadSha: proof.sourceSha,
    ciRunId: proof.ciRunId,
  }
}

export async function resolveMergedReleaseProof({ repository, releaseSha, releaseTreeSha, token, ownerAuthorization = {}, fetchImpl = fetch }) {
  if (!/^[0-9a-f]{40}$/.test(releaseSha ?? '') || !/^[0-9a-f]{40}$/.test(releaseTreeSha ?? '')) {
    fail('Release SHA and tree SHA must be full Git object IDs.')
  }
  const prs = await githubList(`/repos/${repository}/commits/${releaseSha}/pulls?per_page=100`, token, fetchImpl)
  const pr = prs.find(candidate => candidate.merged_at && candidate.base?.ref === 'main' &&
    candidate.base?.repo?.full_name === repository && candidate.head?.repo?.full_name === repository)
  if (!pr) fail('No merged same-repository PR to main was found for the release SHA.')
  if (pr.merge_commit_sha !== releaseSha) fail('The release SHA is not the exact merge commit associated with its source PR.')
  const [workflow, sourceCommit, releaseCommit, reviews] = await Promise.all([
    githubRequest(`/repos/${repository}/actions/workflows/release-ci.yml`, token, fetchImpl),
    githubRequest(`/repos/${repository}/commits/${pr.head.sha}`, token, fetchImpl),
    githubRequest(`/repos/${repository}/commits/${releaseSha}`, token, fetchImpl),
    githubList(`/repos/${repository}/pulls/${pr.number}/reviews?per_page=100`, token, fetchImpl),
  ])
  if (workflow.path !== RELEASE_CI_PATH || workflow.state !== 'active' || !workflow.id) {
    fail('The expected read-only Release Candidate CI workflow is not active.')
  }
  if (releaseCommit.commit?.tree?.sha !== releaseTreeSha) fail('The checked-out release SHA does not match the GitHub release commit tree.')
  const runList = await githubRequest(`/repos/${repository}/actions/workflows/${workflow.id}/runs?head_sha=${pr.head.sha}&event=pull_request&per_page=100`, token, fetchImpl)
  const proof = assertMergedReleaseProof({
    pr,
    reviews,
    workflowRuns: runList.workflow_runs,
    repository,
    releaseSha,
    releaseTreeSha,
    ownerAuthorization,
  })
  return {
    ...proof,
    releaseTreeSha,
    sourceTreeSha: sourceCommit.commit?.tree?.sha ?? '',
    treeMatchesReviewedHead: sourceCommit.commit?.tree?.sha === releaseTreeSha,
    reusable: true,
  }
}


export function assertMainQaWorkflowContext({
  repository,
  workflowRef,
  eventName,
  dispatchSha,
  currentMainSha,
  ownerAuthorizedSha,
  actorId,
}) {
  if (repository !== 'eliaspaco18-web/Fintrack') fail('MAIN_QA is available only for the FinTrack repository.')
  if (workflowRef !== 'refs/heads/main' || eventName !== 'workflow_dispatch') {
    fail('MAIN_QA can run only from workflow_dispatch on the protected main branch.')
  }
  if (!/^[0-9a-f]{40}$/.test(String(currentMainSha ?? ''))) fail('GitHub returned an invalid main HEAD SHA.')
  if (dispatchSha !== currentMainSha) fail('The workflow dispatch SHA is not the current main HEAD.')
  if (ownerAuthorizedSha !== currentMainSha) fail('Owner authorization must match the exact current main HEAD SHA.')
  return authorizeReleaseAction({
    expectedSha: currentMainSha,
    ownerAuthorizedSha,
    actorId,
  })
}

export async function resolveMainQaPreview({
  repository,
  ownerAuthorizedSha,
  workflowRef,
  eventName,
  dispatchSha,
  actorId,
  token,
  expected = {},
  fetchImpl = fetch,
}) {
  if (!String(token ?? '').trim()) fail('GitHub token is required to verify MAIN_QA release evidence.')

  async function readMainHead() {
    const ref = await githubRequest('/repos/' + repository + '/git/ref/heads/main', token, fetchImpl)
    if (ref.ref !== 'refs/heads/main' || ref.object?.type !== 'commit') {
      fail('GitHub did not return the canonical main commit reference.')
    }
    const sha = String(ref.object?.sha ?? '')
    if (!/^[0-9a-f]{40}$/.test(sha)) fail('GitHub main HEAD SHA is missing or malformed.')
    return sha
  }

  const currentMainSha = await readMainHead()
  const authorization = assertMainQaWorkflowContext({
    repository,
    workflowRef,
    eventName,
    dispatchSha,
    currentMainSha,
    ownerAuthorizedSha,
    actorId,
  })

  const mainCommit = await githubRequest('/repos/' + repository + '/commits/' + currentMainSha, token, fetchImpl)
  if (mainCommit.sha !== currentMainSha) fail('GitHub returned a different commit than current main HEAD.')
  const treeSha = String(mainCommit.commit?.tree?.sha ?? '')
  if (!/^[0-9a-f]{40}$/.test(treeSha)) fail('GitHub did not return a verifiable main tree SHA.')

  const proof = await resolveMergedReleaseProof({
    repository,
    releaseSha: currentMainSha,
    releaseTreeSha: treeSha,
    token,
    ownerAuthorization: { ownerAuthorizedSha, actorId },
    fetchImpl,
  })
  if (!proof.treeMatchesReviewedHead || proof.sourceTreeSha !== treeSha) {
    fail('Release Candidate CI does not cover the exact integrated main tree.')
  }

  const checks = [
    ['commitSha', currentMainSha],
    ['treeSha', treeSha],
    ['ciRunId', proof.ciRunId],
    ['pullRequestNumber', String(proof.sourcePullRequestNumber)],
    ['sourceSha', proof.sourceSha],
  ]
  for (const [name, actual] of checks) {
    if (expected[name] !== undefined && String(expected[name]) !== String(actual)) {
      fail('MAIN_QA release evidence changed after Preview approval.')
    }
  }

  const mainShaAfterChecks = await readMainHead()
  if (mainShaAfterChecks !== currentMainSha) {
    fail('main HEAD changed while MAIN_QA evidence was being verified.')
  }

  return {
    pullRequestNumber: proof.sourcePullRequestNumber,
    commitSha: currentMainSha,
    treeSha,
    ciRunId: proof.ciRunId,
    headRef: 'main',
    sourceSha: proof.sourceSha,
    authorizationMethod: authorization.authorizationMethod,
    authorizedActorId: authorization.authorizedActorId,
  }
}

async function vercelRequest(path, token, teamId, fetchImpl = fetch) {
  const url = new URL(`https://api.vercel.com${path}`)
  if (teamId) url.searchParams.set('teamId', teamId)
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) fail(`Vercel read request failed with HTTP ${response.status}.`)
  return response.json()
}


export function assertMainQaPreviewDeployment(deployment, expected) {
  if (!deployment || typeof deployment !== 'object') fail('Vercel returned no MAIN_QA deployment record.')
  if (deployment.readyState !== 'READY') fail('MAIN_QA Preview deployment did not reach READY.')
  if (deployment.target !== null && deployment.target !== 'preview') {
    fail('MAIN_QA deployment target is not Preview.')
  }
  if (deploymentProjectId(deployment) !== expected.projectId) fail('MAIN_QA deployment belongs to a different Vercel project.')
  if (deployment.meta?.githubCommitSha !== expected.commitSha) fail('MAIN_QA deployment SHA does not match current main.')
  if (deployment.meta?.gitTreeSha !== expected.treeSha) fail('MAIN_QA deployment tree does not match current main.')
  if (deployment.meta?.fintrackPreviewMode !== 'MAIN_QA') fail('Vercel deployment is not explicitly marked as MAIN_QA.')
  if (deployment.meta?.githubPullRequest) fail('MAIN_QA deployment unexpectedly contains PR metadata.')

  const deploymentRef = String(deployment.meta?.githubCommitRef ?? '')
  const normalizedRef = deploymentRef.startsWith('refs/heads/') ? deploymentRef.slice('refs/heads/'.length) : deploymentRef
  if (normalizedRef && !['main', 'HEAD'].includes(normalizedRef)) {
    fail('MAIN_QA deployment identifies a branch other than main or detached HEAD.')
  }

  const hostname = String(deployment.url ?? '').replace('https://', '')
  if (!hostname.endsWith('.vercel.app') || hostname.includes('/') || hostname !== expected.hostname) {
    fail('MAIN_QA Preview hostname is invalid or does not match the deployed URL.')
  }
  if (!Array.isArray(expected.aliases)) fail('Vercel did not return aliases needed to verify the MAIN_QA domain.')
  if (expected.aliases.some(alias =>
    String(typeof alias === 'string' ? alias : alias?.alias).toLowerCase() ===
    String(expected.productionDomain ?? '').toLowerCase(),
  )) {
    fail('MAIN_QA Preview unexpectedly owns the official Production domain.')
  }
  return true
}

export async function resolveAndVerifyVercelMainQaPreview({
  projectId,
  teamId,
  deploymentUrl,
  commitSha,
  treeSha,
  token,
  fetchImpl = fetch,
}) {
  if (!/^prj_[A-Za-z0-9]+$/.test(projectId ?? '') || !/^team_[A-Za-z0-9]+$/.test(teamId ?? '')) {
    fail('Vercel team or project ID is missing or malformed.')
  }
  const parsed = new URL(deploymentUrl)
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || !parsed.hostname.endsWith('.vercel.app')) {
    fail('MAIN_QA deployment URL must be a Vercel hostname without a path.')
  }
  const [project, deployment] = await Promise.all([
    vercelRequest('/v9/projects/' + encodeURIComponent(projectId), token, teamId, fetchImpl),
    vercelRequest('/v13/deployments/' + encodeURIComponent(parsed.hostname), token, teamId, fetchImpl),
  ])
  if (!deployment?.id) fail('Vercel MAIN_QA response has no deployment ID.')
  const aliasResponse = await vercelRequest('/v2/deployments/' + encodeURIComponent(deployment.id) + '/aliases', token, teamId, fetchImpl)
  const aliases = Array.isArray(aliasResponse.aliases) ? aliasResponse.aliases : null
  assertPreviewProjectProtection(project, projectId)
  assertMainQaPreviewDeployment(deployment, {
    projectId,
    commitSha,
    treeSha,
    hostname: parsed.hostname,
    aliases,
    productionDomain: 'fintrack-eta-silk.vercel.app',
  })
  return { deploymentId: deployment.id, url: parsed.origin, hostname: parsed.hostname, readyState: deployment.readyState }
}

export async function resolveAndVerifyVercelPreview({ projectId, teamId, deploymentUrl, commitSha, treeSha, headRef, pullRequestNumber, repository, token, fetchImpl = fetch }) {
  if (!/^prj_[A-Za-z0-9]+$/.test(projectId ?? '') || !/^team_[A-Za-z0-9]+$/.test(teamId ?? '')) {
    fail('Vercel team or project ID is missing or malformed.')
  }
  const parsed = new URL(deploymentUrl)
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || !parsed.hostname.endsWith('.vercel.app')) {
    fail('Preview deployment URL must be a Vercel hostname without a path.')
  }
  const [project, deployment] = await Promise.all([
    vercelRequest(`/v9/projects/${encodeURIComponent(projectId)}`, token, teamId, fetchImpl),
    vercelRequest(`/v13/deployments/${encodeURIComponent(parsed.hostname)}`, token, teamId, fetchImpl),
  ])
  if (!deployment?.id) fail('Vercel Preview response has no deployment ID.')
  const aliasResponse = await vercelRequest(`/v2/deployments/${encodeURIComponent(deployment.id)}/aliases`, token, teamId, fetchImpl)
  const aliases = Array.isArray(aliasResponse.aliases) ? aliasResponse.aliases : null
  const [githubOrg, githubRepo] = String(repository ?? '').split('/')
  assertPreviewProjectProtection(project, projectId)
  assertPreviewDeployment(deployment, {
    projectId,
    commitSha,
    treeSha,
    headRef,
    githubOrg,
    githubRepo,
    pullRequestNumber,
    hostname: parsed.hostname,
    aliases,
    productionDomain: 'fintrack-eta-silk.vercel.app',
  })
  return { deploymentId: deployment.id, url: parsed.origin, hostname: parsed.hostname, readyState: deployment.readyState }
}

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) fail(`${name} is required.`)
  return value
}

function appendOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) return
  const lines = Object.entries(values).map(([name, value]) => `${name}=${String(value).replace(/[\r\n]/g, '')}`)
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`)
}

async function main() {
  const mode = process.argv[2]
  const repository = requireEnv('GITHUB_REPOSITORY')
  const token = ['preview-pr', 'main-qa', 'merged-ci-tree', 'merged-release-proof'].includes(mode) ? requireEnv('GITHUB_TOKEN') : ''

  if (mode === 'main-qa') {
    const candidate = await resolveMainQaPreview({
      repository,
      ownerAuthorizedSha: requireEnv('OWNER_AUTHORIZED_SHA'),
      workflowRef: requireEnv('GITHUB_REF'),
      eventName: requireEnv('GITHUB_EVENT_NAME'),
      dispatchSha: requireEnv('GITHUB_SHA'),
      actorId: requireEnv('AUTHORIZED_ACTOR_ID'),
      token,
      expected: process.env.EXPECTED_SHA ? {
        commitSha: process.env.EXPECTED_SHA,
        treeSha: process.env.EXPECTED_TREE_SHA,
        ciRunId: process.env.EXPECTED_CI_RUN_ID,
        pullRequestNumber: process.env.EXPECTED_PULL_REQUEST_NUMBER,
        sourceSha: process.env.EXPECTED_SOURCE_SHA,
      } : {},
    })
    appendOutput(candidate)
    process.stdout.write('Approved MAIN_QA Preview: exact current main SHA, integrated PR, matching CI, and repository-owner authorization verified.\n')
    return
  }

  if (mode === 'preview-pr') {
    const candidate = await resolvePreviewPr({
      repository,
      pullRequestNumber: Number(requireEnv('PULL_REQUEST_NUMBER')),
      token,
      ownerAuthorization: {
        ownerAuthorizedSha: process.env.OWNER_AUTHORIZED_SHA ?? '',
        actorId: process.env.AUTHORIZED_ACTOR_ID ?? '',
      },
    })
    if (process.env.EXPECTED_SHA && candidate.commitSha !== process.env.EXPECTED_SHA) fail('PR head changed after Preview was queued; restart using the newly reviewed SHA.')
    if (process.env.EXPECTED_TREE_SHA && candidate.treeSha !== process.env.EXPECTED_TREE_SHA) fail('PR tree changed after Preview was queued; restart using the newly reviewed tree.')
    if (process.env.EXPECTED_CI_RUN_ID && candidate.ciRunId !== process.env.EXPECTED_CI_RUN_ID) fail('Latest successful CI evidence changed after Preview was queued; resolve it again.')
    appendOutput(candidate)
    process.stdout.write(`Approved Preview candidate: PR #${candidate.pullRequestNumber}, SHA ${candidate.commitSha}, CI run ${candidate.ciRunId}.\n`)
    return
  }

  if (mode === 'merged-ci-tree') {
    const candidate = await findSuccessfulCiForMergedTree({
      repository,
      releaseSha: requireEnv('RELEASE_SHA'),
      releaseTreeSha: requireEnv('RELEASE_TREE_SHA'),
      token,
      ownerAuthorization: {
        ownerAuthorizedSha: process.env.OWNER_AUTHORIZED_SHA ?? '',
        actorId: process.env.AUTHORIZED_ACTOR_ID ?? '',
      },
    })
    appendOutput(candidate)
    process.stdout.write(candidate.reusable
      ? `Reusing Release Candidate CI run ${candidate.ciRunId} for the exact release tree.\n`
      : `No reusable CI proof (${candidate.reason}); the caller must run the full post-merge suite.\n`)
    return
  }

  if (mode === 'merged-release-proof') {
    const proof = await resolveMergedReleaseProof({
      repository,
      releaseSha: requireEnv('RELEASE_SHA'),
      releaseTreeSha: requireEnv('RELEASE_TREE_SHA'),
      token,
      ownerAuthorization: {
        ownerAuthorizedSha: process.env.OWNER_AUTHORIZED_SHA ?? '',
        actorId: process.env.AUTHORIZED_ACTOR_ID ?? '',
      },
    })
    appendOutput(proof)
    process.stdout.write(`Verified merged PR #${proof.sourcePullRequestNumber}, exact release SHA/tree, ${proof.authorizationMethod} authorization, and CI run ${proof.ciRunId}.\n`)
    return
  }

  if (mode === 'promotion-authorization') {
    const authorization = assertPromotionAuthorization({
      releaseSha: requireEnv('RELEASE_SHA'),
      stageAuthorizationMethod: requireEnv('STAGE_AUTHORIZATION_METHOD'),
      ownerAuthorization: {
        ownerAuthorizedSha: process.env.OWNER_AUTHORIZED_SHA ?? '',
        actorId: process.env.AUTHORIZED_ACTOR_ID ?? '',
      },
    })
    appendOutput(authorization)
    process.stdout.write(`Promotion authorization verified via ${authorization.authorizationMethod}.\n`)
    return
  }

  if (mode === 'check-preview-environment') {
    const path = process.argv[3]
    if (!path) fail('Usage: continuous-publishing.mjs check-preview-environment <vercel-env-file>.')
    const values = parseEnvironmentFile(fs.readFileSync(path, 'utf8'))
    assertPreviewSupabaseEnvironment(values, {
      previewProjectRef: requireEnv('PREVIEW_SUPABASE_PROJECT_REF'),
      productionProjectRef: requireEnv('PRODUCTION_SUPABASE_PROJECT_REF'),
      shellFlag: values.NEXT_PUBLIC_FINTRACK_V3_SHELL,
    })
    const headers = previewSupabaseProbeHeaders(values.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const probe = await fetch(`${values.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { method: 'GET', headers, redirect: 'error' })
    assertPreviewSupabaseCredentialProbe(probe.status, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.stdout.write('Preview Supabase public variables are bound to the isolated QA project; the non-retrievable Secret will be verified inside the protected remote Preview build; V3 shell is enabled.\n')
    return
  }

  if (mode === 'verify-preview-build-bootstrap') {
    const candidateDirectory = process.argv[3]
    const trustedDirectory = process.argv[4]
    if (!candidateDirectory || !trustedDirectory) {
      fail('Usage: continuous-publishing.mjs verify-preview-build-bootstrap <candidate-directory> <trusted-main-directory>.')
    }
    const readRegularFile = (path, label) => {
      let metadata
      try {
        metadata = fs.lstatSync(path)
      } catch {
        fail(`${label} is missing from the candidate or trusted main checkout.`)
      }
      if (!metadata.isFile()) fail(`${label} must be a regular file; symlinks are not accepted.`)
      return fs.readFileSync(path, 'utf8')
    }
    let candidateHasVercelTs = false
    try {
      fs.lstatSync(`${candidateDirectory}/vercel.ts`)
      candidateHasVercelTs = true
    } catch (error) {
      if (error?.code !== 'ENOENT') fail('Could not verify whether the candidate contains a Vercel TypeScript config.')
    }
    assertPreviewBuildBootstrap({
      candidateVercelConfig: readRegularFile(`${candidateDirectory}/vercel.json`, 'Candidate vercel.json'),
      trustedVercelConfig: readRegularFile(`${trustedDirectory}/vercel.json`, 'Trusted main vercel.json'),
      candidateVerifier: readRegularFile(`${candidateDirectory}/scripts/release/verify-preview-build-env.mjs`, 'Candidate Preview build verifier'),
      trustedVerifier: readRegularFile(`${trustedDirectory}/scripts/release/verify-preview-build-env.mjs`, 'Trusted main Preview build verifier'),
      candidateHasVercelTs,
    })
    process.stdout.write('Candidate Preview build command and verifier match trusted main.\n')
    return
  }

  if (mode === 'mask-preview-environment') {
    const path = process.argv[3]
    if (!path) fail('Usage: continuous-publishing.mjs mask-preview-environment <vercel-env-file>.')
    const values = parseEnvironmentFile(fs.readFileSync(path, 'utf8'))
    for (const value of Object.values(values)) {
      if (value.length >= 4) {
        process.stdout.write(`${githubMaskCommand(value)}\n`)
      }
    }
    process.stdout.write('Registered redaction for Preview credential variables.\n')
    return
  }

  if (mode === 'verify-main-qa-preview-deployment') {
    const checked = await resolveAndVerifyVercelMainQaPreview({
      projectId: requireEnv('VERCEL_PROJECT_ID'),
      teamId: requireEnv('VERCEL_ORG_ID'),
      deploymentUrl: requireEnv('DEPLOYMENT_URL'),
      commitSha: requireEnv('RELEASE_SHA'),
      treeSha: requireEnv('RELEASE_TREE_SHA'),
      token: requireEnv('VERCEL_TOKEN'),
    })
    const protection = await fetch(checked.url, { method: 'GET', redirect: 'manual' })
    assertPreviewDeploymentProtectionResponse(protection)
    appendOutput({ deployment_url: checked.url, deployment_id: checked.deploymentId, ready_state: checked.readyState })
    process.stdout.write('MAIN_QA Preview deployment is READY and authentication-protected.\n')
    return
  }

  if (mode === 'verify-preview-deployment') {
    const checked = await resolveAndVerifyVercelPreview({
      projectId: requireEnv('VERCEL_PROJECT_ID'),
      teamId: requireEnv('VERCEL_ORG_ID'),
      deploymentUrl: requireEnv('DEPLOYMENT_URL'),
      commitSha: requireEnv('RELEASE_SHA'),
      treeSha: requireEnv('RELEASE_TREE_SHA'),
      headRef: requireEnv('RELEASE_HEAD_REF'),
      pullRequestNumber: requireEnv('PULL_REQUEST_NUMBER'),
      repository,
      token: requireEnv('VERCEL_TOKEN'),
    })
    const protection = await fetch(checked.url, { method: 'GET', redirect: 'manual' })
    assertPreviewDeploymentProtectionResponse(protection)
    appendOutput({ deployment_url: checked.url, deployment_id: checked.deploymentId, ready_state: checked.readyState })
    process.stdout.write(`Preview deployment is READY and authentication-protected: ${checked.hostname}.\n`)
    return
  }

  if (mode === 'verify-preview-project') {
    const project = await vercelRequest(`/v9/projects/${encodeURIComponent(requireEnv('VERCEL_PROJECT_ID'))}`, requireEnv('VERCEL_TOKEN'), requireEnv('VERCEL_ORG_ID'))
    assertPreviewProjectProtection(project, requireEnv('VERCEL_PROJECT_ID'))
    process.stdout.write('Verified expected Vercel project identity and Vercel Authentication protection.\n')
    return
  }

  fail('Usage: continuous-publishing.mjs <preview-pr|main-qa|merged-ci-tree|merged-release-proof|check-preview-environment|verify-preview-build-bootstrap|mask-preview-environment|verify-preview-project|verify-preview-deployment|verify-main-qa-preview-deployment>.')
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
