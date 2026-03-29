// =============================================================================
// components/dashboard/widgets/AlertsWidget.tsx
// Widget de vencimientos próximos y alertas financieras.
// Consolida cuotas vencidas, por cobrar y por pagar en una sola vista.
// =============================================================================

'use client'

import Link                           from 'next/link'
import { useState }                   from 'react'
import { useCurrency }                from '@/lib/hooks/useDashboard'
import { formatCurrency, toPenAmount } from '@/lib/contracts/ui.contracts'
import {
  WidgetShell,
  SectionHeader,
  EmptyWidget,
  UrgencyBadge,
}                                     from '../primitives'
import type {
  UpcomingInstallment,
  ReceivablesSummary,
  PayablesSummary,
}                                     from '@/modules/dashboard/dashboard.types'

// ─── TIPOS UNIFICADOS ─────────────────────────────────────────────────────────

type AlertType = 'installment' | 'receivable' | 'payable'

interface AlertItem {
  id:       string
  type:     AlertType
  label:    string
  amount:   number
  currency: string
  dueDate:  string | null
  urgency:  'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | null
  href:     string
}

// ─── FILTER TABS ─────────────────────────────────────────────────────────────

type TabKey = 'all' | AlertType

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',         label: 'Todo'      },
  { key: 'installment', label: 'Cuotas'    },
  { key: 'receivable',  label: 'Cobrar'    },
  { key: 'payable',     label: 'Pagar'     },
]

// ─── ALERT ROW ────────────────────────────────────────────────────────────────

function AlertRow({
  item,
  formatted,
}: {
  item:      AlertItem
  formatted: string
}) {
  const typeColor = {
    installment: '#f59e0b',
    receivable:  '#06b6d4',
    payable:     '#f97316',
  }[item.type]

  const typeLabel = {
    installment: 'Cuota',
    receivable:  'Por cobrar',
    payable:     'Por pagar',
  }[item.type]

  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 py-3
        border-b border-white/[0.04] last:border-0
        hover:bg-white/[0.02] -mx-5 px-5 transition-colors"
    >
      {/* Dot tipo */}
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
        style={{ backgroundColor: typeColor }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-white/70 font-medium truncate leading-tight">
          {item.label}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-[9px] font-bold uppercase tracking-wide"
            style={{ color: typeColor + 'aa' }}
          >
            {typeLabel}
          </span>
          {item.dueDate && (
            <span className="text-[10px] text-white/25">
              {new Date(item.dueDate + 'T12:00:00').toLocaleDateString('es-PE', {
                day: 'numeric', month: 'short'
              })}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[12px] font-bold tabular-nums text-white/75">{formatted}</span>
        <UrgencyBadge urgency={item.urgency}/>
      </div>
    </Link>
  )
}

// ─── WIDGET PRINCIPAL ─────────────────────────────────────────────────────────

interface AlertsWidgetProps {
  installments?: UpcomingInstallment[]
  receivables?:  ReceivablesSummary
  payables?:     PayablesSummary
  loading?:      boolean
}

export function AlertsWidget({
  installments,
  receivables,
  payables,
  loading,
}: AlertsWidgetProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const { preferred, format, exchangeRate } = useCurrency()

  if (loading) {
    return (
      <WidgetShell>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-36 rounded bg-white/[0.06]"/>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 rounded bg-white/[0.05]" style={{ width: `${55 + i * 8}%` }}/>
              <div className="h-3 w-16 rounded bg-white/[0.06]"/>
            </div>
          ))}
        </div>
      </WidgetShell>
    )
  }

  // Normalizar todos los alertas en un array unificado
  const allAlerts: AlertItem[] = [
    ...(installments ?? []).map(i => ({
      id:       i.id,
      type:     'installment' as AlertType,
      label:    `Cuota ${i.installmentNumber}/${i.totalInstallments} — ${i.creditorName}`,
      amount:   i.totalAmount,
      currency: i.currency,
      dueDate:  i.dueDate,
      urgency:  i.urgency,
      href:     '/credits',
    })),
    ...(receivables?.items ?? []).map(r => ({
      id:       r.id,
      type:     'receivable' as AlertType,
      label:    r.debtorName,
      amount:   r.pendingAmount,
      currency: r.currency,
      dueDate:  r.dueDate,
      urgency:  r.urgency,
      href:     '/receivables',
    })),
    ...(payables?.items ?? []).map(p => ({
      id:       p.id,
      type:     'payable' as AlertType,
      label:    p.creditorName,
      amount:   p.pendingAmount,
      currency: p.currency,
      dueDate:  p.dueDate,
      urgency:  p.urgency,
      href:     '/payables',
    })),
  ].sort((a, b) => {
    // Ordenar: OVERDUE > DUE_SOON > UPCOMING > sin fecha
    const order = { OVERDUE: 0, DUE_SOON: 1, UPCOMING: 2, null: 3 }
    const ao    = order[a.urgency ?? 'null'] ?? 3
    const bo    = order[b.urgency ?? 'null'] ?? 3
    if (ao !== bo) return ao - bo
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.localeCompare(b.dueDate)
  })

  const filtered = activeTab === 'all'
    ? allAlerts
    : allAlerts.filter(a => a.type === activeTab)

  const overdueCount = allAlerts.filter(a => a.urgency === 'OVERDUE').length

  return (
    <WidgetShell>
      <SectionHeader
        title="Vencimientos próximos"
        accent="#ef4444"
        action={
          overdueCount > 0 ? (
            <span className="text-[10px] font-bold text-red-400 bg-red-500/10
              px-2 py-0.5 rounded-full">
              {overdueCount} vencida{overdueCount !== 1 ? 's' : ''}
            </span>
          ) : null
        }
      />

      {/* Tabs */}
      {allAlerts.length > 0 && (
        <div className="flex gap-1 mb-4 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          {TABS.map(tab => {
            const count = tab.key === 'all'
              ? allAlerts.length
              : allAlerts.filter(a => a.type === tab.key).length

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex-1 flex items-center justify-center gap-1
                  py-1.5 rounded-md text-[11px] font-semibold
                  transition-all duration-150
                  ${activeTab === tab.key
                    ? 'bg-white/[0.07] text-white/80'
                    : 'text-white/25 hover:text-white/50'
                  }
                `}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[9px] tabular-nums ${
                    activeTab === tab.key ? 'text-white/50' : 'text-white/20'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyWidget
          message={allAlerts.length === 0 ? 'Sin vencimientos próximos' : 'Sin items en esta categoría'}
          hint={allAlerts.length === 0 ? 'Los próximos 30 días se verán aquí' : undefined}
        />
      ) : (
        <div>
          {filtered.slice(0, 8).map(item => (
            <AlertRow
              key={`${item.type}-${item.id}`}
              item={item}
              formatted={formatCurrency(
                format(toPenAmount(item.amount, item.currency as 'PEN' | 'USD', exchangeRate)),
                preferred
              )}
            />
          ))}
          {filtered.length > 8 && (
            <p className="text-[11px] text-white/25 text-center pt-3">
              +{filtered.length - 8} más
            </p>
          )}
        </div>
      )}
    </WidgetShell>
  )
}
