// =============================================================================
// lib/api/error-message.ts
// Normaliza mensajes de error de la API para UI:
// - Usa message/detail cuando existen
// - Si llega error.fields (validación), incluye el primer campo afectado
// =============================================================================

type ApiErrorEnvelope = {
  ok: false
  error?: {
    message?: string
    detail?: string
    fields?: Record<string, string[]>
  }
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  short_name: 'Nombre corto',
  code: 'Código',
  country: 'País',
  color: 'Color',
  icon: 'Icono',
  institution: 'Banco / institución',
  bank_entity_id: 'Entidad bancaria',
  account_id: 'Cuenta',
  category_id: 'Categoría',
  currency: 'Moneda',
  amount: 'Monto',
  initial_balance: 'Saldo inicial',
  credit_limit: 'Límite de crédito',
  used_amount: 'Monto usado',
  principal_amount: 'Monto principal',
  annual_tea: 'TEA anual',
  total_installments: 'Número de cuotas',
  closing_day: 'Día de cierre',
  payment_day: 'Día de pago',
  transaction_date: 'Fecha',
  description: 'Descripción',
  start_date: 'Fecha de inicio',
  end_date: 'Fecha de fin',
  period_type: 'Periodo',
  is_active: 'Estado',
  due_date: 'Fecha de vencimiento',
  debtor_name: 'Deudor',
  creditor_name: 'Acreedor',
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function humanizeToken(token: string): string {
  if (!token) return token
  if (FIELD_LABELS[token]) return FIELD_LABELS[token]
  return capitalize(token.replace(/[_-]+/g, ' '))
}

function humanizeFieldPath(path: string): string {
  const tokens = path
    .split('.')
    .filter(token => token.length > 0 && !/^\d+$/.test(token))

  if (tokens.length === 0) return 'dato'

  if (tokens.length === 1) return humanizeToken(tokens[0]!)

  return tokens.map(humanizeToken).join(' > ')
}

function normalizeSentence(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function firstFieldIssue(fields?: Record<string, string[]>): string | null {
  if (!fields) return null
  const entry = Object.entries(fields).find(([path]) => typeof path === 'string' && path.length > 0)
  if (!entry) return null

  const [path, messages] = entry
  const fieldLabel = humanizeFieldPath(path)
  const firstMessage = Array.isArray(messages) ? (messages.find(Boolean) ?? '').trim() : ''

  if (firstMessage) {
    return `Revisa el campo "${fieldLabel}": ${firstMessage}`
  }
  return `Revisa el campo "${fieldLabel}".`
}

export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('ok' in payload) ||
    (payload as ApiErrorEnvelope).ok !== false
  ) {
    return fallback
  }

  const error = (payload as ApiErrorEnvelope).error
  if (!error) return fallback

  const baseMessage = error.message?.trim() || fallback
  const extras: string[] = []

  if (error.detail?.trim()) extras.push(error.detail.trim())

  const fieldHint = firstFieldIssue(error.fields)
  if (fieldHint) extras.push(fieldHint)

  if (extras.length === 0) return baseMessage
  return `${normalizeSentence(baseMessage)} ${extras.join(' ')}`
}
