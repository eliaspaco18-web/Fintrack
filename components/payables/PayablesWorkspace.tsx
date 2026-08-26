'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RecordModal } from '@/components/ui/RecordModal'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { ViewToggle } from '@/components/ui/ViewToggle'
import {
  AmountCell,
  ConfirmDialog,
  DataFilterPreset,
  DataSearchField,
  EmptyState,
  FilterBar,
  LedgerModule,
  StatusBadge,
} from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { useToast } from '@/lib/toast/toast'
import { ObligationCurrencyProgress } from '@/components/obligations/ObligationCurrencyProgress'
import {
  combineObligationCurrencyBreakdowns,
  formatObligationCurrencySummaries,
  getObligationSettlementState,
  type ObligationSettlementState,
} from '@/modules/obligations/obligation-currency-presentation'
import { CreditorForm, type CreditorRow } from './CreditorForm'
import { PayableForm } from './PayableForm'
import { CreditorDetail, type CreditorWithStats } from './CreditorDetail'

type StatusFilter = 'all' | 'pending' | 'paid'
type SortOrder = 'desc' | 'asc'
type ViewMode = 'list' | 'cards'

function creditorSettlementState(creditor: CreditorWithStats) {
  return getObligationSettlementState({
    summaries: creditor.currency_summaries,
    unverifiedRecordCount: creditor.unverified_currency_records,
    hasUnverifiedInitialBalance: creditor.has_unverified_initial_debt,
  })
}

function statusTone(state: ObligationSettlementState) {
  if (state === 'SETTLED') return 'success' as const
  if (state === 'UNVERIFIED' || state === 'EMPTY') return 'muted' as const
  return 'danger' as const
}

function statusLabel(state: ObligationSettlementState) {
  if (state === 'SETTLED') return 'Pagado'
  if (state === 'UNVERIFIED') return 'No verificable'
  if (state === 'EMPTY') return 'Sin cuentas'
  return 'Pendiente'
}

export function PayablesWorkspace({ exchangeRate = 3.7 }: { exchangeRate?: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [creditors, setCreditors] = useState<CreditorWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowActionId, setRowActionId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [query, setQuery] = useState('')

  const [creditorModalOpen, setCreditorModalOpen] = useState(false)
  const [payableModalOpen, setPayableModalOpen] = useState(false)
  const [editingCreditor, setEditingCreditor] = useState<CreditorRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CreditorWithStats | null>(null)
  const [selectedCreditorId, setSelectedCreditorId] = useState<string | null>(null)
  const drawerCreditorId = searchParams.get('creditorId')

  const clearDrawerQuery = useCallback(() => {
    if (!searchParams.get('creditorId')) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('creditorId')
    const nextUrl = params.toString().length > 0 ? `${pathname}?${params}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  const loadCreditors = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetchWithTimeout('/api/creditors', { cache: 'no-store' })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los acreedores'))
      }

      setCreditors((json.data as CreditorWithStats[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar acreedores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCreditors()
  }, [loadCreditors])

  useEffect(() => {
    if (!drawerCreditorId || creditors.length === 0) return
    if (selectedCreditorId === drawerCreditorId) return
    if (creditors.some((creditor) => creditor.id === drawerCreditorId)) {
      setSelectedCreditorId(drawerCreditorId)
    }
  }, [creditors, drawerCreditorId, selectedCreditorId])

  const selectedCreditor = useMemo(
    () => creditors.find(creditor => creditor.id === selectedCreditorId) ?? null,
    [creditors, selectedCreditorId],
  )

  const currencyBreakdown = useMemo(
    () => combineObligationCurrencyBreakdowns(creditors.map(creditor => ({
      summaries: creditor.currency_summaries,
      unverifiedRecordCount: creditor.unverified_currency_records,
      unverifiedOpenRecordCount: creditor.unverified_open_currency_records,
    }))),
    [creditors],
  )

  const creditorsWithUnverifiedInitialDebt = useMemo(
    () => creditors.filter(creditor => creditor.has_unverified_initial_debt).length,
    [creditors],
  )

  const hasPendingDocumentedAmount = currencyBreakdown.summaries.some(summary => summary.pending > 0)
  const hasCurrencyLimitations = creditorsWithUnverifiedInitialDebt > 0
    || currencyBreakdown.unverifiedRecordCount > 0
  const canSortByPendingAmount = currencyBreakdown.summaries.length <= 1 && !hasCurrencyLimitations
  const currencyLimitationDetail = hasCurrencyLimitations
    ? [
        creditorsWithUnverifiedInitialDebt > 0
          ? `${creditorsWithUnverifiedInitialDebt} saldo${creditorsWithUnverifiedInitialDebt === 1 ? '' : 's'} inicial${creditorsWithUnverifiedInitialDebt === 1 ? '' : 'es'} sin moneda`
          : null,
        currencyBreakdown.unverifiedRecordCount > 0
          ? `${currencyBreakdown.unverifiedRecordCount} registro${currencyBreakdown.unverifiedRecordCount === 1 ? '' : 's'} no verificable${currencyBreakdown.unverifiedRecordCount === 1 ? '' : 's'}`
          : null,
      ].filter(Boolean).join(' · ')
    : null

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return creditors
      .filter(creditor => {
        const settlementState = creditorSettlementState(creditor)
        if (statusFilter === 'pending' && !['OPEN', 'UNVERIFIED'].includes(settlementState)) return false
        if (statusFilter === 'paid' && settlementState !== 'SETTLED') return false

        if (
          normalizedQuery &&
          !creditor.name.toLowerCase().includes(normalizedQuery) &&
          !(creditor.relationship ?? '').toLowerCase().includes(normalizedQuery)
        ) {
          return false
        }

        return true
      })
      .sort((left, right) => {
        if (!canSortByPendingAmount) return left.name.localeCompare(right.name, 'es')
        return sortOrder === 'desc'
          ? right.pending_amount - left.pending_amount
          : left.pending_amount - right.pending_amount
      })
  }, [canSortByPendingAmount, creditors, query, sortOrder, statusFilter])

  const pendingCreditors = useMemo(
    () => creditors.filter(creditor => ['OPEN', 'UNVERIFIED'].includes(creditorSettlementState(creditor))).length,
    [creditors],
  )

  const activeCreditors = useMemo(
    () => creditors.filter(creditor => creditor.is_active).length,
    [creditors],
  )

  const pendingAccounts = useMemo(
    () => creditors.reduce((sum, creditor) => (
      sum
      + creditor.currency_summaries.reduce((count, summary) => count + summary.openRecordCount, 0)
      + creditor.unverified_open_currency_records
    ), 0),
    [creditors],
  )

  const openCreateCreditor = useCallback(() => {
    setEditingCreditor(null)
    setCreditorModalOpen(true)
  }, [])

  const openEditCreditor = useCallback((creditor: CreditorRow) => {
    setEditingCreditor(creditor)
    setCreditorModalOpen(true)
  }, [])

  const closeCreditorModal = useCallback(() => {
    setCreditorModalOpen(false)
    setEditingCreditor(null)
  }, [])

  const onCreditorSuccess = useCallback(async () => {
    closeCreditorModal()
    await loadCreditors()
  }, [closeCreditorModal, loadCreditors])

  const onPayableSuccess = useCallback(async () => {
    setPayableModalOpen(false)
    await loadCreditors()
  }, [loadCreditors])

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return

    setRowActionId(pendingDelete.id)

    try {
      const res = await fetch(`/api/creditors/${pendingDelete.id}`, { method: 'DELETE' })

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el acreedor'))
      }

      toast.success('Acreedor eliminado', undefined, { persist: false })
      setPendingDelete(null)

      if (selectedCreditorId === pendingDelete.id) {
        setSelectedCreditorId(null)
      }

      await loadCreditors()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo eliminar el acreedor')
    } finally {
      setRowActionId(null)
    }
  }, [loadCreditors, pendingDelete, selectedCreditorId, toast])

  const toggleActive = useCallback(async (creditor: CreditorWithStats, next: boolean) => {
    setRowActionId(creditor.id)

    try {
      const res = await fetch(`/api/creditors/${creditor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el acreedor'))
      }

      toast.success(next ? 'Acreedor activado' : 'Acreedor desactivado', undefined, { persist: false })
      await loadCreditors()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setRowActionId(null)
    }
  }, [loadCreditors, toast])

  return (
    <>
      <LedgerModule
        kind="payable"
        title="Por pagar"
        description="Control de acreedores, compromisos abiertos y riesgo de salida de caja con detalle lateral inmediato."
        headerMode="content"
        actions={(
          <>
            <Button
              type="button"
              onClick={openCreateCreditor}
              variant="secondary"
              size="md"
              testId="payables-new-creditor-btn"
            >
              Nuevo acreedor
            </Button>
            <CreateModuleButton
              onClick={() => setPayableModalOpen(true)}
              label="Nueva cuenta"
              testId="payables-new-btn"
            />
          </>
        )}
        stats={[
          {
            label: 'Pendiente documentado',
            value: formatObligationCurrencySummaries(currencyBreakdown.summaries, 'pending'),
            detail: currencyLimitationDetail
              ?? (pendingCreditors > 0 ? `${pendingCreditors} acreedor${pendingCreditors === 1 ? '' : 'es'}` : 'Sin deuda activa'),
            caption: hasCurrencyLimitations
              ? 'Los importes sin moneda confirmada estan excluidos.'
              : 'Importes abiertos separados por moneda, sin conversion.',
            tone: hasPendingDocumentedAmount || hasCurrencyLimitations ? 'danger' : 'neutral',
          },
          {
            label: 'Pagado documentado',
            value: formatObligationCurrencySummaries(currencyBreakdown.summaries, 'settled'),
            detail: creditors.length > 0 ? 'Separado por moneda original' : 'Sin movimientos',
            caption: 'Pagos registrados sin mezclar PEN y USD.',
            tone: 'success',
          },
          {
            label: 'Cuentas abiertas',
            value: String(pendingAccounts),
            detail: pendingAccounts > 0 ? 'Seguimiento activo' : 'Sin alertas',
            caption: 'Compromisos documentados todavia pendientes de pago.',
            tone: pendingAccounts > 0 ? 'danger' : 'neutral',
          },
          {
            label: 'Acreedores activos',
            value: String(activeCreditors),
            detail: creditors.length > activeCreditors ? `${creditors.length - activeCreditors} inactivo${creditors.length - activeCreditors === 1 ? '' : 's'}` : 'Base vigente',
            caption: 'Terceros habilitados para nueva operacion.',
            tone: 'primary',
          },
        ]}
        presets={(
          <>
            <DataFilterPreset
              label="Pendientes"
              active={statusFilter === 'pending'}
              count={pendingCreditors}
              onClick={() => setStatusFilter('pending')}
              color="var(--c-danger)"
            />
            <DataFilterPreset
              label="Pagados"
              active={statusFilter === 'paid'}
              count={creditors.filter(creditor => creditorSettlementState(creditor) === 'SETTLED').length}
              onClick={() => setStatusFilter('paid')}
            />
            <DataFilterPreset
              label="Todos"
              active={statusFilter === 'all'}
              count={creditors.length}
              onClick={() => setStatusFilter('all')}
            />
          </>
        )}
        search={(
          <DataSearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar acreedor o relacion"
          />
        )}
        filters={(
          <FilterBar>
            {canSortByPendingAmount ? (
              <AppSelect
                value={sortOrder}
                onChange={value => setSortOrder(value as SortOrder)}
                compact
                searchable={false}
                className="w-[220px]"
                options={[
                  { value: 'desc', label: 'Mayor a menor saldo' },
                  { value: 'asc', label: 'Menor a mayor saldo' },
                ]}
              />
            ) : (
              <StatusBadge tone="muted" dot={false}>
                Orden alfabetico · saldos no comparables
              </StatusBadge>
            )}
          </FilterBar>
        )}
        viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} id="payables-view-toggle" />}
        controlsMeta={(
          <StatusBadge tone="muted" dot={false}>
            {filtered.length} acreedor{filtered.length === 1 ? '' : 'es'}
          </StatusBadge>
        )}
        error={error}
        onRetry={loadCreditors}
        detail={selectedCreditor ? {
          open: true,
          title: selectedCreditor.name,
          description: selectedCreditor.relationship?.trim()
            ? `${selectedCreditor.relationship} · ${formatObligationCurrencySummaries(selectedCreditor.currency_summaries, 'pending')} pendiente`
            : `${formatObligationCurrencySummaries(selectedCreditor.currency_summaries, 'pending')} pendiente`,
          onClose: () => {
            setSelectedCreditorId(null)
            clearDrawerQuery()
          },
          width: 1520,
          inset: true,
          content: (
            <CreditorDetail
              creditor={selectedCreditor}
              exchangeRate={exchangeRate}
              onChanged={loadCreditors}
            />
          ),
        } : null}
      >
        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map(item => (
              <div key={item} className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4">
                <div className="flex animate-pulse flex-col gap-3">
                  <div className="h-4 w-36 rounded-full bg-[var(--c-surface-2)]" />
                  <div className="h-3 w-full rounded-full bg-[var(--c-surface-2)]" />
                  <div className="h-16 rounded-[12px] bg-[var(--c-surface-2)]" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query || statusFilter !== 'pending'
              ? 'No encontramos acreedores para esos filtros.'
              : 'Todavia no tienes acreedores registrados.'}
            description={query || statusFilter !== 'pending'
              ? 'Prueba con otra busqueda o vuelve a los pendientes para recuperar el foco operativo.'
              : 'Crea primero el acreedor y luego registra cada cuenta por pagar dentro del ledger.'}
            action={query || statusFilter !== 'pending'
              ? {
                  label: 'Limpiar filtros',
                  onClick: () => {
                    setQuery('')
                    setStatusFilter('pending')
                    setSortOrder('desc')
                  },
                }
              : {
                  label: 'Nuevo acreedor',
                  onClick: openCreateCreditor,
                }}
          />
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {filtered.map(creditor => (
              <article
                key={creditor.id}
                className={`rounded-[14px] border px-4 py-4 transition-colors ${
                  creditor.is_active
                    ? 'border-[var(--c-border)] bg-[var(--c-surface)]'
                    : 'border-[var(--c-border)] bg-[var(--c-surface)] opacity-70'
                }`}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] xl:items-start">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => setSelectedCreditorId(creditor.id)}
                      data-testid={`creditor-open-${creditor.id}`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          creditorSettlementState(creditor) === 'SETTLED'
                            ? 'bg-[var(--c-success)]'
                            : creditorSettlementState(creditor) === 'UNVERIFIED'
                              ? 'bg-[var(--c-text-faint)]'
                              : 'bg-[var(--c-danger)]'
                        }`} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--c-text)]">
                              {creditor.name}
                            </p>
                            <StatusBadge tone={statusTone(creditorSettlementState(creditor))}>
                              {statusLabel(creditorSettlementState(creditor))}
                            </StatusBadge>
                            {!creditor.is_active ? (
                              <StatusBadge tone="muted" dot={false}>
                                Inactivo
                              </StatusBadge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                            {creditor.relationship?.trim() || 'Sin relacion registrada'}
                          </p>
                          <p className="mt-2 text-[11px] text-[var(--c-text-faint)]">
                            {creditor.count_pending > 0
                              ? `${creditor.count_pending} cuenta${creditor.count_pending === 1 ? '' : 's'} pendiente${creditor.count_pending === 1 ? '' : 's'}`
                              : 'Sin saldo abierto'}
                            {' · '}
                            {creditor.payables_count} movimiento{creditor.payables_count === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                        <AmountCell
                          label="Total documentado"
                          value={formatObligationCurrencySummaries(creditor.currency_summaries, 'total')}
                          align="left"
                        />
                      </div>
                      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                        <AmountCell
                          label="Pagado documentado"
                          value={formatObligationCurrencySummaries(creditor.currency_summaries, 'settled')}
                          tone="success"
                          align="left"
                        />
                      </div>
                      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                        <AmountCell
                          label="Pendiente documentado"
                          value={formatObligationCurrencySummaries(creditor.currency_summaries, 'pending')}
                          tone={creditor.currency_summaries.some(summary => summary.pending > 0) ? 'danger' : 'neutral'}
                          align="left"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      <ActionIconButton
                        onClick={() => setSelectedCreditorId(creditor.id)}
                        disabled={rowActionId !== null}
                        icon="view"
                        label="Ver detalle"
                      />
                      <ActionIconButton
                        onClick={() => openEditCreditor(creditor)}
                        disabled={rowActionId !== null}
                        icon="edit"
                        label="Editar acreedor"
                        testId={`creditor-edit-${creditor.id}`}
                      />
                      {creditor.is_active ? (
                        <ActionIconButton
                          onClick={() => void toggleActive(creditor, false)}
                          disabled={rowActionId !== null}
                          icon="deactivate"
                          label="Desactivar acreedor"
                          variant="danger"
                          testId={`creditor-deactivate-${creditor.id}`}
                        />
                      ) : (
                        <ActionIconButton
                          onClick={() => void toggleActive(creditor, true)}
                          disabled={rowActionId !== null}
                          icon="reactivate"
                          label="Activar acreedor"
                          variant="success"
                          testId={`creditor-reactivate-${creditor.id}`}
                        />
                      )}
                      <ActionIconButton
                        onClick={() => setPendingDelete(creditor)}
                        disabled={rowActionId !== null}
                        icon="delete"
                        label="Eliminar acreedor"
                        variant="danger"
                        testId={`creditor-delete-${creditor.id}`}
                      />
                    </div>
                  </div>

                  <ObligationCurrencyProgress
                    summaries={creditor.currency_summaries}
                    kind="payable"
                    hasUnverifiedInitialBalance={creditor.has_unverified_initial_debt}
                    unverifiedRecordCount={creditor.unverified_currency_records}
                    compact
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filtered.map(creditor => (
              <article
                key={creditor.id}
                className="rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => setSelectedCreditorId(creditor.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--c-text)]">
                          {creditor.name}
                        </p>
                        <StatusBadge tone={statusTone(creditorSettlementState(creditor))}>
                          {statusLabel(creditorSettlementState(creditor))}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                        {creditor.relationship?.trim() || 'Sin relacion registrada'}
                      </p>
                    </button>

                    <div className="flex items-center gap-1">
                      <ActionIconButton
                        onClick={() => setSelectedCreditorId(creditor.id)}
                        disabled={rowActionId !== null}
                        icon="view"
                        label="Ver detalle"
                        testId={`creditor-view-card-${creditor.id}`}
                      />
                      <ActionIconButton
                        onClick={() => openEditCreditor(creditor)}
                        disabled={rowActionId !== null}
                        icon="edit"
                        label="Editar acreedor"
                        testId={`creditor-edit-card-${creditor.id}`}
                      />
                      {creditor.is_active ? (
                        <ActionIconButton
                          onClick={() => void toggleActive(creditor, false)}
                          disabled={rowActionId !== null}
                          icon="deactivate"
                          label="Desactivar acreedor"
                          variant="danger"
                          testId={`creditor-deactivate-card-${creditor.id}`}
                        />
                      ) : (
                        <ActionIconButton
                          onClick={() => void toggleActive(creditor, true)}
                          disabled={rowActionId !== null}
                          icon="reactivate"
                          label="Activar acreedor"
                          variant="success"
                          testId={`creditor-reactivate-card-${creditor.id}`}
                        />
                      )}
                      <ActionIconButton
                        onClick={() => setPendingDelete(creditor)}
                        disabled={rowActionId !== null}
                        icon="delete"
                        label="Eliminar acreedor"
                        variant="danger"
                        testId={`creditor-delete-card-${creditor.id}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                      <AmountCell
                        label="Total documentado"
                        value={formatObligationCurrencySummaries(creditor.currency_summaries, 'total')}
                        align="left"
                      />
                    </div>
                    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                      <AmountCell
                        label="Pagado documentado"
                        value={formatObligationCurrencySummaries(creditor.currency_summaries, 'settled')}
                        tone="success"
                        align="left"
                      />
                    </div>
                    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                      <AmountCell
                        label="Pendiente documentado"
                        value={formatObligationCurrencySummaries(creditor.currency_summaries, 'pending')}
                        tone={creditor.currency_summaries.some(summary => summary.pending > 0) ? 'danger' : 'neutral'}
                        align="left"
                      />
                    </div>
                  </div>

                  <ObligationCurrencyProgress
                    summaries={creditor.currency_summaries}
                    kind="payable"
                    hasUnverifiedInitialBalance={creditor.has_unverified_initial_debt}
                    unverifiedRecordCount={creditor.unverified_currency_records}
                    compact
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </LedgerModule>

      <RecordModal
        open={creditorModalOpen}
        onClose={closeCreditorModal}
        eyebrow="Cuentas por pagar"
        title={editingCreditor ? 'Editar acreedor' : 'Nuevo acreedor'}
        subtitle="Registra a la persona o empresa a la que debes capital u obligaciones operativas."
        size="sm"
      >
        <CreditorForm
          creditor={editingCreditor}
          onSuccess={onCreditorSuccess}
          onCancel={closeCreditorModal}
        />
      </RecordModal>

      <RecordModal
        open={payableModalOpen}
        onClose={() => setPayableModalOpen(false)}
        eyebrow="Cuentas por pagar"
        title="Nueva cuenta por pagar"
        subtitle="Registra el compromiso pendiente y dejalo listo para seguimiento dentro del ledger."
        size="lg"
      >
        <PayableForm
          creditors={creditors}
          exchangeRate={exchangeRate}
          onSuccess={onPayableSuccess}
          onCancel={() => setPayableModalOpen(false)}
        />
      </RecordModal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Eliminar acreedor"
        message={`Esta accion eliminara a "${pendingDelete?.name}" y no se puede deshacer.`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
        loading={rowActionId !== null}
        danger
        confirmLabel="Eliminar"
        confirmTestId="confirm-delete-creditor"
      />
    </>
  )
}
