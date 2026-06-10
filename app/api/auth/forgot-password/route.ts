// =============================================================================
// app/api/auth/forgot-password/route.ts
// Solicita recuperación de contraseña desde pantalla de acceso.
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiZodError } from '@/lib/api/response'
import { sendAuthPasswordResetEmail } from '@/lib/email/send-auth-password-reset-email'
import { resolveAppUrlFromRequest } from '@/lib/server/app-url'

const zForgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Ingresa un correo válido')
    .max(160),
})

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 5

const requestBuckets = new Map<string, { count: number; resetAt: number }>()

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'

  const realIp = request.headers.get('x-real-ip')
  return realIp?.trim() || 'unknown'
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const current = requestBuckets.get(key)

  if (!current || now > current.resetAt) {
    requestBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return false
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return true

  requestBuckets.set(key, {
    count: current.count + 1,
    resetAt: current.resetAt,
  })
  return false
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zForgotPasswordSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const siteUrl = resolveAppUrlFromRequest(request)
  const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent('/settings?tab=security')}`

  const ip = getClientIp(request)
  const bucketKey = `${ip}:${parsed.data.email.toLowerCase()}`
  if (isRateLimited(bucketKey)) {
    return apiOk({
      message: 'Si el correo existe, recibirás un enlace de recuperación en unos minutos.',
    })
  }

  const customResetEmail = await sendAuthPasswordResetEmail({
    email: parsed.data.email,
    appUrl: siteUrl,
    redirectTo,
  })

  if (!customResetEmail.sent) {
    console.warn('[forgot-password] custom email fallback:', customResetEmail.reason)
  }

  const supabase = createClient()
  if (!customResetEmail.sent) {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo,
    })

    if (error) {
      return apiOk({
        message: 'Si el correo existe, recibirás un enlace de recuperación en unos minutos.',
      })
    }
  }

  return apiOk({
    message: 'Si el correo existe, recibirás un enlace de recuperación en unos minutos.',
  })
}
