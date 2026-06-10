// =============================================================================
// lib/email/send-transaction-email.ts
// Envia email de notificación de transacción vía Resend.
// Verifica la preferencia del usuario antes de enviar.
// =============================================================================

import { createServiceClient }     from '@/lib/supabase.server'
import { resend, EMAIL_FROM }      from '@/lib/email/resend'
import { resolveAppUrlFallback }   from '@/lib/server/app-url'
import {
  buildTransactionEmailHtml,
  buildTransactionEmailSubject,
  type TransactionEmailData,
} from '@/lib/email/templates/transaction-notification'

interface SendTransactionEmailInput {
  userId:               string
  transactionId:        string   // UUID of the transaction
  type:                 'INCOME' | 'EXPENSE' | 'TRANSFER'
  amount:               number
  currency:             'PEN' | 'USD'
  exchangeRate?:        number
  description:          string
  transactionDate:      string
  sourceAccountId:      string
  destinationAccountId?: string | null
  categoryId?:          string | null
  notes?:               string | null
}

export async function sendTransactionNotificationEmail(
  input: SendTransactionEmailInput
): Promise<{ sent: boolean; reason?: string }> {

  // 1. Verificar si Resend está configurado
  if (!resend) {
    console.warn('[sendTransactionEmail] RESEND_API_KEY not set — skipping email')
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  const service = createServiceClient()

  // 2. Obtener perfil + preferencias en una sola query
  const { data: profile, error: profileError } = await (service as any)
    .from('profiles')
    .select('email, full_name, notification_prefs')
    .eq('id', input.userId)
    .single() as {
      data: {
        email: string
        full_name: string | null
        notification_prefs: Record<string, boolean> | null
      } | null
      error: { message: string } | null
    }

  if (profileError || !profile) {
    console.error('[sendTransactionEmail] profile error:', profileError?.message)
    return { sent: false, reason: 'profile_not_found' }
  }

  // 3. Verificar preferencia del usuario
  const prefs = profile.notification_prefs ?? {}
  if (!prefs.newTransaction) {
    return { sent: false, reason: 'user_preference_disabled' }
  }

  // 4. Resolver nombres de cuentas en paralelo con la categoría
  const accountIds = [input.sourceAccountId, input.destinationAccountId].filter(Boolean) as string[]

  const [accountsRes, categoryRes] = await Promise.all([
    service.from('accounts').select('id, name').in('id', accountIds),
    input.categoryId
      ? service.from('categories').select('name').eq('id', input.categoryId).single()
      : Promise.resolve({ data: null }),
  ])

  const accountMap = new Map((accountsRes.data ?? []).map(a => [a.id, a.name]))

  // 5. Construir datos del email
  const appUrl = resolveAppUrlFallback()

  const emailData: TransactionEmailData = {
    userName:               profile.full_name ?? profile.email.split('@')[0] ?? '',
    userEmail:              profile.email,
    transactionId:          input.transactionId,
    type:                   input.type,
    amount:                 input.amount,
    currency:               input.currency,
    exchangeRate:           input.exchangeRate,
    description:            input.description,
    transactionDate:        input.transactionDate,
    accountName:            accountMap.get(input.sourceAccountId) ?? 'Cuenta',
    destinationAccountName: input.destinationAccountId
      ? (accountMap.get(input.destinationAccountId) ?? undefined)
      : undefined,
    categoryName:           (categoryRes.data as { name?: string } | null)?.name ?? undefined,
    notes:                  input.notes ?? undefined,
    appUrl,
  }

  // 6. Enviar
  try {
    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      profile.email,
      subject: buildTransactionEmailSubject(emailData),
      html:    buildTransactionEmailHtml(emailData),
    })

    if (error) {
      console.error('[sendTransactionEmail] resend error:', error)
      return { sent: false, reason: error.message }
    }

    console.info(`[sendTransactionEmail] ✅ sent to ${profile.email} · op ${emailData.transactionId}`)
    return { sent: true }
  } catch (err) {
    console.error('[sendTransactionEmail] unexpected error:', err)
    return { sent: false, reason: 'unexpected_error' }
  }
}
