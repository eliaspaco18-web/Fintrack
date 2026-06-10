// =============================================================================
// app/api/auth/welcome-email/route.ts
// Envía correo de bienvenida profesional post-registro.
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError, apiOk, apiZodError } from '@/lib/api/response'
import { EMAIL_FROM, resend } from '@/lib/email/resend'
import {
  buildWelcomeAuthEmailHtml,
  buildWelcomeAuthEmailSubject,
} from '@/lib/email/templates/auth-welcome'
import { resolveAppUrlFromRequest } from '@/lib/server/app-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const zWelcomeEmailSchema = z.object({
  email: z.string().trim().email('Correo inválido').max(160),
  fullName: z.string().trim().min(2).max(120),
  accountType: z.enum(['PERSONAL', 'BUSINESS']),
  defaultCurrency: z.enum(['PEN', 'USD']),
  country: z.string().trim().min(2).max(3),
})

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 3

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

  const parsed = zWelcomeEmailSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const ip = getClientIp(request)
  const bucketKey = `${ip}:${parsed.data.email.toLowerCase()}`
  if (isRateLimited(bucketKey)) {
    return apiOk({ sent: false, reason: 'RATE_LIMITED' })
  }

  if (!resend) {
    return apiOk({ sent: false, reason: 'RESEND_NOT_CONFIGURED' })
  }

  const appUrl = resolveAppUrlFromRequest(request)

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: parsed.data.email,
      subject: buildWelcomeAuthEmailSubject(),
      html: buildWelcomeAuthEmailHtml({
        fullName: parsed.data.fullName,
        accountType: parsed.data.accountType,
        defaultCurrency: parsed.data.defaultCurrency,
        country: parsed.data.country,
        appUrl,
      }),
    })

    if (error) {
      console.error('[welcome-email] resend error:', error)
      return apiOk({ sent: false, reason: 'SEND_ERROR' })
    }

    return apiOk({ sent: true })
  } catch (error) {
    console.error('[welcome-email] unexpected error:', error)
    return apiOk({ sent: false, reason: 'UNEXPECTED_ERROR' })
  }
}
