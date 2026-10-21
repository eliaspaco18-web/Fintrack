'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnchoredActionMenu } from '@/components/ui/AnchoredActionMenu'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { RecordModal } from '@/components/ui/RecordModal'
import { ViewToggle } from '@/components/ui/ViewToggle'
import { ConfirmDialog, DataErrorBanner, DataSearchField, EmptyState, PageLayout } from '@/components/finance'
import { FormActions } from '@/components/forms/primitives'
import { DetailDrawer } from '@/components/finance/primitives'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { useToast } from '@/lib/toast/toast'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import {
  combineObligationCurrencyBreakdowns,
  type ObligationCurrencySummary,
} from '@/modules/obligations/obligation-currency-presentation'
import {
  countReceivablesDueWithinDays,
  getDebtorDueSummary,
  getReceivablePersonState,
  hasVerifiedOpenReceivable,
  type ReceivableListRecord,
} from '@/modules/receivables/receivables-list-presentation'
import { DebtorDetail } from './DebtorDetail'
import { DebtorForm, type DebtorRow } from './DebtorForm'
import { ReceivableForm, type ReceivableRow } from './ReceivableForm'
import styles from './ReceivablesManager.module.css'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'

type DebtorWithStats = DebtorRow & {
  total_lent: number
  total_collected: number
  pending_amount: number
  progress_pct: number
  all_collected: boolean
  count_pending: number
  receivables_count: number
  currency_summaries: ObligationCurrencySummary[]
  unverified_currency_records: number
  unverified_open_currency_records: number
  has_unverified_initial_debt: boolean
}

type StatusFilter = 'all' | 'pending' | 'collected'
type SortOrder = 'desc' | 'asc'
type ViewMode = 'list' | 'cards'
type DiscardTarget = 'debtor' | 'receivable' | null
type ModalFormState = { disabled: boolean; saving: boolean; editing: boolean }
const EMPTY_DEBTOR_FORM_STATE: ModalFormState = { disabled: false, saving: false, editing: false }
const EMPTY_RECEIVABLE_FORM_STATE: ModalFormState = { disabled: true, saving: false, editing: false }

const RECEIVABLES_COLLECTION_URL = '/transactions?new=transaction&module=receivable&type=INCOME'

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

function currentLocalDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function statusLabel(state: ReturnType<typeof getReceivablePersonState>) {
  switch (state) {
    case 'OPEN': return 'Pendiente'
    case 'PARTIAL': return 'Cobro parcial'
    case 'SETTLED': return 'Cobrado'
    case 'WRITTEN_OFF': return 'Castigado'
    case 'UNVERIFIED': return 'No verificable'
    default: return 'Sin cuentas documentadas'
  }
}

function statusClass(state: ReturnType<typeof getReceivablePersonState>) {
  if (state === 'SETTLED') return 'border-[var(--ft-success-soft)] bg-[var(--ft-success-soft)] text-[var(--ft-success)]'
  if (state === 'OPEN' || state === 'PARTIAL') return 'border-[var(--ft-warning-soft)] bg-[var(--ft-warning-soft)] text-[var(--ft-warning)]'
  if (state === 'WRITTEN_OFF') return 'border-[var(--ft-danger-soft)] bg-[var(--ft-danger-soft)] text-[var(--ft-danger)]'
  return 'border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-[var(--ft-text-muted)]'
}

function personState(
  debtor: DebtorWithStats,
  records: readonly ReceivableListRecord[],
  recordsUnavailable: boolean,
) {
  const state = getReceivablePersonState(records, debtor.id, debtor.has_unverified_initial_debt)
  return recordsUnavailable && debtor.receivables_count > 0 && state === 'EMPTY' ? 'UNVERIFIED' as const : state
}

function openReceivableRecords(records: readonly ReceivableListRecord[], debtorId: string) {
  return records.filter(record => record.debtor_id === debtorId
    && ['PENDING', 'PARTIAL'].includes(record.status)
    && Number.isFinite(Number(record.amount))
    && Number.isFinite(Number(record.collected_amount))
    && Number(record.amount) - Number(record.collected_amount) > 0)
}

function DebtorStatus({ state, inactive = false }: { state: ReturnType<typeof getReceivablePersonState>; inactive?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex min-h-6 items-center rounded-[6px] border px-2 text-[10px] font-semibold leading-4 ${statusClass(state)}`}>
        {statusLabel(state)}
      </span>
      {inactive ? (
        <span className="inline-flex min-h-6 items-center rounded-[6px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2 text-[10px] font-medium leading-4 text-[var(--ft-text-subtle)]">
          Inactivo
        </span>
      ) : null}
    </span>
  )
}

function DebtorActions({
  debtor,
  canCollect,
  busy,
  onView,
  onEdit,
  onToggle,
  onDelete,
}: {
  debtor: DebtorWithStats
  canCollect: boolean
  busy: boolean
  onView: () => void
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className={styles.actions}>
      <Button type="button" variant="ghost" size="sm" onClick={onView} disabled={busy}>
        Ver cuenta
      </Button>
      {canCollect ? (
        <Button
          href={RECEIVABLES_COLLECTION_URL}
          variant="secondary"
          size="sm"
          ariaLabel={`Registrar cobro, después selecciona una cuenta pendiente de ${debtor.name}`}
          title="Abre Registrar cobro en Movimientos. Allí elegirás la cuenta exacta antes de confirmar."
        >
          Registrar cobro
        </Button>
      ) : null}
      <span className={styles.moreAction}>
        <AnchoredActionMenu
          label={`Más acciones de ${debtor.name}`}
          triggerContent={(
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
            </svg>
          )}
          className="h-9 w-9 rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]"
          disabled={busy}
          align="end"
          actions={[
            { id: 'edit', label: 'Editar persona', onSelect: onEdit },
            { id: 'state', label: debtor.is_active ? 'Desactivar persona' : 'Activar persona', onSelect: onToggle },
            { id: 'delete', label: 'Eliminar persona', destructive: true, onSelect: onDelete },
          ]}
        />
      </span>
    </div>
  )
}

export function ReceivablesManager({ exchangeRate = 3.7 }: { exchangeRate?: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const registerRef = useRef<HTMLElement>(null)
  const hasLoadedDebtorsRef = useRef(false)
  const hasLoadedReceivablesRef = useRef(false)
  const nestedFocusReturnRef = useRef<HTMLElement | null>(null)

  const [debtors, setDebtors] = useState<DebtorWithStats[]>([])
  const [receivables, setReceivables] = useState<ReceivableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [receivablesLoading, setReceivablesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [receivablesError, setReceivablesError] = useState<string | null>(null)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [query, setQuery] = useState('')
  const [debtorModalOpen, setDebtorModalOpen] = useState(false)
  const [receivableModalOpen, setReceivableModalOpen] = useState(false)
  const [debtorDirty, setDebtorDirty] = useState(false)
  const [receivableDirty, setReceivableDirty] = useState(false)
  const [debtorFormState, setDebtorFormState] = useState(EMPTY_DEBTOR_FORM_STATE)
  const [receivableFormState, setReceivableFormState] = useState(EMPTY_RECEIVABLE_FORM_STATE)
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget>(null)
  const [editingDebtor, setEditingDebtor] = useState<DebtorRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DebtorWithStats | null>(null)
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null)
  const [nestedModalOpen, setNestedModalOpen] = useState(false)
  const drawerDebtorId = searchParams.get('debtorId')

  const clearDrawerQuery = useCallback(() => {
    if (!searchParams.get('debtorId')) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('debtorId')
    const nextUrl = params.toString().length > 0 ? `${pathname}?${params}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  const loadDebtors = useCallback(async () => {
    if (!hasLoadedDebtorsRef.current) setLoading(true)
    setError(null)
    try {
      const response = await fetchWithTimeout('/api/debtors', { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok || !Array.isArray(json.data)) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las personas.'))
      }
      setDebtors(json.data as DebtorWithStats[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las personas.')
    } finally {
      hasLoadedDebtorsRef.current = true
      setLoading(false)
    }
  }, [])

  // This unfiltered read is intentionally kept separate from /api/debtors and its legacy-link repair path.
  const loadReceivables = useCallback(async () => {
    if (!hasLoadedReceivablesRef.current) setReceivablesLoading(true)
    setReceivablesError(null)
    try {
      const response = await fetchWithTimeout('/api/receivables', { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok || !Array.isArray(json.data)) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las fechas de vencimiento.'))
      }
      setReceivables(json.data as ReceivableRow[])
    } catch (caught) {
      setReceivablesError(caught instanceof Error ? caught.message : 'No se pudieron cargar las fechas de vencimiento.')
    } finally {
      hasLoadedReceivablesRef.current = true
      setReceivablesLoading(false)
    }
  }, [])

  const refreshModule = useCallback(async () => {
    await Promise.all([loadDebtors(), loadReceivables()])
  }, [loadDebtors, loadReceivables])

  useEffect(() => { void loadDebtors(); void loadReceivables() }, [loadDebtors, loadReceivables])

  useEffect(() => {
    if (!drawerDebtorId || debtors.length === 0) return
    if (selectedDebtorId === drawerDebtorId) return
    if (debtors.some(debtor => debtor.id === drawerDebtorId)) setSelectedDebtorId(drawerDebtorId)
  }, [debtors, drawerDebtorId, selectedDebtorId])

  const selectedDebtor = useMemo(
    () => debtors.find(debtor => debtor.id === selectedDebtorId) ?? null,
    [debtors, selectedDebtorId],
  )
  const onNestedModalOpenChange = useCallback((open: boolean) => {
    if (open && document.activeElement instanceof HTMLElement) nestedFocusReturnRef.current = document.activeElement
    setNestedModalOpen(open)
  }, [])
  const currencyBreakdown = useMemo(() => combineObligationCurrencyBreakdowns(debtors.map(debtor => ({
    summaries: debtor.currency_summaries ?? [],
    unverifiedRecordCount: debtor.unverified_currency_records ?? 0,
    unverifiedOpenRecordCount: debtor.unverified_open_currency_records ?? 0,
  }))), [debtors])
  const hasCurrencyLimitations = debtors.some(debtor => debtor.has_unverified_initial_debt)
    || currencyBreakdown.unverifiedRecordCount > 0
  const unverifiedPersonCount = debtors.filter(debtor => debtor.has_unverified_initial_debt).length
  const canSortByPendingAmount = currencyBreakdown.summaries.length <= 1 && !hasCurrencyLimitations
  const currentDate = currentLocalDate()
  const listDataLoading = loading || (receivablesLoading && !hasLoadedReceivablesRef.current)

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-PE')
    return debtors.filter(debtor => {
      const state = personState(debtor, receivables, Boolean(receivablesError) && receivables.length === 0)
      if (statusFilter === 'pending' && !['OPEN', 'PARTIAL', 'UNVERIFIED'].includes(state)) return false
      if (statusFilter === 'collected' && state !== 'SETTLED') return false
      return !normalizedQuery
        || debtor.name.toLocaleLowerCase('es-PE').includes(normalizedQuery)
        || (debtor.relationship ?? '').toLocaleLowerCase('es-PE').includes(normalizedQuery)
    }).sort((left, right) => {
      if (!canSortByPendingAmount) return left.name.localeCompare(right.name, 'es')
      return sortOrder === 'desc'
        ? right.pending_amount - left.pending_amount
        : left.pending_amount - right.pending_amount
    })
  }, [canSortByPendingAmount, debtors, query, receivables, receivablesError, sortOrder, statusFilter])

  const pendingByCurrency = useMemo(() => new Map(
    currencyBreakdown.summaries.map(summary => [summary.currency, summary.pending]),
  ), [currencyBreakdown.summaries])
  const pendingByCurrencyCount = useMemo(() => new Map(
    currencyBreakdown.summaries.map(summary => [summary.currency, summary.openRecordCount]),
  ), [currencyBreakdown.summaries])
  const dueSoonCount = useMemo(
    () => countReceivablesDueWithinDays(receivables, currentDate, 7),
    [currentDate, receivables],
  )

  const openCreateDebtor = useCallback(() => {
    setEditingDebtor(null)
    setDebtorDirty(false)
    setDebtorFormState(EMPTY_DEBTOR_FORM_STATE)
    setDebtorModalOpen(true)
  }, [])
  const openEditDebtor = useCallback((debtor: DebtorRow) => {
    setEditingDebtor(debtor)
    setDebtorDirty(false)
    setDebtorFormState({ ...EMPTY_DEBTOR_FORM_STATE, editing: true })
    setDebtorModalOpen(true)
  }, [])
  const requestCloseDebtor = useCallback(() => {
    if (debtorDirty) setDiscardTarget('debtor')
    else setDebtorModalOpen(false)
  }, [debtorDirty])
  const requestCloseReceivable = useCallback(() => {
    if (receivableDirty) setDiscardTarget('receivable')
    else setReceivableModalOpen(false)
  }, [receivableDirty])
  const confirmDiscard = useCallback(() => {
    if (discardTarget === 'debtor') {
      setDebtorDirty(false)
      setDebtorModalOpen(false)
    } else if (discardTarget === 'receivable') {
      setReceivableDirty(false)
      setReceivableModalOpen(false)
    }
    setDiscardTarget(null)
  }, [discardTarget])

  const onDebtorSuccess = useCallback(async () => {
    setDebtorDirty(false)
    setDebtorModalOpen(false)
    await refreshModule()
  }, [refreshModule])
  const onReceivableSuccess = useCallback(async () => {
    setReceivableDirty(false)
    setReceivableModalOpen(false)
    await refreshModule()
  }, [refreshModule])

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return
    setRowActionId(pendingDelete.id)
    try {
      const response = await fetch(`/api/debtors/${pendingDelete.id}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 204) {
        const json = await response.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar la persona.'))
      }
      toast.success('Persona eliminada', undefined, { persist: false })
      setPendingDelete(null)
      if (selectedDebtorId === pendingDelete.id) setSelectedDebtorId(null)
      await refreshModule()
    } catch (caught) {
      toast.error('No se pudo eliminar', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setRowActionId(null)
    }
  }, [pendingDelete, refreshModule, selectedDebtorId, toast])

  const toggleActive = useCallback(async (debtor: DebtorWithStats) => {
    const next = !debtor.is_active
    setRowActionId(debtor.id)
    try {
      const response = await fetch(`/api/debtors/${debtor.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: next }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo actualizar la persona.'))
      toast.success(next ? 'Persona activada' : 'Persona desactivada', undefined, { persist: false })
      await refreshModule()
    } catch (caught) {
      toast.error('No se pudo actualizar', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setRowActionId(null)
    }
  }, [refreshModule, toast])

  const openWarningRecords = useCallback(() => {
    setStatusFilter('all')
    setQuery('')
    const unverifiedDebtors = debtors.filter(debtor => debtor.has_unverified_initial_debt)
    if (unverifiedDebtors.length === 1) {
      setSelectedDebtorId(unverifiedDebtors[0]!.id)
      return
    }
    requestAnimationFrame(() => registerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [debtors])

  const closeDetail = useCallback(() => {
    setSelectedDebtorId(null)
    clearDrawerQuery()
  }, [clearDrawerQuery])

  const summaryReady = !loading && !error

  return (
    <>
      <PageLayout className={`max-w-none !gap-0 ${movementStyles.v3ModuleContent} ${styles.page}`}>
        <div className={movementStyles.pageOverview} data-testid="receivables-page-overview">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 data-ft-route-heading="" tabIndex={-1} className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">
                Por cobrar
              </h1>
              <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">
                Tus pendientes, organizados por persona y moneda.
              </p>
            </div>
            <div className={styles.headerActions}>
              <CreateModuleButton
                onClick={() => { setReceivableDirty(false); setReceivableFormState(EMPTY_RECEIVABLE_FORM_STATE); setReceivableModalOpen(true) }}
                label="Registrar cuenta por cobrar"
                className={`${movementStyles.v3ModulePrimaryAction} ${styles.primaryAction} w-full sm:w-auto`}
                testId="receivables-create-button"
              />
            </div>
          </header>

          <section className={movementStyles.summary} aria-label="Resumen de cuentas por cobrar">
            <div className={movementStyles.summaryItem}>
              <p>Pendiente documentado · PEN</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>
                {!summaryReady ? '—' : formatCurrency(pendingByCurrency.get('PEN') ?? 0, 'PEN')}
              </div>
              <span className={movementStyles.summaryDetail}>
                {summaryReady ? `${pendingByCurrencyCount.get('PEN') ?? 0} cuentas abiertas` : error ? 'Resumen no disponible' : 'Cargando resumen'}
              </span>
            </div>
            <div className={movementStyles.summaryItem}>
              <p>Pendiente documentado · USD</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>
                {!summaryReady ? '—' : formatCurrency(pendingByCurrency.get('USD') ?? 0, 'USD')}
              </div>
              <span className={movementStyles.summaryDetail}>
                {summaryReady ? `${pendingByCurrencyCount.get('USD') ?? 0} cuentas abiertas` : error ? 'Resumen no disponible' : 'Cargando resumen'}
              </span>
            </div>
            <div className={`${movementStyles.summaryItem} ${movementStyles.summaryQualitative}`}>
              <p>Vencimientos próximos · 7 días</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>
                {receivablesLoading ? '—' : receivablesError ? 'No disponible' : `${dueSoonCount} registro${dueSoonCount === 1 ? '' : 's'}`}
              </div>
              <span className={movementStyles.summaryDetail}>
                {receivablesError ? 'Fechas no disponibles' : 'Cuentas pendientes con fecha registrada'}
              </span>
            </div>
          </section>
        </div>

        <nav aria-label="Estado de cuentas por cobrar" className={`${movementStyles.tabs} ${styles.receivableTabs}`} data-testid="receivables-status-tabs">
          {([
            ['pending', 'Pendientes'],
            ['collected', 'Cobrados'],
            ['all', 'Todos'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              className={styles.receivableTab}
              data-active={statusFilter === value}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className={`${movementStyles.controls} ${movementStyles.portfolioFilterBar} ${styles.moduleToolbar}`} data-testid="receivables-filter-toolbar">
          <div className={`${movementStyles.controlsMain} ${styles.moduleToolbarMain}`}>
            <DataSearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar persona o relación"
              className={`${movementStyles.searchControl} ${styles.moduleSearch}`}
              aria-label="Buscar personas que te deben"
              data-testid="receivables-search"
            />
            {canSortByPendingAmount ? (
              <AppSelect
                value={sortOrder}
                onChange={value => setSortOrder(value as SortOrder)}
                options={[
                  { value: 'desc', label: 'Mayor saldo primero' },
                  { value: 'asc', label: 'Menor saldo primero' },
                ]}
                compact
                searchable={false}
                className={`filters-control ${styles.sortSelect}`}
                aria-label="Ordenar por saldo pendiente"
                data-testid="receivables-sort-filter"
              />
            ) : (
              <span className={styles.sortContext}>Orden alfabético · monedas separadas</span>
            )}
          </div>
          <div className={`${movementStyles.controlsActions} ${styles.toolbarActions}`}>
            <ViewToggle value={viewMode} onChange={setViewMode} id="receivables-view-toggle" />
          </div>
        </div>

        {error ? <DataErrorBanner message={error} onRetry={loadDebtors} /> : null}
        {receivablesError ? (
          <div role="status" className="flex flex-col gap-2 rounded-[12px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] leading-[18px] text-[var(--ft-text-muted)]">No se pudieron consultar las fechas y referencias de las cuentas por cobrar.</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadReceivables()}>Reintentar</Button>
          </div>
        ) : null}

        {hasCurrencyLimitations ? (
          <aside className={styles.currencyNotice} role="note" aria-label="Saldos sin moneda verificable">
            <div className={styles.currencyNoticeCopy}>
              <svg className={styles.currencyNoticeIcon} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" />
              </svg>
              <span>
                {unverifiedPersonCount > 0
                  ? `${unverifiedPersonCount} saldo${unverifiedPersonCount === 1 ? '' : 's'} inicial${unverifiedPersonCount === 1 ? '' : 'es'} sin moneda identificada. Se conserva${unverifiedPersonCount === 1 ? '' : 'n'} por separado y no se suma${unverifiedPersonCount === 1 ? '' : 'n'} a los pendientes.`
                  : `${currencyBreakdown.unverifiedRecordCount} registro${currencyBreakdown.unverifiedRecordCount === 1 ? '' : 's'} sin moneda verificable; se excluyen de los importes por moneda.`}
              </span>
            </div>
              <Button type="button" variant="secondary" size="sm" onClick={openWarningRecords}>{unverifiedPersonCount === 1 ? 'Ver registro' : 'Revisar personas'}</Button>
          </aside>
        ) : null}

        <section ref={registerRef} className={styles.register} aria-labelledby="receivables-register-title" data-testid="receivables-register">
          <div className={styles.registerHeader}>
            <div className="min-w-0">
              <h2 id="receivables-register-title" className={styles.registerTitle}>Personas que te deben</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={openCreateDebtor} testId="receivables-new-debtor-btn">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Añadir persona
              </Button>
            </div>
          </div>

          {error && debtors.length === 0 ? (
            <div className={styles.emptyRows}>
              <EmptyState title="No se pudieron cargar las personas." description="Reintenta para consultar el registro de Por cobrar." action={{ label: 'Reintentar', onClick: () => void loadDebtors() }} />
            </div>
          ) : listDataLoading ? (
            <div className={styles.loadingRows} aria-label="Cargando personas">
              {[0, 1, 2].map(item => <div key={item} className={styles.loadingRow} aria-hidden="true">
                {[0, 1, 2, 3].map(cell => <span key={cell} className="h-3 animate-pulse rounded-full bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />)}
              </div>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyRows}>
              <EmptyState
                title={query || statusFilter !== 'pending' ? 'No encontramos personas con esos filtros.' : 'Todavía no tienes personas registradas.'}
                description={query || statusFilter !== 'pending'
                  ? 'Prueba otra búsqueda o cambia el filtro de estado.'
                  : 'Añade a la persona y luego registra cada cuenta por cobrar con su moneda y fechas.'}
                action={query || statusFilter !== 'pending'
                  ? { label: 'Limpiar filtros', onClick: () => { setQuery(''); setStatusFilter('pending') } }
                  : { label: 'Añadir persona', onClick: openCreateDebtor }}
              />
            </div>
          ) : (
            <>
              <div className={styles.columnHeading} aria-hidden="true">
                <span>Persona</span><span>Pendiente documentado</span><span>Vencimiento registrado</span><span className="text-right">Acciones</span>
              </div>
              {viewMode === 'list' ? (
                <div className={styles.rows}>
                  {filtered.map(debtor => {
                    const state = personState(debtor, receivables, Boolean(receivablesError) && receivables.length === 0)
                    const due = getDebtorDueSummary(receivables, debtor.id, currentDate)
                    const pending = (debtor.currency_summaries ?? []).filter(summary => summary.pending > 0)
                    const canCollect = !receivablesLoading && hasVerifiedOpenReceivable(receivables, debtor.id)
                    const openRecords = openReceivableRecords(receivables, debtor.id)
                    return (
                      <Fragment key={debtor.id}>
                        <article className={styles.personRow} data-inactive={!debtor.is_active || undefined} data-unverified={debtor.has_unverified_initial_debt || undefined} data-testid={`receivable-person-row-${debtor.id}`}>
                          <div className={styles.personIdentity}>
                            <div className={styles.personName}>{debtor.name}</div>
                            <p className={styles.personContext}>{debtor.relationship?.trim() || 'Sin relación registrada'}</p>
                            <div className={styles.personMeta}>
                              <DebtorStatus state={state} inactive={!debtor.is_active} />
                              <span>{openRecords.length} cuenta{openRecords.length === 1 ? '' : 's'} pendiente{openRecords.length === 1 ? '' : 's'}</span>
                              {debtor.has_unverified_initial_debt ? <span>Saldo inicial sin moneda</span> : null}
                            </div>
                          </div>
                          <div className={styles.amountStack} aria-label={`Pendiente documentado de ${debtor.name}`}>
                            {pending.length > 0 ? pending.map(summary => (
                              <div className={styles.currencyAmount} key={summary.currency}>
                                <span>{formatCurrency(summary.pending, summary.currency)}</span>
                                <span className={styles.currencyCode}>{summary.currency}</span>
                              </div>
                            )) : (
                              <span className={styles.currencyEmpty}>
                                {debtor.has_unverified_initial_debt ? 'Importe inicial no verificable' : 'Sin saldo documentado pendiente'}
                              </span>
                            )}
                          </div>
                          <div className={styles.dueSummary}>
                            {receivablesLoading ? <span className={styles.dueEmpty}>Consultando fechas…</span>
                              : receivablesError ? <span className={styles.dueEmpty}>Fecha no disponible</span>
                                : due.date ? <>
                                  <div className={styles.dueDate}>{due.overdue ? 'Vencida · ' : 'Próxima · '}{formatDate(due.date)}</div>
                                  <p className={styles.dueMeta}>
                                    {due.openWithDateCount > 1 ? `Entre ${due.openWithDateCount} cuentas con fecha` : 'Fecha registrada'}
                                    {due.openWithoutDateCount > 0 ? ` · ${due.openWithoutDateCount} sin fecha` : ''}
                                  </p>
                                </> : <span className={styles.dueEmpty}>
                                  {openRecords.length > 0 ? 'Sin fecha registrada' : 'Sin vencimiento pendiente'}
                                </span>}
                          </div>
                          <DebtorActions
                            debtor={debtor}
                            canCollect={canCollect}
                            busy={rowActionId !== null}
                            onView={() => setSelectedDebtorId(debtor.id)}
                            onEdit={() => openEditDebtor(debtor)}
                            onToggle={() => void toggleActive(debtor)}
                            onDelete={() => setPendingDelete(debtor)}
                          />
                        </article>

                        <article className={styles.mobileCard} data-inactive={!debtor.is_active || undefined} data-unverified={debtor.has_unverified_initial_debt || undefined} data-testid={`receivable-person-mobile-${debtor.id}`}>
                          <div className={styles.mobileTop}>
                            <div className={styles.mobileIdentity}>
                              <div className={styles.personName}>{debtor.name}</div>
                              <p className={styles.personContext}>{debtor.relationship?.trim() || 'Sin relación registrada'}</p>
                              <div className={styles.personMeta}><DebtorStatus state={state} inactive={!debtor.is_active} /></div>
                            </div>
                            <div className={styles.mobileAmounts}>
                              {pending.length > 0 ? pending.map(summary => (
                                <span key={summary.currency} className={styles.currencyAmount}>
                                  {formatCurrency(summary.pending, summary.currency)}
                                </span>
                              )) : <span className={styles.currencyEmpty}>{debtor.has_unverified_initial_debt ? 'No verificable' : 'Sin saldo abierto'}</span>}
                            </div>
                          </div>
                          <div className={styles.mobileBottom}>
                            <div className={styles.dueSummary}>
                              {receivablesLoading ? <span className={styles.dueEmpty}>Consultando fechas…</span>
                                : receivablesError ? <span className={styles.dueEmpty}>Fecha no disponible</span>
                                  : due.date ? <><div className={styles.dueDate}>{due.overdue ? 'Vencida · ' : 'Próxima · '}{formatDate(due.date)}</div><p className={styles.dueMeta}>{due.openWithDateCount > 1 ? `Entre ${due.openWithDateCount} cuentas con fecha` : 'Fecha registrada'}</p></>
                                    : <span className={styles.dueEmpty}>{openRecords.length > 0 ? 'Sin fecha registrada' : 'Sin vencimiento pendiente'}</span>}
                            </div>
                            <div className={styles.mobileActions}>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDebtorId(debtor.id)}>Ver cuenta</Button>
                              {canCollect ? <Button href={RECEIVABLES_COLLECTION_URL} variant="secondary" size="sm">Registrar cobro</Button> : null}
                              <span className={styles.moreAction}>
                                <AnchoredActionMenu
                                  label={`Más acciones de ${debtor.name}`}
                                  triggerContent={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>}
                                  className="h-9 w-9 rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]"
                                  disabled={rowActionId !== null}
                                  actions={[
                                    { id: 'edit', label: 'Editar persona', onSelect: () => openEditDebtor(debtor) },
                                    { id: 'state', label: debtor.is_active ? 'Desactivar persona' : 'Activar persona', onSelect: () => void toggleActive(debtor) },
                                    { id: 'delete', label: 'Eliminar persona', destructive: true, onSelect: () => setPendingDelete(debtor) },
                                  ]}
                                />
                              </span>
                            </div>
                          </div>
                        </article>
                      </Fragment>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-px bg-[var(--ft-border)] p-px xl:grid-cols-2">
                  {filtered.map(debtor => {
                    const state = personState(debtor, receivables, Boolean(receivablesError) && receivables.length === 0)
                    const pending = (debtor.currency_summaries ?? []).filter(summary => summary.pending > 0)
                    const canCollect = !receivablesLoading && hasVerifiedOpenReceivable(receivables, debtor.id)
                    return (
                      <article key={debtor.id} className="min-w-0 bg-[var(--ft-surface)] p-4" data-testid={`receivable-person-card-${debtor.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><div className={styles.personName}>{debtor.name}</div><p className={styles.personContext}>{debtor.relationship?.trim() || 'Sin relación registrada'}</p><div className="mt-2"><DebtorStatus state={state} inactive={!debtor.is_active} /></div></div>
                          <span className={styles.moreAction}><AnchoredActionMenu label={`Más acciones de ${debtor.name}`} triggerContent={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>} className="h-9 w-9 rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]" disabled={rowActionId !== null} actions={[{ id: 'edit', label: 'Editar persona', onSelect: () => openEditDebtor(debtor) }, { id: 'state', label: debtor.is_active ? 'Desactivar persona' : 'Activar persona', onSelect: () => void toggleActive(debtor) }, { id: 'delete', label: 'Eliminar persona', destructive: true, onSelect: () => setPendingDelete(debtor) }]} /></span>
                        </div>
                        <div className="mt-3 grid gap-1 border-t border-[var(--ft-border)] pt-3">
                          {pending.length > 0 ? pending.map(summary => <p key={summary.currency} className="text-[12px] font-semibold tabular-nums text-[var(--ft-text-strong)]">{formatCurrency(summary.pending, summary.currency)} · {summary.currency} pendiente</p>) : <p className="text-[12px] text-[var(--ft-text-muted)]">{debtor.has_unverified_initial_debt ? 'Saldo inicial sin moneda verificada' : 'Sin saldo documentado pendiente'}</p>}
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDebtorId(debtor.id)}>Ver cuenta</Button>{canCollect ? <Button href={RECEIVABLES_COLLECTION_URL} variant="secondary" size="sm">Registrar cobro</Button> : null}</div>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </PageLayout>

      <DetailDrawer
        open={Boolean(selectedDebtor)}
        title={selectedDebtor?.name ?? 'Detalle de persona'}
        description={selectedDebtor?.relationship?.trim() || 'Cuentas documentadas y movimientos vinculados, separados por moneda.'}
        onClose={closeDetail}
        width={1000}
        inset
        focusTrapActive={!nestedModalOpen}
        preserveFocusOnResume
        focusReturnTargetRef={nestedFocusReturnRef}
        reliableExitLifecycle
      >
        {selectedDebtor ? (
          <DebtorDetail
            debtor={selectedDebtor}
            exchangeRate={exchangeRate}
            onChanged={refreshModule}
            onNestedModalOpenChange={onNestedModalOpenChange}
          />
        ) : null}
      </DetailDrawer>

      <RecordModal
        open={debtorModalOpen}
        onClose={requestCloseDebtor}
        onExitComplete={() => { if (!debtorModalOpen) setEditingDebtor(null) }}
        eyebrow="Personas por cobrar"
        title={editingDebtor ? 'Editar persona' : 'Añadir persona'}
        subtitle="Identifica a quién corresponde el seguimiento del cobro."
        size="sm"
        presentation="workbench"
        testId="receivables-debtor-modal"
        footer={(
          <FormActions
            secondaryAction={<Button type="button" variant="secondary" size="lg" onClick={requestCloseDebtor} disabled={debtorFormState.saving}>Cancelar</Button>}
            primaryAction={(
              <Button type="submit" form="debtor-form" variant="primary" size="lg" disabled={debtorFormState.disabled} loading={debtorFormState.saving} testId="debtor-save-btn">
                {debtorFormState.editing ? 'Actualizar deudor' : 'Crear deudor'}
              </Button>
            )}
          />
        )}
      >
        <DebtorForm
          debtor={editingDebtor}
          onSuccess={onDebtorSuccess}
          onDirtyChange={setDebtorDirty}
          onFormStateChange={setDebtorFormState}
        />
      </RecordModal>

      <RecordModal
        open={receivableModalOpen}
        onClose={requestCloseReceivable}
        onExitComplete={() => { if (!receivableModalOpen) setReceivableDirty(false) }}
        eyebrow="Por cobrar"
        title="Registrar cuenta por cobrar"
        subtitle="Documenta el pendiente con su moneda y fechas registradas."
        size="lg"
        presentation="workbench"
        overlayClassName={`z-modal ${styles.receivableFormOverlay}`}
        testId="receivables-create-modal"
        footer={(
          <FormActions
            secondaryAction={<Button type="button" variant="secondary" size="lg" onClick={requestCloseReceivable} disabled={receivableFormState.saving}>Cancelar</Button>}
            primaryAction={(
              <Button type="submit" form="receivable-form" variant="primary" size="lg" disabled={receivableFormState.disabled} loading={receivableFormState.saving} testId="receivable-save-btn">
                Crear cuenta por cobrar
              </Button>
            )}
          />
        )}
      >
        <ReceivableForm
          debtors={debtors}
          exchangeRate={exchangeRate}
          onSuccess={onReceivableSuccess}
          onDirtyChange={setReceivableDirty}
          onFormStateChange={setReceivableFormState}
        />
      </RecordModal>

      <ConfirmDialog
        open={discardTarget !== null}
        title="Descartar cambios sin guardar"
        message="Los cambios realizados en este formulario se perderán."
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardTarget(null)}
        confirmLabel="Descartar cambios"
        confirmTestId="receivables-discard-confirm"
        cancelTestId="receivables-discard-cancel"
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar persona"
        message={`Esta acción eliminará a “${pendingDelete?.name ?? ''}” si las reglas actuales lo permiten.`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
        loading={rowActionId !== null}
        danger
        confirmLabel="Eliminar"
        confirmTestId="confirm-delete-debtor"
      />
    </>
  )
}
