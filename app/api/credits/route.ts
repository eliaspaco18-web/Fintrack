// =============================================================================
// app/api/credits/route.ts
// GET  /api/credits   — lista créditos
// POST /api/credits   — crea tarjeta o crédito bancario desde módulo Créditos
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import {
  deriveCreditDisplayType,
  type CreditListItem,
} from '@/lib/credits/display-type'
import {
  apiCreated,
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'
import { TransactionService } from '@/modules/transactions/transaction.service'
import { LoanRepository } from '@/modules/loans/loan.repository'
import type { TablesInsert } from '@/types/database.types'

const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
const zCurrency = z.enum(['PEN', 'USD'])

const zCreateCreditCardSchema = z.object({
  kind: z.literal('CARD'),
  name: z.string().trim().min(2).max(100),
  bank_entity_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional().nullable(),
  currency: zCurrency.default('PEN'),
  credit_limit: z.number().positive().optional(),
  credit_limit_pen: z.number().min(0).optional(),
  credit_limit_usd: z.number().min(0).optional(),
  used_amount: z.number().min(0).optional(),
  used_amount_pen: z.number().min(0).optional(),
  used_amount_usd: z.number().min(0).optional(),
  interest_rate: z.number().min(0).max(9.9999).default(0),
  closing_day: z.number().int().min(1).max(31).optional(),
  payment_day: z.number().int().min(1).max(31).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
})

const zCreateBankCreditSchema = z.object({
  kind: z.literal('BANK'),
  name: z.string().trim().min(2).max(100),
  creditor_name: z.string().trim().min(2).max(150),
  bank_entity_id: z.string().uuid(),
  account_id: z.string().uuid(),
  category_id: z.string().uuid().optional(),
  currency: zCurrency.default('PEN'),
  principal_amount: z.number().positive(),
  interest_rate: z.number().min(0).max(9.9999).default(0),
  total_installments: z.number().int().min(1).max(600),
  start_date: zDate,
  end_date: zDate,
  transaction_date: zDate.optional(),
  exchange_rate: z.number().positive().optional(),
  description: z.string().trim().min(2).max(255).optional(),
  generate_schedule: z.boolean().default(true),
  installments: z.array(z.object({
    installment_number: z.number().int().min(1),
    due_date: zDate,
    principal_amount: z.number().min(0),
    interest_amount: z.number().min(0),
    insurance_amount: z.number().min(0).default(0),
  })).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
})

const zCreateCreditSchema = z.discriminatedUnion('kind', [
  zCreateCreditCardSchema,
  zCreateBankCreditSchema,
]).superRefine((data, ctx) => {
  if (data.kind === 'CARD') {
    const limitPen = data.credit_limit_pen ?? (data.currency === 'PEN' ? data.credit_limit ?? 0 : 0)
    const limitUsd = data.credit_limit_usd ?? (data.currency === 'USD' ? data.credit_limit ?? 0 : 0)
    const primaryLimit = data.currency === 'PEN' ? limitPen : limitUsd
    const usedPen = data.used_amount_pen ?? (data.currency === 'PEN' ? data.used_amount ?? 0 : 0)
    const usedUsd = data.used_amount_usd ?? (data.currency === 'USD' ? data.used_amount ?? 0 : 0)
    const primaryUsed = data.currency === 'PEN' ? usedPen : usedUsd

    if (primaryLimit <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['credit_limit'],
        message: 'La línea de crédito debe ser mayor a 0',
      })
    }

    if (primaryUsed > primaryLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.currency === 'PEN' ? ['used_amount_pen'] : ['used_amount_usd'],
        message: 'El consumo inicial en la moneda de la línea no puede superar el límite de crédito',
      })
    }
    return
  }

  const txDate = data.transaction_date ?? data.start_date

  if (data.end_date <= data.start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_date'],
      message: 'La fecha fin debe ser posterior a la fecha de inicio',
    })
  }

  if (data.start_date < txDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['start_date'],
      message: 'La fecha de inicio no puede ser anterior al desembolso',
    })
  }

  if (data.currency === 'USD' && (!data.exchange_rate || data.exchange_rate <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exchange_rate'],
      message: 'El tipo de cambio es obligatorio para créditos en USD',
    })
  }

  if (data.installments && data.installments.length > 0 && data.installments.length !== data.total_installments) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['installments'],
      message: 'La cantidad de cuotas manuales debe coincidir con el número de cuotas',
    })
  }
})

type CreditCreateRequest = z.infer<typeof zCreateCreditSchema>

async function ensureUserActiveBankEntity(params: { userId: string; bankEntityId: string }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bank_entities')
    .select('id, name, short_name, is_active')
    .eq('id', params.bankEntityId)
    .eq('user_id', params.userId)
    .single()

  if (error || !data) {
    return { ok: false as const, code: 'NOT_FOUND', message: 'Entidad bancaria no encontrada' }
  }

  if (!data.is_active) {
    return { ok: false as const, code: 'BUSINESS_RULE_ERROR', message: 'La entidad bancaria seleccionada está inactiva' }
  }

  return { ok: true as const, bankEntity: data }
}

async function ensureUserActiveAccount(
  params: { userId: string; accountId: string; expectedType?: 'CREDIT_CARD' }
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, type, is_active, bank_entity_id')
    .eq('id', params.accountId)
    .eq('user_id', params.userId)
    .single()

  if (error || !data) {
    return { ok: false as const, code: 'NOT_FOUND', message: 'Cuenta no encontrada' }
  }

  if (!data.is_active) {
    return { ok: false as const, code: 'BUSINESS_RULE_ERROR', message: 'La cuenta seleccionada está inactiva' }
  }

  if (params.expectedType && data.type !== params.expectedType) {
    return {
      ok: false as const,
      code: 'BUSINESS_RULE_ERROR',
      message: 'La cuenta seleccionada debe ser de tipo Tarjeta para vincular la línea de crédito',
    }
  }

  if (params.expectedType === 'CREDIT_CARD' && !data.bank_entity_id) {
    return {
      ok: false as const,
      code: 'BUSINESS_RULE_ERROR',
      message: 'La cuenta tarjeta debe estar vinculada a una entidad bancaria.',
      detail: 'Edita la cuenta en Portafolio y asigna la entidad bancaria antes de crear la tarjeta de crédito.',
    }
  }

  return { ok: true as const, account: data }
}

async function rollbackCreatedRecords(params: {
  userId: string
  transactionId?: string | null
  creditId?: string | null
  loanId?: string | null
}) {
  const supabase = createClient()
  const txService = new TransactionService(supabase)

  if (params.loanId) {
    await supabase.from('loans').delete().eq('id', params.loanId).eq('user_id', params.userId)
  }

  if (params.creditId) {
    await supabase.from('credits').delete().eq('id', params.creditId).eq('user_id', params.userId)
  }

  if (params.transactionId) {
    await txService.deleteTransaction(params.userId, params.transactionId, { force: true })
  }
}

async function createCreditCard(userId: string, payload: Extract<CreditCreateRequest, { kind: 'CARD' }>) {
  let accountId = payload.account_id ?? null
  let bankEntityId = payload.bank_entity_id ?? null

  if (accountId) {
    const accountValidation = await ensureUserActiveAccount({
      userId,
      accountId,
      expectedType: 'CREDIT_CARD',
    })

    if (!accountValidation.ok) {
      return apiError({ code: accountValidation.code, message: accountValidation.message })
    }

    bankEntityId = bankEntityId ?? accountValidation.account.bank_entity_id
  }

  if (!bankEntityId) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Selecciona la entidad bancaria emisora de la tarjeta.',
    })
  }

  const bankValidation = await ensureUserActiveBankEntity({
    userId,
    bankEntityId,
  })

  if (!bankValidation.ok) {
    return apiError({ code: bankValidation.code, message: bankValidation.message })
  }

  const supabase = createClient()
  const creditLimitPen = Number(payload.credit_limit_pen ?? (payload.currency === 'PEN' ? payload.credit_limit ?? 0 : 0))
  const creditLimitUsd = Number(payload.credit_limit_usd ?? (payload.currency === 'USD' ? payload.credit_limit ?? 0 : 0))
  const usedAmountPen = Number(payload.used_amount_pen ?? (payload.currency === 'PEN' ? payload.used_amount ?? 0 : 0))
  const usedAmountUsd = Number(payload.used_amount_usd ?? (payload.currency === 'USD' ? payload.used_amount ?? 0 : 0))
  const primaryCreditLimit = payload.currency === 'PEN' ? creditLimitPen : creditLimitUsd
  const primaryUsedAmount = payload.currency === 'PEN' ? usedAmountPen : usedAmountUsd

  if (!accountId) {
    const bankLabel = bankValidation.bankEntity.name
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: `${payload.name} (${payload.currency})`,
        institution: bankLabel,
        bank_entity_id: bankEntityId,
        type: 'CREDIT_CARD',
        currency: payload.currency,
        balance: 0,
        initial_balance: 0,
        initial_balance_date: new Date().toISOString().slice(0, 10),
        include_in_net_worth: false,
        color: '#0ea5e9',
        icon: 'credit-card',
        notes: 'Cuenta técnica creada automáticamente para registrar consumos de tarjeta.',
      })
      .select('id')
      .single()

    if (accountError || !account) {
      return apiError({ code: 'DATABASE_ERROR', message: accountError?.message ?? 'No se pudo crear la cuenta técnica de la tarjeta' })
    }

    accountId = account.id
  }

  const creditInsert: TablesInsert<'credits'> = {
    user_id: userId,
    account_id: accountId,
    bank_entity_id: bankEntityId,
    transaction_id: null,
    credit_type: 'CREDIT_CARD',
    name: payload.name,
    credit_limit: primaryCreditLimit,
    credit_limit_pen: creditLimitPen,
    credit_limit_usd: creditLimitUsd,
    used_amount: primaryUsedAmount,
    used_amount_pen: usedAmountPen,
    used_amount_usd: usedAmountUsd,
    interest_rate: payload.interest_rate,
    closing_day: payload.closing_day ?? null,
    payment_day: payload.payment_day ?? null,
    currency: payload.currency,
    status: 'ACTIVE',
    notes: payload.notes ?? null,
  }

  const { data: credit, error } = await supabase
    .from('credits')
    .insert(creditInsert)
    .select('*')
    .single()

  if (error || !credit) {
    const missingDualColumn = error?.message
      ? /credit_limit_pen|credit_limit_usd|used_amount_pen|used_amount_usd/i.test(error.message)
      : false

    if (!missingDualColumn) {
      return apiError({ code: 'DATABASE_ERROR', message: error?.message ?? 'No se pudo crear la tarjeta de crédito' })
    }

    const legacyCreditInsert = {
      ...creditInsert,
      credit_limit_pen: undefined,
      credit_limit_usd: undefined,
      used_amount_pen: undefined,
      used_amount_usd: undefined,
    }

    const { data: legacyCredit, error: legacyError } = await supabase
      .from('credits')
      .insert(legacyCreditInsert)
      .select('*')
      .single()

    if (legacyError || !legacyCredit) {
      return apiError({ code: 'DATABASE_ERROR', message: legacyError?.message ?? 'No se pudo crear la tarjeta de crédito' })
    }

    return apiCreated({
      credit: legacyCredit,
      loan: null,
      transaction: null,
      installments_generated: 0,
      auto_income_created: false,
    })
  }

  return apiCreated({
    credit,
    loan: null,
    transaction: null,
    installments_generated: 0,
    auto_income_created: false,
  })
}

async function createBankCredit(userId: string, payload: Extract<CreditCreateRequest, { kind: 'BANK' }>) {
  const accountValidation = await ensureUserActiveAccount({
    userId,
    accountId: payload.account_id,
  })

  if (!accountValidation.ok) {
    return apiError({ code: accountValidation.code, message: accountValidation.message })
  }

  const supabase = createClient()
  const txService = new TransactionService(supabase)

  const transactionDate = payload.transaction_date ?? payload.start_date
  const txDescription = payload.description?.trim() || `Desembolso de crédito: ${payload.name}`

  const txResult = await txService.createTransaction(userId, {
    type: 'INCOME',
    source_account_id: payload.account_id,
    amount: payload.principal_amount,
    currency: payload.currency,
    exchange_rate: payload.exchange_rate,
    description: txDescription,
    transaction_date: transactionDate,
    category_id: payload.category_id,
    notes: payload.notes ?? undefined,
    is_recurring: false,
  })

  if (!txResult.ok) {
    return apiError(txResult.error)
  }

  const transaction = txResult.data.transaction

  const creditInsert: TablesInsert<'credits'> = {
    user_id: userId,
    account_id: payload.account_id,
    bank_entity_id: payload.bank_entity_id,
    transaction_id: transaction.id,
    credit_type: 'LINE_OF_CREDIT',
    name: payload.name,
    credit_limit: payload.principal_amount,
    used_amount: payload.principal_amount,
    interest_rate: payload.interest_rate,
    closing_day: null,
    payment_day: null,
    currency: payload.currency,
    status: 'ACTIVE',
    notes: payload.notes ?? null,
  }

  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .insert(creditInsert)
    .select('*')
    .single()

  if (creditError || !credit) {
    await rollbackCreatedRecords({ userId, transactionId: transaction.id })
    return apiError({ code: 'DATABASE_ERROR', message: creditError?.message ?? 'No se pudo crear el crédito bancario' })
  }

  const loanInsert: TablesInsert<'loans'> = {
    user_id: userId,
    credit_id: credit.id,
    bank_entity_id: payload.bank_entity_id,
    transaction_id: transaction.id,
    creditor_name: payload.creditor_name,
    principal_amount: payload.principal_amount,
    interest_rate: payload.interest_rate,
    total_installments: payload.total_installments,
    paid_installments: 0,
    start_date: payload.start_date,
    end_date: payload.end_date,
    currency: payload.currency,
    status: 'ACTIVE',
    notes: payload.notes ?? null,
  }

  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .insert(loanInsert)
    .select('*')
    .single()

  if (loanError || !loan) {
    await rollbackCreatedRecords({ userId, transactionId: transaction.id, creditId: credit.id })
    return apiError({ code: 'DATABASE_ERROR', message: loanError?.message ?? 'No se pudo crear el préstamo' })
  }

  const manualSchedule: TablesInsert<'installments'>[] | null = payload.installments && payload.installments.length > 0
    ? payload.installments.map(item => {
      const interestPlusInsurance = item.interest_amount + item.insurance_amount
      const totalAmount = item.principal_amount + interestPlusInsurance
      return {
        loan_id: loan.id,
        transaction_id: null,
        installment_number: item.installment_number,
        principal_amount: item.principal_amount,
        interest_amount: interestPlusInsurance,
        total_amount: totalAmount,
        due_date: item.due_date,
        paid_date: null,
        paid_amount: null,
        status: 'PENDING' as const,
      }
    })
    : null

  let installmentsGenerated = 0
  if (manualSchedule || payload.generate_schedule) {
    const schedule: TablesInsert<'installments'>[] = manualSchedule ?? LoanRepository.buildInstallmentSchedule({
      loanId: loan.id,
      principalAmount: payload.principal_amount,
      interestRate: payload.interest_rate,
      totalInstallments: payload.total_installments,
      startDate: payload.start_date,
    })

    if (schedule.length > 0) {
      const { error: installmentsError } = await supabase
        .from('installments')
        .insert(schedule)

      if (installmentsError) {
        await rollbackCreatedRecords({
          userId,
          transactionId: transaction.id,
          creditId: credit.id,
          loanId: loan.id,
        })
        return apiError({ code: 'DATABASE_ERROR', message: installmentsError.message })
      }

      installmentsGenerated = schedule.length
    }
  }

  return apiCreated({
    credit,
    loan,
    transaction,
    installments_generated: installmentsGenerated,
    auto_income_created: true,
  })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const params = req.nextUrl.searchParams
  const statusParam = params.get('status')
  const allowedStatus = ['ACTIVE', 'CLOSED', 'BLOCKED'] as const
  const status = allowedStatus.find(value => value === statusParam)

  if (statusParam && !status) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Parámetro status inválido' })
  }

  let query = supabase
    .from('credits')
    .select('*')
    .eq('user_id', userId)
    .order('name')

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  const credits = data ?? []
  const lineCreditIds = credits
    .filter(credit => credit.credit_type === 'LINE_OF_CREDIT')
    .map(credit => credit.id)

  let creditIdsWithLoan = new Set<string>()
  if (lineCreditIds.length > 0) {
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('credit_id')
      .eq('user_id', userId)
      .in('credit_id', lineCreditIds)

    if (loansError) {
      return apiError({ code: 'DATABASE_ERROR', message: loansError.message })
    }

    creditIdsWithLoan = new Set(
      (loans ?? [])
        .map(loan => loan.credit_id)
        .filter((creditId): creditId is string => typeof creditId === 'string' && creditId.length > 0),
    )
  }

  const enrichedCredits: CreditListItem[] = credits.map(credit => {
    const hasLoan = creditIdsWithLoan.has(credit.id)

    return {
      ...credit,
      has_loan: hasLoan,
      display_type: deriveCreditDisplayType({
        creditType: credit.credit_type,
        hasLoan,
      }),
    }
  })

  return apiOk(enrichedCredits)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zCreateCreditSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  if (parsed.data.kind === 'CARD') {
    return createCreditCard(userId, parsed.data)
  }

  return createBankCredit(userId, parsed.data)
}
