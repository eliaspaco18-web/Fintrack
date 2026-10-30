import fs from 'node:fs'
import path from 'node:path'

/**
 * Vercel CLI 63.1.0 can retain a root .env.local path in the prebuilt upload
 * file map and hashes that path during deploy. Remove pulled secrets, then
 * leave the path as a mode-600 empty file so hashing does not fail with ENOENT.
 */
export function preparePrebuiltDeployEnv(projectRoot = process.cwd()) {
  const root = path.resolve(projectRoot)
  const productionEnvPath = path.join(root, '.vercel', '.env.production.local')
  const localEnvPath = path.join(root, '.env.local')

  fs.rmSync(productionEnvPath, { force: true })
  fs.rmSync(localEnvPath, { force: true })
  fs.writeFileSync(localEnvPath, '', { flag: 'wx', mode: 0o600 })

  const envStat = fs.lstatSync(localEnvPath)
  if (
    !envStat.isFile() ||
    envStat.isSymbolicLink() ||
    envStat.size !== 0 ||
    (envStat.mode & 0o077) !== 0
  ) {
    throw new Error('Prebuilt deploy .env.local must be a private, empty regular file.')
  }

  if (fs.existsSync(productionEnvPath)) {
    throw new Error('Pulled Production environment file remains before prebuilt upload.')
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    preparePrebuiltDeployEnv()
    process.stdout.write('Pulled environment files removed; empty private .env.local placeholder ready.\n')
  } catch (error) {
    process.stderr.write(
      `Could not prepare secret-free prebuilt environment: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  }
}
