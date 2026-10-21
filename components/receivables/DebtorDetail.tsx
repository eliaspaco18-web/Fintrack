'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { RecordModal } from '@/components/ui/RecordModal'
import { FormActions } from '@/components/forms/primitives'
import { ConfirmDialog, DataErrorBanner, DataSearchField, EmptyState } from '@/components/finance'
import { IncomeDatePicker } from '@/components/forms/TransactionForm/IncomeDatePicker'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import {
  formatVerifiedObligationAmount,
  getObligationSettlementState,
  resolveVerifiedObligationCurrency,
  summarizeObligationLedgerCurrencies,
  type ObligationCurrencySummary,
} from '@/modules/obligations/obligation-currency-presentation'
import { ReceivableForm } from './ReceivableForm'
import type { DebtorRow } from './DebtorForm'
import styles from './DebtorDetail.module.css'

export type DebtorWithStats = DebtorRow & {
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
  currency: string
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
  onNestedModalOpenChange?: (open: boolean) => void
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

function isOverdue(row: ReceivableRow) {
  if (!row.due_date || !['PENDING', 'PARTIAL'].includes(row.status)) return false
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return row.due_date < todayIso
}

function resolveLedgerMeta(row: LedgerRow) {
  const currency = resolveVerifiedObligationCurrency(row.currency)
  const verifiedAmount = currency ? formatCurrency(row.amount, currency) : 'Importe no verificable'

  if (row.type === 'INCOME') {
    return { label: 'Cobro', tone: styles.income, detail: 'Cobro registrado', signedAmount: currency ? `+${verifiedAmount}` : verifiedAmount }
  }
  return { label: 'Préstamo', tone: styles.expense, detail: 'Capital entregado', signedAmount: currency ? `−${verifiedAmount}` : verifiedAmount }
}

function summaryStateLabel(state: ReturnType<typeof getObligationSettlementState>) {
  switch (state) {
    case 'SETTLED': return 'Cobranza cerrada'
    case 'UNVERIFIED': return 'Importe no verificable'
    case 'EMPTY': return 'Sin cuentas documentadas'
    default: return 'Cobranza abierta'
  }
}

function receivableStateLabel(status: string) {
  switch (status.toUpperCase()) {
    case 'COLLECTED': return 'Cobrado'
    case 'PARTIAL': return 'Parcial'
    case 'PENDING': return 'Pendiente'
    default: return 'Estado no verificable'
  }
}

function formatReceivableAmount(value: unknown, currency: string | null) {
  const amount = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return currency && Number.isFinite(amount) ? formatCurrency(amount, currency) : 'Importe no verificable'
}

export function DebtorDetail({ debtor, exchangeRate, onChanged, onNestedModalOpenChange }: Props) {
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
  const [dateError, setDateError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDirty, setCreateDirty] = useState(false)
  const [createFormState, setCreateFormState] = useState({ disabled: true, saving: false, editing: false })
  const [discardOpen, setDiscardOpen] = useState(false)
  const settlementState = getObligationSettlementState({
    summaries: debtor.currency_summaries,
    unverifiedRecordCount: debtor.unverified_currency_records,
    hasUnverifiedInitialBalance: debtor.has_unverified_initial_debt,
  })

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Preserve the existing detail reads: the debtor_id route is intentionally unchanged.
      const [receivablesRes, ledgerRes] = await Promise.all([
        fetch(`/api/receivables?debtor_id=${debtor.id}`, { cache: 'no-store' }),
        fetch(`/api/debtors/${debtor.id}/ledger`, { cache: 'no-store' }),
      ])
      const [receivablesJson, ledgerJson] = await Promise.all([
        receivablesRes.json().catch(() => null),
        ledgerRes.json().catch(() => null),
      ])
      if (!receivablesRes.ok || !receivablesJson?.ok) throw new Error(getApiErrorMessage(receivablesJson, 'No se pudieron cargar las cuentas por cobrar.'))
      if (!ledgerRes.ok || !ledgerJson?.ok) throw new Error(getApiErrorMessage(ledgerJson, 'No se pudo cargar el historial del deudor.'))
      setRows((receivablesJson.data as ReceivableRow[]) ?? [])
      setLedgerRows((ledgerJson.data as LedgerRow[]) ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al cargar el detalle del deudor.')
    } finally {
      setLoading(false)
    }
  }, [debtor.id])

  useEffect(() => {
    void loadRows()
    let cancelled = false
    fetch('/api/accounts?is_active=true', { cache: 'no-store' })
      .then(response => response.json())
      .then(json => { if (!cancelled && json?.ok) setAccounts((json.data as AccountOption[]) ?? []) })
      .catch(() => null)
    return () => { cancelled = true }
  }, [loadRows])

  const normalizedQuery = query.trim().toLocaleLowerCase('es-PE')
  const accountOptions = useMemo(() => [
    { value: 'all', label: 'Todos los portafolios' },
    ...accounts.map(account => ({ value: account.id, label: account.name })),
  ], [accounts])
  const filteredLedger = useMemo(() => ledgerRows.filter(row => {
    if (movementFilter === 'income' && row.type !== 'INCOME') return false
    if (movementFilter === 'expense' && row.type !== 'EXPENSE') return false
    if (accountFilter !== 'all' && row.source_account?.id !== accountFilter) return false
    if (dateFrom && row.transaction_date < dateFrom) return false
    if (dateTo && row.transaction_date > dateTo) return false
    if (normalizedQuery && ![row.description, row.notes, row.category?.name, row.source_account?.name]
      .some(value => (value ?? '').toLocaleLowerCase('es-PE').includes(normalizedQuery))) return false
    return true
  }), [accountFilter, dateFrom, dateTo, ledgerRows, movementFilter, normalizedQuery])
  const filteredLedgerBreakdown = useMemo(() => summarizeObligationLedgerCurrencies(filteredLedger), [filteredLedger])
  const overdueCount = useMemo(() => rows.filter(isOverdue).length, [rows])
  const openAccountsCount = rows.filter(row => ['PENDING', 'PARTIAL'].includes(row.status)).length
  const hasPositiveLedgerBalance = filteredLedgerBreakdown.summaries.some(summary => summary.balance > 0)

  const handleFormSuccess = useCallback(async () => {
    setCreateDirty(false)
    setCreateOpen(false)
    await loadRows()
    await onChanged?.()
  }, [loadRows, onChanged])

  const requestCloseCreate = useCallback(() => {
    if (createDirty) setDiscardOpen(true)
    else setCreateOpen(false)
  }, [createDirty])

  const openCreate = useCallback(() => {
    setCreateDirty(false)
    setCreateFormState({ disabled: true, saving: false, editing: false })
    setCreateOpen(true)
    onNestedModalOpenChange?.(true)
  }, [onNestedModalOpenChange])

  const confirmDiscard = useCallback(() => {
    setCreateDirty(false)
    setDiscardOpen(false)
    setCreateOpen(false)
  }, [])

  const clearFilters = useCallback(() => {
    setQuery('')
    setAccountFilter('all')
    setMovementFilter('all')
    setDateFrom('')
    setDateTo('')
    setDateError(null)
  }, [])

  return (
    <div className={styles.detailLayout} data-testid="debtor-detail-content">
      <section className={styles.recoveryPanel} aria-labelledby="debtor-recovery-title">
        <div className={styles.panelHeading}>
          <div>
            <h3 id="debtor-recovery-title">Recuperación documentada</h3>
            <p>Importes pendientes y cobrados por moneda original.</p>
          </div>
          <span className={`${styles.stateBadge} ${settlementState === 'SETTLED' ? styles.stateSuccess : settlementState === 'UNVERIFIED' ? styles.stateMuted : styles.stateWarning}`}>
            {summaryStateLabel(settlementState)}
          </span>
        </div>
        {debtor.currency_summaries.length ? (
          <div className={styles.currencySummaries}>
            {debtor.currency_summaries.map(summary => (
              <article key={summary.currency} className={styles.currencySummary}>
                <p>{summary.currency}</p>
                <div className={styles.currencyMetrics}>
                  <div><span>Total</span><strong>{formatVerifiedObligationAmount(summary.total, summary.currency)}</strong></div>
                  <div><span>Cobrado</span><strong className={styles.settledAmount}>{formatVerifiedObligationAmount(summary.settled, summary.currency)}</strong></div>
                  <div><span>Pendiente</span><strong className={summary.pending > 0 ? styles.pendingAmount : ''}>{formatVerifiedObligationAmount(summary.pending, summary.currency)}</strong></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.noSummary}>{debtor.has_unverified_initial_debt ? 'El saldo inicial no tiene una moneda documentada y se mantiene fuera de estos totales.' : 'Todavía no hay importes documentados para mostrar.'}</p>
        )}
        {debtor.unverified_currency_records > 0 || debtor.has_unverified_initial_debt ? (
          <p className={styles.unverifiedNote} role="note">
            {debtor.has_unverified_initial_debt ? 'Saldo inicial sin moneda verificable' : `${debtor.unverified_currency_records} registro${debtor.unverified_currency_records === 1 ? '' : 's'} sin moneda verificable`}. Excluido de los importes por moneda.
          </p>
        ) : null}
        <div className={styles.recoveryProgress} aria-label="Porcentaje cobrado por moneda">
          {debtor.currency_summaries.map(summary => {
            const percent = summary.total > 0 ? Math.min(100, Math.max(0, summary.settled / summary.total * 100)) : 0
            return <div key={summary.currency} className={styles.progressLine}><span>{summary.currency}</span><div role="progressbar" aria-label={`Cobrado ${summary.currency}`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div><strong>{Math.round(percent)}%</strong></div>
          })}
        </div>
      </section>

      <section className={styles.obligationsPanel} aria-labelledby="debtor-obligations-title" data-testid="debtor-obligations">
        <div className={styles.obligationsHeading}>
          <div>
            <h3 id="debtor-obligations-title">Cuentas por cobrar</h3>
            <p>{rows.length} registro{rows.length === 1 ? '' : 's'} documentado{rows.length === 1 ? '' : 's'} · importes en su moneda original</p>
          </div>
        </div>
        {loading && rows.length === 0 ? (
          <div className={styles.obligationLoading} aria-busy="true" aria-label="Cargando cuentas por cobrar">
            {[0, 1].map(item => <span key={item} />)}
          </div>
        ) : rows.length === 0 ? (
          <p className={styles.noObligations}>Todavía no hay cuentas por cobrar documentadas para esta persona.</p>
        ) : (
          <div className={styles.obligationList}>
            {rows.map(row => {
              const currency = resolveVerifiedObligationCurrency(row.currency)
              const amount = typeof row.amount === 'number' ? row.amount : typeof row.amount === 'string' ? Number(row.amount) : NaN
              const collected = typeof row.collected_amount === 'number' ? row.collected_amount : typeof row.collected_amount === 'string' ? Number(row.collected_amount) : NaN
              const canShowPending = Boolean(currency) && Number.isFinite(amount) && Number.isFinite(collected)
              const pendingAmount = canShowPending ? amount - collected : null
              const normalizedStatus = row.status.toUpperCase()
              const stateClass = normalizedStatus === 'COLLECTED' ? styles.stateSuccess : normalizedStatus === 'PENDING' || normalizedStatus === 'PARTIAL' ? styles.stateWarning : styles.stateMuted

              return (
                <article className={styles.obligationRow} key={row.id} data-testid={`debtor-obligation-${row.id}`}>
                  <div className={styles.obligationCopy}>
                    <strong>{row.concept?.trim() || 'Cuenta por cobrar'}</strong>
                    <span>
                      Emitida {formatDate(row.issue_date)}
                      {row.due_date ? ` · Vence ${formatDate(row.due_date)}` : ' · Sin vencimiento registrado'}
                    </span>
                    {row.attachment_url ? <a href={row.attachment_url} target="_blank" rel="noreferrer">Ver documento asociado</a> : null}
                  </div>
                  <div className={styles.obligationAmounts}>
                    <span>Total <strong>{formatReceivableAmount(row.amount, currency)}</strong></span>
                    <span>Cobrado <strong>{formatReceivableAmount(row.collected_amount, currency)}</strong></span>
                    <span>Pendiente <strong className={pendingAmount !== null && pendingAmount > 0 ? styles.pendingAmount : ''}>{pendingAmount !== null && currency ? formatCurrency(pendingAmount, currency) : 'Importe no verificable'}</strong></span>
                  </div>
                  <span className={`${styles.stateBadge} ${stateClass}`}>{receivableStateLabel(row.status)}</span>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className={styles.historyPanel} aria-labelledby="debtor-ledger-title">
        <div className={styles.historyHeading}>
          <div>
            <h3 id="debtor-ledger-title">Movimientos vinculados</h3>
            <p>{filteredLedger.length} movimiento{filteredLedger.length === 1 ? '' : 's'} · {openAccountsCount} cuenta{openAccountsCount === 1 ? '' : 's'} pendiente{openAccountsCount === 1 ? '' : 's'}{overdueCount ? ` · ${overdueCount} vencida${overdueCount === 1 ? '' : 's'}` : ''}</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={openCreate}>Nueva cuenta por cobrar</Button>
        </div>

        <div className={styles.detailToolbar}>
          <DataSearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar movimientos vinculados"
            aria-label="Buscar movimientos vinculados"
            className={styles.detailSearch}
            data-testid="debtor-detail-search"
          />
          <AppSelect value={accountFilter} onChange={setAccountFilter} options={accountOptions} compact searchable={false} className={`${styles.detailFilter} ${styles.detailAccountFilter}`} aria-label="Filtrar por portafolio" />
          <AppSelect value={movementFilter} onChange={value => setMovementFilter(value as 'all' | 'income' | 'expense')} options={[
            { value: 'all', label: 'Todos los movimientos' },
            { value: 'expense', label: 'Solo préstamos' },
            { value: 'income', label: 'Solo cobros' },
          ]} compact searchable={false} className={`${styles.detailFilter} ${styles.detailMovementFilter}`} aria-label="Filtrar por tipo de movimiento" />
          <div className={styles.detailDateControl}><IncomeDatePicker value={dateFrom} onChange={setDateFrom} onInvalidInput={setDateError} error={dateError ?? undefined} inputLabel="Fecha desde" inputTestId="debtor-detail-date-from" positioningBoundary="viewport" /></div>
          <div className={styles.detailDateControl}><IncomeDatePicker value={dateTo} onChange={setDateTo} onInvalidInput={setDateError} error={dateError ?? undefined} inputLabel="Fecha hasta" inputTestId="debtor-detail-date-to" positioningBoundary="viewport" /></div>
          <Button className={styles.detailClear} type="button" variant="ghost" size="sm" onClick={clearFilters}>Limpiar</Button>
        </div>
        {dateError ? <p className={styles.dateError} role="alert">{dateError}</p> : null}

        {error ? <DataErrorBanner message={error} onRetry={() => void loadRows()} /> : null}
        {loading ? (
          <div className={styles.loadingList} aria-label="Cargando movimientos" aria-busy="true">
            {[0, 1, 2].map(item => <div key={item} className={styles.loadingLine}><span /><span /><span /></div>)}
          </div>
        ) : !error && filteredLedger.length === 0 ? (
          <EmptyState
            title={query || accountFilter !== 'all' || movementFilter !== 'all' || dateFrom || dateTo ? 'No encontramos movimientos con esos filtros.' : 'Todavía no hay movimientos vinculados.'}
            description={query || accountFilter !== 'all' || movementFilter !== 'all' || dateFrom || dateTo ? 'Prueba otro rango de fechas o limpia los filtros.' : 'Los préstamos y cobros registrados aparecerán aquí.'}
            action={query || accountFilter !== 'all' || movementFilter !== 'all' || dateFrom || dateTo ? { label: 'Limpiar filtros', onClick: clearFilters } : undefined}
          />
        ) : !error ? (
          <div className={styles.ledgerList}>
            <div className={styles.ledgerHead} aria-hidden="true"><span>Tipo</span><span>Descripción</span><span>Portafolio</span><span>Categoría</span><span>Fecha</span><span className="text-right">Importe</span></div>
            {filteredLedger.map(row => {
              const meta = resolveLedgerMeta(row)
              return <article key={row.id} className={styles.ledgerRow} data-testid={`debtor-ledger-row-${row.id}`}>
                <div><span className={`${styles.typeBadge} ${meta.tone}`}>{meta.label}</span></div>
                <div className={styles.ledgerDescription}><strong>{row.description?.trim() || 'Movimiento sin descripción'}</strong><span>{row.notes?.trim() || meta.detail}</span></div>
                <div className={styles.ledgerCell}>{row.source_account?.name || 'Sin portafolio'}</div>
                <div className={styles.ledgerCell}>{row.category?.name || 'Sin categoría'}</div>
                <time className={styles.ledgerDate} dateTime={row.transaction_date}>{formatDate(row.transaction_date)}</time>
                <strong className={`${styles.ledgerAmount} ${row.type === 'INCOME' ? styles.incomeAmount : styles.expenseAmount}`}>{meta.signedAmount}</strong>
              </article>
            })}
          </div>
        ) : null}
      </section>

      <RecordModal
        open={createOpen}
        onClose={requestCloseCreate}
        onExitComplete={() => onNestedModalOpenChange?.(false)}
        eyebrow="Cuentas por cobrar"
        title="Nueva cuenta por cobrar"
        subtitle="Registra un nuevo compromiso dentro del mismo deudor."
        size="lg"
        presentation="workbench"
        overlayClassName={`z-modal ${styles.receivableFormOverlay}`}
        focusTrapActive={!discardOpen}
        preserveFocusOnResume
        footer={(
          <FormActions
            secondaryAction={<Button type="button" variant="secondary" size="lg" onClick={requestCloseCreate} disabled={createFormState.saving}>Cancelar</Button>}
            primaryAction={<Button type="submit" form="receivable-form" variant="primary" size="lg" disabled={createFormState.disabled} loading={createFormState.saving} testId="debtor-detail-receivable-save-btn">Crear cuenta por cobrar</Button>}
          />
        )}
      >
        <ReceivableForm
          debtors={[debtor]}
          exchangeRate={exchangeRate}
          defaultDebtorId={debtor.id}
          onSuccess={handleFormSuccess}
          onDirtyChange={setCreateDirty}
          onFormStateChange={setCreateFormState}
        />
      </RecordModal>
      <ConfirmDialog
        open={discardOpen}
        title="Descartar cambios sin guardar"
        message="Los cambios realizados en esta cuenta por cobrar se perderán."
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardOpen(false)}
        confirmLabel="Descartar cambios"
      />
    </div>
  )
}
