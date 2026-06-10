// =============================================================================
// app/api/profile/send-reset-email/route.ts
// Envía un correo de restablecimiento de contraseña al usuario.
// =============================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized } from '@/lib/api/response'
import { sendAuthPasswordResetEmail } from '@/lib/email/send-auth-password-reset-email'
import { resolveAppUrlFromRequest } from '@/lib/server/app-url'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user || !user.email) return apiUnauthorized()

  const siteUrl = resolveAppUrlFromRequest(request)
  const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent('/settings?tab=security')}`

  const customResetEmail = await sendAuthPasswordResetEmail({
    email: user.email,
    appUrl: siteUrl,
    redirectTo,
  })

  if (customResetEmail.sent) {
    return apiOk({ message: 'Correo enviado correctamente', email: user.email })
  }

  console.warn('[profile/send-reset-email] custom email fallback:', customResetEmail.reason)

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo,
  })

  if (error) {
    return apiError({
      code: 'AUTH_ERROR',
      message: error.message ?? 'No se pudo enviar el correo de restablecimiento',
    })
  }

  return apiOk({ message: 'Correo enviado correctamente', email: user.email })
}
