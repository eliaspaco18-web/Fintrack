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
  ProgressMetric,
  StatusBadge,
} from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { useToast } from '@/lib/toast/toast'
import { DebtorForm, type DebtorRow } from './DebtorForm'
import { ReceivableForm } from './ReceivableForm'
import { DebtorDetail } from './DebtorDetail'

type DebtorWithStats = DebtorRow & {
  total_lent: number
  total_collected: number
  pending_amount: number
  progress_pct: number
  all_collected: boolean
  count_pending: number
  receivables_count: number
}

type StatusFilter = 'all' | 'pending' | 'collected'
type SortOrder = 'desc' | 'asc'
type ViewMode = 'list' | 'cards'

function statusTone(debtor: DebtorWithStats) {
  if (debtor.all_collected) return 'success' as const
  return 'warning' as const
}

function progressTone(debtor: DebtorWithStats) {
  if (debtor.all_collected) return 'success' as const
  if (debtor.progress_pct >= 65) return 'info' as const
  return 'warning' as const
}

export function ReceivablesManager({ exchangeRate = 3.7 }: { exchangeRate?: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [debtors, setDebtors] = useState<DebtorWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowActionId, setRowActionId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [query, setQuery] = useState('')

  const [debtorModalOpen, setDebtorModalOpen] = useState(false)
  const [receivableModalOpen, setReceivableModalOpen] = useState(false)
  const [editingDebtor, setEditingDebtor] = useState<DebtorRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DebtorWithStats | null>(null)
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null)
  const drawerDebtorId = searchParams.get('debtorId')

  const clearDrawerQuery = useCallback(() => {
    if (!searchParams.get('debtorId')) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('debtorId')
    const nextUrl = params.toString().length > 0 ? `${pathname}?${params}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  const loadDebtors = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/debtors', { cache: 'no-store' })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los deudores'))
      }

      setDebtors((json.data as DebtorWithStats[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar deudores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDebtors()
  }, [loadDebtors])

  useEffect(() => {
    if (!drawerDebtorId || debtors.length === 0) return
    if (selectedDebtorId === drawerDebtorId) return
    if (debtors.some((debtor) => debtor.id === drawerDebtorId)) {
      setSelectedDebtorId(drawerDebtorId)
    }
  }, [debtors, drawerDebtorId, selectedDebtorId])

  const selectedDebtor = useMemo(
    () => debtors.find(debtor => debtor.id === selectedDebtorId) ?? null,
    [debtors, selectedDebtorId],
  )

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return debtors
      .filter(debtor => {
        if (statusFilter === 'pending' && debtor.all_collected) return false
        if (statusFilter === 'collected' && !debtor.all_collected) return false

        if (
          normalizedQuery &&
          !debtor.name.toLowerCase().includes(normalizedQuery) &&
          !(debtor.relationship ?? '').toLowerCase().includes(normalizedQuery)
        ) {
          return false
        }

        return true
      })
      .sort((left, right) =>
        sortOrder === 'desc'
          ? right.pending_amount - left.pending_amount
          : left.pending_amount - right.pending_amount,
      )
  }, [debtors, query, sortOrder, statusFilter])

  const totalPendingAmount = useMemo(
    () => debtors.reduce((sum, debtor) => sum + debtor.pending_amount, 0),
    [debtors],
  )

  const totalCollectedAmount = useMemo(
    () => debtors.reduce((sum, debtor) => sum + debtor.total_collected, 0),
    [debtors],
  )

  const pendingDebtors = useMemo(
    () => debtors.filter(debtor => !debtor.all_collected).length,
    [debtors],
  )

  const activeDebtors = useMemo(
    () => debtors.filter(debtor => debtor.is_active).length,
    [debtors],
  )

  const pendingAccounts = useMemo(
    () => debtors.reduce((sum, debtor) => sum + debtor.count_pending, 0),
    [debtors],
  )

  const openCreateDebtor = useCallback(() => {
    setEditingDebtor(null)
    setDebtorModalOpen(true)
  }, [])

  const openEditDebtor = useCallback((debtor: DebtorRow) => {
    setEditingDebtor(debtor)
    setDebtorModalOpen(true)
  }, [])

  const closeDebtorModal = useCallback(() => {
    setDebtorModalOpen(false)
    setEditingDebtor(null)
  }, [])

  const onDebtorSuccess = useCallback(async () => {
    closeDebtorModal()
    await loadDebtors()
  }, [closeDebtorModal, loadDebtors])

  const onReceivableSuccess = useCallback(async () => {
    setReceivableModalOpen(false)
    await loadDebtors()
  }, [loadDebtors])

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return

    setRowActionId(pendingDelete.id)

    try {
      const res = await fetch(`/api/debtors/${pendingDelete.id}`, { method: 'DELETE' })

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el deudor'))
      }

      toast.success('Deudor eliminado', undefined, { persist: false })
      setPendingDelete(null)

      if (selectedDebtorId === pendingDelete.id) {
        setSelectedDebtorId(null)
      }

      await loadDebtors()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo eliminar el deudor')
    } finally {
      setRowActionId(null)
    }
  }, [loadDebtors, pendingDelete, selectedDebtorId, toast])

  const toggleActive = useCallback(async (debtor: DebtorWithStats, next: boolean) => {
    setRowActionId(debtor.id)

    try {
      const res = await fetch(`/api/debtors/${debtor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el deudor'))
      }

      toast.success(next ? 'Deudor activado' : 'Deudor desactivado', undefined, { persist: false })
      await loadDebtors()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setRowActionId(null)
    }
  }, [loadDebtors, toast])

  return (
    <>
      <LedgerModule
        kind="receivable"
        title="Por cobrar"
        description="Seguimiento operativo de deudores, compromisos abiertos y recuperacion pendiente sin salir del flujo principal."
        headerMode="content"
        actions={(
          <>
            <Button
              type="button"
              onClick={openCreateDebtor}
              variant="secondary"
              size="md"
              testId="receivables-new-debtor-btn"
            >
              Nuevo deudor
            </Button>
            <CreateModuleButton
              onClick={() => setReceivableModalOpen(true)}
              label="Nueva cuenta"
              testId="receivables-new-btn"
            />
          </>
        )}
        stats={[
          {
            label: 'Pendiente total',
            value: formatCurrency(totalPendingAmount, 'PEN'),
            detail: pendingDebtors > 0 ? `${pendingDebtors} deudor${pendingDebtors === 1 ? '' : 'es'}` : 'Sin deuda activa',
            caption: 'Monto abierto que aun no ingreso a caja.',
            tone: totalPendingAmount > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Cobrado acumulado',
            value: formatCurrency(totalCollectedAmount, 'PEN'),
            detail: debtors.length > 0 ? 'Historico recuperado' : 'Sin movimientos',
            caption: 'Recuperacion consolidada de todas las cuentas.',
            tone: 'success',
          },
          {
            label: 'Cuentas abiertas',
            value: String(pendingAccounts),
            detail: pendingAccounts > 0 ? 'Seguimiento activo' : 'Sin alertas',
            caption: 'Compromisos individuales todavia pendientes de cobro.',
            tone: pendingAccounts > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Deudores activos',
            value: String(activeDebtors),
            detail: debtors.length > activeDebtors ? `${debtors.length - activeDebtors} inactivo${debtors.length - activeDebtors === 1 ? '' : 's'}` : 'Base vigente',
            caption: 'Terceros habilitados para nueva operacion.',
            tone: 'primary',
          },
        ]}
        presets={(
          <>
            <DataFilterPreset
              label="Pendientes"
              active={statusFilter === 'pending'}
              count={pendingDebtors}
              onClick={() => setStatusFilter('pending')}
            />
            <DataFilterPreset
              label="Cobrados"
              active={statusFilter === 'collected'}
              count={debtors.filter(debtor => debtor.all_collected && debtor.receivables_count > 0).length}
              onClick={() => setStatusFilter('collected')}
            />
            <DataFilterPreset
              label="Todos"
              active={statusFilter === 'all'}
              count={debtors.length}
              onClick={() => setStatusFilter('all')}
            />
          </>
        )}
        search={(
          <DataSearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar deudor o relacion"
          />
        )}
        filters={(
          <FilterBar>
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
          </FilterBar>
        )}
        viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} id="receivables-view-toggle" />}
        controlsMeta={(
          <StatusBadge tone="muted" dot={false}>
            {filtered.length} deudor{filtered.length === 1 ? '' : 'es'}
          </StatusBadge>
        )}
        error={error}
        onRetry={loadDebtors}
        detail={selectedDebtor ? {
          open: true,
          title: selectedDebtor.name,
          description: selectedDebtor.relationship?.trim()
            ? `${selectedDebtor.relationship} · ${formatCurrency(selectedDebtor.pending_amount, 'PEN')} pendiente`
            : `${formatCurrency(selectedDebtor.pending_amount, 'PEN')} pendiente`,
          onClose: () => {
            setSelectedDebtorId(null)
            clearDrawerQuery()
          },
          width: 1520,
          inset: true,
          content: (
            <DebtorDetail
              debtor={selectedDebtor}
              exchangeRate={exchangeRate}
              onChanged={loadDebtors}
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
              ? 'No encontramos deudores para esos filtros.'
              : 'Todavia no tienes deudores registrados.'}
            description={query || statusFilter !== 'pending'
              ? 'Prueba con otra busqueda o vuelve a los pendientes para recuperar el foco operativo.'
              : 'Crea primero el deudor y luego registra cada cuenta por cobrar dentro del ledger.'}
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
                  label: 'Nuevo deudor',
                  onClick: openCreateDebtor,
                }}
          />
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {filtered.map(debtor => (
              <article
                key={debtor.id}
                className={`rounded-[14px] border px-4 py-4 transition-colors ${
                  debtor.is_active
                    ? 'border-[var(--c-border)] bg-[var(--c-surface)]'
                    : 'border-[var(--c-border)] bg-[var(--c-surface)] opacity-70'
                }`}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] xl:items-start">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => setSelectedDebtorId(debtor.id)}
                      data-testid={`debtor-open-${debtor.id}`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          debtor.all_collected ? 'bg-[var(--c-success)]' : 'bg-[var(--c-warning)]'
                        }`} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--c-text)]">
                              {debtor.name}
                            </p>
                            <StatusBadge tone={statusTone(debtor)}>
                              {debtor.all_collected ? 'Cobrado' : 'Pendiente'}
                            </StatusBadge>
                            {!debtor.is_active ? (
                              <StatusBadge tone="muted" dot={false}>
                                Inactivo
                              </StatusBadge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                            {debtor.relationship?.trim() || 'Sin relacion registrada'}
                          </p>
                          <p className="mt-2 text-[11px] text-[var(--c-text-faint)]">
                            {debtor.count_pending > 0
                              ? `${debtor.count_pending} cuenta${debtor.count_pending === 1 ? '' : 's'} pendiente${debtor.count_pending === 1 ? '' : 's'}`
                              : 'Sin saldo abierto'}
                            {' · '}
                            {debtor.receivables_count} movimiento{debtor.receivables_count === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                        <AmountCell
                          label="Total"
                          value={formatCurrency(debtor.total_lent, 'PEN')}
                          align="left"
                        />
                      </div>
                      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                        <AmountCell
                          label="Cobrado"
                          value={formatCurrency(debtor.total_collected, 'PEN')}
                          tone="success"
                          align="left"
                        />
                      </div>
                      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                        <AmountCell
                          label="Pendiente"
                          value={formatCurrency(debtor.pending_amount, 'PEN')}
                          tone={debtor.pending_amount > 0 ? 'warning' : 'neutral'}
                          align="left"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      <ActionIconButton
                        onClick={() => setSelectedDebtorId(debtor.id)}
                        disabled={rowActionId !== null}
                        icon="view"
                        label="Ver detalle"
                      />
                      <ActionIconButton
                        onClick={() => openEditDebtor(debtor)}
                        disabled={rowActionId !== null}
                        icon="edit"
                        label="Editar deudor"
                        testId={`debtor-edit-${debtor.id}`}
                      />
                      {debtor.is_active ? (
                        <ActionIconButton
                          onClick={() => void toggleActive(debtor, false)}
                          disabled={rowActionId !== null}
                          icon="deactivate"
                          label="Desactivar deudor"
                          variant="danger"
                          testId={`debtor-deactivate-${debtor.id}`}
                        />
                      ) : (
                        <ActionIconButton
                          onClick={() => void toggleActive(debtor, true)}
                          disabled={rowActionId !== null}
                          icon="reactivate"
                          label="Activar deudor"
                          variant="success"
                          testId={`debtor-reactivate-${debtor.id}`}
                        />
                      )}
                      <ActionIconButton
                        onClick={() => setPendingDelete(debtor)}
                        disabled={rowActionId !== null}
                        icon="delete"
                        label="Eliminar deudor"
                        variant="danger"
                        testId={`debtor-delete-${debtor.id}`}
                      />
                    </div>
                  </div>

                  <ProgressMetric
                    value={debtor.progress_pct}
                    label="Progreso de cobro"
                    valueLabel={`${debtor.progress_pct.toFixed(1)}%`}
                    tone={progressTone(debtor)}
                    description={
                      debtor.all_collected
                        ? 'Todo el capital registrado fue recuperado.'
                        : `${formatCurrency(debtor.pending_amount, 'PEN')} aun por ingresar.`
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filtered.map(debtor => (
              <article
                key={debtor.id}
                className="rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => setSelectedDebtorId(debtor.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--c-text)]">
                          {debtor.name}
                        </p>
                        <StatusBadge tone={statusTone(debtor)}>
                          {debtor.all_collected ? 'Cobrado' : 'Pendiente'}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                        {debtor.relationship?.trim() || 'Sin relacion registrada'}
                      </p>
                    </button>

                    <div className="flex items-center gap-1">
                      <ActionIconButton
                        onClick={() => setSelectedDebtorId(debtor.id)}
                        disabled={rowActionId !== null}
                        icon="view"
                        label="Ver detalle"
                        testId={`debtor-view-card-${debtor.id}`}
                      />
                      <ActionIconButton
                        onClick={() => openEditDebtor(debtor)}
                        disabled={rowActionId !== null}
                        icon="edit"
                        label="Editar deudor"
                        testId={`debtor-edit-card-${debtor.id}`}
                      />
                      {debtor.is_active ? (
                        <ActionIconButton
                          onClick={() => void toggleActive(debtor, false)}
                          disabled={rowActionId !== null}
                          icon="deactivate"
                          label="Desactivar deudor"
                          variant="danger"
                          testId={`debtor-deactivate-card-${debtor.id}`}
                        />
                      ) : (
                        <ActionIconButton
                          onClick={() => void toggleActive(debtor, true)}
                          disabled={rowActionId !== null}
                          icon="reactivate"
                          label="Activar deudor"
                          variant="success"
                          testId={`debtor-reactivate-card-${debtor.id}`}
                        />
                      )}
                      <ActionIconButton
                        onClick={() => setPendingDelete(debtor)}
                        disabled={rowActionId !== null}
                        icon="delete"
                        label="Eliminar deudor"
                        variant="danger"
                        testId={`debtor-delete-card-${debtor.id}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                      <AmountCell
                        label="Total"
                        value={formatCurrency(debtor.total_lent, 'PEN')}
                        align="left"
                      />
                    </div>
                    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                      <AmountCell
                        label="Cobrado"
                        value={formatCurrency(debtor.total_collected, 'PEN')}
                        tone="success"
                        align="left"
                      />
                    </div>
                    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                      <AmountCell
                        label="Pendiente"
                        value={formatCurrency(debtor.pending_amount, 'PEN')}
                        tone={debtor.pending_amount > 0 ? 'warning' : 'neutral'}
                        align="left"
                      />
                    </div>
                  </div>

                  <ProgressMetric
                    value={debtor.progress_pct}
                    label="Progreso"
                    valueLabel={`${debtor.progress_pct.toFixed(1)}%`}
                    tone={progressTone(debtor)}
                    description={`${debtor.count_pending} cuenta${debtor.count_pending === 1 ? '' : 's'} pendiente${debtor.count_pending === 1 ? '' : 's'}.`}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </LedgerModule>

      <RecordModal
        open={debtorModalOpen}
        onClose={closeDebtorModal}
        eyebrow="Cuentas por cobrar"
        title={editingDebtor ? 'Editar deudor' : 'Nuevo deudor'}
        subtitle="Registra a la persona o empresa que mantiene un saldo pendiente contigo."
        size="sm"
      >
        <DebtorForm
          debtor={editingDebtor}
          onSuccess={onDebtorSuccess}
          onCancel={closeDebtorModal}
        />
      </RecordModal>

      <RecordModal
        open={receivableModalOpen}
        onClose={() => setReceivableModalOpen(false)}
        eyebrow="Cuentas por cobrar"
        title="Nueva cuenta por cobrar"
        subtitle="Registra el compromiso pendiente y dejalo listo para seguimiento dentro del ledger."
        size="lg"
      >
        <ReceivableForm
          debtors={debtors}
          exchangeRate={exchangeRate}
          onSuccess={onReceivableSuccess}
          onCancel={() => setReceivableModalOpen(false)}
        />
      </RecordModal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Eliminar deudor"
        message={`Esta accion eliminara a "${pendingDelete?.name}" y no se puede deshacer.`}
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
