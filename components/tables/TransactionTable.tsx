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
         useRef }                    from 'react'
import { useTransactions }           from '@/lib/hooks/useTransactions'
import { useCurrency }               from '@/lib/hooks/useDashboard'
import { formatCurrency }            from '@/lib/contracts/ui.contracts'
import {
  QuickFilterParams,
  type QuickFilter,
  type TransactionListParams,
}                                    from '@/lib/contracts/ui.contracts'
import {
  ConfirmDialog,
  DataEmptyStateRow,
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
  SavedViewsToolbar,
  StatusBadge as FinanceStatusBadge,
}                                    from '@/components/finance'
import {
  Th, Td,
  SkeletonRows,
  AmountCell,
  DateCell,
}                                    from './primitives'
import { FocusTrap }                 from '@/components/ui/accessibility'
import { ModalOverlayPortal }        from '@/components/ui/ModalOverlayPortal'
import { AppSelect }                 from '@/components/ui/AppSelect'
import { Button }                    from '@/components/ui/Button'
import { TransactionEditModal }      from '@/components/forms/TransactionEditModal'
import type { TransactionType }      from '@/types/database.types'
import type { TransactionFormOptions } from '@/lib/contracts/ui.contracts'

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

const QUICK_FILTERS: { key: QuickFilter; label: string; color?: string }[] = [
  { key: 'all',        label: 'Todos'        },
  { key: 'income',     label: 'Ingresos',    color: 'var(--c-primary)' },
  { key: 'expense',    label: 'Egresos',     color: 'var(--c-danger)' },
  { key: 'transfer',   label: 'Transferencias', color: 'var(--c-info)' },
  { key: 'this_month', label: 'Este mes'     },
  { key: 'last_month', label: 'Mes pasado'   },
]

const SORT_OPTIONS = [
  { value: 'transaction_date-desc', label: 'Más recientes' },
  { value: 'transaction_date-asc',  label: 'Más antiguas'  },
  { value: 'amount-desc',           label: 'Mayor monto'   },
  { value: 'amount-asc',            label: 'Menor monto'   },
]

const PER_PAGE_OPTIONS = [20, 50, 100] as const

const TYPE_CONFIG: Record<TransactionType, { label: string; color: string; prefix: string }> = {
  INCOME:   { label: 'Ingreso',      color: 'var(--c-primary)', prefix: '+' },
  EXPENSE:  { label: 'Egreso',       color: 'var(--c-danger)', prefix: '−' },
  TRANSFER: { label: 'Transferencia',color: 'var(--c-info)', prefix: '⇄' },
}

// ─── TYPE BADGE ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: TransactionType }) {
  const cfg = TYPE_CONFIG[type]
  const tone = type === 'INCOME' ? 'success' : type === 'EXPENSE' ? 'danger' : 'info'
  return (
    <FinanceStatusBadge tone={tone} dot={false} className="justify-center">
      {cfg.prefix} {cfg.label}
    </FinanceStatusBadge>
  )
}

// ─── MODULE BADGES ────────────────────────────────────────────────────────────

function ModuleBadges({ tx }: {
  tx: { hasAsset?: boolean; hasCredit?: boolean; hasReceivable?: boolean; hasPayable?: boolean }
}) {
  const badges = [
    tx.hasAsset      && { label: 'Activo',   className: 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text-muted)]' },
    tx.hasCredit     && { label: 'Crédito',  className: 'border-[var(--c-warning)]/15 bg-[var(--c-warning-soft)] text-[var(--c-warning)]' },
    tx.hasReceivable && { label: 'X Cobrar', className: 'border-[var(--c-info)]/15 bg-[var(--c-info-soft)] text-[var(--c-info)]' },
    tx.hasPayable    && { label: 'X Pagar',  className: 'border-[var(--c-danger)]/15 bg-[var(--c-danger-soft)] text-[var(--c-danger)]' },
  ].filter(Boolean) as { label: string; className: string }[]

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map(b => (
        <span
          key={b.label}
          className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${b.className}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface TransactionTableProps {
  initialParams?: Partial<TransactionListParams>
  options: TransactionFormOptions
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

export function TransactionTable({ initialParams = {}, options }: TransactionTableProps) {
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
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const initializedFiltersRef = useRef(false)
  const suspendControlToParamsSyncRef = useRef(false)
  const loadedPrefsRef = useRef(false)
  const loadedSavedViewsRef = useRef(false)
  const selectAllRef = useRef<HTMLInputElement | null>(null)

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
          fetch('/api/accounts', { cache: 'no-store' }),
          fetch('/api/categories?include_system=false', { cache: 'no-store' }),
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
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
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

  return (
    <div className="space-y-0">
      <DataTable>
        {/* ── TOOLBAR ──────────────────────────────────────────────────── */}
        {filterOptionsError && (
          <DataErrorBanner
            message={filterOptionsError}
            onRetry={() => setFilterOptionsReloadTick(prev => prev + 1)}
          />
        )}
        <DataToolbar>
          {/* Filtros rápidos */}
          <DataToolbarRow className="filters-row-tight w-full overflow-x-auto pb-px">
            {QUICK_FILTERS.map(f => (
              <DataFilterPreset
                key={f.key}
                label={f.label}
                active={activeFilter === f.key}
                onClick={() => handleQuickFilter(f.key)}
                color={f.color}
                testId={`transactions-quick-filter-${f.key}`}
              />
            ))}
          </DataToolbarRow>

          <DataToolbarRow>
            {/* Búsqueda */}
            <DataSearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar descripción…"
              data-testid="transactions-search-input"
              className="filters-search"
            />

            {/* Cuenta */}
            <AppSelect
              value={accountId}
              onChange={setAccountId}
              disabled={loadingFilterOptions}
              testId="transactions-account-filter"
              className="filters-control sm:w-[170px]"
              compact
              searchPlaceholder="Buscar cuenta..."
              options={[
                { value: '', label: 'Todas las cuentas' },
                ...accountOptions.map(option => ({ value: option.value, label: option.label })),
              ]}
            />

            {/* Categoría */}
            <AppSelect
              value={categoryId}
              onChange={setCategoryId}
              disabled={loadingFilterOptions}
              testId="transactions-category-filter"
              className="filters-control sm:w-[180px]"
              compact
              searchPlaceholder="Buscar categoría..."
              options={[
                { value: '', label: 'Todas las categorías' },
                ...categoryOptions.map(option => ({ value: option.value, label: option.label })),
              ]}
            />

            {/* PRD: Fecha Desde */}
            <input
              type="date"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
              data-testid="transactions-date-from"
              className="field-base filters-control h-[34px] text-[11px] sm:w-[140px]"
              title="Fecha desde"
            />

            {/* PRD: Fecha Hasta */}
            <input
              type="date"
              value={dateTo}
              onChange={event => setDateTo(event.target.value)}
              data-testid="transactions-date-to"
              className="field-base filters-control h-[34px] text-[11px] sm:w-[140px]"
              title="Fecha hasta"
            />

            {/* Ordenamiento */}
            <DataSortSelect
              options={SORT_OPTIONS}
              value={sort}
              onChange={handleSortChange}
              testId="transactions-sort-select"
              className="filters-control sm:w-[150px]"
            />

            {/* Registros por página */}
            <AppSelect
              value={String(params.per_page ?? 20)}
              onChange={value => {
                const nextPerPage = Number(value)
                setParams({ per_page: nextPerPage, page: 1 })
              }}
              testId="transactions-per-page-select"
              className="filters-control sm:w-[125px]"
              compact
              searchable={false}
              options={PER_PAGE_OPTIONS.map(option => ({
                value: String(option),
                label: `${option} / página`,
              }))}
            />

          </DataToolbarRow>

          <DataToolbarRow className="md:items-center md:justify-between">
            <div className="w-full md:w-auto">
              <Button
                type="button"
                onClick={resetAllFilters}
                testId="transactions-reset-filters-button"
                variant="secondary"
                size="sm"
              >
                Limpiar filtros
              </Button>
            </div>

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
              options={[
                { value: '', label: 'Vistas guardadas' },
                ...savedViews.map(view => ({ value: view.id, label: view.name })),
              ]}
              />
          </DataToolbarRow>

          {selectedTransactionIds.length > 0 ? (
            <DataToolbarRow className="items-center justify-between gap-3 rounded-[16px] border border-[color:rgba(184,74,74,0.14)] bg-[var(--c-danger-soft)] px-3 py-2">
              <p className="text-[12px] font-medium text-[var(--c-danger)]">
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

        {/* ── TABLA ────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th className="w-12">
                  <div className="flex items-center justify-center">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectVisible}
                      aria-label="Seleccionar transacciones visibles"
                      className="h-4 w-4 rounded border border-[var(--c-border)] text-[var(--c-primary)] accent-[var(--c-primary)]"
                    />
                  </div>
                </Th>
                <Th>Tipo</Th>
                <Th className="min-w-[180px]">Descripción</Th>
                <Th className="hidden md:table-cell">Cuenta</Th>
                <Th
                  className="hidden sm:table-cell"
                  sortKey="transaction_date"
                  currentSort={{ key: sortBy ?? '', dir: sortDir ?? 'desc' }}
                  onSort={k => setSort(`${k}-${sortDir === 'desc' ? 'asc' : 'desc'}`)}
                >
                  Fecha
                </Th>
                <Th
                  right
                  sortKey="amount"
                  currentSort={{ key: sortBy ?? '', dir: sortDir ?? 'desc' }}
                  onSort={k => setSort(`${k}-${sortDir === 'desc' ? 'asc' : 'desc'}`)}
                >
                  Monto
                </Th>
                <Th className="w-24"/>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows cols={7} rows={10}/>
              ) : isEmpty ? (
                <DataEmptyStateRow
                  icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/></svg>}
                  title="Sin transacciones"
                  description={search ? `No hay resultados para "${search}"` : 'Registra tu primer ingreso, egreso o transferencia.'}
                  action={
                    !search ? (
                      <Button href="/transactions?new=transaction" scroll={false} prefetch variant="primary" size="sm">
                        Nueva transacción
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                transactions.map((tx, index) => {
                  return (
                    <tr
                      key={tx.id}
                      data-testid={`transactions-row-${tx.id}`}
                      style={{ animationDelay: `${index * 16}ms` }}
                      className={`list-reveal-item group/row cursor-pointer transition-colors hover:bg-[var(--c-surface-2)] ${selectedTransactionIds.includes(tx.id) ? 'bg-[var(--c-primary-soft)]' : ''}`}
                      onClick={() => router.push(`/transactions/${tx.id}`)}
                    >
                      <Td>
                        <div
                          className="flex items-center justify-center"
                          onClick={event => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTransactionIds.includes(tx.id)}
                            onChange={() => toggleTransactionSelection(tx.id)}
                            aria-label={`Seleccionar ${tx.description}`}
                            className="h-4 w-4 rounded border border-[var(--c-border)] text-[var(--c-primary)] accent-[var(--c-primary)]"
                          />
                        </div>
                      </Td>
                      <Td>
                        <TypeBadge type={tx.type}/>
                      </Td>
                      <Td>
                        <p className="text-sm text-[var(--c-text)] font-medium leading-tight">
                          {tx.description}
                        </p>
                        <ModuleBadges tx={tx}/>
                        {tx.category && (
                          <p className="text-[10px] text-[var(--c-text-muted)] mt-0.5">
                            {normalizeCategoryLabel(tx.category.name)}
                          </p>
                        )}
                      </Td>
                      <Td muted className="hidden md:table-cell">
                        <p className="text-[12px]">{tx.sourceAccount?.name ?? '—'}</p>
                        {tx.destinationAccount && (
                          <p className="text-[10px] text-[var(--c-text-faint)]">
                            → {tx.destinationAccount.name}
                          </p>
                        )}
                      </Td>
                      <Td muted className="hidden sm:table-cell">
                        <DateCell date={tx.transactionDate}/>
                      </Td>
                      <Td right>
                        <AmountCell
                          amountPen={tx.amountPen}
                          original={tx.currency !== 'PEN'
                            ? { amount: tx.amount, currency: tx.currency }
                            : undefined
                          }
                          variant={
                            tx.type === 'INCOME'  ? 'income'
                            : tx.type === 'EXPENSE' ? 'expense'
                            : 'neutral'
                          }
                          preferred={preferred}
                          exchangeRate={exchangeRate}
                          format={format}
                          formatter={(n, c) => formatCurrency(n, c as 'PEN' | 'USD')}
                        />
                      </Td>
                      <Td>
                        <DataRowActions actions={[
                          {
                            label:   'Editar',
                            onClick: () => setEditTransactionId(tx.id),
                            testId:  `transactions-row-edit-${tx.id}`,
                          },
                          {
                            label:    'Eliminar',
                            variant:  'danger',
                            disabled: deleteState.status === 'loading',
                            onClick:  () => openDeleteTransactionModal(tx.id),
                            testId:   `transactions-row-delete-${tx.id}`,
                          },
                        ]}/>
                      </Td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINACIÓN ───────────────────────────────────────────────── */}
        {pagination && (
          <DataPagination
            page={pagination.page}
            totalPages={totalPages}
            total={pagination.total}
            perPage={pagination.per_page}
            onPage={setPage}
          />
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
              className="w-full max-w-md rounded-2xl border border-[var(--c-border)] bg-[var(--c-modal-bg)] p-5"
              onClick={event => event.stopPropagation()}
            >
              <h3 id="transactions-save-view-title" className="text-sm font-bold text-[var(--c-text)]">
                Guardar vista
              </h3>
              <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
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
                  <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--c-text-muted)]">Nombre</span>
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
                  <p className="text-[11px] text-amber-300/85">
                    Ya existe una vista con ese nombre y se sobrescribirá.
                  </p>
                )}
                {saveViewError && (
                  <p className="text-[11px] text-red-400">{saveViewError}</p>
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
              <span className="mt-2 block text-[11px] text-[var(--c-danger)]">
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
              <span className="mt-2 block text-[11px] text-[var(--c-danger)]">
                {bulkDeleteState.error.message ?? 'No se pudieron eliminar las transacciones seleccionadas.'}
              </span>
            ) : null}
            {bulkDeleteState.status === 'success' && bulkDeleteState.data.failed.length > 0 ? (
              <span className="mt-2 block text-[11px] text-[var(--c-warning)]">
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
