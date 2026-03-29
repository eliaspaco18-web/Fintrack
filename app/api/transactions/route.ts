// =============================================================================
// app/api/transactions/route.ts
// GET  /api/transactions  — lista paginada con filtros
// POST /api/transactions  — crear transacción (+ módulos derivados)
// =============================================================================

import { NextRequest }                        from 'next/server'
import { createClient }                       from '@/lib/supabase.server'
import { TransactionService }                 from '@/modules/transactions/transaction.service'
import {
  zCreateTransactionSchema,
  zTransactionFiltersSchema,
}                                             from '@/lib/schemas/transaction.schemas'
import {
  apiCreated,
  apiOk,
  apiUnauthorized,
  apiZodError,
  fromResult,
  getSessionUserId,
}                                             from '@/lib/api/response'

type TransactionApiRow = {
  amount?: number | string | null
  amount_pen?: number | string | null
  amountPen?: number | string | null
  currency?: 'PEN' | 'USD' | string | null
  exchange_rate?: number | string | null
  transaction_date?: string | null
  transactionDate?: string | null
  affects_reports?: boolean | null
  affectsReports?: boolean | null
  source_account?: unknown
  sourceAccount?: unknown
  destination_account?: unknown
  destinationAccount?: unknown
  [key: string]: unknown
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeTransactionRow(row: TransactionApiRow): TransactionApiRow {
  const amount = toSafeNumber(row.amount, 0)
  const rate = toSafeNumber(row.exchange_rate, 1)
  const rawAmountPen = row.amount_pen ?? row.amountPen
  const computedAmountPen =
    rawAmountPen !== undefined && rawAmountPen !== null
      ? toSafeNumber(rawAmountPen, 0)
      : row.currency === 'USD'
        ? amount * rate
        : amount

  const txDate =
    typeof row.transaction_date === 'string' && row.transaction_date.trim().length > 0
      ? row.transaction_date
      : typeof row.transactionDate === 'string'
        ? row.transactionDate
        : ''

  const affectsReports =
    typeof row.affects_reports === 'boolean'
      ? row.affects_reports
      : typeof row.affectsReports === 'boolean'
        ? row.affectsReports
        : true

  const sourceAccount = row.sourceAccount ?? row.source_account ?? null
  const destinationAccount = row.destinationAccount ?? row.destination_account ?? null

  return {
    ...row,
    amount,
    amount_pen: computedAmountPen,
    amountPen: computedAmountPen,
    transaction_date: txDate,
    transactionDate: txDate,
    affects_reports: affectsReports,
    affectsReports,
    source_account: sourceAccount,
    sourceAccount,
    destination_account: destinationAccount,
    destinationAccount,
  }
}

// ─── GET /api/transactions ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  // Parsear query params
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = zTransactionFiltersSchema.safeParse(params)
  if (!parsed.success) return apiZodError(parsed.error)

  const service = new TransactionService(supabase)
  const result  = await service.getTransactions(userId, parsed.data)
  if (!result.ok) return fromResult(result)

  const normalizedData = result.data.data.map(row =>
    normalizeTransactionRow(row as unknown as TransactionApiRow)
  )

  return apiOk({
    data: normalizedData,
    pagination: {
      page:     result.data.page,
      per_page: result.data.per_page,
      total:    result.data.total,
      has_more: result.data.has_more,
    },
  })
}

// ─── POST /api/transactions ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiZodError({ issues: [{ path: [], message: 'Body JSON inválido', code: 'custom' }] } as never)
  }

  const parsed = zCreateTransactionSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const service = new TransactionService(supabase)
  const result  = await service.createTransaction(userId, parsed.data)
  if (!result.ok) return fromResult(result)

  return apiCreated(result.data)
}
