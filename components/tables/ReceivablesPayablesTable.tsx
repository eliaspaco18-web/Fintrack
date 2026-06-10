'use client'

// =============================================================================
// components/tables/ReceivablesPayablesTable.tsx
// Listados de cuentas por cobrar y por pagar.
// Incluyen urgency indicators, partial amounts, overdue highlighting.
// =============================================================================

import { useRouter }                 from 'next/navigation'
import Link                          from 'next/link'
import { useState, useEffect }       from 'react'
import { useReceivables, usePayables } from '@/lib/hooks/useModules'
import { useCurrency }               from '@/lib/hooks/useDashboard'
import { formatCurrency, formatPercent, toPenAmount } from '@/lib/contracts/ui.contracts'
import {
  TableShell,
  Toolbar,
  SearchInput,
  FilterPill,
  Th, Td,
  SkeletonRows,
  EmptyState,
  StatusBadge,
  RowActions,
  DateCell,
  AmountCell,
}                                    from './primitives'
import type { ReceivableStatus, PayableStatus } from '@/types/database.types'

// ─── URGENCY INDICATOR ───────────────────────────────────────────────────────

function UrgencyDot({ dueDate, status }: { dueDate?: string | null; status: string }) {
  if (!dueDate || status === 'COLLECTED' || status === 'PAID') return null

  const today   = new Date()
  const due     = new Date(dueDate + 'T12:00:00')
  const diffMs  = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  let color  = 'bg-white/20'
  let title  = `Vence en ${diffDays} días`

  if (diffDays < 0) {
    color = 'bg-red-500'
    title = `Venció hace ${Math.abs(diffDays)} días`
  } else if (diffDays <= 7) {
    color = 'bg-amber-500'
    title = `Vence en ${diffDays} días`
  }

  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`}
      title={title}
    />
  )
}

// ─── PARTIAL PROGRESS ────────────────────────────────────────────────────────

function PartialProgress({ paid, total }: { paid: number; total: number }) {
  if (paid <= 0 || total <= 0) return null
  const pct = Math.min((paid / total) * 100, 100)
  return (
    <div className="mt-1">
      <div className="flex justify-between text-[9px] text-white/25 mb-0.5">
        <span>Parcial</span>
        <span>{formatPercent(pct, { fractionDigits: 0 })}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-amber-500/60 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────

type BadgeVariant =
  | 'success' | 'error' | 'warning' | 'info'
  | 'pending' | 'active' | 'closed' | 'overdue'
  | 'paid' | 'partial' | 'collected'

const REC_STATUS: Record<ReceivableStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:     { label: 'Pendiente',  variant: 'pending'   },
  PARTIAL:     { label: 'Parcial',    variant: 'partial'   },
  COLLECTED:   { label: 'Cobrado',    variant: 'collected' },
  WRITTEN_OFF: { label: 'Castigado',  variant: 'closed'    },
}

const PAY_STATUS: Record<PayableStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:  { label: 'Pendiente', variant: 'pending' },
  PARTIAL:  { label: 'Parcial',   variant: 'partial' },
  PAID:     { label: 'Pagado',    variant: 'paid'    },
  DISPUTED: { label: 'Disputado', variant: 'error'   },
}

// =============================================================================
// RECEIVABLES TABLE
// =============================================================================

export function ReceivablesTable() {
  const router = useRouter()
  const { preferred, format, exchangeRate } = useCurrency()
  const [activeStatus, setActiveStatus] = useState<string>('PENDING')
  const [search, setSearch]             = useState('')

  const { receivables, isLoading, isEmpty, setFilters } = useReceivables({
    status: activeStatus || undefined,
  })

  useEffect(() => {
    setFilters({ status: activeStatus || undefined })
  }, [activeStatus, setFilters])

  const filtered = search
    ? receivables.filter(r =>
        r.debtor_name.toLowerCase().includes(search.toLowerCase()) ||
        r.concept?.toLowerCase().includes(search.toLowerCase())
      )
    : receivables

  const totalPending = filtered
    .filter(r => r.status === 'PENDING' || r.status === 'PARTIAL')
    .reduce((s, r) => {
      const pen = toPenAmount(r.amount - r.collected_amount, r.currency, exchangeRate)
      return s + pen
    }, 0)

  return (
    <TableShell>
      <Toolbar>
        <FilterPill label="Pendientes" active={activeStatus === 'PENDING'}  onClick={() => setActiveStatus('PENDING')} color="#06b6d4"/>
        <FilterPill label="Todos"      active={activeStatus === ''}         onClick={() => setActiveStatus('')}/>
        <FilterPill label="Cobrados"   active={activeStatus === 'COLLECTED'} onClick={() => setActiveStatus('COLLECTED')} color="var(--c-primary)"/>
        {totalPending > 0 && (
          <span className="text-[11px] text-white/25 tabular-nums hidden sm:inline">
            Por cobrar: <strong className="text-cyan-400">
              {formatCurrency(format(totalPending), preferred)}
            </strong>
          </span>
        )}
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar deudor…" className="filters-search xl:ml-auto"/>
      </Toolbar>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <Th>Deudor</Th>
              <Th className="hidden md:table-cell">Concepto</Th>
              <Th right>Monto</Th>
              <Th right className="hidden sm:table-cell">Pendiente</Th>
              <Th className="hidden lg:table-cell">Emisión</Th>
              <Th>Vencimiento</Th>
              <Th>Estado</Th>
              <Th className="w-20"/>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows cols={8} rows={5}/>
            ) : isEmpty || filtered.length === 0 ? (
              <EmptyState
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>}
                title="Sin cuentas por cobrar"
                description="Registra un ingreso de tipo 'Cuenta por cobrar' para verlas aquí."
                action={
                  <Link
                    href="/transactions?new=transaction&type=INCOME&module=receivable"
                    prefetch
                    className="btn-primary text-xs px-4 py-2"
                  >
                    Registrar por cobrar
                  </Link>
                }
              />
            ) : (
              filtered.map((rec, index) => {
                const pending    = rec.amount - rec.collected_amount
                const pendingPen = toPenAmount(pending, rec.currency, exchangeRate)
                const amountPen  = toPenAmount(rec.amount, rec.currency, exchangeRate)
                const status     = REC_STATUS[rec.status] ?? { label: rec.status, variant: 'pending' as const }
                const isOverdue  = rec.due_date && new Date(rec.due_date) < new Date() && rec.status !== 'COLLECTED'

                return (
                  <tr
                    key={rec.id}
                    style={{ animationDelay: `${index * 16}ms` }}
                    className={`list-reveal-item group/row hover:bg-white/[0.02] transition-colors ${
                      isOverdue ? 'bg-red-500/[0.03]' : ''
                    }`}
                  >
                    <Td>
                      <div className="flex items-center gap-2">
                        <UrgencyDot dueDate={rec.due_date} status={rec.status}/>
                        <div>
                          <p className="text-sm text-white/80 font-medium">{rec.debtor_name}</p>
                          {rec.status === 'PARTIAL' && (
                            <PartialProgress paid={rec.collected_amount} total={rec.amount}/>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td muted className="hidden md:table-cell">
                      <span className="text-[12px] truncate max-w-[180px] block">
                        {rec.concept ?? '—'}
                      </span>
                    </Td>
                    <Td right>
                      <AmountCell
                        amountPen={amountPen}
                        variant="income"
                        preferred={preferred}
                        exchangeRate={exchangeRate}
                        format={format}
                        formatter={(n, c) => formatCurrency(n, c as 'PEN' | 'USD')}
                      />
                    </Td>
                    <Td right className="hidden sm:table-cell">
                      {pending > 0 && (
                        <span className="text-[12px] font-bold tabular-nums text-cyan-400">
                          {formatCurrency(format(pendingPen), preferred)}
                        </span>
                      )}
                    </Td>
                    <Td muted className="hidden lg:table-cell">
                      <DateCell date={rec.issue_date}/>
                    </Td>
                    <Td>
                      {rec.due_date
                        ? <DateCell date={rec.due_date}/>
                        : <span className="text-[12px] text-white/20">—</span>
                      }
                    </Td>
                    <Td>
                      <StatusBadge label={status.label} variant={status.variant}/>
                    </Td>
                    <Td>
                      <RowActions actions={[
                        {
                          label:   'Ver',
                          onClick: () => router.push(`/receivables/${rec.id}`),
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

// =============================================================================
// PAYABLES TABLE
// =============================================================================

export function PayablesTable() {
  const router = useRouter()
  const { preferred, format, exchangeRate } = useCurrency()
  const [activeStatus, setActiveStatus] = useState<string>('PENDING')
  const [search, setSearch]             = useState('')

  const { payables, isLoading, isEmpty, setFilters } = usePayables({
    status: activeStatus || undefined,
  })

  useEffect(() => {
    setFilters({ status: activeStatus || undefined })
  }, [activeStatus, setFilters])

  const filtered = search
    ? payables.filter(p =>
        p.creditor_name.toLowerCase().includes(search.toLowerCase()) ||
        p.concept?.toLowerCase().includes(search.toLowerCase())
      )
    : payables

  const totalPending = filtered
    .filter(p => p.status === 'PENDING' || p.status === 'PARTIAL')
    .reduce((s, p) => {
      const pen = toPenAmount(p.amount - p.paid_amount, p.currency, exchangeRate)
      return s + pen
    }, 0)

  return (
    <TableShell>
      <Toolbar>
        <FilterPill label="Pendientes" active={activeStatus === 'PENDING'}  onClick={() => setActiveStatus('PENDING')} color="#f97316"/>
        <FilterPill label="Todos"      active={activeStatus === ''}         onClick={() => setActiveStatus('')}/>
        <FilterPill label="Pagados"    active={activeStatus === 'PAID'}     onClick={() => setActiveStatus('PAID')}    color="var(--c-primary)"/>
        {totalPending > 0 && (
          <span className="text-[11px] text-white/25 tabular-nums hidden sm:inline">
            Por pagar: <strong className="text-orange-400">
              {formatCurrency(format(totalPending), preferred)}
            </strong>
          </span>
        )}
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar acreedor…" className="filters-search xl:ml-auto"/>
      </Toolbar>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <Th>Acreedor</Th>
              <Th className="hidden md:table-cell">Concepto</Th>
              <Th right>Monto</Th>
              <Th right className="hidden sm:table-cell">Pendiente</Th>
              <Th className="hidden lg:table-cell">Emisión</Th>
              <Th>Vencimiento</Th>
              <Th>Estado</Th>
              <Th className="w-20"/>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows cols={8} rows={5}/>
            ) : isEmpty || filtered.length === 0 ? (
              <EmptyState
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="9" y1="13" x2="15" y2="13"/></svg>}
                title="Sin cuentas por pagar"
                description="Registra un egreso de tipo 'Cuenta por pagar' para verlas aquí."
                action={
                  <Link
                    href="/transactions?new=transaction&type=EXPENSE&module=payable"
                    prefetch
                    className="btn-primary text-xs px-4 py-2"
                  >
                    Registrar por pagar
                  </Link>
                }
              />
            ) : (
              filtered.map((pay, index) => {
                const pending    = pay.amount - pay.paid_amount
                const pendingPen = toPenAmount(pending, pay.currency, exchangeRate)
                const amountPen  = toPenAmount(pay.amount, pay.currency, exchangeRate)
                const status     = PAY_STATUS[pay.status] ?? { label: pay.status, variant: 'pending' as const }
                const isOverdue  = pay.due_date && new Date(pay.due_date) < new Date() && pay.status !== 'PAID'

                return (
                  <tr
                    key={pay.id}
                    style={{ animationDelay: `${index * 16}ms` }}
                    className={`list-reveal-item group/row hover:bg-white/[0.02] transition-colors ${
                      isOverdue ? 'bg-red-500/[0.03]' : ''
                    }`}
                  >
                    <Td>
                      <div className="flex items-center gap-2">
                        <UrgencyDot dueDate={pay.due_date} status={pay.status}/>
                        <div>
                          <p className="text-sm text-white/80 font-medium">{pay.creditor_name}</p>
                          {pay.status === 'PARTIAL' && (
                            <PartialProgress paid={pay.paid_amount} total={pay.amount}/>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td muted className="hidden md:table-cell">
                      <span className="text-[12px] truncate max-w-[180px] block">
                        {pay.concept ?? '—'}
                      </span>
                    </Td>
                    <Td right>
                      <AmountCell
                        amountPen={amountPen}
                        variant="expense"
                        preferred={preferred}
                        exchangeRate={exchangeRate}
                        format={format}
                        formatter={(n, c) => formatCurrency(n, c as 'PEN' | 'USD')}
                      />
                    </Td>
                    <Td right className="hidden sm:table-cell">
                      {pending > 0 && (
                        <span className="text-[12px] font-bold tabular-nums text-orange-400">
                          {formatCurrency(format(pendingPen), preferred)}
                        </span>
                      )}
                    </Td>
                    <Td muted className="hidden lg:table-cell">
                      <DateCell date={pay.issue_date}/>
                    </Td>
                    <Td>
                      {pay.due_date
                        ? <DateCell date={pay.due_date}/>
                        : <span className="text-[12px] text-white/20">—</span>
                      }
                    </Td>
                    <Td>
                      <StatusBadge label={status.label} variant={status.variant}/>
                    </Td>
                    <Td>
                      <RowActions actions={[
                        {
                          label:   'Ver',
                          onClick: () => router.push(`/payables/${pay.id}`),
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
