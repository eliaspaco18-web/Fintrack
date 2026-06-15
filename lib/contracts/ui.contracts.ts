// =============================================================================
// lib/contracts/ui.contracts.ts
// Contratos definitivos entre backend y UI.
// Estos tipos son los que hooks y componentes consumen directamente.
// =============================================================================

import type {
  TransactionType, CurrencyCode, AccountType,
  AssetType, CreditType, ReceivableStatus, PayableStatus,
} from '@/types/database.types'

// ─── ERRORES DE FORMULARIO ────────────────────────────────────────────────────

export interface FormError {
  message?: string
  detail?:  string
  root?:   string
  fields?: Record<string, string[]>
  code?:   string
}

export type FormState<T = void> =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; data: T }
  | { status: 'error';   error: FormError }

// ─── ESTADOS ASÍNCRONOS ───────────────────────────────────────────────────────

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error';   error: string }
  | { status: 'empty' }
  | { status: 'success'; data: T }

// ─── PAGINACIÓN ───────────────────────────────────────────────────────────────

export interface Paginated<T> {
  data:       T[]
  pagination: PaginationMeta
}

// ─── FILTROS DE TRANSACCIONES ─────────────────────────────────────────────────

export interface TransactionFilterParams {
  type?:       TransactionType
  accountId?:  string
  categoryId?: string
  currency?:   CurrencyCode
  dateFrom?:   string
  dateTo?:     string
  search?:     string
  sortBy?:     TransactionSortField
  sortDir?:    SortDirection
  page?:       number
  perPage?:    number
}

export function filtersToSearchParams(f: TransactionFilterParams): URLSearchParams {
  const p = new URLSearchParams()
  if (f.type)       p.set('type',        f.type)
  if (f.accountId)  p.set('account_id',  f.accountId)
  if (f.categoryId) p.set('category_id', f.categoryId)
  if (f.currency)   p.set('currency',    f.currency)
  if (f.dateFrom)   p.set('date_from',   f.dateFrom)
  if (f.dateTo)     p.set('date_to',     f.dateTo)
  if (f.search)     p.set('search',      f.search)
  if (f.page)       p.set('page',        String(f.page))
  if (f.perPage)    p.set('per_page',    String(f.perPage))
  return p
}

// ─── VIEW MODELS ─────────────────────────────────────────────────────────────

export interface TransactionViewModel {
  id:          string
  type:        TransactionType
  typeLabel:   string
  typeColor:   string
  amount:      number
  amountPen:   number
  currency:    CurrencyCode
  description: string
  date:        string
  dateLabel:   string
  isTransfer:  boolean
  affectsReports: boolean
  category:    { id: string | null; name: string; icon: string; color: string }
  sourceAccount: { id: string; name: string; color: string; icon: string }
  destinationAccount: { id: string; name: string; color: string; icon: string } | null
  modules:     { hasAsset: boolean; hasCredit: boolean; hasLoan: boolean; hasReceivable: boolean; hasPayable: boolean }
}

export interface AccountViewModel {
  id: string; name: string; type: AccountType; typeLabel: string
  currency: CurrencyCode; balance: number; balancePen: number; balanceUsd: number
  balanceSign: 'positive' | 'negative' | 'zero'; color: string; icon: string; institution: string | null
}

export type UtilizationLevel = 'low' | 'medium' | 'high' | 'critical'

export interface CreditViewModel {
  id: string; name: string; creditType: CreditType; creditTypeLabel: string
  currency: CurrencyCode; creditLimit: number; usedAmount: number; availableAmount: number
  utilizationPct: number; utilizationLevel: UtilizationLevel
  interestRate: number; closingDay: number | null; paymentDay: number | null
  nextClosingDate: string | null; status: string
}

export interface AssetViewModel {
  id: string; name: string; assetType: AssetType; assetTypeLabel: string
  purchaseValue: number; currentValue: number; currency: CurrencyCode
  purchaseDate: string; gainLoss: number; gainLossPct: number
  gainLossSign: 'positive' | 'negative' | 'zero'; status: string; location: string | null
}

export type UrgencyLevel = 'overdue' | 'due_soon' | 'upcoming' | null

export interface ReceivableViewModel {
  id: string; debtorName: string; amount: number; collectedAmount: number
  pendingAmount: number; currency: CurrencyCode; issueDate: string
  dueDate: string | null; status: ReceivableStatus; urgency: UrgencyLevel
  daysUntilDue: number | null; concept: string | null
}

export interface PayableViewModel {
  id: string; creditorName: string; amount: number; paidAmount: number
  pendingAmount: number; currency: CurrencyCode; issueDate: string
  dueDate: string | null; status: PayableStatus; urgency: UrgencyLevel
  daysUntilDue: number | null; concept: string | null
}

// ─── CONTRATOS POR PANTALLA ───────────────────────────────────────────────────

export const SCREEN_STATES = {
  dashboard:       ['loading', 'error', 'empty', 'success'] as const,
  transactions:    ['loading', 'error', 'empty', 'success'] as const,
  transactionForm: ['idle', 'submitting', 'success', 'error'] as const,
  credits:         ['loading', 'error', 'empty', 'success'] as const,
  assets:          ['loading', 'error', 'empty', 'success'] as const,
  receivables:     ['loading', 'error', 'empty', 'success'] as const,
  payables:        ['loading', 'error', 'empty', 'success'] as const,
  settings:        ['loading', 'error', 'success'] as const,
} as const

// ─── MAPPERS PUROS ────────────────────────────────────────────────────────────

export function mapUrgency(dueDate: string | null, status: string): UrgencyLevel {
  if (!dueDate || ['COLLECTED', 'PAID', 'WRITTEN_OFF'].includes(status)) return null
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return 'overdue'
  if (days <= 7) return 'due_soon'
  return 'upcoming'
}

export function mapUtilizationLevel(pct: number): UtilizationLevel {
  if (pct >= 90) return 'critical'
  if (pct >= 75) return 'high'
  if (pct >= 50) return 'medium'
  return 'low'
}

export function mapTransactionTypeLabel(type: TransactionType) {
  return { INCOME: 'Ingreso', EXPENSE: 'Egreso', TRANSFER: 'Transferencia' }[type]
}

export function mapTransactionTypeColor(type: TransactionType) {
  return {
    INCOME:   'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950',
    EXPENSE:  'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950',
    TRANSFER: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950',
  }[type]
}

export function mapAccountTypeLabel(type: AccountType): string {
  return ({ CHECKING: 'Corriente', SAVINGS: 'Ahorros', CASH: 'Efectivo',
           INVESTMENT: 'Inversión', CREDIT_CARD: 'Tarjeta',
           STOCKS: 'Acciones', ETF: 'ETF', CRYPTO: 'Cripto-activos',
           OTHER: 'Otra' } as Record<AccountType, string>)[type]
}

export function mapCreditTypeLabel(type: CreditType) {
  return { CREDIT_CARD: 'Tarjeta de crédito', LINE_OF_CREDIT: 'Crédito bancario' }[type]
}

export function mapAssetTypeLabel(type: AssetType): string {
  return { REAL_ESTATE: 'Inmueble', VEHICLE: 'Vehículo', EQUIPMENT: 'Equipo',
           INVESTMENT: 'Inversión', OTHER: 'Otro' }[type]
}

export function formatCurrency(amount: number, currency: CurrencyCode, locale = 'es-PE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: currency === 'PEN' ? 'PEN' : 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(
  value: number,
  options?: {
    locale?: string
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    useGrouping?: boolean
  }
): string {
  const locale = options?.locale ?? 'es-PE'
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2
  // Clamp minimum so it never exceeds maximum (prevents Intl.NumberFormat RangeError)
  const minimumFractionDigits = Math.min(options?.minimumFractionDigits ?? 2, maximumFractionDigits)
  const useGrouping = options?.useGrouping ?? true

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
  }).format(value)
}

export function formatPercent(
  value: number,
  options?: {
    locale?: string
    fractionDigits?: number
    signed?: boolean
  }
): string {
  const locale = options?.locale ?? 'es-PE'
  const fractionDigits = options?.fractionDigits ?? 1
  const signed = options?.signed ?? false

  const raw = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(Math.abs(value))

  if (signed) {
    const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
    return `${prefix}${raw}%`
  }

  return `${value < 0 ? '-' : ''}${raw}%`
}

export function formatDateLabel(isoDate: string, locale = 'es-PE'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(isoDate + 'T00:00:00'))
}

// =============================================================================
// ADDITIONS: CategoryOption + category_system_key field
// =============================================================================

/** Opción de categoría con system_key estable para derivar módulos */
export interface CategoryOption {
  value:      string            // category.id (UUID)
  label:      string            // nombre visible
  icon?:      string
  color?:     string
  system_key: string | null     // clave estable; null = categoría de usuario
}

export interface TransactionFormOptions {
  accounts:   FormSelectOption[]
  creditCards: FormSelectOption[]
  creditors: FormSelectOption[]
  debtors: FormSelectOption[]
  pendingReceivables: FormSelectOption[]
  pendingPayables: FormSelectOption[]
  assetTypes: FormSelectOption[]
  categories: {
    income:  CategoryOption[]
    expense: CategoryOption[]
  }
  currencies: FormSelectOption[]
}

// =============================================================================
// TransactionFormValues — state shape for react-hook-form
// =============================================================================

export interface TransactionFormValues {
  type:                    TransactionType
  source_account_id:       string
  payment_method?:         'DEBIT' | 'CREDIT'
  credit_card_id?:         string
  credit_operation?:       'CONSUMPTION' | 'PAYMENT'
  destination_account_id?: string
  category_id?:            string
  /** Internal field — synced from category_id, not sent to server */
  category_system_key?:    string | null
  amount:                  number | ''
  currency:                CurrencyCode
  exchange_rate?:          number | ''
  description:             string
  transaction_date:        string
  notes?:                  string
  is_recurring:            boolean
  recurring_name?:         string
  // Module flags
  creates_asset:      boolean
  asset_name?:        string
  asset_type?:        AssetType
  asset_type_id?:     string
  asset_serial?:      string
  asset_location?:    string
  creates_credit:     boolean
  credit_name?:       string
  credit_type?:       CreditType
  credit_limit?:      number | ''
  credit_rate?:       number | ''
  creates_loan:       boolean
  loan_creditor?:     string
  loan_installments?: number | ''
  loan_rate?:         number | ''
  loan_end_date?:     string
  loan_schedule:      boolean
  creates_receivable: boolean
  receivable_debtor_id?: string
  receivable_debtor?: string
  receivable_due?:    string
  settlement_receivable_id?: string
  creates_payable:    boolean
  payable_creditor_id?: string
  payable_creditor?:  string
  payable_due?:       string
  settlement_payable_id?: string
  // PRD v3 campos adicionales por tipo
  sender?:            string   // Remitente — solo Ingreso (PRD línea 169)
  recipient?:         string   // Destinatario — Egreso y Compra de Activo (PRD líneas 187, 215)
  // Fase B — presupuesto asociado al egreso (PRD línea 135)
  budget_id?:         string   // ID del presupuesto activo (solo Egreso)
}

// ─── CURRENCY DISPLAY ─────────────────────────────────────────────────────────

export type DisplayCurrency = 'PEN' | 'USD'

/** Converts amount in original currency to PEN */
export function toPenAmount(
  amount:       number,
  currency:     CurrencyCode,
  exchangeRate: number
): number {
  if (currency === 'PEN') return amount
  return Math.round(amount * exchangeRate * 100) / 100
}

/** Converts amountPen to the user's preferred display currency */
export function toDisplayAmount(
  amountPen:    number,
  preferred:    DisplayCurrency,
  exchangeRate: number
): number {
  if (preferred === 'PEN') return amountPen
  return Math.round((amountPen / exchangeRate) * 100) / 100
}

// ─── TRANSACTION LIST TYPES ───────────────────────────────────────────────────


export type TransactionSortField = 'transaction_date' | 'amount' | 'created_at'
export type SortDirection        = 'asc' | 'desc'

export interface TransactionListParams {
  type?:        TransactionType
  account_id?:  string
  category_id?: string
  currency?:    CurrencyCode
  date_from?:   string
  date_to?:     string
  search?:      string
  sort_by?:     TransactionSortField
  sort_dir?:    SortDirection
  page?:        number
  per_page?:    number
}

export interface PaginationMeta {
  page:      number
  per_page:  number
  total:     number
  has_more:  boolean
}

export interface PaginatedResponse<T> {
  data:       T[]
  pagination: PaginationMeta
}

export interface TransactionListItem {
  id:                     string
  type:                   TransactionType
  amount:                 number
  amountPen:              number
  currency:               CurrencyCode
  description:            string
  transactionDate:        string
  transaction_date:       string
  affectsReports:         boolean
  sourceAccount:  { id: string; name: string; color: string; icon: string } | null
  source_account: { id: string; name: string; color: string; icon: string } | null
  destinationAccount: { id: string; name: string; color: string; icon: string } | null
  destination_account: { id: string; name: string; color: string; icon: string } | null
  category: { id: string; name: string; icon: string; color: string } | null
  hasAsset?:      boolean
  hasCredit?:     boolean
  hasReceivable?: boolean
  hasPayable?:    boolean
}

export type QuickFilter = 'all' | 'income' | 'expense' | 'transfer' | 'this_month' | 'last_month' | 'this_year'

export const QuickFilterParams: Record<QuickFilter, Partial<TransactionListParams>> = {
  all:        {},
  income:     { type: 'INCOME' },
  expense:    { type: 'EXPENSE' },
  transfer:   { type: 'TRANSFER' },
  this_month: {
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
  },
  last_month: (() => {
    const d = new Date()
    return {
      date_from: new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0],
      date_to:   new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0],
    }
  })(),
  this_year: {
    date_from: `${new Date().getFullYear()}-01-01`,
    date_to:   new Date().toISOString().split('T')[0],
  },
}

// ─── ACTION STATE + FORM SELECT ──────────────────────────────────────────────

export type ActionState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error';   error: FormError }

export interface FormSelectOption {
  value:  string
  label:  string
  icon?:  string
  color?: string
  meta?:  Record<string, unknown>
}
