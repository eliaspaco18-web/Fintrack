// =============================================================================
// lib/email/send-auth-password-reset-email.ts
// Envia correo de recuperacion de contrasena con template propio (Resend).
// =============================================================================

import { EMAIL_FROM, resend } from '@/lib/email/resend'
import { createServiceClient } from '@/lib/supabase.server'
import {
  buildAuthPasswordResetEmailHtml,
  buildAuthPasswordResetEmailSubject,
} from '@/lib/email/templates/auth-password-reset'

export type PasswordResetSendReason =
  | 'RESEND_NOT_CONFIGURED'
  | 'SERVICE_ROLE_NOT_CONFIGURED'
  | 'GENERATE_LINK_FAILED'
  | 'SEND_FAILED'
  | 'UNEXPECTED_ERROR'

export interface SendAuthPasswordResetEmailInput {
  email: string
  appUrl: string
  redirectTo: string
}

export interface SendAuthPasswordResetEmailResult {
  sent: boolean
  reason?: PasswordResetSendReason
}

export async function sendAuthPasswordResetEmail(
  input: SendAuthPasswordResetEmailInput
): Promise<SendAuthPasswordResetEmailResult> {
  if (!resend) {
    return { sent: false, reason: 'RESEND_NOT_CONFIGURED' }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { sent: false, reason: 'SERVICE_ROLE_NOT_CONFIGURED' }
  }

  try {
    const service = createServiceClient()
    const { data, error } = await service.auth.admin.generateLink({
      type: 'recovery',
      email: input.email,
      options: {
        redirectTo: input.redirectTo,
      },
    })

    const actionLink = data?.properties?.action_link
    if (error || !actionLink) {
      console.error('[password-reset-email] generate link error:', error)
      return { sent: false, reason: 'GENERATE_LINK_FAILED' }
    }

    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: input.email,
      subject: buildAuthPasswordResetEmailSubject(),
      html: buildAuthPasswordResetEmailHtml({
        appUrl: input.appUrl,
        resetUrl: actionLink,
        expiresInMinutes: 60,
      }),
    })

    if (sendError) {
      console.error('[password-reset-email] resend error:', sendError)
      return { sent: false, reason: 'SEND_FAILED' }
    }

    return { sent: true }
  } catch (error) {
    console.error('[password-reset-email] unexpected error:', error)
    return { sent: false, reason: 'UNEXPECTED_ERROR' }
  }
}
