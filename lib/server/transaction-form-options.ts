import { createClient } from '@/lib/supabase.server'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import { dedupeAssetTypes } from '@/lib/catalog/catalog-normalization'
import { measureServerOperation } from '@/lib/server/observability'
import type {
  CategoryOption,
  FormSelectOption,
  TransactionFormOptions,
  TransactionFormValues,
} from '@/lib/contracts/ui.contracts'
import type { Database } from '@/types/database.types'

export type TransactionSearchParamMap = Record<string, string | string[] | undefined>
type RecurringTemplateRow = Database['public']['Tables']['recurring_transactions']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']
type AssetTypeRow = Database['public']['Tables']['asset_types']['Row']
type AssetTypeLegacy = Database['public']['Enums']['asset_type']

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

function normalizeCategoryKey(category: Pick<CategoryRow, 'name' | 'scope'>): string {
  return `${category.scope}::${normalizeCategoryLabel(category.name).toLocaleLowerCase('es')}`
}

function preferCategoryCandidate(current: CategoryRow, candidate: CategoryRow): CategoryRow {
  const currentOwned = !current.is_system && current.user_id !== null
  const candidateOwned = !candidate.is_system && candidate.user_id !== null

  if (currentOwned !== candidateOwned) return candidateOwned ? candidate : current
  if ((current.sort_order ?? 0) !== (candidate.sort_order ?? 0)) {
    return (candidate.sort_order ?? 0) < (current.sort_order ?? 0) ? candidate : current
  }

  return current
}

function dedupeCategories(items: CategoryRow[]): CategoryRow[] {
  const grouped = new Map<string, CategoryRow>()

  for (const item of items) {
    const key = normalizeCategoryKey(item)
    const existing = grouped.get(key)
    grouped.set(key, existing ? preferCategoryCandidate(existing, item) : item)
  }

  return [...grouped.values()].sort((a, b) => {
    const sortOrderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0)
    if (sortOrderDiff !== 0) return sortOrderDiff
    return normalizeCategoryLabel(a.name).localeCompare(normalizeCategoryLabel(b.name), 'es')
  })
}

function mapAssetTypeNameToLegacyEnum(name: string): AssetTypeLegacy {
  const normalized = name
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')

  if (normalized.includes('inmueble') || normalized.includes('propiedad') || normalized.includes('real estate')) {
    return 'REAL_ESTATE'
  }
  if (normalized.includes('vehiculo') || normalized.includes('auto') || normalized.includes('carro')) {
    return 'VEHICLE'
  }
  if (
    normalized.includes('equipo') ||
    normalized.includes('tecnologia') ||
    normalized.includes('tecnologico') ||
    normalized.includes('equipamiento')
  ) {
    return 'EQUIPMENT'
  }
  if (normalized.includes('inversion') || normalized.includes('accion') || normalized.includes('etf')) {
    return 'INVESTMENT'
  }

  return 'OTHER'
}

export async function resolveTransactionInitialValues(
  searchParams: TransactionSearchParamMap | undefined,
  userId: string,
  options: TransactionFormOptions,
) : Promise<Partial<TransactionFormValues>> {
  if (!searchParams) return {}

  const initial: Partial<TransactionFormValues> = {}

  const applyCategorySelection = (categoryId: string | undefined) => {
    if (!categoryId) return

    const incomeCategory = options.categories.income.find(category => category.value === categoryId)
    const expenseCategory = options.categories.expense.find(category => category.value === categoryId)

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

  const requestedRecurringId = readQueryValue(searchParams.from_recurring)
  if (requestedRecurringId) {
    const supabase = createClient()
    const { data } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('id', requestedRecurringId)
      .eq('user_id', userId)
      .single()

    const recurring = data as RecurringTemplateRow | null
    if (recurring) {
      initial.type = recurring.type
      initial.source_account_id = recurring.source_account_id ?? undefined
      initial.destination_account_id = recurring.destination_account_id ?? undefined
      initial.amount = Number(recurring.amount ?? 0)
      initial.currency = recurring.currency === 'USD' ? 'USD' : 'PEN'
      initial.description = recurring.description ?? ''
      initial.notes = recurring.notes ?? undefined
      initial.sender = recurring.sender ?? undefined
      initial.recipient = recurring.recipient ?? undefined
      initial.payment_method = recurring.payment_method ?? undefined
      initial.budget_id = recurring.budget_id ?? undefined
      initial.receivable_debtor_id = recurring.debtor_id ?? undefined
      initial.payable_creditor_id = recurring.creditor_id ?? undefined

      if (recurring.sub_type === 'RECEIVABLE_LENDING') {
        initial.type = 'EXPENSE'
        initial.creates_receivable = true
      } else if (recurring.sub_type === 'PAYABLE_PAYMENT') {
        initial.type = 'INCOME'
        initial.creates_payable = true
      }

      applyCategorySelection(recurring.category_id ?? undefined)
    }
  }

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

  const requestedDate = readQueryValue(searchParams.transaction_date)
  if (requestedDate) {
    initial.transaction_date = requestedDate
  }

  const requestedDestinationAccountId = readQueryValue(searchParams.destination_account_id)
  if (
    requestedDestinationAccountId &&
    options.accounts.some(account => account.value === requestedDestinationAccountId)
  ) {
    initial.destination_account_id = requestedDestinationAccountId
  }

  const requestedSender = readQueryValue(searchParams.sender)
  if (requestedSender) {
    initial.sender = requestedSender.slice(0, 150)
  }

  const requestedRecipient = readQueryValue(searchParams.recipient)
  if (requestedRecipient) {
    initial.recipient = requestedRecipient.slice(0, 150)
  }

  const requestedBudgetId = readQueryValue(searchParams.budget_id)
  if (requestedBudgetId) {
    initial.budget_id = requestedBudgetId
  }

  const requestedRecurringName = readQueryValue(searchParams.recurring_name)
  if (requestedRecurringName) {
    initial.recurring_name = requestedRecurringName.slice(0, 150)
    initial.is_recurring = true
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
    if (requestedType === 'EXPENSE') {
      initial.type = 'EXPENSE'
      initial.creates_payable = false
    } else {
      initial.type = 'INCOME'
      initial.creates_payable = true
    }
    initial.creates_asset = false
    initial.creates_credit = false
  } else if (requestedModule === 'receivable') {
    if (requestedType === 'INCOME') {
      initial.type = 'INCOME'
      initial.creates_receivable = false
    } else {
      initial.type = 'EXPENSE'
      initial.creates_receivable = true
    }
  }

  const requestedReceivableId = readQueryValue(searchParams.receivable_id)
  if (
    requestedReceivableId &&
    options.pendingReceivables.some(receivable => receivable.value === requestedReceivableId)
  ) {
    initial.settlement_receivable_id = requestedReceivableId
  }

  const requestedPayableId = readQueryValue(searchParams.payable_id)
  if (
    requestedPayableId &&
    options.pendingPayables.some(payable => payable.value === requestedPayableId)
  ) {
    initial.settlement_payable_id = requestedPayableId
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
  applyCategorySelection(requestedCategoryId)

  return initial
}

export async function getTransactionFormOptions(userId: string): Promise<TransactionFormOptions> {
  return measureServerOperation('transaction-form-options', async () => {
    const supabase = createClient()

    const [
      { data: accounts },
      { data: categories },
      { data: assetTypes },
      { data: credits },
      { data: creditors },
      { data: debtors },
      { data: pendingReceivables },
      { data: pendingPayables },
    ] = await Promise.all([
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
        .from('asset_types')
        .select('id, name, color, icon, is_system, user_id, is_active')
        .or(`user_id.eq.${userId},is_system.eq.true`)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('credits')
        .select('id, name, currency, account_id, available_amount, status, credit_type')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .eq('credit_type', 'CREDIT_CARD')
        .not('account_id', 'is', null)
        .order('name'),
      supabase
        .from('creditors')
        .select('id, name, relationship, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('debtors')
        .select('id, name, relationship, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('accounts_receivable')
        .select('id, debtor_id, debtor_name, concept, amount, collected_amount, currency, due_date, issue_date, status')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('accounts_payable')
        .select('id, creditor_id, creditor_name, concept, amount, paid_amount, currency, due_date, issue_date, status')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])
        .order('due_date', { ascending: true, nullsFirst: false }),
    ])

  const toAccountOption = (a: {
    id: string
    name: string
    currency?: string
    balance?: number
    icon?: string
    color?: string
    type?: string
  }): FormSelectOption => ({
    value: a.id,
    label: a.name,
    icon: a.icon,
    color: a.color,
    meta: { currency: a.currency, balance: a.balance, type: a.type },
  })

  const toCategoryOption = (c: {
    id: string
    name: string
    icon?: string
    color?: string
    system_key?: string | null
  }): CategoryOption => ({
    value: c.id,
    label: normalizeCategoryLabel(c.name),
    icon: c.icon,
    color: c.color,
    system_key: c.system_key ?? null,
  })

  const toAssetTypeOption = (assetType: AssetTypeRow): FormSelectOption => ({
    value: assetType.id,
    label: assetType.name,
    icon: assetType.icon,
    color: assetType.color,
    meta: {
      legacyType: mapAssetTypeNameToLegacyEnum(assetType.name),
      is_system: assetType.is_system,
    },
  })

  const accountById = new Map((accounts ?? []).map(account => [account.id, account]))
  const dedupedCategories = dedupeCategories((categories ?? []) as CategoryRow[])
  const dedupedAssetTypes = dedupeAssetTypes((assetTypes ?? []) as AssetTypeRow[])
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

  const creditorOptions: FormSelectOption[] = (creditors ?? []).map(creditor => ({
    value: creditor.id,
    label: creditor.name,
    icon: 'briefcase',
    color: '#f97316',
    meta: {
      relationship: creditor.relationship ?? null,
    },
  }))

  const debtorOptions: FormSelectOption[] = (debtors ?? []).map(debtor => ({
    value: debtor.id,
    label: debtor.name,
    icon: 'wallet',
    color: '#06b6d4',
    meta: {
      relationship: debtor.relationship ?? null,
    },
  }))

  const pendingReceivablesByDebtor = new Map<string, Array<{
    id: string
    debtor_id: string | null
    debtor_name: string
    concept: string | null
    amount: number
    collected_amount: number
    currency: string
    due_date: string | null
    issue_date: string
    status: string
  }>>()

  for (const receivable of pendingReceivables ?? []) {
    const debtorKey = receivable.debtor_id ?? receivable.debtor_name
    const key = `${debtorKey}::${receivable.currency}`
    const current = pendingReceivablesByDebtor.get(key) ?? []
    current.push(receivable)
    pendingReceivablesByDebtor.set(key, current)
  }

  const pendingReceivableOptions: FormSelectOption[] = []

  for (const receivables of pendingReceivablesByDebtor.values()) {
    const ordered = [...receivables].sort((a, b) => {
      const byDue = (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31')
      if (byDue !== 0) return byDue
      return a.issue_date.localeCompare(b.issue_date)
    })

    const debtorId = ordered[0]?.debtor_id ?? null
    const debtorName = ordered[0]?.debtor_name ?? 'Deudor'
    const currency = ordered[0]?.currency ?? 'PEN'
    const totalPendingAmount = ordered.reduce((sum, receivable) => (
      sum + Math.max(0, Number(receivable.amount ?? 0) - Number(receivable.collected_amount ?? 0))
    ), 0)

    if (debtorId) {
      pendingReceivableOptions.push({
        value: `debtor:${debtorId}:${currency}`,
        label: `Cobro general · ${debtorName} · saldo total ${formatNumber(totalPendingAmount)} ${currency} · ${ordered.length} ${ordered.length === 1 ? 'cuenta' : 'cuentas'}`,
        icon: 'wallet',
        color: '#0f766e',
        meta: {
          kind: 'debtor_total',
          debtor_id: debtorId,
          debtor_name: debtorName,
          concept: `Cobro general (${ordered.length} cuentas)`,
          pending_amount: totalPendingAmount,
          currency,
          lines_count: ordered.length,
          settlement_strategy: 'oldest_first',
        },
      })
    }

    for (const receivable of ordered) {
      const pendingAmount = Math.max(0, Number(receivable.amount ?? 0) - Number(receivable.collected_amount ?? 0))
      const concept = typeof receivable.concept === 'string' && receivable.concept.trim().length > 0
        ? receivable.concept.trim()
        : 'Sin concepto'
      const dueSuffix = receivable.due_date ? ` · vence ${receivable.due_date}` : ''

      pendingReceivableOptions.push({
        value: receivable.id,
        label: `Cuenta puntual · ${receivable.debtor_name} · ${concept} · pendiente ${formatNumber(pendingAmount)} ${receivable.currency}${dueSuffix}`,
        icon: 'wallet',
        color: '#06b6d4',
        meta: {
          kind: 'receivable',
          debtor_id: receivable.debtor_id,
          debtor_name: receivable.debtor_name,
          concept,
          amount: Number(receivable.amount ?? 0),
          collected_amount: Number(receivable.collected_amount ?? 0),
          pending_amount: pendingAmount,
          currency: receivable.currency,
          due_date: receivable.due_date,
          issue_date: receivable.issue_date,
          status: receivable.status,
          lines_count: 1,
        },
      })
    }
  }

  const pendingPayableOptions: FormSelectOption[] = (pendingPayables ?? []).map(payable => {
    const pendingAmount = Math.max(0, Number(payable.amount ?? 0) - Number(payable.paid_amount ?? 0))
    const concept = typeof payable.concept === 'string' && payable.concept.trim().length > 0
      ? payable.concept.trim()
      : 'Sin concepto'
    const dueSuffix = payable.due_date ? ` · vence ${payable.due_date}` : ''

    return {
      value: payable.id,
      label: `${payable.creditor_name} · ${concept} · pendiente ${formatNumber(pendingAmount)} ${payable.currency}${dueSuffix}`,
      icon: 'briefcase',
      color: '#f97316',
      meta: {
        creditor_id: payable.creditor_id,
        creditor_name: payable.creditor_name,
        concept,
        amount: Number(payable.amount ?? 0),
        paid_amount: Number(payable.paid_amount ?? 0),
        pending_amount: pendingAmount,
        currency: payable.currency,
        due_date: payable.due_date,
        issue_date: payable.issue_date,
        status: payable.status,
      },
    }
  })

    return {
      accounts: (accounts ?? []).map(toAccountOption),
      creditCards,
      creditors: creditorOptions,
      debtors: debtorOptions,
      pendingReceivables: pendingReceivableOptions,
      pendingPayables: pendingPayableOptions,
      assetTypes: dedupedAssetTypes.map(toAssetTypeOption),
      categories: {
        income: dedupedCategories
          .filter(c => c.scope === 'INCOME')
          .map(toCategoryOption),
        expense: dedupedCategories
          .filter(c => c.scope === 'EXPENSE')
          .map(toCategoryOption),
      },
      currencies: [
        { value: 'PEN', label: 'PEN — Soles peruanos' },
        { value: 'USD', label: 'USD — Dólares americanos' },
      ],
    }
  }, { warnAtMs: 450, meta: { user_id: userId } })
}
