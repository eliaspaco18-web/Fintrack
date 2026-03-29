// =============================================================================
// app/(dashboard)/transactions/new/page.tsx
// =============================================================================

import { redirect }          from 'next/navigation'
import type { Metadata }     from 'next'
import Link                  from 'next/link'
import { createClient }      from '@/lib/supabase.server'
import { TransactionForm }   from '@/components/forms/TransactionForm'
import type {
  TransactionFormOptions,
  FormSelectOption,
  CategoryOption,
  TransactionFormValues,
}                            from '@/lib/contracts/ui.contracts'
import { formatNumber } from '@/lib/contracts/ui.contracts'

export const metadata: Metadata = { title: 'Nueva transacción' }

type SearchParamMap = Record<string, string | string[] | undefined>

const CATEGORY_ICON_PREFIXES = [
  'wallet',
  'bank',
  'card',
  'coins',
  'savings',
  'briefcase',
  'vault',
  'chart',
  'tag',
  'home',
  'car',
  'heart',
  'book-open',
  'film',
  'package',
  'credit-card',
  'file-minus',
  'minus-circle',
]

function readQueryValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeCategoryLabel(raw: string): string {
  const clean = raw.trim()
  if (!clean) return 'Sin categoría'

  const prefixPattern = new RegExp(`^(${CATEGORY_ICON_PREFIXES.join('|')})\\s+`, 'i')
  const withoutPrefix = clean.replace(prefixPattern, '')
  const normalized = withoutPrefix.replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : clean
}

function resolveInitialValues(
  searchParams: SearchParamMap | undefined,
  options: TransactionFormOptions
): Partial<TransactionFormValues> {
  if (!searchParams) return {}

  const initial: Partial<TransactionFormValues> = {}

  const requestedType = readQueryValue(searchParams.type)
  if (requestedType === 'INCOME' || requestedType === 'EXPENSE' || requestedType === 'TRANSFER') {
    initial.type = requestedType
  }

  const requestedAccountId =
    readQueryValue(searchParams.source_account_id) ??
    readQueryValue(searchParams.account_id)
  if (requestedAccountId && options.accounts.some(account => account.value === requestedAccountId)) {
    initial.source_account_id = requestedAccountId
  }

  const requestedCurrency = readQueryValue(searchParams.currency)
  if (requestedCurrency === 'PEN' || requestedCurrency === 'USD') {
    initial.currency = requestedCurrency
  }

  const requestedDescription = readQueryValue(searchParams.description)
  if (requestedDescription) {
    initial.description = requestedDescription.slice(0, 255)
  }

  const requestedModule = readQueryValue(searchParams.module)
  if (requestedModule === 'asset') {
    initial.type = 'EXPENSE'
    initial.creates_asset = true
    initial.creates_payable = false
  } else if (requestedModule === 'credit') {
    initial.type = 'EXPENSE'
    initial.payment_method = 'CREDIT'
    initial.creates_asset = false
    initial.creates_payable = false
  } else if (requestedModule === 'payable') {
    initial.type = 'EXPENSE'
    initial.creates_asset = false
    initial.creates_credit = false
    initial.creates_payable = true
  } else if (requestedModule === 'receivable') {
    initial.type = 'INCOME'
    initial.creates_receivable = true
  }

  const requestedCreditKind = readQueryValue(searchParams.credit_kind)
  if (requestedCreditKind === 'card') {
    initial.payment_method = 'CREDIT'
  } else if (requestedCreditKind === 'bank') {
    initial.payment_method = 'DEBIT'
  }

  const requestedLoanSchedule = readQueryValue(searchParams.loan_schedule)
  if (requestedLoanSchedule === 'true') {
    initial.loan_schedule = true
  } else if (requestedLoanSchedule === 'false') {
    initial.loan_schedule = false
  }

  const requestedCreditCardId = readQueryValue(searchParams.credit_card_id)
  if (requestedCreditCardId) {
    initial.credit_card_id = requestedCreditCardId
    initial.payment_method = 'CREDIT'
    initial.type = 'EXPENSE'
  }

  const requestedCategoryId = readQueryValue(searchParams.category_id)
  if (requestedCategoryId) {
    const incomeCategory = options.categories.income.find(category => category.value === requestedCategoryId)
    const expenseCategory = options.categories.expense.find(category => category.value === requestedCategoryId)

    if ((incomeCategory || expenseCategory) && initial.type !== 'TRANSFER') {
      if (!initial.type) {
        if (incomeCategory && !expenseCategory) initial.type = 'INCOME'
        if (expenseCategory && !incomeCategory) initial.type = 'EXPENSE'
      }

      const selectedCategory =
        initial.type === 'INCOME'
          ? incomeCategory
          : initial.type === 'EXPENSE'
            ? expenseCategory
            : expenseCategory ?? incomeCategory

      if (selectedCategory) {
        initial.category_id = selectedCategory.value
        initial.category_system_key = selectedCategory.system_key ?? null
      }
    }
  }

  return initial
}

async function getFormOptions(userId: string): Promise<TransactionFormOptions> {
  const supabase = createClient()

  const [{ data: accounts }, { data: categories }, { data: credits }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, currency, balance, color, icon')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, scope, icon, color, system_key')
      .eq('user_id', userId)
      .order('sort_order'),
    supabase
      .from('credits')
      .select('id, name, currency, account_id, available_amount, status, credit_type')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .eq('credit_type', 'CREDIT_CARD')
      .not('account_id', 'is', null)
      .order('name'),
  ])

  const toAccountOption = (a: {
    id: string; name: string; currency?: string
    balance?: number; icon?: string; color?: string; type?: string
  }): FormSelectOption => ({
    value: a.id,
    label: a.name,
    icon:  a.icon,
    color: a.color,
    meta:  { currency: a.currency, balance: a.balance, type: a.type },
  })

  const toCategoryOption = (c: {
    id: string; name: string; icon?: string
    color?: string; system_key?: string | null
  }): CategoryOption => ({
    value:      c.id,
    label:      normalizeCategoryLabel(c.name),
    icon:       c.icon,
    color:      c.color,
    system_key: c.system_key ?? null,
  })

  const accountById = new Map((accounts ?? []).map(account => [account.id, account]))
  const creditCards: FormSelectOption[] = (credits ?? []).flatMap(credit => {
    const linkedAccount = credit.account_id ? accountById.get(credit.account_id) : null
    if (!linkedAccount) return []

    return [{
      value: credit.id,
      label: `${credit.name} · disp. ${formatNumber(Number(credit.available_amount ?? 0))} ${credit.currency}`,
      icon: 'credit-card',
      color: '#0ea5e9',
      meta: {
        account_id: linkedAccount.id,
        account_name: linkedAccount.name,
        currency: credit.currency,
      },
    }]
  })

  return {
    accounts:   (accounts ?? []).map(toAccountOption),
    creditCards,
    categories: {
      income:  (categories ?? [])
        .filter(c => c.scope === 'INCOME' || c.scope === 'BOTH')
        .map(toCategoryOption),
      expense: (categories ?? [])
        .filter(c => c.scope === 'EXPENSE' || c.scope === 'BOTH')
        .map(toCategoryOption),
    },
    currencies: [
      { value: 'PEN', label: 'PEN — Soles peruanos' },
      { value: 'USD', label: 'USD — Dólares americanos' },
    ],
  }
}

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams?: SearchParamMap
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const options = await getFormOptions(user.id)
  const initialValues = resolveInitialValues(searchParams, options)
  const hasAccounts = options.accounts.length > 0
  const uniqueCategoryCount = new Set([
    ...options.categories.income.map(category => category.value),
    ...options.categories.expense.map(category => category.value),
  ]).size
  const hasCategories = uniqueCategoryCount > 0
  const hasPrefill = Object.keys(initialValues).length > 0

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Nueva transacción</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Registra un ingreso, egreso o transferencia</p>
      </div>

      <div data-testid="new-transaction-summary" className="mb-4 rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--color-text-muted)]">
            Cuentas activas: <span className="text-[var(--color-text)] font-semibold">{options.accounts.length}</span>{' '}
            · Categorías: <span className="text-[var(--color-text)] font-semibold">{uniqueCategoryCount}</span>
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/portfolio"
              className="inline-flex items-center rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
            >
              Portafolio
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
            >
              Administración
            </Link>
            <Link
              href="/transactions"
              className="inline-flex items-center rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
            >
              Movimientos
            </Link>
          </div>
        </div>
        {hasPrefill && (
          <p className="text-[11px] text-emerald-300/85 mt-2">
            Formulario preconfigurado desde otro módulo.
          </p>
        )}
      </div>

      {!hasAccounts ? (
        <div data-testid="new-transaction-no-accounts" className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-amber-300">Primero crea una cuenta</h2>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
              Para registrar transacciones necesitas al menos una cuenta activa en tu portafolio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/portfolio"
              className="inline-flex items-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-[var(--color-on-accent)] hover:bg-emerald-400 transition-colors"
            >
              Ir a Portafolio
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
            >
              Ir a Administración
            </Link>
          </div>
        </div>
      ) : (
          <div data-testid="new-transaction-form-wrapper" className="space-y-3">
          {!hasCategories && (
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <p className="text-[12px] text-[var(--color-text-muted)]">
                Aún no tienes categorías personalizadas. Puedes crearlas en{' '}
                <Link href="/admin" className="text-emerald-300 hover:text-emerald-200 underline">
                  Administración
                </Link>
                .
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
            <TransactionForm
              options={options}
              initialValues={initialValues}
              showSuccessSummary={true}
            />
          </div>
        </div>
      )}
    </div>
  )
}
