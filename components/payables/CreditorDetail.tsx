'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { DataErrorBanner, DataSearchField, EmptyState } from '@/components/finance'
import { IncomeDatePicker } from '@/components/forms/TransactionForm/IncomeDatePicker'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import {
  formatObligationLedgerSummaries,
  formatVerifiedObligationAmount,
  getObligationSettlementState,
  resolveVerifiedObligationCurrency,
  summarizeObligationLedgerCurrencies,
  type ObligationCurrencySummary,
} from '@/modules/obligations/obligation-currency-presentation'
import { getPayablePaymentProgress } from '@/modules/payables/payables-list-presentation'
import { buildPayableFinancialHistory, type PayableHistoryItem } from '@/modules/payables/payables-history-presentation'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'
import type { CreditorRow } from './CreditorForm'
import type { PayableRow } from './PayableForm'
import styles from './CreditorDetail.module.css'

export type CreditorWithStats = CreditorRow & {
  total_owed: number
  total_paid: number
  pending_amount: number
  progress_pct: number
  all_paid: boolean
  count_pending: number
  payables_count: number
  currency_summaries: ObligationCurrencySummary[]
  unverified_currency_records: number
  unverified_open_currency_records: number
  has_unverified_initial_debt: boolean
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
type Props = { creditor: CreditorWithStats }

function formatDate(iso: string) {
  if (!iso) return 'Fecha no disponible'
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function historyType(item: PayableHistoryItem) {
  if (item.kind === 'obligation') return { label: 'Obligación', className: styles.obligationType }
  if (item.kind === 'loan') return { label: 'Préstamo recibido', className: styles.loanType }
  return { label: 'Pago realizado', className: styles.paymentType }
}

export function CreditorDetail({ creditor }: Props) {
  const [rows, setRows] = useState<PayableRow[]>([])
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [movementFilter, setMovementFilter] = useState<'all' | 'loan' | 'obligation' | 'payment'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const settlementState = getObligationSettlementState({ summaries: creditor.currency_summaries, unverifiedRecordCount: creditor.unverified_currency_records, hasUnverifiedInitialBalance: creditor.has_unverified_initial_debt })
  const progress = getPayablePaymentProgress(creditor.currency_summaries)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [payablesResponse, ledgerResponse] = await Promise.all([
        fetch(`/api/payables?creditor_id=${creditor.id}`, { cache: 'no-store' }),
        fetch(`/api/creditors/${creditor.id}/ledger`, { cache: 'no-store' }),
      ])
      const [payablesJson, ledgerJson] = await Promise.all([payablesResponse.json().catch(() => null), ledgerResponse.json().catch(() => null)])
      if (!payablesResponse.ok || !payablesJson?.ok) throw new Error(getApiErrorMessage(payablesJson, 'No se pudieron cargar las obligaciones.'))
      if (!ledgerResponse.ok || !ledgerJson?.ok) throw new Error(getApiErrorMessage(ledgerJson, 'No se pudo cargar el historial del acreedor.'))
      setRows((payablesJson.data as PayableRow[]) ?? [])
      setLedgerRows((ledgerJson.data as LedgerRow[]) ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al cargar el detalle del acreedor.')
    } finally { setLoading(false) }
  }, [creditor.id])

  useEffect(() => {
    void loadRows()
    let cancelled = false
    fetch('/api/accounts?is_active=true', { cache: 'no-store' }).then(response => response.json()).then(json => {
      if (!cancelled && json?.ok) setAccounts((json.data as AccountOption[]) ?? [])
    }).catch(() => null)
    return () => { cancelled = true }
  }, [loadRows])

  const accountOptions = useMemo(() => [{ value: 'all', label: 'Todos los portafolios' }, ...accounts.map(account => ({ value: account.id, label: account.name }))], [accounts])
  const history = useMemo(() => buildPayableFinancialHistory(rows, ledgerRows), [ledgerRows, rows])
  const queryNormalized = query.trim().toLocaleLowerCase('es-PE')
  const filtered = useMemo(() => history.filter(item => {
    if (movementFilter !== 'all' && item.kind !== movementFilter) return false
    if (accountFilter !== 'all' && !ledgerRows.some(ledger => ledger.id === item.id.replace('ledger:', '') && ledger.source_account?.id === accountFilter)) {
      if (item.source !== 'document' || rows.find(row => `payable:${row.id}` === item.id)?.source_account?.id !== accountFilter) return false
    }
    if (dateFrom && item.date < dateFrom) return false
    if (dateTo && item.date > dateTo) return false
    return !queryNormalized || `${item.title} ${item.description} ${item.account}`.toLocaleLowerCase('es-PE').includes(queryNormalized)
  }), [accountFilter, dateFrom, dateTo, history, ledgerRows, movementFilter, queryNormalized, rows])
  const ledgerBreakdown = useMemo(() => summarizeObligationLedgerCurrencies(ledgerRows), [ledgerRows])
  const openCount = rows.filter(row => ['PENDING', 'PARTIAL', 'DISPUTED'].includes(row.status.toUpperCase()) && Number(row.amount) - Number(row.paid_amount) > 0).length
  const disputedCount = rows.filter(row => row.status.toUpperCase() === 'DISPUTED').length

  const clearFilters = useCallback(() => { setQuery(''); setAccountFilter('all'); setMovementFilter('all'); setDateFrom(''); setDateTo(''); setDateError(null) }, [])
  const dateValid = !dateFrom || !dateTo || dateFrom <= dateTo

  return (
    <div className={styles.detailLayout} data-testid="payables-detail-content">
      <section className={styles.summaryPanel} aria-labelledby="payables-summary-title" data-testid="payables-detail-summary">
        <div className={styles.summaryHeading}><h3 id="payables-summary-title">Pago documentado</h3><span className={`${styles.stateBadge} ${settlementState === 'SETTLED' ? styles.stateSuccess : settlementState === 'UNVERIFIED' || settlementState === 'EMPTY' ? styles.stateMuted : styles.stateWarning}`}>{settlementState === 'SETTLED' ? 'Pagos completos' : settlementState === 'UNVERIFIED' ? 'Moneda no verificable' : settlementState === 'EMPTY' ? 'Sin obligaciones' : 'Saldo pendiente'}</span></div>
        {creditor.currency_summaries.length ? <div className={styles.currencyRows}>{creditor.currency_summaries.map(summary => {
          const paidPercent = progress.available ? progress.items.find(item => item.currency === summary.currency)?.percent : null
          return <div className={styles.currencyRow} key={summary.currency}>
            <strong className={styles.currency}>{summary.currency}</strong>
            <div><span>Total documentado</span><strong>{formatVerifiedObligationAmount(summary.total, summary.currency)}</strong></div>
            <div><span>Total pagado</span><strong className={styles.paid}>{formatVerifiedObligationAmount(summary.settled, summary.currency)}</strong></div>
            <div><span>Saldo pendiente</span><strong className={summary.pending > 0 ? styles.pending : ''}>{formatVerifiedObligationAmount(summary.pending, summary.currency)}</strong></div>
            <div className={styles.progress}><div><span>Pagado</span><strong>{paidPercent === null || paidPercent === undefined ? 'Sin datos suficientes' : `${paidPercent.toFixed(1)}%`}</strong></div>{paidPercent !== null && paidPercent !== undefined ? <div className={styles.track} role="progressbar" aria-label={`Pagado en ${summary.currency}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercent}><span style={{ width: `${paidPercent}%` }} /></div> : null}</div>
          </div>
        })}</div> : <p className={styles.summaryEmpty}>{creditor.has_unverified_initial_debt ? 'El saldo inicial no tiene moneda confirmada y se mantiene fuera de estos totales.' : 'Todavía no hay importes documentados.'}</p>}
        {creditor.has_unverified_initial_debt || creditor.unverified_currency_records > 0 ? <p className={styles.unverified}>{creditor.has_unverified_initial_debt ? 'Saldo inicial sin moneda verificable' : `${creditor.unverified_currency_records} obligación${creditor.unverified_currency_records === 1 ? '' : 'es'} sin moneda verificable`}. Excluido de los importes por moneda.</p> : null}
      </section>

      <section className={styles.historyPanel} aria-labelledby="payables-history-title">
        <header className={styles.historyHeading}><div><h3 id="payables-history-title">Historial financiero</h3><p>{filtered.length} registro{filtered.length === 1 ? '' : 's'} · {openCount} obligación{openCount === 1 ? '' : 'es'} pendiente{openCount === 1 ? '' : 's'}{disputedCount ? ` · ${disputedCount} en disputa` : ''}</p></div></header>
        <div className={`${movementStyles.controlsMain} ${movementStyles.portfolioFilterBar} ${styles.detailToolbar}`} data-testid="payables-detail-filter-toolbar">
          <DataSearchField value={query} onChange={setQuery} placeholder="Buscar historial financiero" aria-label="Buscar historial financiero" className={styles.detailSearch} data-testid="payables-detail-search" />
          <AppSelect value={accountFilter} onChange={setAccountFilter} options={accountOptions} compact searchable={false} matchTriggerWidth className={`${movementStyles.portfolioFilter} ${styles.detailFilter} filters-control`} ariaLabel="Filtrar por portafolio" testId="payables-detail-account-filter" />
          <AppSelect value={movementFilter} onChange={value => setMovementFilter(value as typeof movementFilter)} options={[{ value: 'all', label: 'Todos los movimientos' }, { value: 'loan', label: 'Préstamos recibidos' }, { value: 'obligation', label: 'Obligaciones' }, { value: 'payment', label: 'Pagos realizados' }]} compact searchable={false} matchTriggerWidth className={`${movementStyles.portfolioFilter} ${styles.detailFilter} filters-control`} ariaLabel="Filtrar por tipo de movimiento" testId="payables-detail-type-filter" />
          <div className={styles.dateControl}><IncomeDatePicker value={dateFrom} onChange={value => { setDateFrom(value); setDateError(null) }} onInvalidInput={setDateError} error={dateError ?? undefined} inputLabel="Fecha desde" inputTestId="payables-detail-date-from" positioningBoundary="viewport" /></div>
          <div className={styles.dateControl}><IncomeDatePicker value={dateTo} onChange={value => { setDateTo(value); setDateError(null) }} onInvalidInput={setDateError} error={dateError ?? undefined} inputLabel="Fecha hasta" inputTestId="payables-detail-date-to" positioningBoundary="viewport" /></div>
          <Button className={styles.clearButton} type="button" variant="ghost" size="sm" onClick={clearFilters}>Limpiar</Button>
        </div>
        {dateError || !dateValid ? <p className={styles.dateError} role="alert">{dateError || 'La fecha inicial debe ser anterior o igual a la fecha final.'}</p> : null}
        <div className={styles.historyScroll}>
          {error ? <DataErrorBanner message={error} onRetry={() => void loadRows()} /> : null}
          {loading ? <div className={styles.loadingRows} aria-label="Cargando historial" aria-busy="true">{[0, 1, 2].map(index => <div key={index}><span /><span /><span /></div>)}</div>
            : !error && (filtered.length === 0 || !dateValid) ? <EmptyState title={history.length && dateValid ? 'No encontramos movimientos con esos filtros.' : history.length ? 'Revisa el rango de fechas.' : 'Todavía no hay movimientos vinculados.'} description={history.length ? 'Prueba con otros filtros o límpialos para ver todo el historial.' : 'Las obligaciones, préstamos y pagos vinculados aparecerán aquí.'} action={history.length ? { label: 'Limpiar filtros', onClick: clearFilters } : undefined} />
              : !error ? <div className={styles.historyTable}>
                <div className={styles.tableHeader} aria-hidden="true"><span>Tipo</span><span>Descripción</span><span>Cuenta asociada</span><span>Fecha</span><span className="text-right">Importe</span><span>Estado</span></div>
                {filtered.map(item => {
                  const type = historyType(item)
                  const currency = resolveVerifiedObligationCurrency(item.currency)
                  const amountLabel = currency && Number.isFinite(item.amount) ? formatCurrency(item.amount, currency) : 'Importe no verificable'
                  const signed = item.kind === 'loan' ? `+${amountLabel}` : item.kind === 'payment' ? `−${amountLabel}` : amountLabel
                  return <article className={styles.tableRow} key={item.id} data-testid={`payables-history-row-${item.id}`} data-record-source={item.source}>
                    <div><span className={`${styles.typeBadge} ${type.className}`}>{type.label}</span></div>
                    <div className={styles.description}><strong>{item.title}</strong><span>{item.description}</span></div>
                    <div className={styles.account}>{item.account}</div>
                    <time dateTime={item.date}>{formatDate(item.date)}</time>
                    <strong className={`${styles.amount} ${item.kind === 'loan' ? styles.loanAmount : item.kind === 'payment' ? styles.paymentAmount : ''}`}>{signed}</strong>
                    <span className={`${styles.statusBadge} ${item.status === 'Pagado' ? styles.statusPaid : item.status === 'En disputa' ? styles.statusDisputed : styles.statusMuted}`}>{item.status}</span>
                  </article>
                })}
                {ledgerBreakdown.unverifiedRecordCount > 0 ? <p className={styles.ledgerNote}>{ledgerBreakdown.unverifiedRecordCount} movimiento{ledgerBreakdown.unverifiedRecordCount === 1 ? '' : 's'} sin moneda verificable.</p> : null}
              </div> : null}
        </div>
      </section>
    </div>
  )
}
