'use client'

// =============================================================================
// components/tables/TransactionTable.tsx
// Tabla completa de transacciones con toolbar, filtros rápidos, búsqueda,
// ordenamiento por columna y paginación.
// =============================================================================

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback,
         useDeferredValue,
         useEffect,
         useMemo,
         useRef,
         type ReactNode,
         type RefObject }            from 'react'
import { useTransactions }           from '@/lib/hooks/useTransactions'
import { useCurrency }               from '@/lib/hooks/useDashboard'
import { fetchWithTimeout }          from '@/lib/client/fetch-with-timeout'
import { formatCurrency }            from '@/lib/contracts/ui.contracts'
import {
  QuickFilterParams,
  type QuickFilter,
  type TransactionListItem,
  type TransactionListParams,
}                                    from '@/lib/contracts/ui.contracts'
import {
  ConfirmDialog,
  DataErrorBanner,
  DataFilterPreset,
  DataPagination,
  DataRefreshIndicator,
  DataRowActions,
  DataSearchField,
  DataSortSelect,
  DataTable,
  DataToolbar,
  DataToolbarRow,
  EmptyState as FinanceEmptyState,
  SavedViewsToolbar,
}                                    from '@/components/finance'
import {
  AmountCell,
  DateCell,
}                                    from './primitives'
import { FocusTrap }                 from '@/components/ui/accessibility'
import { ModalOverlayPortal }        from '@/components/ui/ModalOverlayPortal'
import { AppSelect }                 from '@/components/ui/AppSelect'
import { Button }                    from '@/components/ui/Button'
import { FinancialIcon }             from '@/components/ui/FinancialIcon'
import { TransactionEditModal }      from '@/components/forms/TransactionEditModal'
import type { TransactionType }      from '@/types/database.types'
import type { TransactionFormOptions } from '@/lib/contracts/ui.contracts'

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'income', label: 'Ingresos' },
  { key: 'expense', label: 'Egresos' },
  { key: 'transfer', label: 'Transferencias' },
  { key: 'this_month', label: 'Este mes' },
  { key: 'last_month', label: 'Mes pasado' },
]

const SORT_OPTIONS = [
  { value: 'transaction_date-desc', label: 'Más recientes' },
  { value: 'transaction_date-asc',  label: 'Más antiguas'  },
  { value: 'amount-desc',           label: 'Mayor monto'   },
  { value: 'amount-asc',            label: 'Menor monto'   },
]

const PER_PAGE_OPTIONS = [20, 50, 100] as const

const TYPE_CONFIG: Record<TransactionType, { label: string; prefix: string; className: string }> = {
  INCOME: {
    label: 'Ingreso',
    prefix: '+',
    className: 'text-[var(--ft-success)]',
  },
  EXPENSE: {
    label: 'Egreso',
    prefix: '−',
    className: 'text-[var(--ft-text-muted)]',
  },
  TRANSFER: {
    label: 'Transferencia',
    prefix: '⇄',
    className: 'text-[var(--ft-info)]',
  },
}

// ─── TYPE BADGE ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: TransactionType }) {
  const cfg = TYPE_CONFIG[type]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${cfg.className}`}>
      <span aria-hidden="true" className="font-mono text-[12px]">{cfg.prefix}</span>
      {cfg.label}
    </span>
  )
}

// ─── MODULE BADGES ────────────────────────────────────────────────────────────

function ModuleBadges({ tx }: {
  tx: { hasAsset?: boolean; hasCredit?: boolean; hasReceivable?: boolean; hasPayable?: boolean }
}) {
  const badges = [
    tx.hasAsset && 'Activo',
    tx.hasCredit && 'Crédito',
    tx.hasReceivable && 'X Cobrar',
    tx.hasPayable && 'X Pagar',
  ].filter(Boolean) as string[]

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {badges.map(label => (
        <span
          key={label}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--ft-text-subtle)]"
        >
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-current" />
          {label}
        </span>
      ))}
    </div>
  )
}

function TransactionIdentityMark({ transaction }: { transaction: TransactionListItem }) {
  const identity = transaction.category ?? transaction.sourceAccount ?? transaction.destinationAccount
  const iconName = identity?.icon || (transaction.type === 'TRANSFER' ? 'wallet' : 'tag')
  const iconColor = identity?.color || 'var(--ft-text-muted)'

  return (
    <span
      aria-hidden="true"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-surface border border-[var(--ft-border)] bg-[var(--ft-surface-muted)]"
    >
      <span style={{ color: iconColor }}>
        <FinancialIcon name={iconName} size={17} />
      </span>
    </span>
  )
}

function TransactionAccountPath({ transaction }: { transaction: TransactionListItem }) {
  const sourceName = transaction.sourceAccount?.name ?? '—'
  const destinationName = transaction.destinationAccount?.name

  return (
    <div className="min-w-0 text-[12px] leading-5">
      <p className="truncate font-medium text-[var(--ft-text-strong)]">{sourceName}</p>
      {destinationName ? (
        <p className="flex min-w-0 items-center gap-1 text-[var(--ft-text-muted)]">
          <span aria-hidden="true" className="shrink-0 text-[var(--ft-text-subtle)]">→</span>
          <span className="truncate">{destinationName}</span>
        </p>
      ) : null}
    </div>
  )
}

function TransactionContext({ transaction }: { transaction: TransactionListItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-[var(--ft-text-muted)]">
      {transaction.category ? (
        <span>{normalizeCategoryLabel(transaction.category.name)}</span>
      ) : null}
      <TypeBadge type={transaction.type} />
      {!transaction.affectsReports ? (
        <span className="inline-flex items-center gap-1 text-[var(--ft-warning)]">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-current" />
          No afecta reportes
        </span>
      ) : null}
      <ModuleBadges tx={transaction} />
    </div>
  )
}

function MobileTransactionSkeletons() {
  return (
    <div aria-hidden="true" className="divide-y divide-[var(--ft-border)] xl:hidden">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-3 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-surface bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/5 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
            </div>
            <div className="shrink-0 space-y-2 text-right">
              <div className="ml-auto h-4 w-24 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
              <div className="ml-auto h-3 w-16 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
            </div>
          </div>
          <div className="ml-[52px] h-3 w-1/2 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  )
}

function DesktopLedgerSkeletons() {
  return (
    <div aria-hidden="true" className="hidden xl:block">
      <div className="divide-y divide-[var(--ft-border)]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="grid min-h-[82px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
            <div className="h-4 w-4 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
            <div className="grid grid-cols-[92px_minmax(0,1.45fr)_minmax(0,0.85fr)_minmax(120px,0.6fr)] items-center gap-4">
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-surface bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-3/5 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
                <div className="h-3 w-2/5 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
              </div>
              <div className="space-y-2 text-right">
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
                <div className="ml-auto h-3 w-16 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
              </div>
            </div>
            <div className="h-9 w-24 animate-pulse rounded-control bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  )
}

function LedgerColumnHeader({
  allVisibleSelected,
  selectAllRef,
  onToggleSelectVisible,
  sortBy,
  sortDir,
  onSort,
}: {
  allVisibleSelected: boolean
  selectAllRef: RefObject<HTMLInputElement>
  onToggleSelectVisible: () => void
  sortBy: TransactionListParams['sort_by']
  sortDir: 'asc' | 'desc'
  onSort: (value: string) => void
}) {
  return (
    <div className="hidden min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-5 text-[11px] font-medium text-[var(--ft-text-muted)] xl:grid">
      <input
        ref={selectAllRef}
        type="checkbox"
        checked={allVisibleSelected}
        onChange={onToggleSelectVisible}
        aria-label="Seleccionar transacciones visibles"
        className="h-4 w-4 rounded border border-[var(--ft-border)] text-[var(--ft-primary)] accent-[var(--ft-primary)]"
      />
      <div className="grid min-w-0 grid-cols-[92px_minmax(0,1.45fr)_minmax(0,0.85fr)_minmax(120px,0.6fr)] items-center gap-4">
        <button
          type="button"
          onClick={() => onSort(`transaction_date-${sortBy === 'transaction_date' && sortDir === 'desc' ? 'asc' : 'desc'}`)}
          aria-pressed={sortBy === 'transaction_date'}
          className="justify-self-start rounded-control px-2 py-1.5 transition-colors duration-fast hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)] motion-reduce:transition-none"
        >
          Fecha {sortBy === 'transaction_date' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
        </button>
        <span id="transactions-ledger-heading">Movimiento</span>
        <span className="truncate">Cuenta / ruta</span>
        <button
          type="button"
          onClick={() => onSort(`amount-${sortBy === 'amount' && sortDir === 'desc' ? 'asc' : 'desc'}`)}
          aria-pressed={sortBy === 'amount'}
          className="justify-self-end rounded-control px-2 py-1.5 text-right transition-colors duration-fast hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)] motion-reduce:transition-none"
        >
          Monto {sortBy === 'amount' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
        </button>
      </div>
      <span className="w-[112px] text-right">Acciones</span>
    </div>
  )
}

function ReviewFactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 py-3.5">
      <dt className="text-[11px] font-medium text-[var(--ft-text-muted)]">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[12px] font-medium text-[var(--ft-text-strong)]">
        {children}
      </dd>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface TransactionTableProps {
  initialParams?: Partial<TransactionListParams>
  options: TransactionFormOptions
  workspaceHeader?: ReactNode
}

type FilterOption = { value: string; label: string }

type AccountFilterRow = {
  id: string
  name: string
  currency: 'PEN' | 'USD'
}

type CategoryFilterRow = {
  id: string
  name: string
  scope: 'INCOME' | 'EXPENSE'
  icon: string | null
}

interface TableControlState {
  activeFilter: QuickFilter
  search: string
  sort: string
  accountId: string
  categoryId: string
  page: number
  perPage: number
  txParams: Partial<TransactionListParams>
}

interface StoredTablePrefs {
  quickFilter?: QuickFilter
  sort?: string
  perPage?: number
}

interface SavedTransactionViewState {
  activeFilter: QuickFilter
  search: string
  sort: string
  accountId: string
  categoryId: string
  perPage: number
}

interface SavedTransactionView {
  id: string
  name: string
  state: SavedTransactionViewState
}

const QUICK_FILTER_SET = new Set<QuickFilter>(
  QUICK_FILTERS.map(filter => filter.key)
)

const SORT_BY_VALUES: Array<NonNullable<TransactionListParams['sort_by']>> = [
  'transaction_date',
  'amount',
  'created_at',
]

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

const TABLE_PREFS_STORAGE_KEY = 'fintrack.transactions.table-prefs.v1'
const TABLE_SAVED_VIEWS_STORAGE_KEY = 'fintrack.transactions.saved-views.v1'

function isQuickFilter(value: string): value is QuickFilter {
  return QUICK_FILTER_SET.has(value as QuickFilter)
}

function isSortBy(value: string): value is NonNullable<TransactionListParams['sort_by']> {
  return SORT_BY_VALUES.includes(value as NonNullable<TransactionListParams['sort_by']>)
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

function isPerPageAllowed(value: number): value is (typeof PER_PAGE_OPTIONS)[number] {
  return PER_PAGE_OPTIONS.includes(value as (typeof PER_PAGE_OPTIONS)[number])
}

function normalizeCategoryLabel(raw: string): string {
  const clean = raw.trim()
  if (!clean) return 'Sin categoría'

  const prefixPattern = new RegExp(`^(${CATEGORY_ICON_PREFIXES.join('|')})\\s+`, 'i')
  const withoutPrefix = clean.replace(prefixPattern, '')
  const normalized = withoutPrefix.replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : clean
}

function isSortValue(value: string): boolean {
  const [sortBy, sortDir] = value.split('-')
  if (!sortBy || !sortDir) return false
  return isSortBy(sortBy) && (sortDir === 'asc' || sortDir === 'desc')
}

function readTablePrefs(): StoredTablePrefs | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(TABLE_PREFS_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as StoredTablePrefs
    const safe: StoredTablePrefs = {}

    if (parsed.quickFilter && isQuickFilter(parsed.quickFilter)) {
      safe.quickFilter = parsed.quickFilter
    }
    if (parsed.sort && isSortValue(parsed.sort)) {
      safe.sort = parsed.sort
    }
    if (typeof parsed.perPage === 'number' && isPerPageAllowed(parsed.perPage)) {
      safe.perPage = parsed.perPage
    }

    return safe
  } catch {
    return null
  }
}

function writeTablePrefs(prefs: StoredTablePrefs) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TABLE_PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Ignorar errores de storage (modo privado, cuota, etc.)
  }
}

function isSavedViewState(value: unknown): value is SavedTransactionViewState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SavedTransactionViewState>
  return (
    typeof candidate.search === 'string' &&
    typeof candidate.sort === 'string' &&
    typeof candidate.accountId === 'string' &&
    typeof candidate.categoryId === 'string' &&
    typeof candidate.perPage === 'number' &&
    isQuickFilter(String(candidate.activeFilter)) &&
    isSortValue(candidate.sort) &&
    isPerPageAllowed(candidate.perPage)
  )
}

function readSavedViews(): SavedTransactionView[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(TABLE_SAVED_VIEWS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map(item => {
        const view = item as Partial<SavedTransactionView>
        if (
          typeof view.id !== 'string' ||
          typeof view.name !== 'string' ||
          !isSavedViewState(view.state)
        ) {
          return null
        }
        return {
          id: view.id,
          name: view.name,
          state: view.state,
        } satisfies SavedTransactionView
      })
      .filter((view): view is SavedTransactionView => view !== null)
  } catch {
    return []
  }
}

function writeSavedViews(views: SavedTransactionView[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TABLE_SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views))
  } catch {
    // Ignorar errores de storage (modo privado, cuota, etc.)
  }
}

function areSavedViewStatesEqual(
  a: SavedTransactionViewState,
  b: SavedTransactionViewState
): boolean {
  return (
    a.activeFilter === b.activeFilter &&
    a.search === b.search &&
    a.sort === b.sort &&
    a.accountId === b.accountId &&
    a.categoryId === b.categoryId &&
    a.perPage === b.perPage
  )
}

function resolveInitialControlState(
  initialParams: Partial<TransactionListParams>,
  searchParams: Pick<URLSearchParams, 'get'>
): TableControlState {
  const queryQuickFilter = searchParams.get('qf')
  const queryType = searchParams.get('type')
  const hasDateRange = Boolean(searchParams.get('date_from') || searchParams.get('date_to'))

  let activeFilter: QuickFilter = 'all'
  if (queryQuickFilter && isQuickFilter(queryQuickFilter)) {
    activeFilter = queryQuickFilter
  } else if (queryType === 'INCOME') {
    activeFilter = 'income'
  } else if (queryType === 'EXPENSE') {
    activeFilter = 'expense'
  } else if (queryType === 'TRANSFER') {
    activeFilter = 'transfer'
  } else if (hasDateRange) {
    activeFilter = 'all'
  } else if (initialParams.type === 'INCOME') {
    activeFilter = 'income'
  } else if (initialParams.type === 'EXPENSE') {
    activeFilter = 'expense'
  } else if (initialParams.type === 'TRANSFER') {
    activeFilter = 'transfer'
  }

  const querySortBy = searchParams.get('sort_by')
  const querySortDir = searchParams.get('sort_dir')
  const fallbackSortBy = initialParams.sort_by ?? 'transaction_date'
  const fallbackSortDir = initialParams.sort_dir ?? 'desc'
  const sortBy = querySortBy && isSortBy(querySortBy) ? querySortBy : fallbackSortBy
  const sortDir =
    querySortDir === 'asc' || querySortDir === 'desc'
      ? querySortDir
      : fallbackSortDir
  const sort = `${sortBy}-${sortDir}`

  const rawSearch = searchParams.get('search') ?? initialParams.search ?? ''
  const search = rawSearch.slice(0, 100)
  const rawAccountId = searchParams.get('account_id') ?? initialParams.account_id ?? ''
  const rawCategoryId = searchParams.get('category_id') ?? initialParams.category_id ?? ''
  const accountId = rawAccountId && isUuid(rawAccountId) ? rawAccountId : ''
  const categoryId = rawCategoryId && isUuid(rawCategoryId) ? rawCategoryId : ''
  const rawPage = Number(searchParams.get('page') ?? initialParams.page ?? 1)
  const rawPerPage = Number(searchParams.get('per_page') ?? initialParams.per_page ?? 20)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const perPage = Number.isInteger(rawPerPage) && rawPerPage > 0 && rawPerPage <= 100 ? rawPerPage : 20

  return {
    activeFilter,
    search,
    sort,
    accountId,
    categoryId,
    page,
    perPage,
    txParams: {
      ...QuickFilterParams[activeFilter],
      search: search || undefined,
      account_id: accountId || undefined,
      category_id: categoryId || undefined,
      sort_by: sortBy as TransactionListParams['sort_by'],
      sort_dir: sortDir as 'asc' | 'desc',
      page,
      per_page: perPage,
    },
  }
}

export function TransactionTable({
  initialParams = {},
  options,
  workspaceHeader,
}: TransactionTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { preferred, format, exchangeRate } = useCurrency()

  const initialControlRef = useRef<TableControlState | null>(null)
  const baseInitialParamsRef = useRef(initialParams)
  const lastSyncedQueryRef = useRef(searchParams.toString())
  if (!initialControlRef.current) {
    initialControlRef.current = resolveInitialControlState(initialParams, searchParams)
  }
  const initialControl = initialControlRef.current

  const [activeFilter, setActiveFilter] = useState<QuickFilter>(initialControl.activeFilter)
  const [search,       setSearch]       = useState(initialControl.search)
  const [sort,         setSort]         = useState(initialControl.sort)
  const [accountId,    setAccountId]    = useState(initialControl.accountId)
  const [categoryId,   setCategoryId]   = useState(initialControl.categoryId)
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [accountOptions, setAccountOptions] = useState<FilterOption[]>([])
  const [categoryOptions, setCategoryOptions] = useState<FilterOption[]>([])
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(true)
  const [filterOptionsError, setFilterOptionsError] = useState<string | null>(null)
  const [filterOptionsReloadTick, setFilterOptionsReloadTick] = useState(0)
  const [savedViews, setSavedViews] = useState<SavedTransactionView[]>([])
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('')
  const [saveViewModalOpen, setSaveViewModalOpen] = useState(false)
  const [saveViewNameDraft, setSaveViewNameDraft] = useState('')
  const [saveViewError, setSaveViewError] = useState<string | null>(null)
  const [deleteSavedViewModalOpen, setDeleteSavedViewModalOpen] = useState(false)
  const [deleteTransactionModalOpen, setDeleteTransactionModalOpen] = useState(false)
  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(null)
  const [editTransactionId, setEditTransactionId] = useState<string | null>(null)
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([])
  const [focusedTransactionId, setFocusedTransactionId] = useState<string | null>(null)
  const [reviewPanelVisible, setReviewPanelVisible] = useState(false)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const initializedFiltersRef = useRef(false)
  const suspendControlToParamsSyncRef = useRef(false)
  const loadedPrefsRef = useRef(false)
  const loadedSavedViewsRef = useRef(false)
  const selectAllRef = useRef<HTMLInputElement | null>(null)
  const mobileSelectAllRef = useRef<HTMLInputElement | null>(null)
  const reviewOpenFrameRef = useRef<number | null>(null)
  const reviewCloseTimerRef = useRef<number | null>(null)
  const reviewReturnFocusRef = useRef<HTMLElement | null>(null)

  const deferredSearch = useDeferredValue(search)

  const [sortBy, sortDir] = sort.split('-') as [TransactionListParams['sort_by'], 'asc' | 'desc']
  const selectedSavedView = useMemo(
    () => savedViews.find(view => view.id === selectedSavedViewId) ?? null,
    [savedViews, selectedSavedViewId]
  )
  const normalizedSaveViewName = useMemo(
    () => saveViewNameDraft.trim().toLowerCase(),
    [saveViewNameDraft]
  )
  const duplicatedSavedView = useMemo(
    () =>
      normalizedSaveViewName
        ? savedViews.find(view => view.name.toLowerCase() === normalizedSaveViewName) ?? null
        : null,
    [normalizedSaveViewName, savedViews]
  )

  const {
    transactions,
    pagination,
    isLoading,
    isValidating,
    isEmpty,
    params,
    setParams,
    setPage,
    remove,
    bulkRemove,
    refresh,
    deleteState,
    bulkDeleteState,
  } = useTransactions({
    ...initialParams,
    ...initialControl.txParams,
  })

  const selectedTransactionForDelete = useMemo(
    () => transactions.find(tx => tx.id === deleteTransactionId) ?? null,
    [deleteTransactionId, transactions]
  )
  const selectedTransactionForEdit = useMemo(
    () => transactions.find(tx => tx.id === editTransactionId) ?? null,
    [editTransactionId, transactions]
  )
  const selectedTransactions = useMemo(
    () => transactions.filter(tx => selectedTransactionIds.includes(tx.id)),
    [selectedTransactionIds, transactions]
  )
  const focusedTransaction = useMemo(
    () => transactions.find(tx => tx.id === focusedTransactionId) ?? null,
    [focusedTransactionId, transactions]
  )
  const focusedTransactionIndex = focusedTransaction
    ? transactions.findIndex(tx => tx.id === focusedTransaction.id)
    : -1
  const focusedTransactionPosition = focusedTransaction
    ? focusedTransactionIndex + 1
    : 0
  const focusedTransactionHasModuleContext = Boolean(
    focusedTransaction?.hasAsset
    || focusedTransaction?.hasCredit
    || focusedTransaction?.hasReceivable
    || focusedTransaction?.hasPayable
  )
  const visibleTransactionIds = useMemo(
    () => transactions.map(tx => tx.id),
    [transactions]
  )
  const allVisibleSelected = visibleTransactionIds.length > 0
    && visibleTransactionIds.every(id => selectedTransactionIds.includes(id))
  const someVisibleSelected = visibleTransactionIds.some(id => selectedTransactionIds.includes(id))

  const currentViewState = useMemo<SavedTransactionViewState>(
    () => ({
      activeFilter,
      search,
      sort,
      accountId,
      categoryId,
      perPage: params.per_page ?? 20,
    }),
    [activeFilter, search, sort, accountId, categoryId, params.per_page]
  )

  const closeTransactionReview = useCallback(() => {
    if (reviewOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(reviewOpenFrameRef.current)
      reviewOpenFrameRef.current = null
    }
    if (reviewCloseTimerRef.current !== null) {
      window.clearTimeout(reviewCloseTimerRef.current)
    }

    const returnFocus = reviewReturnFocusRef.current
    setReviewPanelVisible(false)
    reviewCloseTimerRef.current = window.setTimeout(() => {
      setFocusedTransactionId(null)
      reviewCloseTimerRef.current = null
      if (returnFocus?.isConnected) returnFocus.focus()
    }, 300)
  }, [])

  const openTransactionReview = useCallback((id: string) => {
    if (reviewCloseTimerRef.current !== null) {
      window.clearTimeout(reviewCloseTimerRef.current)
      reviewCloseTimerRef.current = null
    }
    if (reviewOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(reviewOpenFrameRef.current)
      reviewOpenFrameRef.current = null
    }

    if (document.activeElement instanceof HTMLElement) {
      reviewReturnFocusRef.current = document.activeElement
    }

    setFocusedTransactionId(id)
    if (reviewPanelVisible) return

    setReviewPanelVisible(false)
    reviewOpenFrameRef.current = window.requestAnimationFrame(() => {
      setReviewPanelVisible(true)
      reviewOpenFrameRef.current = null
    })
  }, [reviewPanelVisible])

  const activateTransactionRow = useCallback((id: string) => {
    if (window.matchMedia('(min-width: 1360px)').matches) {
      openTransactionReview(id)
      return
    }

    router.push(`/transactions/${id}`)
  }, [openTransactionReview, router])

  const moveTransactionReview = useCallback((direction: -1 | 1) => {
    const nextTransaction = transactions[focusedTransactionIndex + direction]
    if (!nextTransaction) return
    setFocusedTransactionId(nextTransaction.id)
    const nextTrigger = document.querySelector<HTMLElement>(
      `[data-review-trigger-id="${nextTransaction.id}"]`
    )
    if (nextTrigger) reviewReturnFocusRef.current = nextTrigger
  }, [focusedTransactionIndex, transactions])

  useEffect(() => () => {
    if (reviewOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(reviewOpenFrameRef.current)
    }
    if (reviewCloseTimerRef.current !== null) {
      window.clearTimeout(reviewCloseTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!reviewPanelVisible) return

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      event.preventDefault()
      closeTransactionReview()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeTransactionReview, reviewPanelVisible])

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1360px)')
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) return
      if (reviewOpenFrameRef.current !== null) {
        window.cancelAnimationFrame(reviewOpenFrameRef.current)
        reviewOpenFrameRef.current = null
      }
      if (reviewCloseTimerRef.current !== null) {
        window.clearTimeout(reviewCloseTimerRef.current)
        reviewCloseTimerRef.current = null
      }
      setReviewPanelVisible(false)
      setFocusedTransactionId(null)
    }

    desktopQuery.addEventListener('change', handleViewportChange)
    return () => desktopQuery.removeEventListener('change', handleViewportChange)
  }, [])

  useEffect(() => {
    if (!focusedTransactionId || focusedTransaction) return
    setReviewPanelVisible(false)
    setFocusedTransactionId(null)
  }, [focusedTransaction, focusedTransactionId])

  useEffect(() => {
    if (!initializedFiltersRef.current) {
      initializedFiltersRef.current = true
      return
    }

    if (suspendControlToParamsSyncRef.current) {
      suspendControlToParamsSyncRef.current = false
      return
    }

    const quickDateParams = QuickFilterParams[activeFilter]
    setParams({
      search:   deferredSearch || undefined,
      account_id: accountId || undefined,
      category_id: categoryId || undefined,
      sort_by:  sortBy,
      sort_dir: sortDir,
      ...quickDateParams,
      // PRD: explicit date pickers override quick-filter dates
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
    })
  }, [activeFilter, accountId, categoryId, dateFrom, dateTo, deferredSearch, sortBy, sortDir, setParams])

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString())
    const activeQuickFilterParams = QuickFilterParams[activeFilter]

    const setOrDelete = (key: string, value: string | undefined) => {
      if (!value) {
        next.delete(key)
        return
      }
      next.set(key, value)
    }

    setOrDelete('qf', activeFilter !== 'all' ? activeFilter : undefined)
    setOrDelete('search', deferredSearch || undefined)
    setOrDelete('account_id', accountId || undefined)
    setOrDelete('category_id', categoryId || undefined)
    setOrDelete('type', activeQuickFilterParams.type)
    setOrDelete('date_from', dateFrom || activeQuickFilterParams.date_from)
    setOrDelete('date_to', dateTo || activeQuickFilterParams.date_to)

    if (sort === 'transaction_date-desc') {
      next.delete('sort_by')
      next.delete('sort_dir')
    } else {
      next.set('sort_by', sortBy ?? 'transaction_date')
      next.set('sort_dir', sortDir)
    }

    const currentPage = params.page ?? 1
    const currentPerPage = params.per_page ?? 20
    setOrDelete('page', currentPage > 1 ? String(currentPage) : undefined)
    setOrDelete('per_page', currentPerPage !== 20 ? String(currentPerPage) : undefined)

    const nextQuery = next.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery !== currentQuery) {
      lastSyncedQueryRef.current = nextQuery
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    }
  }, [
    activeFilter,
    accountId,
    categoryId,
    dateFrom,
    dateTo,
    deferredSearch,
    pathname,
    router,
    searchParams,
    sort,
    sortBy,
    sortDir,
    params.page,
    params.per_page,
  ])

  useEffect(() => {
    if (loadedPrefsRef.current) return
    loadedPrefsRef.current = true

    const prefs = readTablePrefs()
    if (!prefs) return

    const hasQuickFilterInUrl =
      searchParams.has('qf') ||
      searchParams.has('type') ||
      searchParams.has('date_from') ||
      searchParams.has('date_to')
    const hasSortInUrl = searchParams.has('sort_by') || searchParams.has('sort_dir')
    const hasPerPageInUrl = searchParams.has('per_page')

    if (!hasQuickFilterInUrl && prefs.quickFilter && prefs.quickFilter !== activeFilter) {
      setActiveFilter(prefs.quickFilter)
    }
    if (!hasSortInUrl && prefs.sort && prefs.sort !== sort) {
      setSort(prefs.sort)
    }
    if (!hasPerPageInUrl && prefs.perPage && prefs.perPage !== (params.per_page ?? 20)) {
      setParams({ per_page: prefs.perPage, page: 1 })
    }
  }, [activeFilter, params.per_page, searchParams, setParams, sort])

  useEffect(() => {
    if (!loadedPrefsRef.current) return
    writeTablePrefs({
      quickFilter: activeFilter,
      sort,
      perPage: params.per_page ?? 20,
    })
  }, [activeFilter, sort, params.per_page])

  useEffect(() => {
    if (loadedSavedViewsRef.current) return
    loadedSavedViewsRef.current = true
    setSavedViews(readSavedViews())
  }, [])

  useEffect(() => {
    const currentQuery = searchParams.toString()
    if (currentQuery === lastSyncedQueryRef.current) return

    const fromUrl = resolveInitialControlState(baseInitialParamsRef.current, searchParams)

    suspendControlToParamsSyncRef.current = true
    setActiveFilter(fromUrl.activeFilter)
    setSearch(fromUrl.search)
    setSort(fromUrl.sort)
    setAccountId(fromUrl.accountId)
    setCategoryId(fromUrl.categoryId)
    setParams(fromUrl.txParams)

    lastSyncedQueryRef.current = currentQuery
  }, [searchParams, setParams])

  useEffect(() => {
    let cancelled = false

    const loadFilterOptions = async () => {
      setLoadingFilterOptions(true)
      setFilterOptionsError(null)

      try {
        const [accountsRes, categoriesRes] = await Promise.all([
          fetchWithTimeout('/api/accounts', { cache: 'no-store' }),
          fetchWithTimeout('/api/categories?include_system=false', { cache: 'no-store' }),
        ])

        const [accountsJson, categoriesJson] = await Promise.all([
          accountsRes.json().catch(() => null),
          categoriesRes.json().catch(() => null),
        ])

        if (cancelled) return
        if (!accountsRes.ok || !accountsJson?.ok || !categoriesRes.ok || !categoriesJson?.ok) {
          setAccountOptions([])
          setCategoryOptions([])
          setFilterOptionsError('No se pudieron cargar cuentas y categorías.')
          return
        }

        const rawAccounts = (accountsJson.data ?? []) as AccountFilterRow[]
        const rawCategories = (categoriesJson.data ?? []) as CategoryFilterRow[]

        const nextAccounts = rawAccounts
          .map(item => ({
            value: item.id,
            label: `${item.name} · ${item.currency}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es'))

        const scopeLabel: Record<CategoryFilterRow['scope'], string> = {
          INCOME: 'Ingreso',
          EXPENSE: 'Egreso',
        }

        const nextCategories = rawCategories
          .map(item => ({
            value: item.id,
            label: `${normalizeCategoryLabel(item.name)} · ${scopeLabel[item.scope]}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es'))

        setAccountOptions(nextAccounts)
        setCategoryOptions(nextCategories)
        setFilterOptionsError(null)
      } catch {
        if (cancelled) return
        setAccountOptions([])
        setCategoryOptions([])
        setFilterOptionsError('No se pudieron cargar cuentas y categorías.')
      } finally {
        if (!cancelled) setLoadingFilterOptions(false)
      }
    }

    void loadFilterOptions()

    return () => {
      cancelled = true
    }
  }, [filterOptionsReloadTick])

  useEffect(() => {
    if (!selectedSavedView) return
    if (areSavedViewStatesEqual(selectedSavedView.state, currentViewState)) return
    setSelectedSavedViewId('')
  }, [currentViewState, selectedSavedView])

  useEffect(() => {
    setSelectedTransactionIds(prev => {
      const next = prev.filter(id => visibleTransactionIds.includes(id))
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev
      }
      return next
    })
  }, [visibleTransactionIds])

  useEffect(() => {
    const indeterminate = someVisibleSelected && !allVisibleSelected
    if (selectAllRef.current) selectAllRef.current.indeterminate = indeterminate
    if (mobileSelectAllRef.current) mobileSelectAllRef.current.indeterminate = indeterminate
  }, [allVisibleSelected, someVisibleSelected])

  useEffect(() => {
    if (selectedSavedViewId) return
    setDeleteSavedViewModalOpen(false)
  }, [selectedSavedViewId])

  const handleQuickFilter = useCallback((qf: QuickFilter) => {
    setActiveFilter(qf)
  }, [])

  const handleSortChange = useCallback((val: string) => {
    setSort(val)
  }, [])

  const resetAllFilters = useCallback(() => {
    setActiveFilter('all')
    setSearch('')
    setSort('transaction_date-desc')
    setAccountId('')
    setCategoryId('')
    setDateFrom('')
    setDateTo('')
    setSelectedSavedViewId('')
    setParams({
      sort_by: 'transaction_date',
      sort_dir: 'desc',
      per_page: 20,
      page: 1,
      search: undefined,
      account_id: undefined,
      category_id: undefined,
      date_from: undefined,
      date_to: undefined,
      ...QuickFilterParams.all,
    })
  }, [setParams])

  const openDeleteTransactionModal = useCallback((id: string) => {
    setDeleteTransactionId(id)
    setDeleteTransactionModalOpen(true)
  }, [])

  const closeDeleteTransactionModal = useCallback(() => {
    if (deleteState.status === 'loading') return
    setDeleteTransactionModalOpen(false)
    setDeleteTransactionId(null)
  }, [deleteState.status])

  const confirmDeleteTransaction = useCallback(async () => {
    if (!deleteTransactionId) return
    const ok = await remove(deleteTransactionId)
    if (!ok) return
    setDeleteTransactionModalOpen(false)
    setDeleteTransactionId(null)
  }, [deleteTransactionId, remove])

  const toggleTransactionSelection = useCallback((id: string) => {
    setSelectedTransactionIds(prev => (
      prev.includes(id)
        ? prev.filter(currentId => currentId !== id)
        : [...prev, id]
    ))
  }, [])

  const toggleSelectVisible = useCallback(() => {
    setSelectedTransactionIds(prev => (
      allVisibleSelected ? prev.filter(id => !visibleTransactionIds.includes(id)) : Array.from(new Set([...prev, ...visibleTransactionIds]))
    ))
  }, [allVisibleSelected, visibleTransactionIds])

  const closeBulkDeleteModal = useCallback(() => {
    if (bulkDeleteState.status === 'loading') return
    setBulkDeleteModalOpen(false)
  }, [bulkDeleteState.status])

  const confirmBulkDelete = useCallback(async () => {
    if (selectedTransactionIds.length === 0) return
    const result = await bulkRemove(selectedTransactionIds)
    if (!result) return

    const failedIds = new Set(result.failed.map(item => item.id))
    setSelectedTransactionIds(prev => prev.filter(id => failedIds.has(id)))
    setBulkDeleteModalOpen(false)
    await refresh()
  }, [bulkRemove, refresh, selectedTransactionIds])

  const openSaveViewModal = useCallback(() => {
    setSaveViewNameDraft(`Vista ${savedViews.length + 1}`)
    setSaveViewError(null)
    setSaveViewModalOpen(true)
  }, [savedViews.length])

  const closeSaveViewModal = useCallback(() => {
    setSaveViewModalOpen(false)
    setSaveViewError(null)
  }, [])

  const confirmSaveCurrentView = useCallback(() => {
    const name = saveViewNameDraft.trim()
    if (!name) {
      setSaveViewError('Ingresa un nombre para la vista.')
      return
    }

    let nextViews: SavedTransactionView[]
    let savedId: string

    if (duplicatedSavedView) {
      savedId = duplicatedSavedView.id
      nextViews = savedViews.map(view =>
        view.id === duplicatedSavedView.id
          ? { ...view, state: currentViewState, name }
          : view
      )
    } else {
      savedId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      nextViews = [...savedViews, { id: savedId, name, state: currentViewState }]
    }

    writeSavedViews(nextViews)
    setSavedViews(nextViews)
    setSelectedSavedViewId(savedId)
    setSaveViewModalOpen(false)
    setSaveViewError(null)
  }, [currentViewState, duplicatedSavedView, saveViewNameDraft, savedViews])

  const applySavedView = useCallback((viewId: string) => {
    const selected = savedViews.find(view => view.id === viewId)
    if (!selected) return

    const [nextSortByRaw = '', nextSortDirRaw = ''] = selected.state.sort.split('-')
    const nextSortBy = isSortBy(nextSortByRaw) ? nextSortByRaw : 'transaction_date'
    const nextSortDir = nextSortDirRaw === 'asc' || nextSortDirRaw === 'desc'
      ? nextSortDirRaw
      : 'desc'

    setSelectedSavedViewId(selected.id)
    setActiveFilter(selected.state.activeFilter)
    setSearch(selected.state.search)
    setSort(`${nextSortBy}-${nextSortDir}`)
    setAccountId(selected.state.accountId)
    setCategoryId(selected.state.categoryId)
    setParams({
      ...QuickFilterParams[selected.state.activeFilter],
      search: selected.state.search || undefined,
      account_id: selected.state.accountId || undefined,
      category_id: selected.state.categoryId || undefined,
      sort_by: nextSortBy,
      sort_dir: nextSortDir,
      per_page: selected.state.perPage,
      page: 1,
    })
  }, [savedViews, setParams])

  const openDeleteSavedViewModal = useCallback(() => {
    if (!selectedSavedViewId) return
    setDeleteSavedViewModalOpen(true)
  }, [selectedSavedViewId])

  const closeDeleteSavedViewModal = useCallback(() => {
    setDeleteSavedViewModalOpen(false)
  }, [])

  const confirmDeleteSavedView = useCallback(() => {
    if (!selectedSavedViewId) return

    const nextViews = savedViews.filter(view => view.id !== selectedSavedViewId)
    writeSavedViews(nextViews)
    setSavedViews(nextViews)
    setSelectedSavedViewId('')
    setDeleteSavedViewModalOpen(false)
  }, [savedViews, selectedSavedViewId])

  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.per_page)
    : 0
  const hasFilteringCriteria = Boolean(
    search ||
    activeFilter !== 'all' ||
    accountId ||
    categoryId ||
    dateFrom ||
    dateTo
  )
  const hasAdjustedControls = Boolean(
    hasFilteringCriteria ||
    sort !== 'transaction_date-desc' ||
    (params.per_page ?? 20) !== 20
  )
  const advancedFilterCount = [
    Boolean(accountId),
    Boolean(categoryId),
    Boolean(dateFrom || dateTo),
    sort !== 'transaction_date-desc',
    (params.per_page ?? 20) !== 20,
  ].filter(Boolean).length
  const activeContextLabels = useMemo(() => {
    const labels: string[] = []
    const quickFilterLabel = QUICK_FILTERS.find(filter => filter.key === activeFilter)?.label
    const accountLabel = accountOptions.find(option => option.value === accountId)?.label
    const categoryLabel = categoryOptions.find(option => option.value === categoryId)?.label
    const sortLabel = SORT_OPTIONS.find(option => option.value === sort)?.label

    if (activeFilter !== 'all' && quickFilterLabel) labels.push(quickFilterLabel)
    if (search.trim()) labels.push(`Búsqueda: “${search.trim()}”`)
    if (accountId) labels.push(`Cuenta: ${accountLabel ?? 'seleccionada'}`)
    if (categoryId) labels.push(`Categoría: ${categoryLabel ?? 'seleccionada'}`)
    if (dateFrom || dateTo) {
      labels.push(`Fecha: ${dateFrom || '…'} → ${dateTo || '…'}`)
    }
    if (sort !== 'transaction_date-desc') labels.push(`Orden: ${sortLabel ?? sort}`)
    if ((params.per_page ?? 20) !== 20) labels.push(`${params.per_page} por página`)

    return labels
  }, [
    accountId,
    accountOptions,
    activeFilter,
    categoryId,
    categoryOptions,
    dateFrom,
    dateTo,
    params.per_page,
    search,
    sort,
  ])
  const emptyStateDescription = hasFilteringCriteria
    ? search
      ? `No hay resultados para "${search}". Ajusta la búsqueda o limpia los filtros.`
      : 'No hay movimientos que coincidan con los filtros seleccionados.'
    : 'Registra tu primer ingreso, egreso o transferencia.'
  const emptyStateAction = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {hasFilteringCriteria ? (
        <Button type="button" onClick={resetAllFilters} variant="secondary" size="sm">
          Limpiar filtros
        </Button>
      ) : null}
      {!search ? (
        <Button href="/transactions?new=transaction" scroll={false} prefetch variant="primary" size="sm">
          Nueva transacción
        </Button>
      ) : null}
    </div>
  )
  const isIntegratedReviewOpen = Boolean(focusedTransaction && reviewPanelVisible)

  return (
    <div className="space-y-0">
      <div
        data-testid="transactions-review-panel-layer"
        className={`grid items-start transition-[grid-template-columns,gap] duration-slow ease-[var(--ft-ease-out)] motion-reduce:transition-none ${
          isIntegratedReviewOpen
            ? 'grid-cols-[minmax(0,1fr)_0px] gap-0 min-[1360px]:grid-cols-[minmax(0,1fr)_360px] min-[1360px]:gap-3 2xl:grid-cols-[minmax(0,1fr)_400px]'
            : 'grid-cols-[minmax(0,1fr)_0px] gap-0'
        }`}
      >
        <div className="min-w-0">
          {/* Persistent orientation and command surface on roomy viewports. */}
          <div className="lg:sticky lg:top-0 lg:z-sticky lg:-mt-5 lg:bg-[var(--ft-canvas)] lg:pt-5 xl:-mt-6 xl:pt-6">
            <section
              aria-label="Espacio de trabajo de movimientos"
              className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] shadow-elevation-md"
            >
            {workspaceHeader}
            {filterOptionsError && (
              <DataErrorBanner
                message={filterOptionsError}
                onRetry={() => setFilterOptionsReloadTick(prev => prev + 1)}
              />
            )}
            <DataToolbar className="border-b-0 bg-transparent px-4 py-3 sm:px-5">
          <div className={`flex flex-col gap-3 ${isIntegratedReviewOpen ? '' : 'xl:flex-row xl:items-center xl:justify-between'}`}>
            <SavedViewsToolbar
              value={selectedSavedViewId}
              onChange={nextId => {
                if (!nextId) {
                  setSelectedSavedViewId('')
                  return
                }
                applySavedView(nextId)
              }}
              onSave={openSaveViewModal}
              onDelete={openDeleteSavedViewModal}
              deleteDisabled={!selectedSavedViewId}
              selectTestId="transactions-saved-view-select"
              saveTestId="transactions-save-view-button"
              deleteTestId="transactions-delete-view-button"
              className={isIntegratedReviewOpen ? 'w-full' : 'xl:w-auto xl:shrink-0'}
              options={[
                { value: '', label: 'Vistas guardadas' },
                ...savedViews.map(view => ({ value: view.id, label: view.name })),
              ]}
            />

            <div className={`flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center ${isIntegratedReviewOpen ? 'w-full' : 'xl:ml-auto xl:w-full xl:max-w-[520px]'}`}>
              <DataSearchField
                value={search}
                onChange={setSearch}
                placeholder="Buscar por descripción…"
                aria-label="Buscar movimientos por descripción"
                data-testid="transactions-search-input"
                className="w-full sm:min-w-[240px]"
              />
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <Button
                  type="button"
                  onClick={() => setAdvancedFiltersOpen(open => !open)}
                  aria-expanded={advancedFiltersOpen}
                  aria-controls="transactions-advanced-filters"
                  testId="transactions-advanced-filters-button"
                  variant={advancedFiltersOpen || advancedFilterCount > 0 ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full sm:w-auto"
                  leadingIcon={(
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 6h16M7 12h10M10 18h4" />
                    </svg>
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Filtros
                    {advancedFilterCount > 0 ? (
                      <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--ft-primary-soft)] px-1 text-[10px] font-bold tabular-nums text-[var(--ft-primary)]">
                        {advancedFilterCount}
                      </span>
                    ) : null}
                  </span>
                </Button>
                <Button
                  type="button"
                  onClick={resetAllFilters}
                  testId="transactions-reset-filters-button"
                  variant={hasAdjustedControls ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 border-t border-[var(--ft-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <DataToolbarRow className="filters-row-tight min-w-0 flex-nowrap overflow-x-auto pb-1">
              {QUICK_FILTERS.map(filter => (
                <DataFilterPreset
                  key={filter.key}
                  label={filter.label}
                  active={activeFilter === filter.key}
                  onClick={() => handleQuickFilter(filter.key)}
                  testId={`transactions-quick-filter-${filter.key}`}
                />
              ))}
            </DataToolbarRow>
            <p className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--ft-text-muted)]">
              {isLoading
                ? 'Cargando movimientos…'
                : pagination
                  ? `${pagination.total} movimiento${pagination.total === 1 ? '' : 's'}`
                  : 'Movimientos'}
            </p>
          </div>

          {activeContextLabels.length > 0 ? (
            <div
              aria-label="Contexto activo del registro"
              className="flex flex-wrap items-center gap-1.5 border-t border-[var(--ft-border)] pt-3"
            >
              <span className="mr-1 text-[11px] font-medium text-[var(--ft-text-muted)]">Contexto activo</span>
              {activeContextLabels.map(label => (
                <span
                  key={label}
                  className="rounded-control border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2 py-1 text-[11px] text-[var(--ft-text-muted)]"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          {selectedTransactionIds.length > 0 ? (
            <DataToolbarRow className="items-center justify-between gap-3 rounded-surface border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-3 py-2.5">
              <p className="text-[12px] font-semibold text-[var(--ft-primary)]">
                {selectedTransactionIds.length} transacción(es) seleccionada(s) en esta vista.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setSelectedTransactionIds([])}
                  variant="secondary"
                  size="sm"
                >
                  Limpiar selección
                </Button>
                <Button
                  type="button"
                  onClick={() => setBulkDeleteModalOpen(true)}
                  variant="danger"
                  size="sm"
                >
                  Eliminar seleccionadas
                </Button>
              </div>
            </DataToolbarRow>
          ) : null}
            </DataToolbar>

            {!isLoading && !isEmpty ? (
              <LedgerColumnHeader
                allVisibleSelected={allVisibleSelected}
                selectAllRef={selectAllRef}
                onToggleSelectVisible={toggleSelectVisible}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setSort}
              />
            ) : null}
            </section>
          </div>

          {advancedFiltersOpen ? (
            <section
              id="transactions-advanced-filters"
              aria-label="Filtros avanzados de movimientos"
              className={`mt-3 grid gap-3 rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] px-4 py-4 shadow-elevation-sm sm:grid-cols-2 sm:px-5 ${isIntegratedReviewOpen ? '' : 'xl:grid-cols-6'}`}
            >
              <div className="block min-w-0 space-y-1.5 xl:col-span-1">
                <span className="text-[12px] font-medium text-[var(--ft-text-muted)]">Cuenta</span>
                <AppSelect
                  value={accountId}
                  onChange={setAccountId}
                  disabled={loadingFilterOptions}
                  ariaLabel="Filtrar por cuenta"
                  testId="transactions-account-filter"
                  className="w-full"
                  compact
                  searchPlaceholder="Buscar cuenta..."
                  options={[
                    { value: '', label: 'Todas las cuentas' },
                    ...accountOptions.map(option => ({ value: option.value, label: option.label })),
                  ]}
                />
              </div>

              <div className="block min-w-0 space-y-1.5 xl:col-span-1">
                <span className="text-[12px] font-medium text-[var(--ft-text-muted)]">Categoría</span>
                <AppSelect
                  value={categoryId}
                  onChange={setCategoryId}
                  disabled={loadingFilterOptions}
                  ariaLabel="Filtrar por categoría"
                  testId="transactions-category-filter"
                  className="w-full"
                  compact
                  searchPlaceholder="Buscar categoría..."
                  options={[
                    { value: '', label: 'Todas las categorías' },
                    ...categoryOptions.map(option => ({ value: option.value, label: option.label })),
                  ]}
                />
              </div>

              <label className="block min-w-0 space-y-1.5">
                <span className="text-[12px] font-medium text-[var(--ft-text-muted)]">Desde</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={event => setDateFrom(event.target.value)}
                  data-testid="transactions-date-from"
                  className="field-base h-9 w-full text-[11px]"
                  title="Fecha desde"
                />
              </label>

              <label className="block min-w-0 space-y-1.5">
                <span className="text-[12px] font-medium text-[var(--ft-text-muted)]">Hasta</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={event => setDateTo(event.target.value)}
                  data-testid="transactions-date-to"
                  className="field-base h-9 w-full text-[11px]"
                  title="Fecha hasta"
                />
              </label>

              <div className="min-w-0 space-y-1.5">
                <span className="block text-[12px] font-medium text-[var(--ft-text-muted)]">Orden</span>
                <DataSortSelect
                  options={SORT_OPTIONS}
                  value={sort}
                  onChange={handleSortChange}
                  testId="transactions-sort-select"
                  className="w-full"
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <span className="block text-[12px] font-medium text-[var(--ft-text-muted)]">Por página</span>
                <AppSelect
                  value={String(params.per_page ?? 20)}
                  onChange={value => {
                    const nextPerPage = Number(value)
                    setParams({ per_page: nextPerPage, page: 1 })
                  }}
                  ariaLabel="Registros por página"
                  testId="transactions-per-page-select"
                  className="w-full"
                  compact
                  searchable={false}
                  options={PER_PAGE_OPTIONS.map(option => ({
                    value: String(option),
                    label: `${option} / página`,
                  }))}
                />
              </div>
            </section>
          ) : null}

          <DataTable className="mt-3 min-w-0 shadow-elevation-sm">
            <h2 className="sr-only">Libro de movimientos</h2>

        {/* ── REGISTROS RESPONSIVE ─────────────────────────────────────── */}
        {isLoading ? (
          <MobileTransactionSkeletons />
        ) : isEmpty ? (
          <div className="xl:hidden">
            <FinanceEmptyState
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/></svg>}
              title={hasFilteringCriteria ? 'Sin coincidencias' : 'Sin transacciones'}
              description={emptyStateDescription}
              action={emptyStateAction}
              compact
            />
          </div>
        ) : (
          <div className="xl:hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-2.5 sm:px-5">
              <label className="inline-flex min-h-9 items-center gap-2 text-[11px] font-medium text-[var(--ft-text-muted)]">
                <input
                  ref={mobileSelectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectVisible}
                  aria-label="Seleccionar transacciones visibles"
                  className="h-4 w-4 rounded border border-[var(--ft-border)] text-[var(--ft-primary)] accent-[var(--ft-primary)]"
                />
                Seleccionar página
              </label>
              <span className="text-[11px] font-medium tabular-nums text-[var(--ft-text-muted)]">
                {transactions.length} visible{transactions.length === 1 ? '' : 's'}
              </span>
            </div>
            <div role="list" aria-label="Movimientos" className="divide-y divide-[var(--ft-border)]">
              {transactions.map(tx => (
                <article
                  key={tx.id}
                  role="listitem"
                  data-testid={`transactions-mobile-row-${tx.id}`}
                  className={`group/record px-4 py-4 transition-colors duration-fast motion-reduce:transition-none sm:px-5 ${selectedTransactionIds.includes(tx.id) ? 'bg-[var(--ft-primary-soft)]' : 'bg-[var(--ft-surface)]'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 shrink-0 items-center" onClick={event => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedTransactionIds.includes(tx.id)}
                        onChange={() => toggleTransactionSelection(tx.id)}
                        aria-label={`Seleccionar ${tx.description}`}
                        className="h-4 w-4 rounded border border-[var(--ft-border)] text-[var(--ft-primary)] accent-[var(--ft-primary)]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/transactions/${tx.id}`)}
                      aria-label={`Ver detalle de ${tx.description}`}
                      className="grid min-w-0 flex-1 grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]"
                    >
                      <TransactionIdentityMark transaction={tx} />
                      <div className="min-w-0 pt-0.5">
                        <p className="break-words text-[14px] font-semibold leading-5 text-[var(--ft-text-strong)]">
                          {tx.description}
                        </p>
                        <div className="mt-1.5">
                          <TransactionContext transaction={tx} />
                        </div>
                      </div>
                      <AmountCell
                        amountPen={tx.amountPen}
                        original={tx.currency !== 'PEN'
                          ? { amount: tx.amount, currency: tx.currency }
                          : undefined
                        }
                        variant={
                          tx.type === 'INCOME' ? 'income'
                            : tx.type === 'EXPENSE' ? 'expense'
                              : 'neutral'
                        }
                        preferred={preferred}
                        exchangeRate={exchangeRate}
                        format={format}
                        formatter={(n, c) => formatCurrency(n, c as 'PEN' | 'USD')}
                      />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 border-t border-[var(--ft-border)] pt-3 sm:ml-7 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    <TransactionAccountPath transaction={tx} />
                    <div className="flex items-center text-[var(--ft-text-muted)] sm:min-h-9">
                      <DateCell date={tx.transactionDate} />
                    </div>
                    <div className="flex justify-end">
                      <DataRowActions actions={[
                        {
                          label: 'Editar',
                          onClick: () => setEditTransactionId(tx.id),
                          testId: `transactions-mobile-row-edit-${tx.id}`,
                        },
                        {
                          label: 'Eliminar',
                          variant: 'danger',
                          disabled: deleteState.status === 'loading',
                          onClick: () => openDeleteTransactionModal(tx.id),
                          testId: `transactions-mobile-row-delete-${tx.id}`,
                        },
                      ]} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* ── FALLBACK RESPONSIVE: PAGINACIÓN ──────────────────────────── */}
        {pagination ? (
          <div className="xl:hidden">
            <DataPagination
              page={pagination.page}
              totalPages={totalPages}
              total={pagination.total}
              perPage={pagination.per_page}
              onPage={setPage}
            />
          </div>
        ) : null}

        {/* ── LEDGER DE ESCRITORIO ──────────────────────────────────────── */}
        {isLoading ? (
          <DesktopLedgerSkeletons />
        ) : isEmpty ? (
          <div className="hidden xl:block">
            <FinanceEmptyState
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/></svg>}
              title={hasFilteringCriteria ? 'Sin coincidencias' : 'Sin transacciones'}
              description={emptyStateDescription}
              action={emptyStateAction}
            />
          </div>
        ) : (
          <section aria-labelledby="transactions-ledger-heading" className="hidden min-w-0 xl:block">
            <div role="list" aria-label="Registro de movimientos" className="divide-y divide-[var(--ft-border)]">
              {transactions.map(tx => {
                const isFocused = focusedTransaction?.id === tx.id
                const isSelected = selectedTransactionIds.includes(tx.id)

                return (
                  <article
                    key={tx.id}
                    role="listitem"
                    data-testid={`transactions-row-${tx.id}`}
                    className={`group/row grid min-h-[82px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition-[background-color,box-shadow] duration-fast motion-reduce:transition-none ${isFocused ? 'bg-[var(--ft-surface-muted)] shadow-[inset_3px_0_0_var(--ft-primary)]' : isSelected ? 'bg-[var(--ft-primary-soft)]' : 'bg-[var(--ft-surface)] hover:bg-[var(--ft-surface-hover)]'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTransactionSelection(tx.id)}
                      aria-label={`Seleccionar ${tx.description}`}
                      className="h-4 w-4 rounded border border-[var(--ft-border)] text-[var(--ft-primary)] accent-[var(--ft-primary)]"
                    />

                    <button
                      type="button"
                      onClick={() => activateTransactionRow(tx.id)}
                      data-review-trigger-id={tx.id}
                      aria-controls="transactions-review-pane"
                      aria-expanded={isFocused && reviewPanelVisible}
                      aria-label={`Revisar ${tx.description}`}
                      className="grid min-w-0 grid-cols-[92px_minmax(0,1.45fr)_minmax(0,0.85fr)_minmax(120px,0.6fr)] items-center gap-4 rounded-control text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]"
                    >
                      <div className="text-[var(--ft-text-muted)]">
                        <DateCell date={tx.transactionDate} />
                      </div>
                      <div className="flex min-w-0 items-center gap-3">
                        <TransactionIdentityMark transaction={tx} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold leading-5 text-[var(--ft-text-strong)]">
                            {tx.description}
                          </p>
                          <div className="mt-1.5">
                            <TransactionContext transaction={tx} />
                          </div>
                        </div>
                      </div>
                      <TransactionAccountPath transaction={tx} />
                      <AmountCell
                        amountPen={tx.amountPen}
                        original={tx.currency !== 'PEN'
                          ? { amount: tx.amount, currency: tx.currency }
                          : undefined
                        }
                        variant={
                          tx.type === 'INCOME' ? 'income'
                            : tx.type === 'EXPENSE' ? 'expense'
                              : 'neutral'
                        }
                        preferred={preferred}
                        exchangeRate={exchangeRate}
                        format={format}
                        formatter={(n, c) => formatCurrency(n, c as 'PEN' | 'USD')}
                      />
                    </button>

                    <div className="w-[112px] opacity-70 transition-opacity duration-fast group-hover/row:opacity-100 focus-within:opacity-100 motion-reduce:transition-none">
                      <DataRowActions actions={[
                        {
                          label: 'Ver detalle',
                          onClick: () => router.push(`/transactions/${tx.id}`),
                          testId: `transactions-row-detail-${tx.id}`,
                        },
                        {
                          label: 'Editar',
                          onClick: () => setEditTransactionId(tx.id),
                          testId: `transactions-row-edit-${tx.id}`,
                        },
                        {
                          label: 'Eliminar',
                          variant: 'danger',
                          disabled: deleteState.status === 'loading',
                          onClick: () => openDeleteTransactionModal(tx.id),
                          testId: `transactions-row-delete-${tx.id}`,
                        },
                      ]} />
                    </div>
                  </article>
                )
              })}
            </div>

            {pagination ? (
              <DataPagination
                page={pagination.page}
                totalPages={totalPages}
                total={pagination.total}
                perPage={pagination.per_page}
                onPage={setPage}
              />
            ) : null}
          </section>
        )}

        <TransactionEditModal
          open={Boolean(editTransactionId)}
          transactionId={editTransactionId}
          options={options}
          initialTransaction={selectedTransactionForEdit ? {
            id: selectedTransactionForEdit.id,
            type: selectedTransactionForEdit.type,
            amount: selectedTransactionForEdit.amount,
            amount_pen: selectedTransactionForEdit.amountPen,
            currency: selectedTransactionForEdit.currency,
            description: selectedTransactionForEdit.description,
            transaction_date: selectedTransactionForEdit.transactionDate,
          } : null}
          onClose={() => setEditTransactionId(null)}
          onUpdated={() => {
            setEditTransactionId(null)
            void refresh()
            router.refresh()
          }}
        />

        {/* Refresh indicator */}
        <DataRefreshIndicator show={isValidating && !isLoading} />
          </DataTable>
        </div>

      {focusedTransaction ? (
        <aside
          id="transactions-review-pane"
          role="region"
          aria-labelledby="transactions-review-title"
          aria-describedby="transactions-review-description"
          data-testid="transactions-review-panel"
          className={`sticky top-6 flex h-[min(760px,calc(100dvh_-_var(--topbar-height)_-_40px))] min-h-[480px] min-w-0 self-start overflow-hidden rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] shadow-elevation-md transition-[transform,opacity] duration-slow ease-[var(--ft-ease-out)] motion-reduce:translate-x-0 motion-reduce:transition-none ${reviewPanelVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}`}
        >
          <div className="flex min-w-[340px] flex-1 flex-col 2xl:min-w-[380px]">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--ft-border)] bg-[var(--ft-surface)] px-5 py-5">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-10 w-1 shrink-0 rounded-[var(--radius-pill)] bg-[var(--ft-primary)]"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[11px] font-semibold tracking-[0.02em] text-[var(--ft-primary)]">
                      Revisión de movimiento
                    </p>
                    <span className="text-[11px] tabular-nums text-[var(--ft-text-subtle)]">
                      {focusedTransactionPosition} de {transactions.length}
                    </span>
                  </div>
                  <h2 id="transactions-review-title" className="mt-1.5 break-words text-lg font-semibold leading-6 tracking-[-0.025em] text-[var(--ft-text-strong)]">
                    {focusedTransaction.description}
                  </h2>
                </div>
              </div>
              <Button
                type="button"
                onClick={closeTransactionReview}
                ariaLabel="Cerrar revisión contextual"
                variant="ghost"
                size="icon-md"
                className="shrink-0 border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] focus-visible:ring-offset-[var(--ft-surface)]"
                testId="transactions-review-close"
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5" aria-live="polite">
              <p id="transactions-review-description" className="sr-only">
                Revisión contextual del movimiento seleccionado sin abandonar el registro.
              </p>
              <div className="flex items-start gap-3">
                <TransactionIdentityMark transaction={focusedTransaction} />
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-medium text-[var(--ft-text-muted)]">Identidad y clasificación</p>
                  <div className="mt-1.5">
                    <TransactionContext transaction={focusedTransaction} />
                  </div>
                </div>
              </div>

              <div className="-mx-5 mt-5 border-y border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium text-[var(--ft-text-muted)]">Monto</p>
                    <p className="mt-1 text-[11px] leading-4 text-[var(--ft-text-subtle)]">En tu moneda preferida</p>
                  </div>
                  <div className="[&>div>p:first-child]:text-[25px] [&>div>p:first-child]:leading-8 [&>div>p:first-child]:tracking-[-0.04em]">
                    <AmountCell
                      amountPen={focusedTransaction.amountPen}
                      original={focusedTransaction.currency !== 'PEN'
                        ? { amount: focusedTransaction.amount, currency: focusedTransaction.currency }
                        : undefined
                      }
                      variant={
                        focusedTransaction.type === 'INCOME' ? 'income'
                          : focusedTransaction.type === 'EXPENSE' ? 'expense'
                            : 'neutral'
                      }
                      preferred={preferred}
                      exchangeRate={exchangeRate}
                      format={format}
                      formatter={(n, c) => formatCurrency(n, c as 'PEN' | 'USD')}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-[var(--ft-text-strong)]">Datos del movimiento</p>
                <span className="text-[10px] text-[var(--ft-text-subtle)]">Solo campos disponibles</span>
              </div>
              <dl className="mt-2 divide-y divide-[var(--ft-border)] border-y border-[var(--ft-border)]">
                {focusedTransaction.transactionDate ? (
                  <ReviewFactRow label="Fecha">
                    <DateCell date={focusedTransaction.transactionDate} />
                  </ReviewFactRow>
                ) : null}
                {focusedTransaction.sourceAccount?.name ? (
                  <ReviewFactRow label={focusedTransaction.destinationAccount ? 'Origen' : 'Cuenta'}>
                    {focusedTransaction.sourceAccount.name}
                  </ReviewFactRow>
                ) : null}
                {focusedTransaction.destinationAccount?.name ? (
                  <ReviewFactRow label="Destino">
                    {focusedTransaction.destinationAccount.name}
                  </ReviewFactRow>
                ) : null}
                {focusedTransaction.category?.name ? (
                  <ReviewFactRow label="Categoría">
                    {normalizeCategoryLabel(focusedTransaction.category.name)}
                  </ReviewFactRow>
                ) : null}
                {focusedTransaction.currency ? (
                  <ReviewFactRow label="Moneda">
                    <span className="font-mono tabular-nums">{focusedTransaction.currency}</span>
                  </ReviewFactRow>
                ) : null}
                <ReviewFactRow label="Reportes">
                  <span className={focusedTransaction.affectsReports ? 'text-[var(--ft-text-strong)]' : 'text-[var(--ft-warning)]'}>
                    {focusedTransaction.affectsReports ? 'Afecta reportes' : 'No afecta reportes'}
                  </span>
                </ReviewFactRow>
                {focusedTransactionHasModuleContext ? (
                  <ReviewFactRow label="Relaciones">
                    <span className="flex justify-end text-right">
                      <ModuleBadges tx={focusedTransaction} />
                    </span>
                  </ReviewFactRow>
                ) : null}
              </dl>
            </div>

            <footer className="shrink-0 border-t border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  onClick={() => moveTransactionReview(-1)}
                  disabled={focusedTransactionIndex <= 0}
                  variant="ghost"
                  size="sm"
                  testId="transactions-review-previous"
                  leadingIcon={<span aria-hidden="true">←</span>}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  onClick={() => moveTransactionReview(1)}
                  disabled={focusedTransactionIndex >= transactions.length - 1}
                  variant="ghost"
                  size="sm"
                  testId="transactions-review-next"
                  trailingIcon={<span aria-hidden="true">→</span>}
                >
                  Siguiente
                </Button>
              </div>
              <Button
                href={`/transactions/${focusedTransaction.id}`}
                prefetch
                variant="primary"
                size="md"
                fullWidth
                testId={`transactions-review-detail-${focusedTransaction.id}`}
                trailingIcon={<span aria-hidden="true">→</span>}
              >
                Abrir detalle completo
              </Button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => setEditTransactionId(focusedTransaction.id)}
                  variant="secondary"
                  size="sm"
                  testId={`transactions-review-edit-${focusedTransaction.id}`}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  onClick={() => openDeleteTransactionModal(focusedTransaction.id)}
                  disabled={deleteState.status === 'loading'}
                  variant="danger"
                  size="sm"
                  testId={`transactions-review-delete-${focusedTransaction.id}`}
                >
                  Eliminar
                </Button>
              </div>
            </footer>
          </div>
        </aside>
      ) : null}
      </div>

      {saveViewModalOpen && (
        <ModalOverlayPortal
          className="z-[80]"
          onClick={closeSaveViewModal}
          data-testid="transactions-save-view-modal"
        >
          <FocusTrap active={saveViewModalOpen} onEscape={closeSaveViewModal}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="transactions-save-view-title"
              className="w-full max-w-md rounded-modal border border-[var(--ft-border)] bg-[var(--ft-modal-bg)] p-5 shadow-elevation-xl"
              onClick={event => event.stopPropagation()}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-primary)]">
                Movimientos
              </p>
              <h3 id="transactions-save-view-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-[var(--ft-text-strong)]">
                Guardar vista
              </h3>
              <p className="mt-1 text-[12px] leading-5 text-[var(--ft-text-muted)]">
                Guarda los filtros actuales para reutilizarlos después.
              </p>

              <form
                className="mt-4 space-y-3"
                onSubmit={event => {
                  event.preventDefault()
                  confirmSaveCurrentView()
                }}
              >
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">Nombre</span>
                  <input
                    value={saveViewNameDraft}
                    onChange={event => {
                      setSaveViewNameDraft(event.target.value)
                      setSaveViewError(null)
                    }}
                    autoFocus
                    data-testid="transactions-save-view-name-input"
                    className="field-base"
                    placeholder="Ej. Gastos hogar"
                  />
                </label>

                {duplicatedSavedView && (
                  <p className="rounded-control bg-[var(--ft-warning-soft)] px-2.5 py-2 text-[11px] text-[var(--ft-warning)]">
                    Ya existe una vista con ese nombre y se sobrescribirá.
                  </p>
                )}
                {saveViewError && (
                  <p role="alert" className="rounded-control bg-[var(--ft-danger-soft)] px-2.5 py-2 text-[11px] text-[var(--ft-danger)]">{saveViewError}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={closeSaveViewModal}
                    testId="transactions-save-view-cancel-button"
                    variant="secondary"
                    size="sm"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    testId="transactions-save-view-confirm-button"
                    variant="primary"
                    size="sm"
                  >
                    {duplicatedSavedView ? 'Sobrescribir' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </div>
          </FocusTrap>
        </ModalOverlayPortal>
      )}

      <ConfirmDialog
        open={deleteSavedViewModalOpen && Boolean(selectedSavedView)}
        title="Eliminar vista guardada"
        message={
          selectedSavedView ? (
            <>
              ¿Eliminar la vista <strong>&quot;{selectedSavedView.name}&quot;</strong>?
            </>
          ) : ''
        }
        onCancel={closeDeleteSavedViewModal}
        onConfirm={confirmDeleteSavedView}
        danger
        testId="transactions-delete-view-modal"
        cancelTestId="transactions-delete-view-cancel-button"
        confirmTestId="transactions-delete-view-confirm-button"
        confirmLabel="Eliminar"
      />

      <ConfirmDialog
        open={deleteTransactionModalOpen}
        title="Eliminar transacción"
        message={
          <>
            Esta acción no se puede deshacer
            {selectedTransactionForDelete ? (
              <>
                {' '}y afectará los saldos relacionados de{' '}
                <strong>{selectedTransactionForDelete.description}</strong>.
              </>
            ) : '.'}
            {deleteState.status === 'error' ? (
              <span className="mt-2 block text-[11px] text-[var(--ft-danger)]">
                {deleteState.error.message ?? 'No se pudo eliminar la transacción.'}
              </span>
            ) : null}
          </>
        }
        onCancel={closeDeleteTransactionModal}
        onConfirm={() => void confirmDeleteTransaction()}
        loading={deleteState.status === 'loading'}
        danger
        testId="transactions-delete-modal"
        cancelTestId="transactions-delete-cancel-button"
        confirmTestId="transactions-delete-confirm-button"
        confirmLabel="Eliminar"
      />

      <ConfirmDialog
        open={bulkDeleteModalOpen}
        title="Eliminar transacciones seleccionadas"
        message={
          <>
            Esta acción eliminará <strong>{selectedTransactionIds.length}</strong> transacción(es) de la vista actual y ajustará los saldos relacionados.
            {bulkDeleteState.status === 'error' ? (
              <span className="mt-2 block text-[11px] text-[var(--ft-danger)]">
                {bulkDeleteState.error.message ?? 'No se pudieron eliminar las transacciones seleccionadas.'}
              </span>
            ) : null}
            {bulkDeleteState.status === 'success' && bulkDeleteState.data.failed.length > 0 ? (
              <span className="mt-2 block text-[11px] text-[var(--ft-warning)]">
                {bulkDeleteState.data.failed.length} transacción(es) no se pudieron eliminar y seguirán seleccionadas.
              </span>
            ) : null}
          </>
        }
        onCancel={closeBulkDeleteModal}
        onConfirm={() => void confirmBulkDelete()}
        loading={bulkDeleteState.status === 'loading'}
        danger
        testId="transactions-bulk-delete-modal"
        cancelTestId="transactions-bulk-delete-cancel-button"
        confirmTestId="transactions-bulk-delete-confirm-button"
        confirmLabel="Eliminar seleccionadas"
      />
    </div>
  )
}
