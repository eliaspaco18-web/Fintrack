// =============================================================================
// components/dashboard/widgets/ReceivablesPayablesWidget.tsx
// Widget compacto de cuentas por cobrar y por pagar.
// Muestra resumen de totales y los próximos items urgentes.
// =============================================================================

'use client'

import Link                       from 'next/link'
import { useCurrency }            from '@/lib/hooks/useDashboard'
import { formatCurrency, toPenAmount } from '@/lib/contracts/ui.contracts'
import {
  WidgetShell,
  SectionHeader,
  EmptyWidget,
  UrgencyBadge,
}                                 from '../primitives'
import type {
  ReceivablesSummary,
  PayablesSummary,
}                                 from '@/modules/dashboard/dashboard.types'

// ─── HALF WIDGET ─────────────────────────────────────────────────────────────
// Mitad del widget — cobrar o pagar

interface HalfProps {
  title:     string
  total:     number
  count:     number
  items:     Array<{
    id:       string
    name:     string
    amount:   number
    dueDate:  string | null
    urgency:  'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | null
  }>
  accent:    string
  emptyMsg:  string
  href:      string
  preferred: 'PEN' | 'USD'
  format:    (n: number) => number
}

function Half({
  title, total, count, items, accent,
  emptyMsg, href, preferred, format,
}: HalfProps) {
  const hasOverdue = items.some(i => i.urgency === 'OVERDUE')

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }}/>
          <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-white/30">
            {title}
          </span>
          {hasOverdue && (
            <span className="text-[8px] font-bold text-red-400 bg-red-500/10
              px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Vencida
            </span>
          )}
        </div>
        <Link href={href}
          className="text-[11px] text-white/20 hover:text-white/45 transition-colors">
          {count > 0 ? `${count} →` : '→'}
        </Link>
      </div>

      {/* Total */}
      <p className="text-lg font-bold tabular-nums mb-3 leading-tight"
        style={{ color: accent }}>
        {formatCurrency(format(total), preferred)}
      </p>

      {/* Items */}
      {items.length === 0 ? (
        <p className="text-[11px] text-white/20">{emptyMsg}</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 3).map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-white/55 truncate flex-1">{item.name}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <UrgencyBadge urgency={item.urgency}/>
                <span className="text-[11px] text-white/50 tabular-nums">
                  {formatCurrency(format(item.amount), preferred)}
                </span>
              </div>
            </div>
          ))}
          {items.length > 3 && (
            <p className="text-[10px] text-white/20">+{items.length - 3} más</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── WIDGET PRINCIPAL ─────────────────────────────────────────────────────────

interface ReceivablesPayablesWidgetProps {
  receivables?: ReceivablesSummary
  payables?:    PayablesSummary
  loading?:     boolean
}

export function ReceivablesPayablesWidget({
  receivables,
  payables,
  loading,
}: ReceivablesPayablesWidgetProps) {
  const { preferred, format, exchangeRate } = useCurrency()

  if (loading) {
    return (
      <WidgetShell>
        <div className="animate-pulse">
          <div className="h-3 w-32 rounded bg-white/[0.06] mb-4"/>
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded bg-white/[0.05]"/>
                <div className="h-6 w-24 rounded bg-white/[0.07]"/>
                <div className="h-3 w-28 rounded bg-white/[0.04]"/>
                <div className="h-3 w-24 rounded bg-white/[0.04]"/>
              </div>
            ))}
          </div>
        </div>
      </WidgetShell>
    )
  }

  const rec = receivables ?? { totalPendingPen: 0, totalPendingUsd: 0, count: 0, items: [] }
  const pay = payables    ?? { totalPendingPen: 0, totalPendingUsd: 0, count: 0, items: [] }

  const netPen = rec.totalPendingPen - pay.totalPendingPen
  const hasAny = rec.count > 0 || pay.count > 0

  return (
    <WidgetShell>
      <SectionHeader title="Posición neta" accent="#06b6d4"/>

      {/* Resumen neto */}
      {hasAny && (
        <div className="mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] text-white/25">Balance neto pendiente</span>
          </div>
          <p className={`text-xl font-bold tabular-nums mt-0.5 ${
            netPen >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {netPen >= 0 ? '+' : ''}{formatCurrency(format(netPen), preferred)}
          </p>
        </div>
      )}

      {/* Dos columnas */}
      <div className="grid grid-cols-2 gap-5">
        <Half
          title="Por cobrar"
          total={preferred === 'PEN' ? rec.totalPendingPen : rec.totalPendingUsd}
          count={rec.count}
          items={rec.items.map(r => ({
            id:      r.id,
            name:    r.debtorName,
            amount:  format(toPenAmount(r.pendingAmount, r.currency as 'PEN' | 'USD', exchangeRate)),
            dueDate: r.dueDate,
            urgency: r.urgency as HalfProps['items'][number]['urgency'],
          }))}
          accent="#06b6d4"
          emptyMsg="Sin pendientes"
          href="/receivables"
          preferred={preferred}
          format={format}
        />
        <Half
          title="Por pagar"
          total={preferred === 'PEN' ? pay.totalPendingPen : pay.totalPendingUsd}
          count={pay.count}
          items={pay.items.map(p => ({
            id:      p.id,
            name:    p.creditorName,
            amount:  format(toPenAmount(p.pendingAmount, p.currency as 'PEN' | 'USD', exchangeRate)),
            dueDate: p.dueDate,
            urgency: p.urgency as HalfProps['items'][number]['urgency'],
          }))}
          accent="#f97316"
          emptyMsg="Sin pendientes"
          href="/payables"
          preferred={preferred}
          format={format}
        />
      </div>
    </WidgetShell>
  )
}
