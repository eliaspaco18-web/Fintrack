import fs from 'node:fs'
import { assertMigrationEvidence } from './continuous-publishing.mjs'

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const [path, releaseSha, treeSha, changeType, productionBaseSha, riskLevel, financialSensitive] = process.argv.slice(2)
    if (!path || !/^[0-9a-f]{40}$/.test(releaseSha ?? '') || !/^[0-9a-f]{40}$/.test(treeSha ?? '') || !['code-only', 'migration'].includes(changeType ?? '') || !/^[0-9a-f]{40}$/.test(productionBaseSha ?? '')) {
      throw new Error('Usage: assert-migration-evidence.mjs <evidence.json> <release-sha> <tree-sha> <code-only|migration> <production-base-sha> <standard|elevated> <true|false>')
    }
    if (!['standard', 'elevated'].includes(riskLevel ?? '') || !['true', 'false'].includes(financialSensitive ?? '')) {
      throw new Error('Usage: assert-migration-evidence.mjs <evidence.json> <release-sha> <tree-sha> <code-only|migration> <production-base-sha> <standard|elevated> <true|false>')
    }
    assertMigrationEvidence(JSON.parse(fs.readFileSync(path, 'utf8')), {
      releaseSha, treeSha, changeType, productionBaseSha, riskLevel, financialSensitive: financialSensitive === 'true',
    })
    const evidence = JSON.parse(fs.readFileSync(path, 'utf8'))
    const sourceRunId = process.env.MIGRATION_EVIDENCE_RUN_ID
    if (sourceRunId) {
      if (!/^\d+$/.test(sourceRunId) || evidence.source_run_id !== sourceRunId) throw new Error('Migration evidence source run ID does not match the requested artifact run.')
      const repository = process.env.GITHUB_REPOSITORY
      const token = process.env.GITHUB_TOKEN
      if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required to verify migration evidence provenance.')
      const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${sourceRunId}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
      })
      if (!response.ok) throw new Error(`GitHub migration evidence run lookup failed with HTTP ${response.status}.`)
      const run = await response.json()
      const expectedWorkflow = changeType === 'code-only'
        ? '.github/workflows/production-migration-certification.yml'
        : '.github/workflows/production-migrations.yml'
      if (String(run.path ?? '').split('@')[0] !== expectedWorkflow || run.head_branch !== 'main' || run.head_sha !== releaseSha || run.status !== 'completed' || run.conclusion !== 'success') {
        throw new Error('Migration evidence was not produced by the successful protected workflow for the exact main SHA.')
      }
    }
    process.stdout.write(`Release evidence verified for ${releaseSha} (${changeType}).\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
