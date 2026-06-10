'use client'

// =============================================================================
// components/alerts/AlertSummaryBar.tsx
// PRD v3 — Módulo 9: Resumen superior de alertas
// Muestra: total leídas, total no leídas, conteo por tipo (Críticas/Operativas/Sugerencias)
// =============================================================================

import type { AlertRow } from './AlertsWorkspace'

interface AlertSummaryBarProps {
  alerts:    AlertRow[]
  onRefresh: () => void
  refreshing: boolean
}

export function AlertSummaryBar({ alerts, onRefresh, refreshing }: AlertSummaryBarProps) {
  const unread    = alerts.filter(a => !a.is_read).length
  const read      = alerts.filter(a => a.is_read).length
  const critical  = alerts.filter(a => a.alert_type === 'CRITICAL').length
  const operative = alerts.filter(a => a.alert_type === 'OPERATIONAL').length
  const suggest   = alerts.filter(a => a.alert_type === 'SUGGESTION').length

  return (
    <section className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">

        {/* Counters */}
        <div className="flex flex-wrap items-center gap-6">

          {/* No leídas / Leídas */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--c-text-muted)]">No leídas</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-[var(--c-primary)]">{unread}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--c-text-muted)]">Leídas</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-[var(--c-text-faint)]">{read}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden h-10 w-px bg-[var(--c-border)] sm:block" />

          {/* Por tipo */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-red-400/70">Críticas</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-red-400">{critical}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-amber-400/70">Operativas</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-400">{operative}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-sky-400/70">Sugerencias</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-sky-400">{suggest}</p>
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--c-text-muted)] transition-colors hover:border-[var(--c-border-hover)] hover:text-[var(--c-text)] disabled:opacity-50"
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={refreshing ? 'animate-spin' : ''}
          >
            <path d="M23 4v6h-6"/>
            <path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {refreshing ? 'Actualizando...' : 'Actualizar alertas'}
        </button>
      </div>
    </section>
  )
}
