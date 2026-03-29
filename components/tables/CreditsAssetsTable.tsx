'use client'

// =============================================================================
// components/tables/CreditsTable.tsx + AssetsTable.tsx
// Listados de créditos y activos.
// =============================================================================

import Link                    from 'next/link'
import { useRouter }           from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { useCredits, useAssets } from '@/lib/hooks/useModules'
import { useCurrency }         from '@/lib/hooks/useDashboard'
import { formatCurrency, formatPercent, toPenAmount } from '@/lib/contracts/ui.contracts'
import { FocusTrap } from '@/components/ui/accessibility'
import {
  TableShell,
  Toolbar,
  SearchInput,
  FilterPill,
  SortSelect,
  Th, Td,
  SkeletonRows,
  EmptyState,
  StatusBadge,
  RowActions,
  ProgressBar,
  DateCell,
}                              from './primitives'
import type { CreditStatus, AssetStatus } from '@/types/database.types'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const CREDIT_STATUS_MAP: Record<CreditStatus, { label: string; variant: 'active' | 'closed' | 'error' }> = {
  ACTIVE:  { label: 'Activo',  variant: 'active'  },
  CLOSED:  { label: 'Cerrado', variant: 'closed'  },
  BLOCKED: { label: 'Bloqueado', variant: 'error' },
}

const ASSET_STATUS_MAP: Record<AssetStatus, { label: string; variant: 'active' | 'closed' | 'warning' }> = {
  ACTIVE:      { label: 'Activo',     variant: 'active'  },
  SOLD:        { label: 'Vendido',    variant: 'closed'  },
  DEPRECIATED: { label: 'Depreciado', variant: 'warning' },
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  REAL_ESTATE: 'Inmueble',
  VEHICLE:     'Vehículo',
  EQUIPMENT:   'Equipo',
  INVESTMENT:  'Inversión',
  OTHER:       'Otro',
}

function utilizationColor(pct: number): string {
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#f97316'
  if (pct >= 50) return '#eab308'
  return '#10b981'
}

function formatFriendlyDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function installmentStatusMeta(status: string): {
  label: string
  classes: string
  dotClass: string
} {
  if (status === 'PAID') {
    return {
      label: 'Pagada',
      classes: 'bg-emerald-500/12 text-emerald-400 border border-emerald-400/25',
      dotClass: 'bg-emerald-400',
    }
  }
  if (status === 'OVERDUE') {
    return {
      label: 'Vencida',
      classes: 'bg-red-500/12 text-red-400 border border-red-400/25',
      dotClass: 'bg-red-400',
    }
  }
  if (status === 'PARTIAL') {
    return {
      label: 'Parcial',
      classes: 'bg-amber-500/12 text-amber-400 border border-amber-400/25',
      dotClass: 'bg-amber-400',
    }
  }

  return {
    label: 'Pendiente',
    classes: 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[color:var(--color-border)]',
    dotClass: 'bg-[var(--color-text-faint)]',
  }
}

function installmentAmountClass(status: string): string {
  if (status === 'PAID') return 'text-emerald-400'
  if (status === 'OVERDUE') return 'text-red-400'
  if (status === 'PARTIAL') return 'text-amber-400'
  return 'text-cyan-300'
}

function billingStatusMeta(status: 'PAID' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING'): { label: string; classes: string } {
  if (status === 'PAID') {
    return { label: 'Pagado', classes: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25' }
  }
  if (status === 'OVERDUE') {
    return { label: 'Vencido', classes: 'bg-red-500/15 text-red-300 border border-red-400/25' }
  }
  if (status === 'DUE_SOON') {
    return { label: 'Por vencer', classes: 'bg-amber-500/15 text-amber-300 border border-amber-400/25' }
  }
  return { label: 'Pendiente', classes: 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/25' }
}

const WEEK_DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

function currentMonthKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function monthKeyFromIsoDate(isoDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate.slice(0, 7)
  }
  return currentMonthKey()
}

function monthLabel(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey
  }
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function moveMonth(monthKey: string, delta: number): string {
  const [yearRaw, monthRaw] = monthKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return currentMonthKey()

  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  const nextYear = date.getUTCFullYear()
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${nextYear}-${nextMonth}`
}

function buildMonthGrid(monthKey: string): Array<{ isoDate: string; dayNumber: number; inMonth: boolean }> {
  const [yearRaw, monthRaw] = monthKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return []

  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const firstDayWeek = (firstDay.getUTCDay() + 6) % 7
  const startDate = new Date(Date.UTC(year, month - 1, 1 - firstDayWeek))

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate)
    date.setUTCDate(startDate.getUTCDate() + index)
    const isoDate = date.toISOString().slice(0, 10)
    return {
      isoDate,
      dayNumber: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
    }
  })
}

// =============================================================================
// CREDITS TABLE
// =============================================================================

export function CreditsTable() {
  const router = useRouter()
  const { preferred, format } = useCurrency()
  const [activeStatus, setActiveStatus] = useState<string>('ACTIVE')
  const [activeType, setActiveType]     = useState<'all' | 'CREDIT_CARD' | 'LINE_OF_CREDIT'>('all')
  const [search, setSearch]             = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'OVERVIEW' | 'MOVEMENTS' | 'SCHEDULE'>('OVERVIEW')
  const [scheduleMonth, setScheduleMonth] = useState<string>(currentMonthKey())
  const [selectedCycleKey, setSelectedCycleKey] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<{
    credit: {
      id: string
      name: string
      credit_type: 'CREDIT_CARD' | 'LINE_OF_CREDIT'
      currency: 'PEN' | 'USD'
      credit_limit: number
      used_amount: number
      available_amount: number
      interest_rate: number
      status: string
      closing_day: number | null
      payment_day: number | null
    }
    installments: Array<{
      id: string
      installment_number: number
      due_date: string
      principal_amount: number
      interest_amount: number
      total_amount: number
      status: string
    }>
    movements: {
      consumptions: Array<{ id: string; description: string; amount: number; currency: 'PEN' | 'USD'; transaction_date: string }>
      payments: Array<{ id: string; description: string; amount: number; currency: 'PEN' | 'USD'; transaction_date: string }>
      billing_cycles: Array<{
        key: string
        start_date: string
        end_date: string
        due_date: string
        consumption_total: number
        payment_total: number
        balance_due: number
        status: 'PAID' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING'
        consumptions: Array<{ id: string; description: string; amount: number; currency: 'PEN' | 'USD'; transaction_date: string }>
        payments: Array<{ id: string; description: string; amount: number; currency: 'PEN' | 'USD'; transaction_date: string }>
      }>
    }
    summary: {
      used_amount: number
      available_amount: number
      credit_limit: number
      consumption_total_detected: number
      payment_total_detected: number
      paid_installments: number
      total_installments: number
    }
  } | null>(null)

  const { credits, isLoading, isEmpty, setFilters } = useCredits({
    status: activeStatus || undefined,
  })

  useEffect(() => {
    setFilters({ status: activeStatus || undefined })
  }, [activeStatus, setFilters])

  const filtered = credits.filter(c => {
    const matchesType = activeType === 'all' || c.credit_type === activeType
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesSearch
  })

  const openDetail = async (creditId: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailData(null)
    setDetailTab('OVERVIEW')

    try {
      const response = await fetch(`/api/credits/${creditId}`, { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? 'No se pudo cargar el detalle del crédito')
      }
      setDetailData(json.data)
      const installments = Array.isArray(json.data?.installments)
        ? (json.data.installments as Array<{ due_date?: string; status?: string }>)
        : []
      const nextDueDate = installments.find(item => item.status !== 'PAID')?.due_date
        ?? installments[0]?.due_date
      setScheduleMonth(nextDueDate ? monthKeyFromIsoDate(nextDueDate) : currentMonthKey())
      const billingCycles = Array.isArray(json.data?.movements?.billing_cycles)
        ? (json.data.movements.billing_cycles as Array<{ key?: string }>)
        : []
      setSelectedCycleKey(billingCycles[0]?.key ?? null)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo cargar el detalle del crédito'
      setDetailError(message)
    } finally {
      setDetailLoading(false)
    }
  }

  const utilizationPct = detailData
    ? (detailData.summary.credit_limit > 0
      ? Math.min((detailData.summary.used_amount / detailData.summary.credit_limit) * 100, 100)
      : 0)
    : 0

  const nextInstallment = detailData?.installments.find(item => item.status !== 'PAID') ?? null

  const activeScheduleMonth = scheduleMonth || currentMonthKey()
  const monthGrid = useMemo(
    () => buildMonthGrid(activeScheduleMonth),
    [activeScheduleMonth]
  )
  const installmentsByDate = useMemo(() => {
    const map = new Map<string, Array<{
      id: string
      installment_number: number
      due_date: string
      principal_amount: number
      interest_amount: number
      total_amount: number
      status: string
    }>>()

    if (!detailData?.installments) return map

    detailData.installments.forEach(item => {
      const list = map.get(item.due_date) ?? []
      list.push(item)
      map.set(item.due_date, list)
    })
    return map
  }, [detailData])
  const monthInstallments = useMemo(
    () => detailData?.installments.filter(item => monthKeyFromIsoDate(item.due_date) === activeScheduleMonth) ?? [],
    [activeScheduleMonth, detailData]
  )
  const monthOverdueCount = useMemo(
    () => monthInstallments.filter(item => item.status === 'OVERDUE').length,
    [monthInstallments]
  )
  const monthTotalAmount = useMemo(
    () => monthInstallments.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0),
    [monthInstallments]
  )

  const closeDetailModal = () => {
    setDetailOpen(false)
    setDetailData(null)
    setDetailError(null)
    setDetailTab('OVERVIEW')
    setScheduleMonth(currentMonthKey())
    setSelectedCycleKey(null)
  }

  const billingCycles = useMemo(
    () => detailData?.movements.billing_cycles ?? [],
    [detailData]
  )
  const selectedCycle = useMemo(
    () => billingCycles.find(item => item.key === selectedCycleKey) ?? billingCycles[0] ?? null,
    [billingCycles, selectedCycleKey]
  )
  const movementConsumptions = selectedCycle ? selectedCycle.consumptions : detailData?.movements.consumptions ?? []
  const movementPayments = selectedCycle ? selectedCycle.payments : detailData?.movements.payments ?? []

  return (
    <>
    <TableShell>
      <Toolbar>
        <FilterPill label="Activos"   active={activeStatus === 'ACTIVE'}  onClick={() => setActiveStatus('ACTIVE')}  color="#10b981"/>
        <FilterPill label="Todos"     active={activeStatus === ''}        onClick={() => setActiveStatus('')}/>
        <FilterPill label="Cerrados"  active={activeStatus === 'CLOSED'}  onClick={() => setActiveStatus('CLOSED')}  color="#6b7280"/>
        <div className="mx-1 h-5 w-px bg-white/[0.08]"/>
        <FilterPill label="Tarjetas" active={activeType === 'CREDIT_CARD'} onClick={() => setActiveType('CREDIT_CARD')} color="#0ea5e9"/>
        <FilterPill label="Bancarios" active={activeType === 'LINE_OF_CREDIT'} onClick={() => setActiveType('LINE_OF_CREDIT')} color="#f59e0b"/>
        <FilterPill label="Ambos" active={activeType === 'all'} onClick={() => setActiveType('all')}/>
        <div className="flex-1"/>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar créditos…"/>
      </Toolbar>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Tipo</Th>
              <Th className="hidden sm:table-cell">Uso</Th>
              <Th right className="hidden md:table-cell">Límite</Th>
              <Th right>Disponible</Th>
              <Th className="hidden lg:table-cell">Tasa</Th>
              <Th>Estado</Th>
              <Th className="w-20"/>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows cols={8} rows={5}/>
            ) : isEmpty || filtered.length === 0 ? (
              <EmptyState
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/></svg>}
                title="Sin créditos"
                description="Registra tarjetas de crédito o créditos bancarios desde este módulo."
                action={
                  <Link
                    href="/credits#nuevo-credito"
                    className="btn-primary text-xs px-4 py-2"
                  >
                    Registrar crédito
                  </Link>
                }
              />
            ) : (
              filtered.map(credit => {
                const utilPct = credit.credit_limit > 0
                  ? (credit.used_amount / credit.credit_limit) * 100
                  : 0
                const status  = CREDIT_STATUS_MAP[credit.status] ?? { label: credit.status, variant: 'closed' as const }

                return (
                  <tr key={credit.id} className="group/row hover:bg-white/[0.02] transition-colors">
                    <Td>
                      <p className="text-sm font-semibold text-[var(--color-text)]">{credit.name}</p>
                    </Td>
                    <Td muted>
                        <span className="text-[11px]">
                        {credit.credit_type === 'CREDIT_CARD' ? 'Tarjeta de crédito' : 'Crédito bancario'}
                      </span>
                    </Td>
                    <Td className="hidden sm:table-cell min-w-[120px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
                          <span>{formatPercent(utilPct, { fractionDigits: 0 })} usado</span>
                        </div>
                        <ProgressBar value={utilPct} color={utilizationColor(utilPct)} height={4}/>
                      </div>
                    </Td>
                    <Td right muted className="hidden md:table-cell">
                        <span className="text-[12px] tabular-nums">
                        {formatCurrency(format(credit.credit_limit), preferred)}
                      </span>
                    </Td>
                    <Td right>
                      <span className="text-sm font-bold tabular-nums text-emerald-400">
                        {formatCurrency(format(credit.available_amount ?? 0), preferred)}
                      </span>
                    </Td>
                    <Td muted className="hidden lg:table-cell">
                      <span className="text-[12px] tabular-nums">
                        {formatPercent(credit.interest_rate, { fractionDigits: 2 })}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge
                        label={status.label}
                        variant={status.variant as Parameters<typeof StatusBadge>[0]['variant']}
                      />
                    </Td>
                    <Td>
                      <RowActions actions={[
                        {
                          label:   'Ver detalle',
                          onClick: () => { void openDetail(credit.id) },
                        },
                      ]}/>
                    </Td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </TableShell>
    {detailOpen && (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-[color:var(--color-overlay)] px-4 py-6"
        onClick={() => {
          if (!detailLoading) closeDetailModal()
        }}
      >
        <FocusTrap active={detailOpen}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-5xl rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-modal-bg)] shadow-2xl shadow-[color:var(--color-shadow)]"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text)]">
                  {detailData ? detailData.credit.name : 'Detalle de crédito'}
                </h3>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {detailData?.credit.credit_type === 'CREDIT_CARD'
                    ? 'Tarjeta de crédito: consumos, pagos y disponibilidad'
                    : 'Crédito bancario: cuotas, pagos y seguimiento'}
                </p>
                {detailData && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      detailData.credit.credit_type === 'CREDIT_CARD'
                        ? 'bg-sky-500/15 text-sky-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}>
                      {detailData.credit.credit_type === 'CREDIT_CARD' ? 'Tarjeta de crédito' : 'Crédito bancario'}
                    </span>
                    {detailData.credit.closing_day && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[color:var(--color-border)]">
                        Corte: día {detailData.credit.closing_day}
                      </span>
                    )}
                    {detailData.credit.payment_day && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[color:var(--color-border)]">
                        Pago: día {detailData.credit.payment_day}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                className="rounded-lg border border-[color:var(--color-border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Cerrar
              </button>
            </div>

            <div className="border-b border-[color:var(--color-border)] px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailTab('OVERVIEW')}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    detailTab === 'OVERVIEW'
                      ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300'
                      : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                  }`}
                >
                  Resumen
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('MOVEMENTS')}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    detailTab === 'MOVEMENTS'
                      ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-300'
                      : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                  }`}
                >
                  Movimientos
                </button>
                {detailData?.installments.length ? (
                  <button
                    type="button"
                    onClick={() => setDetailTab('SCHEDULE')}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      detailTab === 'SCHEDULE'
                        ? 'border-amber-400/35 bg-amber-500/15 text-amber-300'
                        : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    Cronograma
                  </button>
                ) : null}
              </div>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 py-4 space-y-4">
              {detailLoading && (
                <p className="text-sm text-[var(--color-text-muted)]">Cargando detalle...</p>
              )}
              {detailError && (
                <p className="text-sm text-red-400">{detailError}</p>
              )}

              {detailData && (
                <>
                  {detailTab === 'OVERVIEW' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Límite</p>
                          <p className="text-lg font-bold text-[var(--color-text)] mt-1 tabular-nums">
                            {formatCurrency(detailData.summary.credit_limit, detailData.credit.currency)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Gastado actual</p>
                          <p className="text-lg font-bold text-rose-400 mt-1 tabular-nums">
                            {formatCurrency(detailData.summary.used_amount, detailData.credit.currency)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Pagado identificado</p>
                          <p className="text-lg font-bold text-emerald-400 mt-1 tabular-nums">
                            {formatCurrency(detailData.summary.payment_total_detected, detailData.credit.currency)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Disponible</p>
                          <p className="text-lg font-bold text-cyan-300 mt-1 tabular-nums">
                            {formatCurrency(detailData.summary.available_amount, detailData.credit.currency)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                            Utilización del crédito
                          </p>
                          <span className="text-[11px] font-semibold text-[var(--color-text-muted)] tabular-nums">
                            {formatPercent(utilizationPct, { fractionDigits: 1 })}
                          </span>
                        </div>
                        <div className="mt-2">
                          <ProgressBar value={utilizationPct} color={utilizationColor(utilizationPct)} height={8}/>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] mb-2">Actividad detectada</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2">
                              <p className="text-[10px] text-[var(--color-text-muted)]">Consumos</p>
                              <p className="text-sm font-bold text-rose-400 tabular-nums mt-0.5">
                                {formatCurrency(detailData.summary.consumption_total_detected, detailData.credit.currency)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2">
                              <p className="text-[10px] text-[var(--color-text-muted)]">Pagos</p>
                              <p className="text-sm font-bold text-emerald-400 tabular-nums mt-0.5">
                                {formatCurrency(detailData.summary.payment_total_detected, detailData.credit.currency)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] mb-2">Próximo hito</p>
                          {nextInstallment ? (
                            <div className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2">
                              <p className="text-[12px] font-semibold text-[var(--color-text)]">
                                Cuota #{nextInstallment.installment_number}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                Vence: {formatFriendlyDate(nextInstallment.due_date)}
                              </p>
                              <p className="text-[13px] font-bold text-[var(--color-text)] mt-1 tabular-nums">
                                {formatCurrency(nextInstallment.total_amount, detailData.credit.currency)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-[12px] text-[var(--color-text-muted)]">
                              No hay cuotas pendientes por ahora.
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {detailTab === 'MOVEMENTS' && (
                    <div className="space-y-3">
                      {detailData.credit.credit_type === 'CREDIT_CARD' && billingCycles.length > 0 && (
                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Ciclos de facturación</p>
                            <span className="text-[11px] text-[var(--color-text-muted)]">
                              Corte día {detailData.credit.closing_day ?? '—'} · Pago día {detailData.credit.payment_day ?? '—'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {billingCycles.slice(0, 6).map(cycle => {
                              const status = billingStatusMeta(cycle.status)
                              const active = cycle.key === selectedCycle?.key
                              return (
                                <button
                                  key={cycle.key}
                                  type="button"
                                  onClick={() => setSelectedCycleKey(cycle.key)}
                                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                                    active
                                      ? 'border-emerald-400/35 bg-emerald-500/10'
                                      : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] hover:border-[color:var(--color-border-hover)]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[12px] font-semibold text-[var(--color-text)] capitalize">
                                      {monthLabel(monthKeyFromIsoDate(cycle.end_date))}
                                    </p>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.classes}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                                    Cierra {formatFriendlyDate(cycle.end_date)} · vence {formatFriendlyDate(cycle.due_date)}
                                  </p>
                                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                                    <span className="text-rose-400">{formatCurrency(cycle.consumption_total, detailData.credit.currency)}</span>
                                    <span className="text-emerald-400">{formatCurrency(cycle.payment_total, detailData.credit.currency)}</span>
                                    <span className={cycle.balance_due > 0 ? 'text-amber-300' : 'text-[var(--color-text-muted)]'}>
                                      {formatCurrency(cycle.balance_due, detailData.credit.currency)}
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Consumos detectados</p>
                          <span className="text-[11px] font-semibold text-rose-400 tabular-nums">
                            {formatCurrency(selectedCycle?.consumption_total ?? detailData.summary.consumption_total_detected, detailData.credit.currency)}
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {movementConsumptions.length === 0 ? (
                            <p className="text-[12px] text-[var(--color-text-muted)]">Sin consumos detectados.</p>
                          ) : movementConsumptions.map(item => (
                            <button
                              key={item.id}
                              onClick={() => router.push(`/transactions/${item.id}`)}
                              className="w-full rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2 text-left hover:border-[color:var(--color-border-hover)] transition-colors"
                            >
                              <p className="text-[12px] font-semibold text-[var(--color-text)] truncate">{item.description}</p>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-[10px] text-[var(--color-text-muted)]">{formatFriendlyDate(item.transaction_date)}</span>
                                <span className="text-[12px] font-bold text-rose-400 tabular-nums">
                                  {formatCurrency(item.amount, item.currency)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Pagos detectados</p>
                          <span className="text-[11px] font-semibold text-emerald-400 tabular-nums">
                            {formatCurrency(selectedCycle?.payment_total ?? detailData.summary.payment_total_detected, detailData.credit.currency)}
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {movementPayments.length === 0 ? (
                            <p className="text-[12px] text-[var(--color-text-muted)]">Sin pagos detectados aún.</p>
                          ) : movementPayments.map(item => (
                            <button
                              key={item.id}
                              onClick={() => router.push(`/transactions/${item.id}`)}
                              className="w-full rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2 text-left hover:border-[color:var(--color-border-hover)] transition-colors"
                            >
                              <p className="text-[12px] font-semibold text-[var(--color-text)] truncate">{item.description}</p>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-[10px] text-[var(--color-text-muted)]">{formatFriendlyDate(item.transaction_date)}</span>
                                <span className="text-[12px] font-bold text-emerald-400 tabular-nums">
                                  {formatCurrency(item.amount, item.currency)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    </div>
                  )}

                  {detailTab === 'SCHEDULE' && (
                    detailData.installments.length > 0 ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Cronograma mensual</p>
                            <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
                              {detailData.summary.paid_installments}/{detailData.summary.total_installments} pagadas
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setScheduleMonth(prev => moveMonth(prev, -1))}
                              className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                            >
                              Anterior
                            </button>
                            <p className="text-sm font-semibold text-[var(--color-text)] capitalize">
                              {monthLabel(activeScheduleMonth)}
                            </p>
                            <button
                              type="button"
                              onClick={() => setScheduleMonth(prev => moveMonth(prev, 1))}
                              className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                            >
                              Siguiente
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2">
                              <p className="text-[10px] text-[var(--color-text-muted)]">Cuotas del mes</p>
                              <p className="text-sm font-bold text-[var(--color-text)] tabular-nums mt-0.5">{monthInstallments.length}</p>
                            </div>
                            <div className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2">
                              <p className="text-[10px] text-[var(--color-text-muted)]">Monto del mes</p>
                              <p className="text-sm font-bold text-[var(--color-text)] tabular-nums mt-0.5">
                                {formatCurrency(monthTotalAmount, detailData.credit.currency)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2">
                              <p className="text-[10px] text-[var(--color-text-muted)]">Vencidas del mes</p>
                              <p className="text-sm font-bold text-red-400 tabular-nums mt-0.5">{monthOverdueCount}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3 overflow-x-auto">
                          <div className="min-w-[760px]">
                            <div className="grid grid-cols-7 gap-2 mb-2">
                              {WEEK_DAYS.map(day => (
                                <div key={day} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] text-center">
                                  {day}
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                              {monthGrid.map(cell => {
                                const dayInstallments = installmentsByDate.get(cell.isoDate) ?? []
                                const dayTotal = dayInstallments.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0)
                                const hasEvents = dayInstallments.length > 0

                                return (
                                  <div
                                    key={cell.isoDate}
                                    className={`min-h-[98px] rounded-lg border p-2 transition-colors ${
                                      cell.inMonth
                                        ? 'border-[color:var(--color-border)] bg-[var(--color-surface-2)]'
                                        : 'border-[color:var(--color-border)] bg-[var(--color-surface)] opacity-55'
                                    } ${hasEvents ? 'ring-1 ring-emerald-400/20' : ''}`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={`text-[11px] font-semibold ${cell.inMonth ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {cell.dayNumber}
                                      </span>
                                      {hasEvents && (
                                        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] tabular-nums">
                                          {dayInstallments.length}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1.5 space-y-1">
                                      {dayInstallments.slice(0, 2).map(item => {
                                        return (
                                          <div key={item.id} className="rounded-md border border-[color:var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1">
                                            <p className="text-[10px] font-semibold text-[var(--color-text)] truncate">
                                              Cuota #{item.installment_number}
                                            </p>
                                            <p className={`text-[10px] font-semibold ${installmentAmountClass(item.status)}`}>
                                              {formatCurrency(item.total_amount, detailData.credit.currency)}
                                            </p>
                                          </div>
                                        )
                                      })}
                                      {dayInstallments.length > 2 && (
                                        <p className="text-[10px] text-[var(--color-text-muted)]">
                                          +{dayInstallments.length - 2} mas
                                        </p>
                                      )}
                                      {hasEvents && (
                                        <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                                          Total: {formatCurrency(dayTotal, detailData.credit.currency)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] mb-2">
                            Cuotas de {monthLabel(activeScheduleMonth)}
                          </p>
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {monthInstallments.length === 0 ? (
                              <p className="text-[12px] text-[var(--color-text-muted)]">
                                No hay cuotas registradas para este mes.
                              </p>
                            ) : monthInstallments.map(item => {
                              const meta = installmentStatusMeta(item.status)
                              return (
                                <div key={item.id} className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[12px] font-semibold text-[var(--color-text)]">
                                      Cuota #{item.installment_number}
                                    </p>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.classes}`}>
                                      {meta.label}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                                    Vence: <strong className="text-[var(--color-text)]">{formatFriendlyDate(item.due_date)}</strong>
                                  </p>
                                  <p className="mt-1 text-[12px] font-bold text-[var(--color-text)] tabular-nums">
                                    Total: {formatCurrency(item.total_amount, detailData.credit.currency)}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
                        <p className="text-sm font-semibold text-[var(--color-text)]">Sin cronograma disponible</p>
                        <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
                          Este crédito no tiene cuotas registradas.
                        </p>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </FocusTrap>
      </div>
    )}
    </>
  )
}

// =============================================================================
// ASSETS TABLE
// =============================================================================

export function AssetsTable() {
  const router = useRouter()
  const { preferred, format, exchangeRate } = useCurrency()
  const [activeStatus, setActiveStatus] = useState<string>('ACTIVE')
  const [search, setSearch]             = useState('')

  const { assets, isLoading, isEmpty, setFilters } = useAssets({
    status: activeStatus || undefined,
  })

  useEffect(() => {
    setFilters({ status: activeStatus || undefined })
  }, [activeStatus, setFilters])

  const filtered = search
    ? assets.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.asset_type.toLowerCase().includes(search.toLowerCase())
      )
    : assets

  const totalValue = filtered.reduce((s, a) => {
    const pen = toPenAmount(a.current_value, a.currency, exchangeRate)
    return s + pen
  }, 0)

  return (
    <TableShell>
      <Toolbar>
        <FilterPill label="Activos"     active={activeStatus === 'ACTIVE'}  onClick={() => setActiveStatus('ACTIVE')}  color="#8b5cf6"/>
        <FilterPill label="Todos"       active={activeStatus === ''}        onClick={() => setActiveStatus('')}/>
        <FilterPill label="Vendidos"    active={activeStatus === 'SOLD'}    onClick={() => setActiveStatus('SOLD')}    color="#6b7280"/>
        <div className="flex-1"/>
        {totalValue > 0 && (
          <span className="text-[11px] text-white/25 tabular-nums hidden sm:inline">
            Total: <strong className="text-purple-400">
              {formatCurrency(format(totalValue), preferred)}
            </strong>
          </span>
        )}
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar activos…"/>
      </Toolbar>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Tipo</Th>
              <Th right className="hidden md:table-cell">Valor compra</Th>
              <Th right>Valor actual</Th>
              <Th className="hidden sm:table-cell">Fecha compra</Th>
              <Th>Estado</Th>
              <Th className="w-20"/>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows cols={7} rows={5}/>
            ) : isEmpty || filtered.length === 0 ? (
              <EmptyState
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 2 9 4.9V17L12 22 3 17V6.9L12 2Z"/></svg>}
                title="Sin activos"
                description="Los activos se crean al registrar un egreso de tipo activo."
                action={
                  <Link
                    href="/transactions/new?type=EXPENSE&module=asset"
                    className="btn-primary text-xs px-4 py-2"
                  >
                    Registrar activo desde transacción
                  </Link>
                }
              />
            ) : (
              filtered.map(asset => {
                const valuePen    = toPenAmount(asset.current_value, asset.currency, exchangeRate)
                const purchasePen = toPenAmount(asset.purchase_value, asset.currency, exchangeRate)
                const gainPct     = purchasePen > 0
                  ? ((valuePen - purchasePen) / purchasePen) * 100
                  : 0
                const status      = ASSET_STATUS_MAP[asset.status] ?? { label: asset.status, variant: 'closed' as const }

                return (
                  <tr key={asset.id} className="group/row hover:bg-white/[0.02] transition-colors">
                    <Td>
                      <p className="text-sm text-white/80 font-medium">{asset.name}</p>
                      {asset.location && (
                        <p className="text-[10px] text-white/25 mt-0.5">{asset.location}</p>
                      )}
                    </Td>
                    <Td muted>
                      <span className="text-[12px]">
                        {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
                      </span>
                    </Td>
                    <Td right muted className="hidden md:table-cell">
                      <span className="text-[12px] tabular-nums">
                        {formatCurrency(format(purchasePen), preferred)}
                      </span>
                    </Td>
                    <Td right>
                      <div>
                        <p className="text-sm font-bold tabular-nums text-purple-400">
                          {formatCurrency(format(valuePen), preferred)}
                        </p>
                        {Math.abs(gainPct) > 0.5 && (
                          <p className={`text-[10px] tabular-nums ${gainPct >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                            {formatPercent(gainPct, { fractionDigits: 1, signed: true })}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td muted className="hidden sm:table-cell">
                      <DateCell date={asset.purchase_date}/>
                    </Td>
                    <Td>
                      <StatusBadge
                        label={status.label}
                        variant={status.variant as Parameters<typeof StatusBadge>[0]['variant']}
                      />
                    </Td>
                    <Td>
                      <RowActions actions={[
                        {
                          label:   'Ver',
                          onClick: () => router.push(`/assets/${asset.id}`),
                        },
                      ]}/>
                    </Td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </TableShell>
  )
}
