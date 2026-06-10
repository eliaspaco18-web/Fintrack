'use client'

import { useCallback, useEffect, useState } from 'react'
import { ModalOverlayPortal } from '@/components/ui/ModalOverlayPortal'
import { FocusTrap } from '@/components/ui/accessibility'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { getApiErrorMessage } from '@/lib/api/error-message'
import type { CurrencyCode, BudgetPeriod } from '@/types/database.types'

// ── Types ──────────────────────────────────────────────────────────────────

type BudgetRef = {
  id: string
  name: string
  description: string | null
  currency: CurrencyCode
  period_type: BudgetPeriod
  period_start: string
  period_end: string
  amount: number
  spent_amount: number
  category?: { name: string } | null
}

type TxRow = {
  id: string
  date: string
  portfolio: string | null
  recipient: string | null
  description: string | null
  amount: number
  currency: CurrencyCode
  exchange_rate: number | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  return `${fmt(start)} → ${fmt(end)}`
}

function formatDate(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  budget: BudgetRef
  onClose: () => void
}

export function BudgetDetail({ budget, onClose }: Props) {
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        period_start: budget.period_start,
        period_end: budget.period_end,
      })
      const res = await fetch(`/api/budgets/${budget.id}/transactions?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las transacciones'))
      }
      setTransactions((json.data as TxRow[]) ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las transacciones')
    } finally {
      setLoading(false)
    }
  }, [budget.id, budget.period_start, budget.period_end])

  useEffect(() => {
    void load()
  }, [load])

  const q = query.trim().toLowerCase()
  const filtered = transactions.filter(tx => {
    if (!q) return true
    return (
      (tx.description ?? '').toLowerCase().includes(q) ||
      (tx.portfolio ?? '').toLowerCase().includes(q) ||
      (tx.recipient ?? '').toLowerCase().includes(q)
    )
  })

  // Total gastado en la moneda del presupuesto
  const safeRate = (r: number | null) => (r && r > 0 ? r : 3.7)
  const totalSpent = filtered.reduce((sum, tx) => {
    const amt = Number(tx.amount ?? 0)
    if (tx.currency === budget.currency) return sum + amt
    if (tx.currency === 'USD' && budget.currency === 'PEN') return sum + amt * safeRate(tx.exchange_rate)
    if (tx.currency === 'PEN' && budget.currency === 'USD') return sum + amt / safeRate(tx.exchange_rate)
    return sum + amt
  }, 0)

  return (
    <ModalOverlayPortal className="z-[97]" onClick={onClose}>
      <FocusTrap active onEscape={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-detail-title"
          onClick={event => event.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[var(--c-border)] bg-[var(--c-modal-bg)] shadow-2xl shadow-[color:var(--c-shadow)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-[var(--c-border)]">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--c-text-muted)]">
                Transacciones del período
              </p>
              <h2 id="budget-detail-title" className="mt-0.5 text-base font-bold text-[var(--c-text)] truncate">
                {budget.name}
              </h2>
              {budget.description && (
                <p className="mt-0.5 text-[12px] text-[var(--c-text-muted)]">{budget.description}</p>
              )}
              <p className="mt-1 text-[11px] text-[var(--c-text-faint)]">
                {formatRange(budget.period_start, budget.period_end)}
                {budget.category && ` · ${budget.category.name}`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel"
              className="shrink-0 rounded-lg border border-[var(--c-border)] p-1.5 text-[var(--c-text-muted)] transition-colors hover:border-[var(--c-border-hover)] hover:text-[var(--c-text)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="px-5 py-3 border-b border-[var(--c-border)]">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por descripción, portafolio o destinatario..."
              className="field-base w-full"
            />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {loading ? (
              <p className="text-sm text-[var(--c-text-muted)] py-6 text-center">Cargando transacciones...</p>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-[12px] text-red-400">{error}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-md border border-red-400/35 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-semibold text-[var(--c-text)]">
                  {q ? 'Sin coincidencias' : 'Sin transacciones en este período'}
                </p>
                <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
                  {q
                    ? 'Prueba con otro término de búsqueda.'
                    : 'Registra transacciones de egreso asociadas a este presupuesto.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_120px] gap-3 px-3 text-[10px] uppercase tracking-[0.11em] text-[var(--c-text-faint)]">
                  <span>Fecha</span>
                  <span>Portafolio</span>
                  <span>Destinatario</span>
                  <span>Descripción</span>
                  <span className="text-right">Importe</span>
                </div>

                {filtered.map(tx => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_120px] md:items-center"
                  >
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:hidden">Fecha</p>
                      <p className="text-[12px] text-[var(--c-text-muted)]">{formatDate(tx.date)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:hidden">Portafolio</p>
                      <p className="truncate text-[13px] text-[var(--c-text)]">{tx.portfolio ?? '—'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:hidden">Destinatario</p>
                      <p className="truncate text-[13px] text-[var(--c-text)]">{tx.recipient ?? '—'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:hidden">Descripción</p>
                      <p className="text-[13px] leading-5 text-[var(--c-text)]">{tx.description ?? '—'}</p>
                    </div>
                    <div className="md:text-right">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:hidden">Importe</p>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-red-400">
                        -{formatCurrency(Number(tx.amount ?? 0), tx.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer — total */}
          <div className="border-t border-[var(--c-border)] px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--c-text-muted)]">
                Total gastado ({filtered.length} transacción{filtered.length !== 1 ? 'es' : ''})
              </p>
              <p className="text-lg font-bold tabular-nums text-[var(--c-text)]">
                {formatCurrency(Math.round(totalSpent * 100) / 100, budget.currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--c-text-muted)]">Presupuesto</p>
              <p className="text-sm font-semibold tabular-nums text-[var(--c-text-muted)]">
                {formatCurrency(Number(budget.amount ?? 0), budget.currency)}
              </p>
            </div>
          </div>
        </div>
      </FocusTrap>
    </ModalOverlayPortal>
  )
}
