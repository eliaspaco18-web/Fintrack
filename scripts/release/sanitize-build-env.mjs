import fs from 'node:fs'

export const BUILD_ENV_ALLOWLIST = new Set([
  'FINTRACK_V3_SHELL_PRODUCTION',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
])

export function sanitizeBuildEnvironment(text, releaseKind) {
  if (!['v2-bridge', 'v3'].includes(releaseKind)) throw new Error('releaseKind must be v2-bridge or v3.')
  const kept = []
  let shellFlag
  const seen = new Set()
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)
    if (!match || !BUILD_ENV_ALLOWLIST.has(match[1])) continue
    if (seen.has(match[1])) throw new Error(`Duplicate allowlisted build variable: ${match[1]}.`)
    seen.add(match[1])
    if (match[1] === 'FINTRACK_V3_SHELL_PRODUCTION') shellFlag = line.slice(match[0].length).replace(/^['"]|['"]$/g, '')
    else kept.push(line)
  }
  if (releaseKind === 'v3' && shellFlag !== '1') throw new Error('V3 staging requires the separately authorized Production shell flag to equal 1.')
  if (releaseKind === 'v2-bridge' && shellFlag === '1') throw new Error('V2 bridge staging is blocked while the Production V3 shell flag equals 1.')
  kept.push(`FINTRACK_V3_SHELL_PRODUCTION=${releaseKind === 'v3' ? '1' : '0'}`)
  return kept.length ? `${kept.join('\n')}\n` : ''
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const target = process.argv[2]
  const releaseKind = process.argv[3]
  if (!target || !releaseKind) {
    process.stderr.write('Usage: node scripts/release/sanitize-build-env.mjs <pulled-vercel-env-file> <v2-bridge|v3>\n')
    process.exitCode = 2
  } else {
    try {
      const original = fs.readFileSync(target, 'utf8')
      const sanitized = sanitizeBuildEnvironment(original, releaseKind)
      fs.writeFileSync(target, sanitized, { mode: 0o600 })
      process.stdout.write(`Retained ${sanitized ? sanitized.trimEnd().split('\n').length : 0} allowlisted build variables; runtime secrets removed.\n`)
    } catch (error) {
      process.stderr.write(`Could not sanitize pulled build environment: ${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 1
    }
  }
}
