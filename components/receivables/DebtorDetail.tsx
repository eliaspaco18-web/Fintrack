'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { RecordModal } from '@/components/ui/RecordModal'
import {
  ControlsBar,
  DataSearchField,
  EmptyState,
  FilterBar,
  StatusBadge,
} from '@/components/finance'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { getApiErrorMessage } from '@/lib/api/error-message'
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

type LedgerRow = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  currency: 'PEN' | 'USD'
  description: string | null
  notes: string | null
  transaction_date: string
  created_at: string
  source_account?: { id: string; name: string; color?: string | null; icon?: string | null } | null
  category?: { id: string; name: string; color?: string | null; icon?: string | null } | null
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

function isOverdue(row: ReceivableRow) {
  if (!row.due_date || row.status === 'COLLECTED') return false
  return new Date(`${row.due_date}T12:00:00`).getTime() < Date.now()
}

function matchesText(value: string | null | undefined, query: string) {
  if (!query) return true
  return (value ?? '').toLowerCase().includes(query)
}

function formatSignedCurrency(value: number, currency: 'PEN' | 'USD') {
  const absolute = formatCurrency(Math.abs(value), currency)
  if (value > 0) return absolute
  if (value < 0) return `-${absolute}`
  return absolute
}

function resolveLedgerMeta(row: LedgerRow) {
  if (row.type === 'INCOME') {
    return {
      label: 'Ingreso',
      tone: 'success' as const,
      detail: 'Cobro registrado',
      signedAmount: `+${formatCurrency(row.amount, row.currency)}`,
    }
  }

  return {
    label: 'Egreso',
    tone: 'warning' as const,
    detail: 'Prestamo entregado',
    signedAmount: `-${formatCurrency(row.amount, row.currency)}`,
  }
}

function RecoveryVisual({
  total,
  collected,
  pending,
  className = '',
}: {
  total: number
  collected: number
  pending: number
  className?: string
}) {
  const safeTotal = Math.max(total, 0)
  const safeCollected = Math.max(collected, 0)
  const safePending = Math.max(pending, 0)
  const progress = safeTotal > 0 ? Math.min(100, (safeCollected / safeTotal) * 100) : 0
  const circumference = 2 * Math.PI * 54
  const progressOffset = circumference - (progress / 100) * circumference
  const summaryLabel = safePending > 0
    ? `Faltan ${formatCurrency(safePending, 'PEN')} para liquidar`
    : 'Cuenta liquidada'

  return (
    <section
      className={`rounded-[22px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
            Avance de recuperacion
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">{summaryLabel}</p>
        </div>
        <StatusBadge tone={safePending > 0 ? 'warning' : 'success'} dot={false}>
          {safePending > 0 ? 'Saldo abierto' : 'Liquidado'}
        </StatusBadge>
      </div>

      <div className="mt-3.5 flex flex-col items-center gap-3">
        <div className="relative h-[156px] w-[156px]">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--c-success)_9%,transparent)_0%,transparent_64%)]" />
          <svg viewBox="0 0 140 140" className="relative z-[1] h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke="color-mix(in srgb, var(--c-border) 78%, transparent)"
              strokeWidth="12"
            />
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke="var(--c-success)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              style={{ transition: 'stroke-dashoffset 220ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center text-center">
            <p className="font-mono text-[29px] font-semibold tracking-[-0.05em] text-[var(--c-text)]">
              {progress.toFixed(1)}%
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
              Recuperado
            </p>
          </div>
        </div>

        <div className="w-full rounded-[18px] border border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-warning-soft)_45%,var(--c-surface))] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
            Pendiente
          </p>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <p className="min-w-0 whitespace-nowrap font-mono text-[22px] font-semibold tracking-[-0.04em] text-[var(--c-warning)]">
              {formatCurrency(safePending, 'PEN')}
            </p>
            <p className="shrink-0 text-[10px] font-medium text-[var(--c-text-muted)]">
              {progress.toFixed(1)}% recuperado
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2.5">
          <div className="min-w-0 rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
              Prestado
            </p>
            <p className="mt-1.5 truncate whitespace-nowrap font-mono text-[15px] font-semibold tabular-nums text-[var(--c-text)]">
              {formatCurrency(safeTotal, 'PEN')}
            </p>
          </div>
          <div className="min-w-0 rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
              Cobrado
            </p>
            <p className="mt-1.5 truncate whitespace-nowrap font-mono text-[15px] font-semibold tabular-nums text-[var(--c-success)]">
              {formatCurrency(safeCollected, 'PEN')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function DebtorDetail({ debtor, exchangeRate, onChanged }: Props) {
  const [rows, setRows] = useState<ReceivableRow[]>([])
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [movementFilter, setMovementFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [createOpen, setCreateOpen] = useState(false)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [receivablesRes, ledgerRes] = await Promise.all([
        fetch(`/api/receivables?debtor_id=${debtor.id}`, { cache: 'no-store' }),
        fetch(`/api/debtors/${debtor.id}/ledger`, { cache: 'no-store' }),
      ])

      const [receivablesJson, ledgerJson] = await Promise.all([
        receivablesRes.json().catch(() => null),
        ledgerRes.json().catch(() => null),
      ])

      if (!receivablesRes.ok || !receivablesJson?.ok) {
        throw new Error(getApiErrorMessage(receivablesJson, 'No se pudieron cargar las cuentas por cobrar'))
      }

      if (!ledgerRes.ok || !ledgerJson?.ok) {
        throw new Error(getApiErrorMessage(ledgerJson, 'No se pudo cargar el historial del deudor'))
      }

      setRows((receivablesJson.data as ReceivableRow[]) ?? [])
      setLedgerRows((ledgerJson.data as LedgerRow[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el detalle del deudor')
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

  const normalizedQuery = query.trim().toLowerCase()
  const accountOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos los portafolios' },
      ...accounts.map(account => ({
        value: account.id,
        label: account.name,
      })),
    ],
    [accounts],
  )

  const filteredLedger = useMemo(() => {
    return ledgerRows.filter(row => {
      if (movementFilter === 'income' && row.type !== 'INCOME') return false
      if (movementFilter === 'expense' && row.type !== 'EXPENSE') return false
      if (accountFilter !== 'all' && row.source_account?.id !== accountFilter) return false
      if (dateFrom && row.transaction_date < dateFrom) return false
      if (dateTo && row.transaction_date > dateTo) return false

      if (
        normalizedQuery &&
        !matchesText(row.description, normalizedQuery) &&
        !matchesText(row.notes, normalizedQuery) &&
        !matchesText(row.category?.name, normalizedQuery) &&
        !matchesText(row.source_account?.name, normalizedQuery)
      ) {
        return false
      }

      return true
    })
  }, [accountFilter, dateFrom, dateTo, ledgerRows, movementFilter, normalizedQuery])

  const filteredLedgerIncome = useMemo(
    () => filteredLedger.filter(row => row.type === 'INCOME').reduce((sum, row) => sum + Number(row.amount), 0),
    [filteredLedger],
  )
  const filteredLedgerExpense = useMemo(
    () => filteredLedger.filter(row => row.type === 'EXPENSE').reduce((sum, row) => sum + Number(row.amount), 0),
    [filteredLedger],
  )
  const overdueCount = useMemo(
    () => rows.filter(isOverdue).length,
    [rows],
  )
  const openAccountsCount = rows.filter(row => row.status !== 'COLLECTED').length
  const filteredLedgerBalance = filteredLedgerExpense - filteredLedgerIncome

  const syncParent = useCallback(async () => {
    if (!onChanged) return
    await onChanged()
  }, [onChanged])

  const handleFormSuccess = useCallback(async () => {
    setCreateOpen(false)
    await loadRows()
    await syncParent()
  }, [loadRows, syncParent])

  const clearFilters = useCallback(() => {
    setQuery('')
    setAccountFilter('all')
    setMovementFilter('all')
    setDateFrom('')
    setDateTo('')
  }, [])

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-hidden xl:grid-cols-[388px_minmax(0,1fr)] 2xl:grid-cols-[404px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-hidden">
        <section className="flex h-full flex-col rounded-[24px] border border-[var(--c-border)] bg-[linear-gradient(180deg,var(--c-surface),var(--c-surface-2))] px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                Detalle del deudor
              </p>
              <div className="mt-2">
                <p className="break-words text-[20px] font-semibold tracking-[-0.03em] text-[var(--c-text)]">
                  {debtor.relationship?.trim() || 'Sin relacion registrada'}
                </p>
                <p className="mt-1 text-[13px] text-[var(--c-text-muted)]">
                  {openAccountsCount} cuenta{openAccountsCount === 1 ? '' : 's'} abierta{openAccountsCount === 1 ? '' : 's'}
                  {' · '}
                  {ledgerRows.length} movimiento{ledgerRows.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              variant="secondary"
              size="sm"
              className="shrink-0"
            >
              Nueva cuenta
            </Button>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <StatusBadge tone={debtor.all_collected ? 'success' : 'warning'}>
              {debtor.all_collected ? 'Cobranza cerrada' : 'Cobranza abierta'}
            </StatusBadge>
            <StatusBadge tone={debtor.is_active ? 'primary' : 'muted'} dot={false}>
              {debtor.is_active ? 'Deudor activo' : 'Deudor inactivo'}
            </StatusBadge>
            {overdueCount > 0 ? (
              <StatusBadge tone="danger" dot={false}>
                {overdueCount} vencida{overdueCount === 1 ? '' : 's'}
              </StatusBadge>
            ) : null}
          </div>

          <RecoveryVisual
            total={debtor.total_lent}
            collected={debtor.total_collected}
            pending={debtor.pending_amount}
            className="mt-3.5"
          />

        </section>
      </aside>

      <div className="min-h-0 min-w-0 overflow-y-auto pr-1">
        <div className="space-y-4">
        <ControlsBar
          className="rounded-[18px] px-3.5 py-2.5"
          presets={(
            <>
              <StatusBadge tone="muted" dot={false}>
                Ledger {filteredLedger.length}
              </StatusBadge>
              <StatusBadge tone={filteredLedgerBalance > 0 ? 'warning' : 'success'} dot={false}>
                Saldo {formatSignedCurrency(filteredLedgerBalance, 'PEN')}
              </StatusBadge>
            </>
          )}
          search={(
            <DataSearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar concepto, categoria, nota o portafolio"
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
                className="w-[210px]"
              />
              <AppSelect
                value={movementFilter}
                onChange={value => setMovementFilter(value as 'all' | 'income' | 'expense')}
                options={[
                  { value: 'all', label: 'Todos los movimientos' },
                  { value: 'expense', label: 'Solo egresos' },
                  { value: 'income', label: 'Solo ingresos' },
                ]}
                compact
                searchable={false}
                className="w-[220px]"
              />
              <input
                type="date"
                value={dateFrom}
                onChange={event => setDateFrom(event.target.value)}
                className="field-base h-9 w-[140px]"
                title="Fecha desde"
                data-testid="debtor-detail-date-from"
              />
              <input
                type="date"
                value={dateTo}
                onChange={event => setDateTo(event.target.value)}
                className="field-base h-9 w-[140px]"
                title="Fecha hasta"
                data-testid="debtor-detail-date-to"
              />
            </FilterBar>
          )}
          actions={(
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        />

        {error ? (
          <div className="rounded-[18px] border border-[rgba(184,74,74,0.22)] bg-[var(--c-danger-soft)] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] font-medium text-[var(--c-danger)]">{error}</p>
              <Button type="button" onClick={() => void loadRows()} variant="danger" size="sm">
                Reintentar
              </Button>
            </div>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)]">
          <div className="flex flex-col gap-2.5 border-b border-[var(--c-border)] px-3.5 py-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                Movimientos del deudor
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                Una sola vista para leer prestamos entregados y cobros recibidos, con saldo consolidado al cierre.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="warning" dot={false}>
                Egresos {formatCurrency(filteredLedgerExpense, 'PEN')}
              </StatusBadge>
              <StatusBadge tone="success" dot={false}>
                Ingresos {formatCurrency(filteredLedgerIncome, 'PEN')}
              </StatusBadge>
              <StatusBadge tone={filteredLedgerBalance > 0 ? 'warning' : 'success'} dot={false}>
                Saldo {formatSignedCurrency(filteredLedgerBalance, 'PEN')}
              </StatusBadge>
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-[var(--c-border)]">
              {[0, 1, 2, 3].map(item => (
                <div key={item} className="px-3.5 py-3">
                  <div className="flex animate-pulse flex-col gap-2">
                    <div className="h-4 w-36 rounded-full bg-[var(--c-surface-2)]" />
                    <div className="h-3 w-full rounded-full bg-[var(--c-surface-2)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="p-3.5">
              <EmptyState
                title={query || accountFilter !== 'all' || movementFilter !== 'all' || dateFrom || dateTo
                  ? 'No encontramos movimientos con esos filtros.'
                  : 'Este deudor aun no tiene movimientos asociados.'}
                description={query || accountFilter !== 'all' || movementFilter !== 'all' || dateFrom || dateTo
                  ? 'Prueba con otro rango, otro tipo de movimiento o una busqueda mas amplia.'
                  : 'Cuando registres prestamos o cobros, aqui veras el historial completo del deudor.'}
                compact
              />
            </div>
          ) : (
            <div>
              <div className="hidden border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-3.5 py-2.5 lg:grid lg:grid-cols-[96px_minmax(0,2.35fr)_150px_190px_112px_120px] lg:gap-3">
                {['Tipo', 'Descripcion', 'Portafolio', 'Categoria', 'Fecha', 'Monto'].map(label => (
                  <p key={label} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                    {label}
                  </p>
                ))}
              </div>

              <div className="divide-y divide-[var(--c-border)]">
                {filteredLedger.map(row => {
                  const meta = resolveLedgerMeta(row)
                  return (
                    <article key={row.id} className="px-3.5 py-3">
                      <div className="grid gap-3 lg:grid-cols-[96px_minmax(0,2.35fr)_150px_190px_112px_120px] lg:items-center lg:gap-3">
                        <div>
                          <StatusBadge tone={meta.tone} dot={false}>
                            {meta.label}
                          </StatusBadge>
                          <p className="mt-2 text-[12px] text-[var(--c-text-muted)] lg:hidden">
                            {meta.detail}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--c-text)]">
                            {row.description?.trim() || 'Movimiento sin descripcion'}
                          </p>
                          <p className="mt-1 truncate text-[12px] leading-5 text-[var(--c-text-muted)]">
                            {row.notes?.trim() || meta.detail}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-[var(--c-text)]">
                            {row.source_account?.name || 'Sin portafolio'}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[12px] text-[var(--c-text)]">
                            {row.category?.name || 'Sin categoria'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[12px] text-[var(--c-text)]">{formatDate(row.transaction_date)}</p>
                        </div>

                        <div className="lg:text-right">
                          <p className={`font-mono text-sm font-semibold tabular-nums ${row.type === 'INCOME' ? 'text-[var(--c-success)]' : 'text-[var(--c-warning)]'}`}>
                            {meta.signedAmount}
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </section>
        </div>
      </div>

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
    </div>
  )
}
