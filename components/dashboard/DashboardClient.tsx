'use client'

// =============================================================================
// components/dashboard/DashboardClient.tsx
// Client Component que recibe los datos iniciales del Server Component y
// gestiona el refresh periódico con useDashboard.
// Compone todos los widgets del dashboard.
// =============================================================================

import { useDashboard }                   from '@/lib/hooks/useDashboard'
import { useCurrency }                    from '@/lib/hooks/useDashboard'
import { formatCurrency, formatNumber }   from '@/lib/contracts/ui.contracts'
import Link                               from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { KpiCard }                        from './primitives'
import { FirstRunOnboarding }             from './FirstRunOnboarding'
import { CashFlowChart }                  from './widgets/CashFlowChart'
import { ExpenseBreakdown }               from './widgets/ExpenseBreakdown'
import {
  AccountsWidget,
  CreditsWidget,
  AssetsWidget,
}                                         from './widgets/FinanceWidgets'
import { AlertsWidget }                   from './widgets/AlertsWidget'
import { ReceivablesPayablesWidget }      from './widgets/ReceivablesPayablesWidget'
import type { DashboardSummary }          from '@/modules/dashboard/dashboard.types'

// ─── ICONS INLINE ─────────────────────────────────────────────────────────────

function IconIncome()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 19V5m0 0-7 7m7-7 7 7"/></svg> }
function IconExpense()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14m0 0-7-7m7 7 7-7"/></svg> }
function IconBalance()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/></svg> }
function IconNetWorth() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/></svg> }
function IconAlert()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v5"/><path d="M12 17h.01"/></svg> }
function IconWallet()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M16 12h.01"/><path d="M3 9h18"/></svg> }
function IconCard()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></svg> }
function IconAsset()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m12 2 9 4.5v11L12 22 3 17.5v-11L12 2Z"/><path d="M12 22V12"/><path d="m21 6.5-9 5.5-9-5.5"/></svg> }
function IconPending()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v18"/><path d="M7 8a4 4 0 0 1 4-2h2a3 3 0 0 1 0 6h-2a3 3 0 0 0 0 6h2a4 4 0 0 0 4-2"/></svg> }

// ─── REFRESHING INDICATOR ─────────────────────────────────────────────────────

function RefreshingDot() {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2
      px-3 py-1.5 rounded-full bg-[#0f1520] border border-white/[0.08]
      shadow-lg animate-[fade-in_0.3s_ease-out]">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
      <span className="text-[10px] text-white/40">Actualizando</span>
    </div>
  )
}

const WELCOME_KEY = 'fintrack.welcome.v1'
const WELCOME_LINES = [
  'Hoy es un gran día para tomar control de tus finanzas.',
  'Cada movimiento que registras te acerca a tus metas.',
  'Vamos a convertir tus números en decisiones inteligentes.',
]

function WelcomeBanner() {
  const [payload, setPayload] = useState<{ name: string; line: string } | null>(null)
  const [visible, setVisible] = useState(false)

  const normalizeName = (raw: string | null | undefined) => {
    const clean = (raw ?? '').trim()
    if (!clean) return 'usuario'
    const withoutEmail = clean.includes('@') ? '' : clean
    const readable = withoutEmail.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return readable.length > 0 ? readable : 'usuario'
  }

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(WELCOME_KEY)
      if (!raw) return

      window.sessionStorage.removeItem(WELCOME_KEY)
      const parsed = JSON.parse(raw) as { name?: string; at?: number }
      const at = Number(parsed.at ?? 0)
      if (!Number.isFinite(at) || Date.now() - at > 1000 * 60 * 15) return

      const cleanName = normalizeName(parsed.name)
      const line =
        WELCOME_LINES[Math.floor(Math.random() * WELCOME_LINES.length)] ??
        'Hoy es un gran día para tomar control de tus finanzas.'

      setPayload({ name: cleanName, line })
      requestAnimationFrame(() => setVisible(true))

      const hideTimer = window.setTimeout(() => {
        setVisible(false)
        window.setTimeout(() => setPayload(null), 450)
      }, 8000)
      return () => window.clearTimeout(hideTimer)
    } catch {
      // Si falla storage/JSON, no mostramos el banner y continuamos normal.
    }
  }, [])

  if (!payload) return null

  return (
    <section
      className={`rounded-2xl border px-4 py-3 md:px-5 md:py-4 transition-all duration-500
        bg-[linear-gradient(140deg,rgba(16,185,129,0.18),rgba(59,130,246,0.14))]
        border-emerald-400/25
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
    >
      <p className="text-[11px] uppercase tracking-[0.1em] text-emerald-300/80">Bienvenido</p>
      <p className="text-sm md:text-base font-semibold text-white mt-0.5">
        Hola, {payload.name}. {payload.line}
      </p>
    </section>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface DashboardClientProps {
  initialData?: DashboardSummary | null
}

interface QuickLinkCardProps {
  title: string
  value: string
  hint: string
  href: string
  tone: 'emerald' | 'amber' | 'violet' | 'cyan'
  icon: ReactNode
}

const QUICK_LINK_TONE: Record<QuickLinkCardProps['tone'], { value: string; icon: string; border: string }> = {
  emerald: { value: 'text-emerald-300', icon: 'text-emerald-300 bg-emerald-500/14', border: 'from-emerald-400/60' },
  amber:   { value: 'text-amber-300',   icon: 'text-amber-300 bg-amber-500/14',     border: 'from-amber-400/60' },
  violet:  { value: 'text-violet-300',  icon: 'text-violet-300 bg-violet-500/14',   border: 'from-violet-400/60' },
  cyan:    { value: 'text-cyan-300',    icon: 'text-cyan-300 bg-cyan-500/14',       border: 'from-cyan-400/60' },
}

function QuickLinkCard({ title, value, hint, href, tone, icon }: QuickLinkCardProps) {
  const style = QUICK_LINK_TONE[tone]

  return (
    <Link
      href={href}
      className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3
        transition-all hover:-translate-y-0.5 hover:bg-white/[0.055] hover:border-white/[0.14]"
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${style.border} via-white/15 to-transparent`}/>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/35">{title}</p>
          <p className={`mt-1 text-lg leading-none font-bold tabular-nums ${style.value}`}>{value}</p>
          <p className="mt-1 text-[11px] text-white/30">{hint}</p>
        </div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.icon}`}>
          {icon}
        </span>
      </div>
    </Link>
  )
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const { summary, isLoading, isRefreshing, error } = useDashboard({ initialData })
  const { preferred, format, exchangeRate }         = useCurrency()
  const [updatedAtLabel, setUpdatedAtLabel] = useState('--:--')

  const s = summary
  const safeExchangeRate = Math.max(exchangeRate || s?.meta.exchangeRateUsdPen || 1, 0.0001)
  const secondaryCurrency = preferred === 'PEN' ? 'USD' : 'PEN'
  const formatDual = (amountPen: number) => {
    const normalized = Number.isFinite(amountPen) ? amountPen : 0
    const primary = formatCurrency(format(normalized), preferred)
    const secondaryAmount = preferred === 'PEN'
      ? normalized / safeExchangeRate
      : normalized

    return {
      primary,
      secondary: formatCurrency(secondaryAmount, secondaryCurrency),
    }
  }

  const monthLabel = s?.meta.currentMonth
    ? new Date(`${s.meta.currentMonth}-01T00:00:00`).toLocaleDateString('es-PE', {
        month: 'long',
        year: 'numeric',
      })
    : 'Mes actual'
  const alertCount =
    (s?.upcomingInstallments.length ?? 0) +
    (s?.receivables.items.length ?? 0) +
    (s?.payables.items.length ?? 0)
  const overdueCount =
    (s?.upcomingInstallments.filter(i => i.urgency === 'OVERDUE').length ?? 0) +
    (s?.receivables.items.filter(i => i.urgency === 'OVERDUE').length ?? 0) +
    (s?.payables.items.filter(i => i.urgency === 'OVERDUE').length ?? 0)
  const hasAccounts = (s?.accounts.length ?? 0) > 0
  const hasCredits = (s?.credits.length ?? 0) > 0
  const hasAssets = (s?.assets.count ?? 0) > 0
  const hasOpenItems = ((s?.receivables.count ?? 0) + (s?.payables.count ?? 0)) > 0
  const hasTransactions =
    (s?.cashFlow6m.some(point => Math.abs(point.incomePen) > 0 || Math.abs(point.expensePen) > 0) ?? false) ||
    Math.abs(s?.currentMonth.incomePen ?? 0) > 0 ||
    Math.abs(s?.currentMonth.expensePen ?? 0) > 0
  const isFirstRun = Boolean(s) && !hasTransactions && !hasCredits && !hasAssets && !hasOpenItems
  const netWorthDisplay = formatDual(s?.netWorth.pen ?? 0)
  const incomeDisplay = formatDual(s?.currentMonth.incomePen ?? 0)
  const expenseDisplay = formatDual(s?.currentMonth.expensePen ?? 0)
  const balanceDisplay = formatDual(s?.currentMonth.netPen ?? 0)

  useEffect(() => {
    const value = s?.meta.calculatedAt
    if (!value) {
      setUpdatedAtLabel('--:--')
      return
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      setUpdatedAtLabel('--:--')
      return
    }

    const nextLabel = new Intl.DateTimeFormat('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date)

    setUpdatedAtLabel(nextLabel.replace(/\s+/g, ' '))
  }, [s?.meta.calculatedAt])

  if (error && !s) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-white/30 text-sm">Error al cargar el dashboard</p>
        <p className="text-white/15 text-xs mt-1">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <WelcomeBanner/>

      {isFirstRun && (
        <FirstRunOnboarding
          hasAccounts={hasAccounts}
          hasTransactions={hasTransactions}
        />
      )}

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="dashboard-hero rounded-2xl border border-white/[0.08] p-5 md:p-6
        bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(8,12,18,0.92),rgba(59,130,246,0.14))]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.11em] text-white/45">
              Balance Consolidado
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mt-1 tabular-nums tracking-tight">
              {netWorthDisplay.primary}
            </h1>
            <p className="text-[12px] text-white/35 mt-1">≈ {netWorthDisplay.secondary}</p>
            <p className="text-[12px] text-white/45 mt-2">
              {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} ·
              {` `}1 USD = {formatNumber(safeExchangeRate, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} PEN
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 min-w-[220px]">
            <Link
              href="/transactions/new"
              className="inline-flex items-center justify-center rounded-lg
              bg-emerald-500 text-black text-xs font-bold px-3 py-2 hover:bg-emerald-400 transition-colors"
            >
              + Nueva transacción
            </Link>
            <Link
              href="/transactions"
              className="inline-flex items-center justify-center rounded-lg
              border border-white/[0.16] text-white/80 text-xs font-semibold px-3 py-2
              hover:border-white/[0.28] hover:text-white transition-colors"
            >
              Ver movimientos
            </Link>
            <Link
              href="/portfolio"
              className="inline-flex items-center justify-center rounded-lg
              border border-white/[0.16] text-white/80 text-xs font-semibold px-3 py-2
              hover:border-white/[0.28] hover:text-white transition-colors"
            >
              Portafolio
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-lg
              border border-white/[0.16] text-white/80 text-xs font-semibold px-3 py-2
              hover:border-white/[0.28] hover:text-white transition-colors"
            >
              Administración
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/35">Ingresos del mes</p>
            <p className="text-lg font-bold tabular-nums text-emerald-400">
              {incomeDisplay.primary}
            </p>
            <p className="text-[10px] text-white/25 tabular-nums mt-0.5">≈ {incomeDisplay.secondary}</p>
          </div>
          <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/35">Egresos del mes</p>
            <p className="text-lg font-bold tabular-nums text-red-400">
              {expenseDisplay.primary}
            </p>
            <p className="text-[10px] text-white/25 tabular-nums mt-0.5">≈ {expenseDisplay.secondary}</p>
          </div>
          <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/35">Alertas</p>
              {overdueCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5
                  rounded-full text-red-300 bg-red-500/15">
                  <IconAlert/>
                  {overdueCount} vencida{overdueCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <p className="text-lg font-bold tabular-nums text-white/80">{alertCount}</p>
          </div>
        </div>
      </section>

      {/* ── QUICK LINKS ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickLinkCard
          title="Cuentas"
          value={String(s?.accounts.length ?? 0)}
          hint="Portafolios activos"
          href="/portfolio"
          tone="emerald"
          icon={<IconWallet/>}
        />
        <QuickLinkCard
          title="Créditos"
          value={String(s?.credits.length ?? 0)}
          hint="Tarjetas y bancarios"
          href="/credits"
          tone="amber"
          icon={<IconCard/>}
        />
        <QuickLinkCard
          title="Activos"
          value={String(s?.assets.count ?? 0)}
          hint="Bienes registrados"
          href="/assets"
          tone="violet"
          icon={<IconAsset/>}
        />
        <QuickLinkCard
          title="Por cobrar/pagar"
          value={String((s?.receivables.count ?? 0) + (s?.payables.count ?? 0))}
          hint="Pendientes"
          href="/receivables"
          tone="cyan"
          icon={<IconPending/>}
        />
      </section>

      {/* ── FILA 1: KPIs ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Patrimonio neto"
          value={netWorthDisplay.primary}
          subvalue={`≈ ${netWorthDisplay.secondary}`}
          accent="white"
          icon={<IconNetWorth/>}
          loading={isLoading}
        />
        <KpiCard
          label="Ingresos del mes"
          value={incomeDisplay.primary}
          subvalue={`≈ ${incomeDisplay.secondary}`}
          accent="emerald"
          icon={<IconIncome/>}
          loading={isLoading}
        />
        <KpiCard
          label="Egresos del mes"
          value={expenseDisplay.primary}
          subvalue={`≈ ${expenseDisplay.secondary}`}
          accent="red"
          icon={<IconExpense/>}
          loading={isLoading}
        />
        <KpiCard
          label="Balance del mes"
          value={balanceDisplay.primary}
          subvalue={`≈ ${balanceDisplay.secondary}`}
          accent={(s?.currentMonth.netPen ?? 0) >= 0 ? 'emerald' : 'red'}
          icon={<IconBalance/>}
          loading={isLoading}
        />
      </section>

      {/* ── FILA 2: Cash flow + Categorías ────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CashFlowChart
            data={s?.cashFlow6m}
            loading={isLoading}
          />
        </div>
        <div>
          <ExpenseBreakdown
            categories={s?.topExpenseCategories}
            loading={isLoading}
          />
        </div>
      </section>

      {/* ── FILA 3: Cuentas + Créditos + Activos ──────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AccountsWidget
          accounts={s?.accounts}
          loading={isLoading}
        />
        <CreditsWidget
          credits={s?.credits}
          loading={isLoading}
        />
        <AssetsWidget
          assets={s?.assets}
          loading={isLoading}
        />
      </section>

      {/* ── FILA 4: Alertas + Por cobrar/pagar ────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertsWidget
          installments={s?.upcomingInstallments}
          receivables={s?.receivables}
          payables={s?.payables}
          loading={isLoading}
        />
        <ReceivablesPayablesWidget
          receivables={s?.receivables}
          payables={s?.payables}
          loading={isLoading}
        />
      </section>

      {/* Meta info */}
      {s?.meta && (
        <p className="text-[10px] text-white/15 text-right">
          Actualizado: {updatedAtLabel} · 1 USD = {formatNumber(safeExchangeRate, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} PEN
        </p>
      )}

      {/* Refreshing indicator */}
      {isRefreshing && <RefreshingDot/>}
    </div>
  )
}
