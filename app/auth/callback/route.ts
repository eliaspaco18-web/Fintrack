// =============================================================================
// app/auth/callback/route.ts
// Finaliza flujos de verificación/recuperación de Supabase Auth.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase.server'

function sanitizeRelativePath(value: string | null): string {
  if (!value) return '/dashboard'
  if (!value.startsWith('/')) return '/dashboard'
  if (value.startsWith('//')) return '/dashboard'
  return value
}

function buildLoginErrorRedirect(request: NextRequest): NextResponse {
  const origin = new URL(request.url).origin
  return NextResponse.redirect(new URL('/login?authError=callback', origin))
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const nextPath = sanitizeRelativePath(url.searchParams.get('next'))

  const supabase = createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return buildLoginErrorRedirect(request)

    const finalPath = nextPath === '/dashboard'
      ? '/login?authMessage=verified'
      : nextPath

    return NextResponse.redirect(new URL(finalPath, url.origin))
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (error) return buildLoginErrorRedirect(request)

    const finalPath = type === 'recovery'
      ? '/settings?tab=security'
      : nextPath

    return NextResponse.redirect(new URL(finalPath, url.origin))
  }

  return buildLoginErrorRedirect(request)
}
