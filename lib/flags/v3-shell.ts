/** V3 shell is opt-in, with a separate server-side production switch. */
interface V3ShellEnvironment {
  NODE_ENV?: string
  VERCEL_ENV?: string
  NEXT_PUBLIC_FINTRACK_V3_SHELL?: string
  FINTRACK_V3_SHELL_PRODUCTION?: string
}

export function isV3ShellEnabled(env: V3ShellEnvironment = process.env): boolean {
  // Never let the public Preview flag opt Production in implicitly.
  if (env.VERCEL_ENV === 'production') return env.FINTRACK_V3_SHELL_PRODUCTION === '1'
  const safeEnvironment = env.NODE_ENV === 'development' || env.VERCEL_ENV === 'preview'
  return env.NEXT_PUBLIC_FINTRACK_V3_SHELL === '1' && safeEnvironment
}
