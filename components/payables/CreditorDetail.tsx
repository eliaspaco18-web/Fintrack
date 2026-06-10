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
import type { CreditorRow } from './CreditorForm'
import { PayableForm, type PayableRow } from './PayableForm'

export type CreditorWithStats = CreditorRow & {
  total_owed: number
  total_paid: number
  pending_amount: number
  progress_pct: number
  all_paid: boolean
  count_pending: number
  payables_count: number
}

type AccountOption = { id: string; name: string }

type Props = {
  creditor: CreditorWithStats
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
    PENDING: { label: 'Pendiente', tone: 'danger' as const },
    PARTIAL: { label: 'Parcial', tone: 'info' as const },
    PAID: { label: 'Pagado', tone: 'success' as const },
    DISPUTED: { label: 'Disputado', tone: 'warning' as const },
  } as const

  return tones[status as keyof typeof tones] ?? { label: status, tone: 'muted' as const }
}

function isOverdue(row: PayableRow) {
  if (!row.due_date || row.status === 'PAID') return false
  return new Date(`${row.due_date}T12:00:00`).getTime() < Date.now()
}

export function CreditorDetail({ creditor, exchangeRate, onChanged }: Props) {
  const { toast } = useToast()

  const [rows, setRows] = useState<PayableRow[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowActionId, setRowActionId] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [editingRow, setEditingRow] = useState<PayableRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PayableRow | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/payables?creditor_id=${creditor.id}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las cuentas por pagar'))
      }

      setRows((json.data as PayableRow[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cuentas por pagar')
    } finally {
      setLoading(false)
    }
  }, [creditor.id])

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
        !row.creditor_name.toLowerCase().includes(normalizedQuery)
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

  const filteredPaid = useMemo(
    () => filtered.reduce((sum, row) => sum + Number(row.paid_amount), 0),
    [filtered],
  )

  const filteredPending = Math.max(0, filteredTotal - filteredPaid)
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
      const res = await fetch(`/api/payables/${pendingDelete.id}`, { method: 'DELETE' })

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar la cuenta por pagar'))
      }

      toast.success('Cuenta por pagar eliminada', undefined, { persist: false })
      setPendingDelete(null)
      await loadRows()
      await syncParent()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo eliminar la cuenta por pagar')
    } finally {
      setRowActionId(null)
    }
  }, [loadRows, pendingDelete, syncParent, toast])

  const handleMarkPaid = useCallback(async (row: PayableRow) => {
    setRowActionId(row.id)

    try {
      const res = await fetch(`/api/payables/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAID',
          paid_amount: row.amount,
          paid_date: new Date().toISOString().slice(0, 10),
        }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar la cuenta por pagar'))
      }

      toast.success('Cuenta marcada como pagada', undefined, { persist: false })
      await loadRows()
      await syncParent()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo actualizar la cuenta por pagar')
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
                Resumen de pagos
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--c-text-muted)]">
                {creditor.relationship?.trim() || 'Sin relacion registrada'}.
                {' '}
                {creditor.count_pending > 0
                  ? `${creditor.count_pending} cuenta${creditor.count_pending === 1 ? '' : 's'} pendiente${creditor.count_pending === 1 ? '' : 's'}.`
                  : 'No quedan compromisos abiertos.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge tone={creditor.all_paid ? 'success' : 'danger'}>
                  {creditor.all_paid ? 'Pago cerrado' : 'Pago abierto'}
                </StatusBadge>
                <StatusBadge tone={creditor.is_active ? 'primary' : 'muted'} dot={false}>
                  {creditor.is_active ? 'Acreedor activo' : 'Acreedor inactivo'}
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
                label="Total adeudado"
                value={formatCurrency(creditor.total_owed, 'PEN')}
                align="left"
              />
            </div>
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
              <AmountCell
                label="Pagado"
                value={formatCurrency(creditor.total_paid, 'PEN')}
                tone="success"
                align="left"
              />
            </div>
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
              <AmountCell
                label="Por pagar"
                value={formatCurrency(creditor.pending_amount, 'PEN')}
                tone={creditor.all_paid ? 'neutral' : 'danger'}
                align="left"
              />
            </div>
          </div>

          <ProgressMetric
            value={creditor.progress_pct}
            label="Avance de pago"
            valueLabel={`${creditor.progress_pct.toFixed(1)}%`}
            tone={creditor.all_paid ? 'success' : 'danger'}
            description={`${creditor.payables_count} movimiento${creditor.payables_count === 1 ? '' : 's'} asociado${creditor.payables_count === 1 ? '' : 's'}.`}
          />
        </div>
      </section>

      <section className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)]">
        <div className="border-b border-[var(--c-border)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                Cuentas por pagar
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                {filtered.length} registro{filtered.length === 1 ? '' : 's'} visibles.
                {' '}
                {overdueCount > 0 ? `${overdueCount} vencid${overdueCount === 1 ? 'a' : 'as'}.` : 'Sin vencimientos criticos.'}
              </p>
            </div>
            <StatusBadge tone={filteredPending > 0 ? 'danger' : 'success'} dot={false}>
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
                placeholder="Buscar concepto o acreedor"
                data-testid="creditor-detail-search"
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
                  data-testid="creditor-detail-date-from"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={event => setDateTo(event.target.value)}
                  className="field-base h-9 w-[150px]"
                  title="Fecha hasta"
                  data-testid="creditor-detail-date-to"
                />
              </FilterBar>
            )}
            actions={(
              <StatusBadge tone="muted" dot={false}>
                Pagado {formatCurrency(filteredPaid, 'PEN')}
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
                  : 'Este acreedor aun no tiene cuentas registradas.'}
                description={query || accountFilter !== 'all' || dateFrom || dateTo
                  ? 'Prueba con otro rango, otro portafolio o una busqueda mas amplia.'
                  : 'Registra una cuenta por pagar para mantener este seguimiento dentro del mismo ledger.'}
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
                const pendingAmount = Math.max(0, row.amount - row.paid_amount)
                const progress = row.amount > 0 ? (row.paid_amount / row.amount) * 100 : 0
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
                          {row.status !== 'PAID' ? (
                            <ActionIconButton
                              onClick={() => void handleMarkPaid(row)}
                              disabled={rowActionId !== null}
                              icon="use"
                              label="Marcar pagada"
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
                            label="Pagado"
                            value={formatCurrency(row.paid_amount, row.currency as 'PEN' | 'USD')}
                            tone="success"
                            align="left"
                          />
                        </div>
                        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                          <AmountCell
                            label="Pendiente"
                            value={formatCurrency(pendingAmount, row.currency as 'PEN' | 'USD')}
                            tone={pendingAmount > 0 ? 'danger' : 'neutral'}
                            align="left"
                          />
                        </div>
                      </div>

                      <ProgressMetric
                        value={progress}
                        label="Progreso"
                        valueLabel={`${progress.toFixed(1)}%`}
                        tone={row.status === 'PAID' ? 'success' : row.status === 'PARTIAL' ? 'info' : 'danger'}
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
        eyebrow="Cuentas por pagar"
        title="Nueva cuenta por pagar"
        subtitle="Registra un nuevo compromiso dentro del mismo acreedor."
        size="lg"
      >
        <PayableForm
          creditors={[creditor]}
          exchangeRate={exchangeRate}
          defaultCreditorId={creditor.id}
          onSuccess={handleFormSuccess}
          onCancel={() => setCreateOpen(false)}
        />
      </RecordModal>

      <RecordModal
        open={!!editingRow}
        onClose={() => setEditingRow(null)}
        eyebrow="Cuentas por pagar"
        title="Editar cuenta por pagar"
        subtitle="Actualiza importes, fechas y estado sin salir del detalle."
        size="lg"
      >
        <PayableForm
          payable={editingRow ?? undefined}
          creditors={[creditor]}
          exchangeRate={exchangeRate}
          defaultCreditorId={creditor.id}
          onSuccess={handleFormSuccess}
          onCancel={() => setEditingRow(null)}
        />
      </RecordModal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Eliminar cuenta por pagar"
        message={`Esta accion eliminara "${pendingDelete?.concept?.trim() || 'esta cuenta'}" del ledger del acreedor.`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
        loading={rowActionId !== null}
        danger
        confirmLabel="Eliminar"
      />
    </div>
  )
}
