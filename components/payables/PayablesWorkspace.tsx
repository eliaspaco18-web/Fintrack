'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnchoredActionMenu } from '@/components/ui/AnchoredActionMenu'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { RecordModal } from '@/components/ui/RecordModal'
import { ConfirmDialog, DataErrorBanner, DataSearchField, EmptyState, PageLayout } from '@/components/finance'
import { FormActions } from '@/components/forms/primitives'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { useToast } from '@/lib/toast/toast'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import {
  combineObligationCurrencyBreakdowns,
  getObligationSettlementState,
  type ObligationCurrencySummary,
  type ObligationSettlementState,
} from '@/modules/obligations/obligation-currency-presentation'
import { getPayablePaymentProgress, countPayablesDueWithinDays, isValidIsoDate } from '@/modules/payables/payables-list-presentation'
import receivableStyles from '@/components/receivables/ReceivablesManager.module.css'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'
import detailStyles from './CreditorDetail.module.css'
import { CreditorForm, type CreditorRow } from './CreditorForm'
import type { PayableRow } from './PayableForm'
import { CreditorDetail, type CreditorWithStats } from './CreditorDetail'
import localStyles from './PayablesWorkspace.module.css'

type StatusFilter = 'all' | 'pending' | 'paid'
type SortOrder = 'desc' | 'asc'
type FormState = { disabled: boolean; saving: boolean; editing: boolean; dirty: boolean }
const EMPTY_FORM_STATE: FormState = { disabled: false, saving: false, editing: false, dirty: false }
const PAYABLE_ISSUE_URL = '/transactions?new=transaction&module=payable&type=INCOME'
const PAYABLE_PAYMENT_URL = '/transactions?new=transaction&module=payable&type=EXPENSE'

function settlementState(creditor: CreditorWithStats): ObligationSettlementState {
  return getObligationSettlementState({
    summaries: creditor.currency_summaries ?? [],
    unverifiedRecordCount: creditor.unverified_currency_records ?? 0,
    hasUnverifiedInitialBalance: creditor.has_unverified_initial_debt,
  })
}

function stateLabel(state: ObligationSettlementState) {
  if (state === 'SETTLED') return 'Pagado'
  if (state === 'UNVERIFIED') return 'No verificable'
  if (state === 'EMPTY') return 'Sin obligaciones'
  return 'Pendiente'
}

function stateClass(state: ObligationSettlementState) {
  if (state === 'SETTLED') return 'border-[var(--ft-success-soft)] bg-[var(--ft-success-soft)] text-[var(--ft-success)]'
  if (state === 'OPEN') return 'border-[var(--ft-warning-soft)] bg-[var(--ft-warning-soft)] text-[var(--ft-warning)]'
  if (state === 'UNVERIFIED') return 'border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-[var(--ft-text-muted)]'
  return 'border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-[var(--ft-text-subtle)]'
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function PayableProgress({ creditor, mobile = false }: { creditor: CreditorWithStats; mobile?: boolean }) {
  const progress = getPayablePaymentProgress(creditor.currency_summaries ?? [])
  if (!progress.available) {
    const label = progress.reason === 'inconsistent' ? 'Datos inconsistentes' : 'Sin datos suficientes'
    return <span className={receivableStyles.recoveryUnavailable} data-testid={`payables-progress-${creditor.id}`}>{label}</span>
  }
  return (
    <div className={`${receivableStyles.recoveryProgress} ${mobile ? receivableStyles.mobileRecoveryProgress : ''}`} aria-label={`Progreso de pago de ${creditor.name}`} data-testid={`payables-progress-${creditor.id}`}>
      {progress.items.map(item => (
        <div className={receivableStyles.recoveryCurrency} key={item.currency}>
          <div className={receivableStyles.recoveryLabel}><span>{item.currency}</span><strong>{item.percent.toFixed(1)}%</strong></div>
          <div className={receivableStyles.recoveryTrack} role="progressbar" aria-label={`Pagado ${item.currency}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.percent}>
            <span style={{ width: `${item.percent}%` }} />
          </div>
        </div>
      ))}
      {(creditor.unverified_currency_records > 0 || creditor.has_unverified_initial_debt)
        ? <span className={receivableStyles.recoveryNote}>Importes no verificables excluidos</span>
        : null}
    </div>
  )
}

function CreditorStatus({ creditor }: { creditor: CreditorWithStats }) {
  const state = settlementState(creditor)
  return <span className="inline-flex flex-wrap items-center gap-1.5">
    <span className={`inline-flex min-h-6 items-center rounded-[6px] border px-2 text-[10px] font-semibold leading-4 ${stateClass(state)}`}>{stateLabel(state)}</span>
    {!creditor.is_active ? <span className="inline-flex min-h-6 items-center rounded-[6px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2 text-[10px] font-medium leading-4 text-[var(--ft-text-subtle)]">Inactivo</span> : null}
  </span>
}

function pendingAmountRows(creditor: CreditorWithStats) {
  return (creditor.currency_summaries ?? []).filter(summary => summary.pending > 0)
}

function pendingPayables(payables: readonly PayableRow[], creditorId: string) {
  return payables.filter(row => row.creditor_id === creditorId && ['PENDING', 'PARTIAL', 'DISPUTED'].includes(row.status.toUpperCase()) && Number(row.amount) - Number(row.paid_amount) > 0)
}

function creditorDueSummary(payables: readonly PayableRow[], creditorId: string) {
  const open = pendingPayables(payables, creditorId)
  const dated = open.filter(row => isValidIsoDate(row.due_date)).sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  return { open, due: dated[0]?.due_date ?? null, withoutDate: open.filter(row => !isValidIsoDate(row.due_date)).length }
}

function CreditorActions({
  creditor, busy, canPay, onView, onEdit, onToggle, onDelete,
}: {
  creditor: CreditorWithStats
  busy: boolean
  canPay: boolean
  onView: () => void
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className={receivableStyles.actions}>
      <Button type="button" variant="ghost" size="sm" onClick={onView} disabled={busy}>Ver cuenta</Button>
      {canPay ? <Button href={PAYABLE_PAYMENT_URL} variant="secondary" size="sm" ariaLabel={`Registrar pago a ${creditor.name}`} title="Abre Registrar pago en Movimientos; allí elegirás la obligación exacta antes de confirmar.">Registrar pago</Button> : null}
      <span className={receivableStyles.moreAction}>
        <AnchoredActionMenu
          label={`Más acciones de ${creditor.name}`}
          triggerContent={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>}
          className="h-9 w-9 rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]"
          disabled={busy}
          align="end"
          actions={[
            { id: 'edit', label: 'Editar acreedor', onSelect: onEdit },
            { id: 'state', label: creditor.is_active ? 'Desactivar acreedor' : 'Activar acreedor', onSelect: onToggle },
            { id: 'delete', label: 'Eliminar acreedor', destructive: true, onSelect: onDelete },
          ]}
        />
      </span>
    </div>
  )
}

export function PayablesWorkspace() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const detailFocusReturnRef = useRef<HTMLElement | null>(null)
  const detailOpenRef = useRef(false)

  const [creditors, setCreditors] = useState<CreditorWithStats[]>([])
  const [payables, setPayables] = useState<PayableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [payablesLoading, setPayablesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payablesError, setPayablesError] = useState<string | null>(null)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [query, setQuery] = useState('')
  const [creditorModalOpen, setCreditorModalOpen] = useState(false)
  const [editingCreditor, setEditingCreditor] = useState<CreditorRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CreditorWithStats | null>(null)
  const [selectedCreditorId, setSelectedCreditorId] = useState<string | null>(null)
  const [selectedCreditorSnapshot, setSelectedCreditorSnapshot] = useState<CreditorWithStats | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [creditorFormState, setCreditorFormState] = useState<FormState>(EMPTY_FORM_STATE)
  const [discardTarget, setDiscardTarget] = useState<'creditor' | null>(null)
  const queryCreditorId = searchParams.get('creditorId')

  const clearDetailQuery = useCallback(() => {
    if (!searchParams.get('creditorId')) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('creditorId')
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const loadCreditors = useCallback(async () => {
    setError(null)
    try {
      const response = await fetchWithTimeout('/api/creditors', { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok || !Array.isArray(json.data)) throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los acreedores.'))
      setCreditors(json.data as CreditorWithStats[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los acreedores.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPayables = useCallback(async () => {
    setPayablesError(null)
    try {
      const response = await fetchWithTimeout('/api/payables', { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok || !Array.isArray(json.data)) throw new Error(getApiErrorMessage(json, 'No se pudieron consultar los vencimientos.'))
      setPayables(json.data as PayableRow[])
    } catch (caught) {
      setPayablesError(caught instanceof Error ? caught.message : 'No se pudieron consultar los vencimientos.')
    } finally {
      setPayablesLoading(false)
    }
  }, [])

  const refreshModule = useCallback(async () => { await Promise.all([loadCreditors(), loadPayables()]) }, [loadCreditors, loadPayables])
  useEffect(() => { void refreshModule() }, [refreshModule])

  const openCreditorDetail = useCallback((creditorId: string) => {
    const creditor = creditors.find(item => item.id === creditorId)
    if (!creditor) return
    if (document.activeElement instanceof HTMLElement) detailFocusReturnRef.current = document.activeElement
    detailOpenRef.current = true
    setSelectedCreditorSnapshot(creditor)
    setSelectedCreditorId(creditorId)
    setDetailOpen(true)
  }, [creditors])

  useEffect(() => {
    if (!queryCreditorId || creditors.length === 0 || selectedCreditorId === queryCreditorId) return
    if (creditors.some(creditor => creditor.id === queryCreditorId)) openCreditorDetail(queryCreditorId)
  }, [creditors, openCreditorDetail, queryCreditorId, selectedCreditorId])

  const selectedCreditor = useMemo(() => creditors.find(creditor => creditor.id === selectedCreditorId)
    ?? (selectedCreditorSnapshot?.id === selectedCreditorId ? selectedCreditorSnapshot : null), [creditors, selectedCreditorId, selectedCreditorSnapshot])
  const closeDetail = useCallback(() => { detailOpenRef.current = false; setDetailOpen(false); clearDetailQuery() }, [clearDetailQuery])
  const completeDetailExit = useCallback(() => {
    if (detailOpenRef.current) return
    setSelectedCreditorId(null)
    setSelectedCreditorSnapshot(null)
    const target = detailFocusReturnRef.current
    detailFocusReturnRef.current = null
    if (target?.isConnected && !target.closest('[inert]')) target.focus()
  }, [])

  const breakdown = useMemo(() => combineObligationCurrencyBreakdowns(creditors.map(creditor => ({
    summaries: creditor.currency_summaries ?? [],
    unverifiedRecordCount: creditor.unverified_currency_records ?? 0,
    unverifiedOpenRecordCount: creditor.unverified_open_currency_records ?? 0,
  }))), [creditors])
  const hasUnverifiedInitial = creditors.some(creditor => creditor.has_unverified_initial_debt)
  const hasCurrencyLimitations = hasUnverifiedInitial || breakdown.unverifiedRecordCount > 0
  const canSortByPending = breakdown.summaries.length <= 1 && !hasCurrencyLimitations
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-PE')
    return creditors.filter(creditor => {
      const state = settlementState(creditor)
      if (statusFilter === 'pending' && !['OPEN', 'UNVERIFIED'].includes(state)) return false
      if (statusFilter === 'paid' && state !== 'SETTLED') return false
      return !normalized || creditor.name.toLocaleLowerCase('es-PE').includes(normalized)
        || (creditor.relationship ?? '').toLocaleLowerCase('es-PE').includes(normalized)
    }).sort((left, right) => {
      if (!canSortByPending) return left.name.localeCompare(right.name, 'es')
      return sortOrder === 'desc' ? right.pending_amount - left.pending_amount : left.pending_amount - right.pending_amount
    })
  }, [canSortByPending, creditors, query, sortOrder, statusFilter])
  const pendingByCurrency = useMemo(() => new Map(breakdown.summaries.map(summary => [summary.currency, summary.pending])), [breakdown.summaries])
  const pendingCountByCurrency = useMemo(() => new Map(breakdown.summaries.map(summary => [summary.currency, summary.openRecordCount])), [breakdown.summaries])
  const summaryCurrencies = useMemo<ObligationCurrencySummary['currency'][]>(() => Array.from(new Set<ObligationCurrencySummary['currency']>(['PEN', 'USD', ...breakdown.summaries.map(summary => summary.currency)])), [breakdown.summaries])
  const dueSoon = useMemo(() => countPayablesDueWithinDays(payables, todayLocal(), 7), [payables])

  const openCreateCreditor = useCallback(() => { setEditingCreditor(null); setCreditorFormState(EMPTY_FORM_STATE); setCreditorModalOpen(true) }, [])
  const openEditCreditor = useCallback((creditor: CreditorWithStats) => { setEditingCreditor(creditor); setCreditorFormState({ ...EMPTY_FORM_STATE, editing: true }); setCreditorModalOpen(true) }, [])
  const requestCloseCreditor = useCallback(() => { if (creditorFormState.dirty) setDiscardTarget('creditor'); else setCreditorModalOpen(false) }, [creditorFormState.dirty])
  const confirmDiscard = useCallback(() => {
    if (discardTarget === 'creditor') setCreditorModalOpen(false)
    setDiscardTarget(null)
  }, [discardTarget])
  const onCreditorSuccess = useCallback(async () => { setCreditorModalOpen(false); await refreshModule() }, [refreshModule])

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return
    setRowActionId(pendingDelete.id)
    try {
      const response = await fetch(`/api/creditors/${pendingDelete.id}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 204) {
        const json = await response.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el acreedor.'))
      }
      toast.success('Acreedor eliminado', undefined, { persist: false })
      setPendingDelete(null)
      if (selectedCreditorId === pendingDelete.id) closeDetail()
      await refreshModule()
    } catch (caught) { toast.error('No se pudo eliminar', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.') }
    finally { setRowActionId(null) }
  }, [closeDetail, pendingDelete, refreshModule, selectedCreditorId, toast])

  const toggleActive = useCallback(async (creditor: CreditorWithStats) => {
    const next = !creditor.is_active
    setRowActionId(creditor.id)
    try {
      const response = await fetch(`/api/creditors/${creditor.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: next }) })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el acreedor.'))
      toast.success(next ? 'Acreedor activado' : 'Acreedor desactivado', undefined, { persist: false })
      await refreshModule()
    } catch (caught) { toast.error('No se pudo actualizar', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.') }
    finally { setRowActionId(null) }
  }, [refreshModule, toast])

  const currentDate = todayLocal()
  const detailState = selectedCreditor ? settlementState(selectedCreditor) : null
  const dueRecordsReady = !payablesLoading && !payablesError
  const hasUnverifiedCount = hasUnverifiedInitial || breakdown.unverifiedRecordCount > 0

  return (
    <>
      <PageLayout className={`max-w-none !gap-0 ${movementStyles.v3ModuleContent} ${receivableStyles.page} ${localStyles.page}`}>
        <div data-testid="payables-page">
        <div className={movementStyles.pageOverview} data-testid="payables-page-overview">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 data-ft-route-heading="" tabIndex={-1} className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">Por pagar</h1>
              <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">Obligaciones y pagos organizados por acreedor y moneda.</p>
            </div>
            <div className={`${receivableStyles.headerActions} ${localStyles.headerActions}`}>
              <Button type="button" variant="secondary" size="sm" onClick={openCreateCreditor} className={receivableStyles.secondaryHeaderAction} testId="payables-new-creditor-btn" leadingIcon={<PlusIcon />}>Añadir persona</Button>
              <Button href={PAYABLE_ISSUE_URL} variant="secondary" size="sm" className={receivableStyles.secondaryHeaderAction} testId="payables-new-btn" leadingIcon={<PlusIcon />}>Nueva obligación</Button>
              <CreateModuleButton href={PAYABLE_PAYMENT_URL} label="Registrar pago" className={`${movementStyles.v3ModulePrimaryAction} ${receivableStyles.primaryAction}`} testId="payables-payment-btn" />
            </div>
          </header>

          <section className={movementStyles.summary} aria-label="Resumen de cuentas por pagar">
            {summaryCurrencies.map(currency => (
              <div className={movementStyles.summaryItem} key={currency}>
                <p>Pendiente documentado · {currency}</p>
                <div className={`${movementStyles.summaryValue} tabular-nums`}>{loading || error ? '—' : formatCurrency(pendingByCurrency.get(currency) ?? 0, currency)}</div>
                <span className={movementStyles.summaryDetail}>{error ? 'Resumen no disponible' : `${pendingCountByCurrency.get(currency) ?? 0} obligaciones abiertas`}</span>
              </div>
            ))}
            <div className={`${movementStyles.summaryItem} ${movementStyles.summaryQualitative}`}>
              <p>Vencimientos próximos · 7 días</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>{!dueRecordsReady ? '—' : `${dueSoon} registro${dueSoon === 1 ? '' : 's'}`}</div>
              <span className={movementStyles.summaryDetail}>{payablesError ? 'Fechas no disponibles' : 'Obligaciones abiertas con fecha registrada'}</span>
            </div>
          </section>
        </div>

        <nav aria-label="Estado de cuentas por pagar" className={`${movementStyles.tabs} ${receivableStyles.receivableTabs}`} data-testid="payables-status-tabs">
          {([['pending', 'Pendientes'], ['paid', 'Pagados'], ['all', 'Todos']] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)} className={receivableStyles.receivableTab} data-active={statusFilter === value}>{label}</button>
          ))}
        </nav>

        <div className={`${movementStyles.controls} ${movementStyles.portfolioFilterBar} ${receivableStyles.moduleToolbar}`} data-testid="payables-filter-toolbar">
          <div className={`${movementStyles.controlsMain} ${receivableStyles.moduleToolbarMain}`}>
            <div className={`${movementStyles.searchControl} ${receivableStyles.moduleSearch} ${localStyles.moduleSearch}`}>
              <DataSearchField value={query} onChange={setQuery} placeholder="Buscar persona o relación" className={localStyles.moduleSearchInput} aria-label="Buscar acreedores" data-testid="payables-search" />
            </div>
            {canSortByPending ? <AppSelect value={sortOrder} onChange={value => setSortOrder(value as SortOrder)} options={[{ value: 'desc', label: 'Mayor saldo primero' }, { value: 'asc', label: 'Menor saldo primero' }]} compact searchable={false} matchTriggerWidth className={`filters-control ${receivableStyles.sortSelect}`} ariaLabel="Ordenar por saldo pendiente" testId="payables-sort-filter" /> : <span className={receivableStyles.sortContext}>Orden alfabético · monedas separadas</span>}
          </div>
        </div>

        {error ? <DataErrorBanner message={error} onRetry={() => void loadCreditors()} /> : null}
        {payablesError ? <div role="status" className="flex flex-col gap-2 rounded-[12px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[12px] leading-[18px] text-[var(--ft-text-muted)]">No se pudieron consultar las fechas de vencimiento.</p><Button type="button" variant="secondary" size="sm" onClick={() => void loadPayables()}>Reintentar</Button></div> : null}

        {hasCurrencyLimitations ? <aside className={receivableStyles.currencyNotice} role="note" aria-label="Saldos sin moneda verificable">
          <div className={receivableStyles.currencyNoticeCopy}><svg className={receivableStyles.currencyNoticeIcon} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg><span>{hasUnverifiedInitial ? `${creditors.filter(creditor => creditor.has_unverified_initial_debt).length} saldo${creditors.filter(creditor => creditor.has_unverified_initial_debt).length === 1 ? '' : 's'} inicial${creditors.filter(creditor => creditor.has_unverified_initial_debt).length === 1 ? '' : 'es'} sin moneda identificada` : `${breakdown.unverifiedRecordCount} registro${breakdown.unverifiedRecordCount === 1 ? '' : 's'} sin moneda verificable`}. Se excluyen de los totales por moneda y del progreso.</span></div>
        </aside> : null}

        <section className={receivableStyles.register} aria-labelledby="payables-register-title" data-testid="payables-register">
          <div className={receivableStyles.registerHeader}><div className="min-w-0"><h2 id="payables-register-title" className={receivableStyles.registerTitle}>Personas a las que debes</h2></div></div>
          {error && creditors.length === 0 ? <div className={receivableStyles.emptyRows}><EmptyState title="No se pudieron cargar los acreedores." description="Reintenta para consultar el registro de Por pagar." action={{ label: 'Reintentar', onClick: () => void loadCreditors() }} /></div>
            : loading ? <div className={receivableStyles.loadingRows} aria-label="Cargando acreedores">{[0, 1, 2].map(item => <div key={item} className={receivableStyles.loadingRow} aria-hidden="true">{[0, 1, 2, 3, 4].map(cell => <span key={cell} className="h-3 animate-pulse rounded-full bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />)}</div>)}</div>
              : filtered.length === 0 ? <div className={receivableStyles.emptyRows}><EmptyState title={query || statusFilter !== 'pending' ? 'No encontramos acreedores con esos filtros.' : 'Todavía no tienes personas registradas.'} description={query || statusFilter !== 'pending' ? 'Prueba otra búsqueda o cambia el filtro de estado.' : 'Añade al acreedor y registra cada obligación para hacer seguimiento de sus pagos.'} action={query || statusFilter !== 'pending' ? { label: 'Limpiar filtros', onClick: () => { setQuery(''); setStatusFilter('pending'); setSortOrder('desc') } } : { label: 'Añadir persona', onClick: openCreateCreditor }} /></div>
                : <>
                  <div className={receivableStyles.columnHeading} aria-hidden="true"><span>Persona</span><span>Pendiente documentado</span><span>Progreso de pago</span><span>Vencimiento registrado</span><span className="text-right">Acciones</span></div>
                  <div className={receivableStyles.rows}>{filtered.map(creditor => {
                    const open = creditorDueSummary(payables, creditor.id)
                    const hasDisputed = payables.some(row => row.creditor_id === creditor.id && row.status.toUpperCase() === 'DISPUTED')
                    const pending = pendingAmountRows(creditor)
                    const state = settlementState(creditor)
                    const canPay = !payablesLoading && pendingPayables(payables, creditor.id).length > 0 && (creditor.currency_summaries ?? []).some(summary => summary.openRecordCount > 0)
                    return <Fragment key={creditor.id}>
                      <article className={receivableStyles.personRow} data-inactive={!creditor.is_active || undefined} data-unverified={creditor.has_unverified_initial_debt || undefined} data-testid={`payable-creditor-row-${creditor.id}`}>
                        <div className={receivableStyles.personIdentity}><div className={receivableStyles.personName}>{creditor.name}</div><p className={receivableStyles.personContext}>{creditor.relationship?.trim() || 'Sin relación registrada'}</p><div className={receivableStyles.personMeta}><CreditorStatus creditor={creditor} />{hasDisputed ? <span className="inline-flex min-h-6 items-center rounded-[6px] border border-[var(--ft-danger-soft)] bg-[var(--ft-danger-soft)] px-2 text-[10px] font-semibold leading-4 text-[var(--ft-danger)]">En disputa</span> : null}<span>{creditor.count_pending} obligación{creditor.count_pending === 1 ? '' : 'es'} pendiente{creditor.count_pending === 1 ? '' : 's'}</span>{creditor.has_unverified_initial_debt ? <span>Saldo inicial sin moneda</span> : null}</div></div>
                        <div className={receivableStyles.amountStack} aria-label={`Pendiente documentado de ${creditor.name}`}>{pending.length ? pending.map(summary => <div className={receivableStyles.currencyAmount} key={summary.currency}><span>{formatCurrency(summary.pending, summary.currency)}</span><span className={receivableStyles.currencyCode}>{summary.currency}</span></div>) : <span className={receivableStyles.currencyEmpty}>{creditor.has_unverified_initial_debt ? 'Importe inicial no verificable' : 'Sin saldo documentado pendiente'}</span>}</div>
                        <div className={receivableStyles.recoveryCell}><PayableProgress creditor={creditor} /></div>
                        <div className={receivableStyles.dueSummary}>{payablesLoading ? <span className={receivableStyles.dueEmpty}>Consultando fechas…</span> : payablesError ? <span className={receivableStyles.dueEmpty}>Fecha no disponible</span> : open.due ? <><div className={receivableStyles.dueDate}>{open.due < currentDate ? 'Vencida · ' : 'Próxima · '}{formatDate(open.due)}</div><p className={receivableStyles.dueMeta}>{open.open.filter(row => isValidIsoDate(row.due_date)).length > 1 ? `Entre ${open.open.filter(row => isValidIsoDate(row.due_date)).length} obligaciones con fecha` : 'Fecha registrada'}{open.withoutDate ? ` · ${open.withoutDate} sin fecha válida` : ''}</p></> : <span className={receivableStyles.dueEmpty}>{open.open.length ? 'Sin fecha registrada' : 'Sin vencimiento pendiente'}</span>}</div>
                        <CreditorActions creditor={creditor} busy={rowActionId !== null} canPay={canPay} onView={() => openCreditorDetail(creditor.id)} onEdit={() => openEditCreditor(creditor)} onToggle={() => void toggleActive(creditor)} onDelete={() => setPendingDelete(creditor)} />
                      </article>
                      <article className={receivableStyles.mobileCard} data-inactive={!creditor.is_active || undefined} data-testid={`payable-creditor-mobile-${creditor.id}`}>
                        <div className={receivableStyles.mobileTop}><div className={receivableStyles.mobileIdentity}><div className={receivableStyles.personName}>{creditor.name}</div><p className={receivableStyles.personContext}>{creditor.relationship?.trim() || 'Sin relación registrada'}</p><div className={receivableStyles.personMeta}><CreditorStatus creditor={creditor} />{hasDisputed ? <span className="inline-flex min-h-6 items-center rounded-[6px] border border-[var(--ft-danger-soft)] bg-[var(--ft-danger-soft)] px-2 text-[10px] font-semibold leading-4 text-[var(--ft-danger)]">En disputa</span> : null}</div></div><div className={receivableStyles.mobileAmounts}>{pending.length ? pending.map(summary => <span key={summary.currency} className={receivableStyles.currencyAmount}>{formatCurrency(summary.pending, summary.currency)}</span>) : <span className={receivableStyles.currencyEmpty}>Sin saldo documentado</span>}</div></div>
                        <PayableProgress creditor={creditor} mobile />
                        <div className={receivableStyles.mobileBottom}><div className={receivableStyles.dueSummary}>{payablesLoading ? <span className={receivableStyles.dueEmpty}>Consultando fechas…</span> : payablesError ? <span className={receivableStyles.dueEmpty}>Fecha no disponible</span> : open.due ? <div className={receivableStyles.dueDate}>{open.due < currentDate ? 'Vencida · ' : 'Próxima · '}{formatDate(open.due)}</div> : <span className={receivableStyles.dueEmpty}>{open.open.length ? 'Sin fecha registrada' : 'Sin vencimiento pendiente'}</span>}</div><CreditorActions creditor={creditor} busy={rowActionId !== null} canPay={canPay} onView={() => openCreditorDetail(creditor.id)} onEdit={() => openEditCreditor(creditor)} onToggle={() => void toggleActive(creditor)} onDelete={() => setPendingDelete(creditor)} /></div>
                      </article>
                    </Fragment>
                  })}</div>
                </>}
        </section>
        </div>
      </PageLayout>

      <RecordModal open={detailOpen} onClose={closeDetail} onExitComplete={completeDetailExit} eyebrow="Detalle de cuenta por pagar" title={selectedCreditor?.name ?? 'Detalle de cuenta'} subtitle={selectedCreditor?.relationship?.trim() || 'Obligaciones documentadas y movimientos vinculados.'} headerBadge={selectedCreditor ? <span className="inline-flex flex-wrap items-center gap-1.5"><span className={`inline-flex min-h-6 items-center rounded-[6px] border px-2 text-[10px] font-semibold leading-4 ${stateClass(detailState!)}`}>{stateLabel(detailState!)}</span>{!selectedCreditor.is_active ? <span className="inline-flex min-h-6 items-center rounded-[6px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2 text-[10px] font-medium leading-4 text-[var(--ft-text-subtle)]">Inactivo</span> : null}</span> : null} size="xl" presentation="workbench" overlayClassName={detailStyles.detailOverlay} bodyClassName={detailStyles.detailModalBody} preserveFocusOnResume preserveFocusOnDeactivate testId="payables-creditor-detail-modal">
        {selectedCreditor ? <CreditorDetail creditor={selectedCreditor} /> : null}
      </RecordModal>

      <RecordModal open={creditorModalOpen} onClose={requestCloseCreditor} onExitComplete={() => { if (!creditorModalOpen) { setEditingCreditor(null); setCreditorFormState(EMPTY_FORM_STATE) } }} eyebrow="Personas por pagar" title={editingCreditor ? 'Editar persona' : 'Añadir persona'} subtitle="Identifica a la persona o empresa acreedora." size="sm" presentation="workbench" focusTrapActive={!discardTarget} preserveFocusOnResume preserveFocusOnDeactivate testId="payables-creditor-modal" footer={<FormActions secondaryAction={<Button type="button" variant="secondary" size="lg" onClick={requestCloseCreditor} disabled={creditorFormState.saving}>Cancelar</Button>} primaryAction={<Button type="submit" form="creditor-form" variant="primary" size="lg" disabled={creditorFormState.disabled} loading={creditorFormState.saving} testId="creditor-save-btn">{creditorFormState.editing ? 'Actualizar acreedor' : 'Crear acreedor'}</Button>} />}>
        <CreditorForm creditor={editingCreditor} onSuccess={onCreditorSuccess} onFormStateChange={setCreditorFormState} />
      </RecordModal>

      <ConfirmDialog open={!!pendingDelete} title="Eliminar acreedor" message={`Esta acción eliminará a “${pendingDelete?.name}” y no se puede deshacer.`} onConfirm={() => void handleDelete()} onCancel={() => setPendingDelete(null)} loading={rowActionId !== null} danger confirmLabel="Eliminar" confirmTestId="confirm-delete-creditor" />
      <ConfirmDialog open={discardTarget !== null} title="Descartar cambios" message="Hay cambios sin guardar. ¿Quieres descartarlos?" onConfirm={confirmDiscard} onCancel={() => setDiscardTarget(null)} confirmLabel="Descartar" danger confirmTestId="confirm-discard-creditor-form" />
    </>
  )
}

function PlusIcon() {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
}
