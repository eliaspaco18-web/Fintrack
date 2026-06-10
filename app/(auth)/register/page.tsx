// =============================================================================
// app/(auth)/register/page.tsx
// Redirige al login en modo registro.
// =============================================================================

import { redirect } from 'next/navigation'

interface RegisterPageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function sanitizeRelativePath(value: string | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  return value
}

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  const nextPath = sanitizeRelativePath(firstValue(searchParams?.next))

  const params = new URLSearchParams({ mode: 'signup' })
  if (nextPath) params.set('next', nextPath)

  redirect(`/login?${params.toString()}`)
}
