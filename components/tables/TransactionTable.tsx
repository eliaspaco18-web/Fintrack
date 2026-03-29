'use client'

// =============================================================================
// components/tables/TransactionTable.tsx
// Tabla completa de transacciones con toolbar, filtros rápidos, búsqueda,
// ordenamiento por columna y paginación.
// =============================================================================

import Link                          from 'next/link'
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
  TableShell,
  Toolbar,
  SearchInput,
  FilterPill,
  SortSelect,
  Th, Td,
  SkeletonRows,
  EmptyState,
  Pagination,
  RowActions,
  StatusBadge,
  AmountCell,
  DateCell,
}                                    from './primitives'
import { FocusTrap }                 from '@/components/ui/accessibility'
import type { TransactionType }      from '@/types/database.types'

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

const QUICK_FILTERS: { key: QuickFilter; label: string; color?: string }[] = [
  { key: 'all',        label: 'Todos'        },
  { key: 'income',     label: 'Ingresos',    color: '#10b981' },
  { key: 'expense',    label: 'Egresos',     color: '#ef4444' },
  { key: 'transfer',   label: 'Transferencias', color: '#3b82f6' },
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
  INCOME:   { label: 'Ingreso',      color: '#10b981', prefix: '+' },
  EXPENSE:  { label: 'Egreso',       color: '#ef4444', prefix: '−' },
  TRANSFER: { label: 'Transferencia',color: '#3b82f6', prefix: '⇄' },
}

// ─── TYPE BADGE ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: TransactionType }) {
  const cfg = TYPE_CONFIG[type]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{
        backgroundColor: cfg.color + '18',
        color:           cfg.color,
      }}
    >
      {cfg.prefix} {cfg.label}
    </span>
  )
}

// ─── MODULE BADGES ────────────────────────────────────────────────────────────

function ModuleBadges({ tx }: {
  tx: { hasAsset?: boolean; hasCredit?: boolean; hasReceivable?: boolean; hasPayable?: boolean }
}) {
  const badges = [
    tx.hasAsset      && { label: 'Activo',   color: '#8b5cf6' },
    tx.hasCredit     && { label: 'Crédito',  color: '#f59e0b' },
    tx.hasReceivable && { label: 'X Cobrar', color: '#06b6d4' },
    tx.hasPayable    && { label: 'X Pagar',  color: '#f97316' },
  ].filter(Boolean) as { label: string; color: string }[]

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map(b => (
        <span
          key={b.label}
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: b.color + '15', color: b.color }}
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
  scope: 'INCOME' | 'EXPENSE' | 'BOTH'
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

export function TransactionTable({ initialParams = {} }: TransactionTableProps) {
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
  const initializedFiltersRef = useRef(false)
  const suspendControlToParamsSyncRef = useRef(false)
  const loadedPrefsRef = useRef(false)
  const loadedSavedViewsRef = useRef(false)

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
    deleteState,
  } = useTransactions({
    ...initialParams,
    ...initialControl.txParams,
  })

  const selectedTransactionForDelete = useMemo(
    () => transactions.find(tx => tx.id === deleteTransactionId) ?? null,
    [deleteTransactionId, transactions]
  )

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

    setParams({
      search:   deferredSearch || undefined,
      account_id: accountId || undefined,
      category_id: categoryId || undefined,
      sort_by:  sortBy,
      sort_dir: sortDir,
      ...QuickFilterParams[activeFilter],
    })
  }, [activeFilter, accountId, categoryId, deferredSearch, sortBy, sortDir, setParams])

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
    setOrDelete('date_from', activeQuickFilterParams.date_from)
    setOrDelete('date_to', activeQuickFilterParams.date_to)

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
          BOTH: 'Ambos',
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
    setSelectedSavedViewId('')
    setParams({
      sort_by: 'transaction_date',
      sort_dir: 'desc',
      per_page: 20,
      page: 1,
      search: undefined,
      account_id: undefined,
      category_id: undefined,
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
      <TableShell>
        {/* ── TOOLBAR ──────────────────────────────────────────────────── */}
        {filterOptionsError && (
          <div className="px-4 pt-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2">
              <p className="text-[11px] font-medium text-red-400">{filterOptionsError}</p>
              <button
                type="button"
                onClick={() => setFilterOptionsReloadTick(prev => prev + 1)}
                className="rounded-md border border-red-300/35 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}
        <Toolbar>
          {/* Filtros rápidos */}
          <div className="flex gap-1.5 overflow-x-auto pb-px">
            {QUICK_FILTERS.map(f => (
              <FilterPill
                key={f.key}
                label={f.label}
                active={activeFilter === f.key}
                onClick={() => handleQuickFilter(f.key)}
                color={f.color}
                testId={`transactions-quick-filter-${f.key}`}
              />
            ))}
          </div>

          {/* Espacio */}
          <div className="flex-1"/>

          {/* Búsqueda */}
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar descripción…"
            data-testid="transactions-search-input"
          />

          {/* Cuenta */}
          <div className="relative">
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              disabled={loadingFilterOptions}
              data-testid="transactions-account-filter"
              className="
                pl-3 pr-7 py-1.5 rounded-lg text-[12px] font-medium min-w-[170px]
                bg-[var(--color-surface)] border border-[color:var(--color-border)]
                text-[var(--color-text-muted)] appearance-none cursor-pointer
                focus:outline-none focus:ring-1 focus:ring-emerald-500/20
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-150
              "
            >
              <option value="">Todas las cuentas</option>
              {accountOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>

          {/* Categoría */}
          <div className="relative">
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              disabled={loadingFilterOptions}
              data-testid="transactions-category-filter"
              className="
                pl-3 pr-7 py-1.5 rounded-lg text-[12px] font-medium min-w-[180px]
                bg-[var(--color-surface)] border border-[color:var(--color-border)]
                text-[var(--color-text-muted)] appearance-none cursor-pointer
                focus:outline-none focus:ring-1 focus:ring-emerald-500/20
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-150
              "
            >
              <option value="">Todas las categorías</option>
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>

          {/* Ordenamiento */}
          <SortSelect
            options={SORT_OPTIONS}
            value={sort}
            onChange={handleSortChange}
            data-testid="transactions-sort-select"
          />

          {/* Registros por página */}
          <div className="relative">
            <select
              value={String(params.per_page ?? 20)}
              onChange={e => {
                const nextPerPage = Number(e.target.value)
                setParams({ per_page: nextPerPage, page: 1 })
              }}
              data-testid="transactions-per-page-select"
              className="
                pl-3 pr-7 py-1.5 rounded-lg text-[12px] font-medium min-w-[125px]
                bg-[var(--color-surface)] border border-[color:var(--color-border)]
                text-[var(--color-text-muted)] appearance-none cursor-pointer
                focus:outline-none focus:ring-1 focus:ring-emerald-500/20
                transition-all duration-150
              "
            >
              {PER_PAGE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option} / página
                </option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>

          {/* Vistas guardadas */}
          <div className="relative">
            <select
              value={selectedSavedViewId}
              onChange={e => {
                const nextId = e.target.value
                if (!nextId) {
                  setSelectedSavedViewId('')
                  return
                }
                applySavedView(nextId)
              }}
              data-testid="transactions-saved-view-select"
              className="
                pl-3 pr-7 py-1.5 rounded-lg text-[12px] font-medium min-w-[150px]
                bg-[var(--color-surface)] border border-[color:var(--color-border)]
                text-[var(--color-text-muted)] appearance-none cursor-pointer
                focus:outline-none focus:ring-1 focus:ring-emerald-500/20
                transition-all duration-150
              "
            >
              <option value="">Vistas guardadas</option>
              {savedViews.map(view => (
                <option key={view.id} value={view.id}>{view.name}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
          <button
            type="button"
            onClick={openSaveViewModal}
            data-testid="transactions-save-view-button"
            className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
          >
            Guardar vista
          </button>
          <button
            type="button"
            disabled={!selectedSavedViewId}
            onClick={openDeleteSavedViewModal}
            data-testid="transactions-delete-view-button"
            className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11px] font-semibold text-red-400/75 hover:text-red-300 hover:border-red-400/35 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Eliminar vista
          </button>

          {/* Gestión rápida */}
          <div className="flex items-center gap-2">
            <Link
              href="/portfolio"
              className="text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Portafolio
            </Link>
            <span className="text-[var(--color-text-faint)] text-[10px]">·</span>
            <Link
              href="/admin"
              className="text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Categorías
            </Link>
            <button
              type="button"
              onClick={resetAllFilters}
              data-testid="transactions-reset-filters-button"
              className="ml-1 rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
            >
              Limpiar
            </button>
          </div>
        </Toolbar>

        {/* ── TABLA ────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
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
                <Th className="w-20"/>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows cols={6} rows={10}/>
              ) : isEmpty ? (
                <EmptyState
                  icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/></svg>}
                  title="Sin transacciones"
                  description={search ? `No hay resultados para "${search}"` : 'Registra tu primer ingreso, egreso o transferencia.'}
                  action={
                    !search ? (
                      <Link href="/transactions/new"
                        className="btn-primary text-xs px-4 py-2">
                        + Nueva transacción
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                transactions.map(tx => {
                  const rowAccentClass =
                    tx.type === 'INCOME'
                      ? 'border-l-2 border-l-emerald-500/70'
                      : tx.type === 'EXPENSE'
                        ? 'border-l-2 border-l-red-500/70'
                        : 'border-l-2 border-l-cyan-400/70'

                  return (
                    <tr
                      key={tx.id}
                      data-testid={`transactions-row-${tx.id}`}
                      className={`group/row cursor-pointer transition-colors hover:bg-[var(--color-surface-2)] ${rowAccentClass}`}
                      onClick={() => router.push(`/transactions/${tx.id}`)}
                    >
                      <Td>
                        <TypeBadge type={tx.type}/>
                      </Td>
                      <Td>
                        <p className="text-sm text-[var(--color-text)] font-medium leading-tight">
                          {tx.description}
                        </p>
                        <ModuleBadges tx={tx}/>
                        {tx.category && (
                          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                            {normalizeCategoryLabel(tx.category.name)}
                          </p>
                        )}
                      </Td>
                      <Td muted className="hidden md:table-cell">
                        <p className="text-[12px]">{tx.sourceAccount?.name ?? '—'}</p>
                        {tx.destinationAccount && (
                          <p className="text-[10px] text-[var(--color-text-faint)]">
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
                        <RowActions actions={[
                          {
                            label:   'Editar',
                            onClick: () => router.push(`/transactions/${tx.id}`),
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
          <Pagination
            page={pagination.page}
            totalPages={totalPages}
            total={pagination.total}
            perPage={pagination.per_page}
            onPage={setPage}
          />
        )}

        {/* Refresh indicator */}
        {isValidating && !isLoading && (
          <div className="px-4 py-2 border-t border-[color:var(--color-border)] text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] animate-pulse">Actualizando…</p>
          </div>
        )}
      </TableShell>

      {saveViewModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[color:var(--color-overlay)] px-4"
          onClick={closeSaveViewModal}
          data-testid="transactions-save-view-modal"
        >
          <FocusTrap active={saveViewModalOpen} onEscape={closeSaveViewModal}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="transactions-save-view-title"
              className="w-full max-w-md rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-modal-bg)] p-5"
              onClick={event => event.stopPropagation()}
            >
              <h3 id="transactions-save-view-title" className="text-sm font-bold text-[var(--color-text)]">
                Guardar vista
              </h3>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
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
                  <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Nombre</span>
                  <input
                    value={saveViewNameDraft}
                    onChange={event => {
                      setSaveViewNameDraft(event.target.value)
                      setSaveViewError(null)
                    }}
                    autoFocus
                    data-testid="transactions-save-view-name-input"
                    className="w-full rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none transition-colors focus:border-emerald-400/45"
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
                  <button
                    type="button"
                    onClick={closeSaveViewModal}
                    data-testid="transactions-save-view-cancel-button"
                    className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    data-testid="transactions-save-view-confirm-button"
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-bold text-black hover:bg-emerald-400 transition-colors"
                  >
                    {duplicatedSavedView ? 'Sobrescribir' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </FocusTrap>
        </div>
      )}

      {deleteSavedViewModalOpen && selectedSavedView && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[color:var(--color-overlay)] px-4"
          onClick={closeDeleteSavedViewModal}
          data-testid="transactions-delete-view-modal"
        >
          <FocusTrap active={deleteSavedViewModalOpen} onEscape={closeDeleteSavedViewModal}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="transactions-delete-view-title"
              className="w-full max-w-md rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-modal-bg)] p-5"
              onClick={event => event.stopPropagation()}
            >
              <h3 id="transactions-delete-view-title" className="text-sm font-bold text-[var(--color-text)]">
                Eliminar vista guardada
              </h3>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                ¿Eliminar la vista <span className="font-semibold text-[var(--color-text)]">&quot;{selectedSavedView.name}&quot;</span>?
              </p>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteSavedViewModal}
                  data-testid="transactions-delete-view-cancel-button"
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteSavedView}
                  data-testid="transactions-delete-view-confirm-button"
                  className="rounded-lg border border-red-400/40 bg-red-500/20 px-3 py-1.5 text-[12px] font-bold text-red-300 hover:bg-red-500/30 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}

      {deleteTransactionModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[color:var(--color-overlay)] px-4"
          onClick={closeDeleteTransactionModal}
          data-testid="transactions-delete-modal"
        >
          <FocusTrap active={deleteTransactionModalOpen} onEscape={closeDeleteTransactionModal}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="transactions-delete-title"
              className="w-full max-w-md rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-modal-bg)] p-5"
              onClick={event => event.stopPropagation()}
            >
              <h3 id="transactions-delete-title" className="text-sm font-bold text-[var(--color-text)]">
                Eliminar transacción
              </h3>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                Esta acción no se puede deshacer
                {selectedTransactionForDelete ? (
                  <>
                    {' '}y afectará los saldos relacionados de{' '}
                    <span className="font-semibold text-[var(--color-text)]">
                      {selectedTransactionForDelete.description}
                    </span>.
                  </>
                ) : '.'}
              </p>
              {deleteState.status === 'error' && (
                <p className="mt-2 text-[11px] text-red-400">
                  {deleteState.error.message ?? 'No se pudo eliminar la transacción.'}
                </p>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteTransactionModal}
                  disabled={deleteState.status === 'loading'}
                  data-testid="transactions-delete-cancel-button"
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteTransaction()}
                  disabled={deleteState.status === 'loading'}
                  data-testid="transactions-delete-confirm-button"
                  className="rounded-lg border border-red-400/40 bg-red-500/20 px-3 py-1.5 text-[12px] font-bold text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {deleteState.status === 'loading' ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  )
}
