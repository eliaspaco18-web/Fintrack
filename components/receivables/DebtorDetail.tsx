'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppSelect } from '@/components/ui/AppSelect'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { Button } from '@/components/ui/Button'
import { RecordModal } from '@/components/ui/RecordModal'
import {
  AmountCell,
  ConfirmDialog,
  ControlsBar,
  DataSearchField,
  EmptyState,
  FilterBar,
  ProgressMetric,
  StatusBadge,
} from '@/components/finance'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { useToast } from '@/lib/toast/toast'
import type { DebtorRow } from './DebtorForm'
import { ReceivableForm } from './ReceivableForm'

export type DebtorWithStats = DebtorRow & {
  total_lent: number
  total_collected: number
  pending_amount: number
  progress_pct: number
  all_collected: boolean
  count_pending: number
  receivables_count: number
}

type ReceivableRow = {
  id: string
  debtor_id: string | null
  debtor_name: string
  concept: string | null
  amount: number
  collected_amount: number
  currency: string
  issue_date: string
  due_date: string | null
  notes: string | null
  attachment_url: string | null
  status: string
  source_account?: { id: string; name: string } | null
}

type AccountOption = { id: string; name: string }

type Props = {
  debtor: DebtorWithStats
  exchangeRate: number
  onChanged?: () => void | Promise<void>
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function resolveStatus(status: string) {
  const tones = {
    PENDING: { label: 'Pendiente', tone: 'warning' as const },
    PARTIAL: { label: 'Parcial', tone: 'info' as const },
    COLLECTED: { label: 'Cobrado', tone: 'success' as const },
    WRITTEN_OFF: { label: 'Castigado', tone: 'muted' as const },
  } as const

  return tones[status as keyof typeof tones] ?? { label: status, tone: 'muted' as const }
}

function isOverdue(row: ReceivableRow) {
  if (!row.due_date || row.status === 'COLLECTED') return false
  return new Date(`${row.due_date}T12:00:00`).getTime() < Date.now()
}

export function DebtorDetail({ debtor, exchangeRate, onChanged }: Props) {
  const { toast } = useToast()

  const [rows, setRows] = useState<ReceivableRow[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowActionId, setRowActionId] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [editingRow, setEditingRow] = useState<ReceivableRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ReceivableRow | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/receivables?debtor_id=${debtor.id}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las cuentas por cobrar'))
      }

      setRows((json.data as ReceivableRow[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cuentas por cobrar')
    } finally {
      setLoading(false)
    }
  }, [debtor.id])

  useEffect(() => {
    void loadRows()
    fetch('/api/accounts?is_active=true', { cache: 'no-store' })
      .then(response => response.json())
      .then(json => {
        if (json?.ok) setAccounts((json.data as AccountOption[]) ?? [])
      })
      .catch(() => null)
  }, [loadRows])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return rows.filter(row => {
      if (
        normalizedQuery &&
        !(row.concept ?? '').toLowerCase().includes(normalizedQuery) &&
        !row.debtor_name.toLowerCase().includes(normalizedQuery)
      ) {
        return false
      }

      if (accountFilter !== 'all' && row.source_account?.id !== accountFilter) return false
      if (dateFrom && row.issue_date < dateFrom) return false
      if (dateTo && row.issue_date > dateTo) return false

      return true
    })
  }, [accountFilter, dateFrom, dateTo, query, rows])

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, row) => sum + Number(row.amount), 0),
    [filtered],
  )

  const filteredCollected = useMemo(
    () => filtered.reduce((sum, row) => sum + Number(row.collected_amount), 0),
    [filtered],
  )

  const filteredPending = Math.max(0, filteredTotal - filteredCollected)
  const overdueCount = useMemo(() => filtered.filter(isOverdue).length, [filtered])
  const accountOptions = useMemo(
    () => [{ value: 'all', label: 'Portafolio' }, ...accounts.map(account => ({
      value: account.id,
      label: account.name,
    }))],
    [accounts],
  )

  const syncParent = useCallback(async () => {
    if (!onChanged) return
    await onChanged()
  }, [onChanged])

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return

    setRowActionId(pendingDelete.id)

    try {
      const res = await fetch(`/api/receivables/${pendingDelete.id}`, { method: 'DELETE' })

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar la cuenta por cobrar'))
      }

      toast.success('Cuenta por cobrar eliminada', undefined, { persist: false })
      setPendingDelete(null)
      await loadRows()
      await syncParent()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo eliminar la cuenta por cobrar')
    } finally {
      setRowActionId(null)
    }
  }, [loadRows, pendingDelete, syncParent, toast])

  const handleMarkCollected = useCallback(async (row: ReceivableRow) => {
    setRowActionId(row.id)

    try {
      const res = await fetch(`/api/receivables/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COLLECTED',
          collected_amount: row.amount,
          collected_date: new Date().toISOString().slice(0, 10),
        }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar la cuenta por cobrar'))
      }

      toast.success('Cuenta marcada como cobrada', undefined, { persist: false })
      await loadRows()
      await syncParent()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo actualizar la cuenta por cobrar')
    } finally {
      setRowActionId(null)
    }
  }, [loadRows, syncParent, toast])

  const handleFormSuccess = useCallback(async () => {
    setEditingRow(null)
    setCreateOpen(false)
    await loadRows()
    await syncParent()
  }, [loadRows, syncParent])

  return (
    <div className="space-y-4">
      <section className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                Resumen de cobranza
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--c-text-muted)]">
                {debtor.relationship?.trim() || 'Sin relacion registrada'}.
                {' '}
                {debtor.count_pending > 0
                  ? `${debtor.count_pending} cuenta${debtor.count_pending === 1 ? '' : 's'} pendiente${debtor.count_pending === 1 ? '' : 's'}.`
                  : 'Todas las cuentas estan liquidadas.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge tone={debtor.all_collected ? 'success' : 'warning'}>
                  {debtor.all_collected ? 'Cobranza cerrada' : 'Cobranza abierta'}
                </StatusBadge>
                <StatusBadge tone={debtor.is_active ? 'primary' : 'muted'} dot={false}>
                  {debtor.is_active ? 'Deudor activo' : 'Deudor inactivo'}
                </StatusBadge>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              variant="secondary"
              size="sm"
            >
              Nueva cuenta
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
              <AmountCell
                label="Total prestado"
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
                label="Por cobrar"
                value={formatCurrency(debtor.pending_amount, 'PEN')}
                tone={debtor.all_collected ? 'neutral' : 'warning'}
                align="left"
              />
            </div>
          </div>

          <ProgressMetric
            value={debtor.progress_pct}
            label="Avance de cobro"
            valueLabel={`${debtor.progress_pct.toFixed(1)}%`}
            tone={debtor.all_collected ? 'success' : 'warning'}
            description={`${debtor.receivables_count} movimiento${debtor.receivables_count === 1 ? '' : 's'} asociado${debtor.receivables_count === 1 ? '' : 's'}.`}
          />
        </div>
      </section>

      <section className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)]">
        <div className="border-b border-[var(--c-border)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                Cuentas por cobrar
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                {filtered.length} registro{filtered.length === 1 ? '' : 's'} visibles.
                {' '}
                {overdueCount > 0 ? `${overdueCount} vencid${overdueCount === 1 ? 'a' : 'as'}.` : 'Sin vencimientos criticos.'}
              </p>
            </div>
            <StatusBadge tone={filteredPending > 0 ? 'warning' : 'success'} dot={false}>
              Pendiente {formatCurrency(filteredPending, 'PEN')}
            </StatusBadge>
          </div>
        </div>

        <div className="p-4">
          <ControlsBar
            search={(
              <DataSearchField
                value={query}
                onChange={setQuery}
                placeholder="Buscar concepto o deudor"
                data-testid="debtor-detail-search"
              />
            )}
            filters={(
              <FilterBar>
                <AppSelect
                  value={accountFilter}
                  onChange={setAccountFilter}
                  options={accountOptions}
                  compact
                  searchable={false}
                  className="w-[190px]"
                />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={event => setDateFrom(event.target.value)}
                  className="field-base h-9 w-[150px]"
                  title="Fecha desde"
                  data-testid="debtor-detail-date-from"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={event => setDateTo(event.target.value)}
                  className="field-base h-9 w-[150px]"
                  title="Fecha hasta"
                  data-testid="debtor-detail-date-to"
                />
              </FilterBar>
            )}
            actions={(
              <StatusBadge tone="muted" dot={false}>
                Cobrado {formatCurrency(filteredCollected, 'PEN')}
              </StatusBadge>
            )}
          />

          {error ? (
            <div className="mt-3 rounded-xl border border-[rgba(184,74,74,0.22)] bg-[var(--c-danger-soft)] px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-medium text-[var(--c-danger)]">{error}</p>
                <Button type="button" onClick={() => void loadRows()} variant="danger" size="sm">
                  Reintentar
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map(item => (
                  <div
                    key={item}
                    className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-4"
                  >
                    <div className="flex animate-pulse flex-col gap-3">
                      <div className="h-4 w-32 rounded-full bg-[var(--c-border)]/45" />
                      <div className="h-3 w-full rounded-full bg-[var(--c-border)]/30" />
                      <div className="h-3 w-2/3 rounded-full bg-[var(--c-border)]/30" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={query || accountFilter !== 'all' || dateFrom || dateTo
                  ? 'No encontramos cuentas con esos filtros.'
                  : 'Este deudor aun no tiene cuentas registradas.'}
                description={query || accountFilter !== 'all' || dateFrom || dateTo
                  ? 'Prueba con otro rango, otro portafolio o una busqueda mas amplia.'
                  : 'Registra una cuenta por cobrar para mantener este seguimiento dentro del mismo ledger.'}
                action={{
                  label: query || accountFilter !== 'all' || dateFrom || dateTo
                    ? 'Limpiar filtros'
                    : 'Nueva cuenta',
                  onClick: query || accountFilter !== 'all' || dateFrom || dateTo
                    ? () => {
                        setQuery('')
                        setAccountFilter('all')
                        setDateFrom('')
                        setDateTo('')
                      }
                    : () => setCreateOpen(true),
                }}
                compact
              />
            ) : (
              filtered.map(row => {
                const pendingAmount = Math.max(0, row.amount - row.collected_amount)
                const progress = row.amount > 0 ? (row.collected_amount / row.amount) * 100 : 0
                const status = resolveStatus(row.status)
                const overdue = isOverdue(row)

                return (
                  <article
                    key={row.id}
                    className={`rounded-[14px] border px-4 py-4 transition-colors ${
                      overdue
                        ? 'border-[rgba(184,74,74,0.24)] bg-[rgba(184,74,74,0.04)]'
                        : 'border-[var(--c-border)] bg-[var(--c-surface)]'
                    }`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--c-text)]">
                              {row.concept?.trim() || 'Cuenta sin descripcion'}
                            </p>
                            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                            {overdue ? (
                              <StatusBadge tone="danger" dot={false}>
                                Vencida
                              </StatusBadge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                            {row.source_account?.name || 'Sin portafolio asociado'}
                            {' · '}
                            Emitida {formatDate(row.issue_date)}
                            {row.due_date ? ` · Vence ${formatDate(row.due_date)}` : ' · Sin vencimiento'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 self-start">
                          {row.status !== 'COLLECTED' ? (
                            <ActionIconButton
                              onClick={() => void handleMarkCollected(row)}
                              disabled={rowActionId !== null}
                              icon="use"
                              label="Marcar cobrada"
                              variant="success"
                            />
                          ) : null}
                          <ActionIconButton
                            onClick={() => setEditingRow(row)}
                            disabled={rowActionId !== null}
                            icon="edit"
                            label="Editar cuenta"
                          />
                          <ActionIconButton
                            onClick={() => setPendingDelete(row)}
                            disabled={rowActionId !== null}
                            icon="delete"
                            label="Eliminar cuenta"
                            variant="danger"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                          <AmountCell
                            label="Monto"
                            value={formatCurrency(row.amount, row.currency as 'PEN' | 'USD')}
                            align="left"
                          />
                        </div>
                        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                          <AmountCell
                            label="Cobrado"
                            value={formatCurrency(row.collected_amount, row.currency as 'PEN' | 'USD')}
                            tone="success"
                            align="left"
                          />
                        </div>
                        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                          <AmountCell
                            label="Pendiente"
                            value={formatCurrency(pendingAmount, row.currency as 'PEN' | 'USD')}
                            tone={pendingAmount > 0 ? 'warning' : 'neutral'}
                            align="left"
                          />
                        </div>
                      </div>

                      <ProgressMetric
                        value={progress}
                        label="Progreso"
                        valueLabel={`${progress.toFixed(1)}%`}
                        tone={row.status === 'COLLECTED' ? 'success' : row.status === 'PARTIAL' ? 'info' : 'warning'}
                        description={overdue
                          ? 'Requiere seguimiento inmediato por vencimiento.'
                          : row.notes?.trim() || 'Sin observaciones adicionales.'}
                      />
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </section>

      <RecordModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        eyebrow="Cuentas por cobrar"
        title="Nueva cuenta por cobrar"
        subtitle="Registra un nuevo compromiso dentro del mismo deudor."
        size="lg"
      >
        <ReceivableForm
          debtors={[debtor]}
          exchangeRate={exchangeRate}
          defaultDebtorId={debtor.id}
          onSuccess={handleFormSuccess}
          onCancel={() => setCreateOpen(false)}
        />
      </RecordModal>

      <RecordModal
        open={!!editingRow}
        onClose={() => setEditingRow(null)}
        eyebrow="Cuentas por cobrar"
        title="Editar cuenta por cobrar"
        subtitle="Actualiza importes, fechas y estado sin salir del detalle."
        size="lg"
      >
        <ReceivableForm
          receivable={editingRow ?? undefined}
          debtors={[debtor]}
          exchangeRate={exchangeRate}
          defaultDebtorId={debtor.id}
          onSuccess={handleFormSuccess}
          onCancel={() => setEditingRow(null)}
        />
      </RecordModal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Eliminar cuenta por cobrar"
        message={`Esta accion eliminara "${pendingDelete?.concept?.trim() || 'esta cuenta'}" del ledger del deudor.`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
        loading={rowActionId !== null}
        danger
        confirmLabel="Eliminar"
      />
    </div>
  )
}
