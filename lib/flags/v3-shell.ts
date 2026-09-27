/** V3 shell is opt-in and cannot activate on a production deployment. */
interface V3ShellEnvironment {
  NODE_ENV?: string
  VERCEL_ENV?: string
  NEXT_PUBLIC_FINTRACK_V3_SHELL?: string
}

export function isV3ShellEnabled(env: V3ShellEnvironment = process.env): boolean {
  if (env.VERCEL_ENV === 'production') return false
  const safeEnvironment = env.NODE_ENV === 'development' || env.VERCEL_ENV === 'preview'
  return env.NEXT_PUBLIC_FINTRACK_V3_SHELL === '1' && safeEnvironment
}
