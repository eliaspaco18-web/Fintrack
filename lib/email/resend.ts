// =============================================================================
// lib/email/resend.ts
// Cliente Resend singleton para envío de emails transaccionales.
// =============================================================================

import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY

// En desarrollo sin API key, usamos un cliente mock que no falla
export const resend = apiKey ? new Resend(apiKey) : null

export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL ?? 'FinTrack <noreply@fintrack.app>'
