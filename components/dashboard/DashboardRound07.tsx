'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { BudgetProgressRow } from '@/components/finance/charts/BudgetProgressRow'
import { CategoryRanking, type CategoryRankingRow } from '@/components/finance/charts/CategoryRanking'
import { MonthlyFlowBars, MonthlyFlowDataTable, type MonthlyFlowDatum } from '@/components/finance/charts/MonthlyFlowBars'
import { MoneyText } from '@/components/finance/MoneyText'
import { PositionBand } from '@/components/finance/PositionBand'
import { FocusTrap } from '@/components/ui/accessibility'
import { ModalOverlayPortal } from '@/components/ui/ModalOverlayPortal'
import { QUICK_OPERATIONS } from '@/lib/constants/quick-operations'
import type { TransactionListItem } from '@/lib/contracts/ui.contracts'
import type { CreditListItem } from '@/lib/credits/display-type'
import type { DashboardSidebar, DashboardSummary, MoneyFlowPoint } from '@/lib/dashboard/types'
import { formatV3Money } from '@/lib/finance/v3-money-display'
import {
  currentLimaPeriod, documentedAgenda, documentedPending, nativeAccountPosition,
  type DashboardAccount, type DashboardObligation,
} from '@/lib/dashboard/round07'
import { fetchDashboardData } from './api'
import styles from './DashboardRound07.module.css'

const AdvancedDashboard = dynamic(() => import('./DashboardWorkspace').then(module => module.DashboardWorkspace), { ssr: false })

type MoneyFlowResponse = { series: MoneyFlowPoint[] }
type RecentResponse = { data: TransactionListItem[]; pagination: { has_more: boolean } }
type BudgetPeriod = {
  id: string
  amount: number
  spent_amount: number
  remaining_amount: number
  progress_percent: number
  over_limit: boolean
  period_start: string
  period_end: string
  budget: { id: string; name: string; currency: string; is_active: boolean }
}

const read = <T,>(url: string) => fetchDashboardData<T>(url)
const number = (value: number) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(value)
const moneyLabel = (value: number, currency: string) => formatV3Money({ value, currency }).text
const amount = (value: number, currency: string) => (
  <MoneyText value={Number.isFinite(value) ? value : null} currency={currency} />
)
const monthName = (iso: string) => new Intl.DateTimeFormat('es-PE', {
  month: 'long', timeZone: 'UTC',
}).format(new Date(`${iso.slice(0, 7)}-01T12:00:00Z`))

function SourceState({ loading, failed, available, retry, children }: {
  loading: boolean; failed: boolean; available: boolean; retry: () => void; children: React.ReactNode
}) {
  if (failed && !available) return <div className={styles.sourceState} role="alert">No se pudo cargar esta sección. <button type="button" onClick={retry}>Reintentar</button></div>
  if (loading) return <div className={styles.sourceState} role="status" aria-busy="true">Cargando información…</div>
  return <>{failed ? <div className={styles.stale} role="status">No se pudo actualizar; se muestran los últimos datos disponibles. <button type="button" onClick={retry}>Reintentar</button></div> : null}{children}</>
}

function Panel({ title, subtitle, href, linkLabel, children, className = '' }: {
  title: string; subtitle?: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string
}) {
  return <section className={`${styles.panel} ${className}`} aria-label={title}>
    <div className={styles.panelHeading}>
      <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
      {href ? <Link href={href} className={styles.panelLink}>{linkLabel ?? 'Ver todos'} <span aria-hidden="true">↗</span></Link> : null}
    </div>
    {children}
  </section>
}

function useDashboardSources(period: string) {
  const options = { revalidateOnFocus: false, dedupingInterval: 30_000 }
  const accounts = useSWR('/api/accounts?include_inactive=true', read<DashboardAccount[]>, options)
  const receivables = useSWR('/api/receivables', read<DashboardObligation[]>, options)
  const payables = useSWR('/api/payables', read<DashboardObligation[]>, options)
  const summary = useSWR('/api/dashboard/summary', read<DashboardSummary>, options)
  const flow = useSWR('/api/dashboard/money-flow?months=6&mode=mensual', read<MoneyFlowResponse>, options)
  const sidebar = useSWR(`/api/dashboard/sidebar?period=${period}`, read<DashboardSidebar>, options)
  const budgets = useSWR(`/api/budget-periods?period=${period}`, read<BudgetPeriod[]>, options)
  const recent = useSWR('/api/transactions?sort_by=transaction_date&sort_dir=desc&page=1&per_page=5', read<RecentResponse>, options)
  const credits = useSWR('/api/credits', read<CreditListItem[]>, options)
  return { accounts, receivables, payables, summary, flow, sidebar, budgets, recent, credits }
}

export function DashboardRound07() {
  const [today] = useState(() => currentLimaPeriod())
  const [agendaDays, setAgendaDays] = useState<7 | 30>(7)
  const [categoryType, setCategoryType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE')
  const [flowMonths, setFlowMonths] = useState<3 | 6>(6)
  const [showFlowTable, setShowFlowTable] = useState(false)
  const [showMobileAnalysis, setShowMobileAnalysis] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showAllAgenda, setShowAllAgenda] = useState(false)
  const sources = useDashboardSources(today.month)
  const month = monthName(today.iso)
  const firstDay = `${today.month}-01`
  const dateLabel = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${today.iso}T12:00:00Z`))

  const accounts = useMemo(() => nativeAccountPosition(sources.accounts.data ?? []), [sources.accounts.data])
  const receivables = useMemo(() => documentedPending(sources.receivables.data ?? [], 'collected_amount'), [sources.receivables.data])
  const payables = useMemo(() => documentedPending(sources.payables.data ?? [], 'paid_amount'), [sources.payables.data])
  const agenda = useMemo(() => documentedAgenda(
    sources.receivables.data ?? [], sources.payables.data ?? [], today.iso, agendaDays,
  ), [sources.receivables.data, sources.payables.data, today.iso, agendaDays])
  const agendaLoading = !sources.receivables.data && !sources.payables.data
  const flowPoints: MonthlyFlowDatum[] = useMemo(() => (sources.flow.data?.series ?? []).map((point, index) => ({
    id: `${index}-${point.month}`, label: point.month, periodLabel: point.month,
    income: Number.isFinite(point.ingresos) ? point.ingresos : null,
    expense: Number.isFinite(point.egresos) ? point.egresos : null,
    incomeLabel: Number.isFinite(point.ingresos) ? moneyLabel(point.ingresos, 'PEN') : 'No disponible',
    expenseLabel: Number.isFinite(point.egresos) ? moneyLabel(point.egresos, 'PEN') : 'No disponible',
    resultLabel: Number.isFinite(point.saldo_mensual) ? moneyLabel(point.saldo_mensual, 'PEN') : 'No disponible',
    // The API currently omits an ISO month key; a localized label cannot prove which bar is current.
    partial: false,
  })), [sources.flow.data])
  const rankSource = categoryType === 'EXPENSE' ? sources.sidebar.data?.egresos_categoria : sources.sidebar.data?.ingresos_categoria
  const rankBasis = categoryType === 'EXPENSE' ? sources.summary.data?.egresos_mes : sources.summary.data?.ingresos_mes
  const rankSum = (rankSource ?? []).reduce((total, row) => total + row.monto, 0)
  const rankMatches = rankBasis !== undefined && Math.abs(rankSum - rankBasis) < 0.02
  const rankItems = [...(rankSource ?? [])].sort((a, b) => b.monto - a.monto)
  const categoryHref = (id: string) => `/transactions?type=${categoryType}&category_id=${encodeURIComponent(id)}&date_from=${firstDay}&date_to=${today.iso}&page=1`
  const rankingRows: CategoryRankingRow[] = (showAllCategories || rankItems.length <= 6 ? rankItems : rankItems.slice(0, 5)).map((row, index) => row.category_id
    ? { kind: 'category' as const, key: row.category_id, categoryId: row.category_id, href: categoryHref(row.category_id), name: row.name, amount: row.monto, formattedAmount: moneyLabel(row.monto, 'PEN'), shareLabel: `${number(row.pct)}%` }
    : { kind: 'aggregate' as const, key: `uncategorized-${index}`, name: row.name, amount: row.monto, formattedAmount: moneyLabel(row.monto, 'PEN'), shareLabel: `${number(row.pct)}%`, onInspect: () => setShowAllCategories(true) })
  if (!showAllCategories && rankItems.length > 6) {
    const rest = rankItems.slice(5)
    rankingRows.push({ kind: 'aggregate', key: 'remaining-categories', name: 'Otras categorías', amount: rest.reduce((sum, row) => sum + row.monto, 0), formattedAmount: moneyLabel(rest.reduce((sum, row) => sum + row.monto, 0), 'PEN'), shareLabel: rankBasis && rankBasis > 0 ? `${number(rest.reduce((sum, row) => sum + row.monto, 0) / rankBasis * 100)}%` : 'Sin base', onInspect: () => setShowAllCategories(true) })
  }
  const orderedBudgets = [...(sources.budgets.data ?? [])].filter(item => item.budget?.is_active)
    .sort((a, b) => Number(b.over_limit) - Number(a.over_limit) || b.progress_percent - a.progress_percent || a.budget.name.localeCompare(b.budget.name))
  const cards = (sources.credits.data ?? []).filter(item => item.status === 'ACTIVE' && item.display_type === 'CARD')
  const loans = (sources.credits.data ?? []).filter(item => item.status === 'ACTIVE' && item.display_type === 'LOAN')
  const attention: Array<{ label: string; href: string }> = []
  const overdue = agenda.find(item => item.dueDate < today.iso)
  if (overdue) attention.push({ label: 'Hay un compromiso documentado vencido', href: overdue.href })
  const exceeded = orderedBudgets.find(item => item.over_limit)
  if (exceeded) attention.push({ label: `Presupuesto excedido: ${exceeded.budget.name}`, href: '/budgets' })
  if ((receivables.unverified || payables.unverified) && attention.length < 2) attention.push({ label: 'Hay importes pendientes sin moneda o monto verificable', href: receivables.unverified ? '/receivables' : '/payables' })

  return <main data-ft-v3="" className={styles.dashboard}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Inicio / Panorama</p><h1>Tu panorama financiero</h1><p className={styles.date}>{dateLabel}</p></div>
      <div className={styles.headerActions}>
        <Link href="/transactions" className={styles.periodControl}>Mes actual: {month} <span aria-hidden="true">↗</span></Link>
        <Link href={QUICK_OPERATIONS[0].href} className={styles.primaryAction}>＋ Registrar egreso</Link>
        <details className={styles.operationMenu}><summary aria-label="Otras operaciones">⌄</summary><div>{QUICK_OPERATIONS.slice(1).map(operation => <Link key={operation.id} href={operation.href}>{operation.label}</Link>)}</div></details>
      </div>
    </header>

    <PositionBand
      accounts={{ label: 'Saldos de tus cuentas', href: '/portfolio', scope: sources.accounts.data ? `${accounts.count} cuentas activas · moneda original` : 'Moneda original', amounts: sources.accounts.data ? accounts.amounts : [], unavailableReason: sources.accounts.error ? 'No se pudieron consultar las cuentas.' : !sources.accounts.data ? 'Cargando cuentas…' : undefined }}
      receivables={{ label: 'Por cobrar', href: '/receivables', scope: 'Pendiente documentado · cobertura no verificada', amounts: sources.receivables.data ? receivables.amounts : [], unavailableReason: sources.receivables.error ? 'No se pudo consultar.' : !sources.receivables.data ? 'Cargando…' : receivables.unverified ? `${receivables.unverified} sin importe verificable` : undefined }}
      payables={{ label: 'Por pagar', href: '/payables', scope: 'Pendiente documentado · cobertura no verificada', amounts: sources.payables.data ? payables.amounts : [], unavailableReason: sources.payables.error ? 'No se pudo consultar.' : !sources.payables.data ? 'Cargando…' : payables.unverified ? `${payables.unverified} sin importe verificable` : undefined }}
    />

    {attention.length ? <nav className={styles.attention} aria-label="Para revisar"><span>ⓘ &nbsp; Para revisar</span>{attention.slice(0, 2).map(item => <Link key={item.href} href={item.href}>{item.label} <span aria-hidden="true">›</span></Link>)}</nav> : null}

    <div className={styles.bodyGrid}>
      <div className={styles.leftColumn}>
        <Panel title={`Así va ${month}`} subtitle={`Del 1 al ${today.day} · PEN de reporte`} className={styles.report}>
          <SourceState loading={!sources.summary.data && !sources.summary.error} failed={Boolean(sources.summary.error)} available={Boolean(sources.summary.data)} retry={() => void sources.summary.mutate()}>
            {sources.summary.data ? <>
              <div className={styles.facts}>
                <Link href={`/transactions?type=INCOME&date_from=${firstDay}&date_to=${today.iso}&page=1`}><span>Ingresos</span>{amount(sources.summary.data.ingresos_mes, 'PEN')}</Link>
                <Link href={`/transactions?type=EXPENSE&date_from=${firstDay}&date_to=${today.iso}&page=1`}><span>Egresos</span>{amount(sources.summary.data.egresos_mes, 'PEN')}</Link>
                <div className={styles.resultFact}><span>Resultado del período</span>{amount(sources.summary.data.resultado_mensual, 'PEN')}</div>
              </div>
            </> : null}
          </SourceState>
          <button type="button" className={styles.mobileAnalysisToggle} aria-expanded={showMobileAnalysis} onClick={() => setShowMobileAnalysis(value => !value)}>{showMobileAnalysis ? 'Ocultar flujo y categorías' : 'Ver flujo y categorías'} <span aria-hidden="true">⌄</span></button>
          <div className={styles.reportAnalysis} data-mobile-expanded={showMobileAnalysis}>
            <div className={styles.flowBlock}>
              <div className={styles.subheading}><h3>Ingresos y egresos</h3><div className={styles.segment}><button aria-pressed={flowMonths === 3} onClick={() => setFlowMonths(3)}>3 meses</button><button aria-pressed={flowMonths === 6} onClick={() => setFlowMonths(6)}>6 meses</button></div></div>
              <p className={styles.meta}>PEN de reporte · la API no entrega una fecha completa para cada barra; no se usa esta serie para calcular los totales.</p>
              <SourceState loading={!sources.flow.data && !sources.flow.error} failed={Boolean(sources.flow.error)} available={Boolean(sources.flow.data)} retry={() => void sources.flow.mutate()}>
                {flowPoints.length ? <><MonthlyFlowBars points={flowPoints} requestedMonths={flowMonths} /><button className={styles.textButton} onClick={() => setShowFlowTable(value => !value)} aria-expanded={showFlowTable}>{showFlowTable ? 'Ocultar datos' : 'Ver datos exactos'}</button>{showFlowTable ? <MonthlyFlowDataTable points={flowPoints} /> : null}</> : <p className={styles.empty}>Aún no hay meses de movimiento para comparar.</p>}
              </SourceState>
            </div>
            <div className={styles.rankBlock}>
              <div className={styles.subheading}><h3>Por categoría</h3><div className={styles.segment}><button aria-pressed={categoryType === 'EXPENSE'} onClick={() => { setCategoryType('EXPENSE'); setShowAllCategories(false) }}>Egresos</button><button aria-pressed={categoryType === 'INCOME'} onClick={() => { setCategoryType('INCOME'); setShowAllCategories(false) }}>Ingresos</button></div></div>
              <SourceState loading={!sources.sidebar.data && !sources.sidebar.error} failed={Boolean(sources.sidebar.error)} available={Boolean(sources.sidebar.data)} retry={() => void sources.sidebar.mutate()}>
                {!sources.summary.data ? <p className={styles.empty}>Esperando el total del reporte para verificar categorías.</p> : !rankMatches ? <p className={styles.empty}>El desglose no coincide con el total del reporte. Revisa las categorías en Movimientos.</p> : rankingRows.length ? <><CategoryRanking rows={rankingRows} /><p className={styles.meta}>Registros de categoría; la participación en reportes se explica en el detalle.</p></> : <p className={styles.empty}>Sin categorías en el reporte de este mes.</p>}
              </SourceState>
            </div>
          </div>
          <div className={styles.panelFooter}><span>Resultado = ingresos − egresos, sin transferencias internas</span><span>{sources.summary.data && sources.summary.data.ingresos_mes > 0 ? `${number(sources.summary.data.resultado_mensual / sources.summary.data.ingresos_mes * 100)}% de los ingresos queda como resultado` : 'Sin base para el porcentaje'}</span></div>
        </Panel>

        <Panel title="Últimos movimientos" subtitle="Lo último que registraste · no se usa para calcular el mes" href="/transactions" className={styles.recent}>
          <SourceState loading={!sources.recent.data && !sources.recent.error} failed={Boolean(sources.recent.error)} available={Boolean(sources.recent.data)} retry={() => void sources.recent.mutate()}>
            {(sources.recent.data?.data ?? []).length ? <ul className={styles.recentList}>{sources.recent.data!.data.map(row => <li key={row.id}><Link href={`/transactions/${encodeURIComponent(row.id)}`}><span className={styles.recentDate}>{row.transactionDate || row.transaction_date}</span><span className={styles.recentIdentity}><strong>{row.description || (row.type === 'TRANSFER' ? 'Transferencia' : 'Movimiento')}</strong><small>{row.category?.name ?? (row.type === 'TRANSFER' ? 'Transferencia interna' : row.type === 'INCOME' ? 'Ingreso' : 'Egreso')}</small></span><span className={styles.recentAccount}>{row.sourceAccount?.name ?? row.source_account?.name ?? '—'}</span><span className={styles.recentAmount}>{row.type === 'TRANSFER' ? '' : row.type === 'INCOME' ? '+' : '−'}{amount(Math.abs(row.amount), row.currency)}</span><span aria-hidden="true">›</span></Link></li>)}</ul> : <p className={styles.empty}>Aún no hay movimientos. <Link href={QUICK_OPERATIONS[0].href}>Registrar el primero</Link></p>}
          </SourceState>
          <div className={styles.panelFooter}><Link href={QUICK_OPERATIONS[1].href}>＋ Registrar ingreso</Link><Link href={QUICK_OPERATIONS[2].href}>⇄ Transferir entre cuentas</Link><Link href={QUICK_OPERATIONS[0].href}>Otras operaciones ↗</Link></div>
        </Panel>
      </div>

      <div className={styles.rightColumn}>
        <Panel title="Tu próxima agenda" subtitle="Compromisos documentados · no son pagos automáticos" className={styles.agenda}>
          <div className={styles.agendaControls}><div className={styles.segment}><button aria-pressed={agendaDays === 7} onClick={() => setAgendaDays(7)}>7 días</button><button aria-pressed={agendaDays === 30} onClick={() => setAgendaDays(30)}>30 días</button></div></div>
          <SourceState loading={agendaLoading && !sources.receivables.error && !sources.payables.error} failed={Boolean(sources.receivables.error || sources.payables.error)} available={!agendaLoading} retry={() => { void sources.receivables.mutate(); void sources.payables.mutate() }}>
            {agenda.length ? <><p className={styles.meta}>Agenda parcial: ciclos y préstamos se consultan en Créditos. Documentos: cobertura no verificada.</p><ul className={styles.agendaList}>{agenda.slice(0, 4).map(item => <li key={`${item.source}-${item.id}`}><Link href={item.href}><span className={styles.dateTile}><strong>{item.dueDate.slice(8)}</strong><small>{new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'UTC' }).format(new Date(`${item.dueDate}T12:00:00Z`))}</small></span><span className={styles.agendaIdentity}><strong>{item.label}</strong><small>{item.dueDate < today.iso ? 'Vencido · ' : ''}{item.source === 'receivable' ? 'Por cobrar' : 'Por pagar'}</small></span><span className={styles.agendaAmount}>{amount(item.pending ?? Number.NaN, item.currency ?? 'PEN')}</span><span aria-hidden="true">›</span></Link></li>)}</ul>{agenda.length > 4 ? <button className={styles.textButton} onClick={() => setShowAllAgenda(true)}>Ver los {agenda.length} documentos</button> : null}</> : <p className={styles.empty}>No hay vencimientos documentados en este intervalo. Ciclos y préstamos: consultar Créditos.</p>}
          </SourceState>
        </Panel>

        <Panel title="Presupuestos" subtitle={`${month} · importes vinculados`} href="/budgets">
          <SourceState loading={!sources.budgets.data && !sources.budgets.error} failed={Boolean(sources.budgets.error)} available={Boolean(sources.budgets.data)} retry={() => void sources.budgets.mutate()}>
            {orderedBudgets.length ? <div className={styles.budgetList}>{orderedBudgets.slice(0, 3).map(item => {
              const valid = Number.isFinite(item.amount) && item.amount > 0 && Number.isFinite(item.spent_amount) && Number.isFinite(item.progress_percent)
              const common = { periodId: item.id, href: '/budgets', label: item.budget.name, spentLabel: moneyLabel(item.spent_amount, item.budget.currency), limitLabel: moneyLabel(item.amount, item.budget.currency), basisLabel: item.budget.currency }
              return <BudgetProgressRow key={item.id} {...common} {...(valid ? { state: 'valid' as const, percentage: item.progress_percent, percentageLabel: `${number(item.progress_percent)}%`, remainingLabel: item.over_limit ? `${moneyLabel(Math.abs(item.remaining_amount), item.budget.currency)} excedidos` : `${moneyLabel(item.remaining_amount, item.budget.currency)} restantes`, exceeded: item.over_limit } : { state: 'invalid' as const, reason: 'Sin límite válido' })} />
            })}</div> : <p className={styles.empty}>No hay presupuestos activos para este mes. <Link href="/budgets?new=budget">Crear presupuesto</Link></p>}
          </SourceState>
        </Panel>

        <SourceState loading={!sources.credits.data && !sources.credits.error} failed={Boolean(sources.credits.error)} available={Boolean(sources.credits.data)} retry={() => void sources.credits.mutate()}>
          {cards.length || loans.length ? <Panel title="Créditos, por separado" subtitle="Deuda en moneda original · no es dinero disponible" href="/credits" linkLabel="Revisar">
            <ul className={styles.creditList}>{cards.slice(0, 2).map(item => <li key={item.id}><Link href={`/credits/${encodeURIComponent(item.id)}`}><span><strong>{item.name}</strong><small>Deuda de tarjeta</small></span>{amount(item.used_amount, item.currency)}</Link></li>)}{loans.slice(0, 2).map(item => <li key={item.id}><Link href={`/credits/${encodeURIComponent(item.id)}`}><span><strong>{item.name}</strong><small>Principal registrado de préstamo</small></span>{amount(item.credit_limit, item.currency)}</Link></li>)}</ul>
            {cards.length > 2 || loans.length > 2 ? <p className={styles.meta}>Hay más productos registrados en Créditos.</p> : null}
          </Panel> : null}
        </SourceState>
      </div>
    </div>

    {showAllAgenda ? <ModalOverlayPortal className={styles.dialogBackdrop} onClick={() => setShowAllAgenda(false)}><FocusTrap active onEscape={() => setShowAllAgenda(false)}><section role="dialog" aria-modal="true" aria-label="Agenda documentada" className={styles.dialog}><div className={styles.panelHeading}><h2>Agenda documentada · {agendaDays} días</h2><button onClick={() => setShowAllAgenda(false)} aria-label="Cerrar agenda">✕</button></div><ul>{agenda.map(item => <li key={`${item.source}-${item.id}`}><Link href={item.href}>{item.dueDate} · {item.label} · {item.source === 'receivable' ? 'Cobrar' : 'Pagar'}</Link></li>)}</ul><p className={styles.meta}>No son pagos automáticos. Cobertura de documentos no verificada.</p></section></FocusTrap></ModalOverlayPortal> : null}

    <p className={styles.scopeNote}>Los saldos describen cuentas activas hoy; el resultado describe {month}. Cobros, pagos y créditos conservan su moneda y significado. Los documentos consultados pueden tener cobertura parcial.</p>
    <div className={styles.advanced}><button type="button" onClick={() => setShowLegacy(value => !value)} aria-expanded={showLegacy}>{showLegacy ? 'Ocultar análisis anteriores' : 'Explorar análisis anteriores'} <span aria-hidden="true">⌄</span></button>{showLegacy ? <AdvancedDashboard /> : null}</div>
  </main>
}
