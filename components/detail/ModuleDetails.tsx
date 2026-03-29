// =============================================================================
// components/detail/ModuleDetails.tsx
// Páginas de detalle para los 4 módulos derivados.
// Cada uno es un Client Component que recibe datos del Server Component padre.
// =============================================================================

'use client'

import { useState }                from 'react'
import { useRouter }               from 'next/navigation'
import { useCurrency }             from '@/lib/hooks/useDashboard'
import { formatCurrency, formatPercent, toPenAmount } from '@/lib/contracts/ui.contracts'
import {
  BackLink,
  DetailShell,
  DetailCard,
  DetailSection,
  DetailField,
  FieldGrid,
  ActionButton,
  ConfirmDialog,
  LinkedModuleBadge,
  InlineError,
}                                  from './primitives'
import { ProgressBar } from '@/components/tables/primitives'
import type { Credit, Asset,
  AccountReceivable, AccountPayable,
  Installment }                    from '@/types/database.types'

// ─── INSTALLMENT LIST ─────────────────────────────────────────────────────────

function InstallmentRow({ inst }: { inst: Installment }) {
  const isOverdue = inst.status === 'OVERDUE'
  const isPaid    = inst.status === 'PAID'

  const statusStyles = {
    PENDING: 'text-white/35',
    PAID:    'text-emerald-400',
    OVERDUE: 'text-red-400',
    PARTIAL: 'text-amber-400',
  }

  return (
    <div className={`
      flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0
      ${isOverdue ? 'bg-red-500/[0.03] -mx-4 px-4 rounded' : ''}
    `}>
      <div className={`
        w-6 h-6 rounded-full border flex items-center justify-center
        text-[10px] font-bold flex-shrink-0
        ${isPaid    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
        : isOverdue ? 'bg-red-500/15 border-red-500/30 text-red-400'
        :             'bg-white/[0.05] border-white/[0.08] text-white/30'}
      `}>
        {isPaid ? '✓' : inst.installment_number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-white/60 tabular-nums">
          Cuota {inst.installment_number}
        </p>
        {inst.due_date && (
          <p className="text-[10px] text-white/25 tabular-nums">
            {new Date(inst.due_date + 'T12:00:00').toLocaleDateString('es-PE', {
              day: 'numeric', month: 'short', year: '2-digit',
            })}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className={`text-[12px] font-bold tabular-nums ${statusStyles[inst.status] ?? 'text-white/40'}`}>
          {formatCurrency(inst.total_amount, 'PEN')}
        </p>
        {inst.interest_amount > 0 && (
          <p className="text-[10px] text-white/20 tabular-nums">
            Int. {formatCurrency(inst.interest_amount, 'PEN')}
          </p>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// CREDIT DETAIL
// =============================================================================

interface CreditDetailProps {
  credit:       Credit
  installments?: Installment[]
  transaction?: { id: string; description: string } | null
}

export function CreditDetail({ credit, installments = [], transaction }: CreditDetailProps) {
  const { preferred, format } = useCurrency()
  const utilPct = credit.credit_limit > 0
    ? (credit.used_amount / credit.credit_limit) * 100
    : 0

  const paidInstallments = installments.filter(i => i.status === 'PAID').length
  const totalInstallments = installments.length
  const overdueInstallments = installments.filter(i => i.status === 'OVERDUE')

  return (
    <>
      <BackLink href="/credits" label="Créditos"/>
      <DetailShell twoColumn aside={
        <div className="space-y-4">
          {transaction && (
            <DetailCard className="p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/25 mb-3">
                Transacción origen
              </h3>
              <LinkedModuleBadge
                label={transaction.description}
                href={`/transactions/${transaction.id}`}
                color="#3b82f6"
              />
            </DetailCard>
          )}
          {overdueInstallments.length > 0 && (
            <div className="rounded-xl bg-red-500/[0.08] border border-red-500/20 p-4">
              <p className="text-[12px] text-red-400 font-semibold mb-1">
                {overdueInstallments.length} cuota{overdueInstallments.length > 1 ? 's' : ''} vencida{overdueInstallments.length > 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-red-400/60">
                Total vencido: {formatCurrency(
                  overdueInstallments.reduce((s, i) => s + i.total_amount, 0),
                  credit.currency as 'PEN' | 'USD'
                )}
              </p>
            </div>
          )}
        </div>
      }>
        {/* Header */}
        <DetailCard>
          <div className="p-6 border-b border-white/[0.05]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide
                  text-amber-400/70 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {credit.credit_type === 'CREDIT_CARD' ? 'Tarjeta de crédito' : 'Crédito bancario'}
                </span>
                <h1 className="text-lg font-bold text-white/85 mt-2">{credit.name}</h1>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-emerald-400">
                  {formatCurrency(format(credit.available_amount ?? 0), preferred)}
                </p>
                <p className="text-[11px] text-white/25">disponible</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex justify-between text-[11px] text-white/35 mb-2">
                <span>Utilización: {formatPercent(utilPct, { fractionDigits: 1 })}</span>
                <span>{formatCurrency(format(credit.used_amount), preferred)} / {formatCurrency(format(credit.credit_limit), preferred)}</span>
              </div>
              <ProgressBar
                value={utilPct}
                color={utilPct >= 90 ? '#ef4444' : utilPct >= 70 ? '#f97316' : '#10b981'}
                height={6}
              />
            </div>
          </div>

          <div className="p-6">
            <FieldGrid>
              <DetailField label="Límite de crédito" mono>
                {formatCurrency(format(credit.credit_limit), preferred)}
              </DetailField>
              <DetailField label="Monto usado" mono>
                {formatCurrency(format(credit.used_amount), preferred)}
              </DetailField>
              <DetailField label="Tasa de interés" mono>
                {formatPercent(credit.interest_rate, { fractionDigits: 2 })} mensual
              </DetailField>
              <DetailField label="Moneda" mono>{credit.currency}</DetailField>
              {credit.closing_day && (
                <DetailField label="Día de corte">Día {credit.closing_day}</DetailField>
              )}
              {credit.payment_day && (
                <DetailField label="Día de pago">Día {credit.payment_day}</DetailField>
              )}
            </FieldGrid>
          </div>
        </DetailCard>

        {/* Cronograma */}
        {installments.length > 0 && (
          <DetailCard>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/30">
                  Cronograma de cuotas
                </h2>
                <span className="text-[11px] text-white/25 tabular-nums">
                  {paidInstallments}/{totalInstallments} pagadas
                </span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {installments.map(inst => (
                  <InstallmentRow key={inst.id} inst={inst}/>
                ))}
              </div>
            </div>
          </DetailCard>
        )}
      </DetailShell>
    </>
  )
}

// =============================================================================
// ASSET DETAIL
// =============================================================================

interface AssetDetailProps {
  asset:       Asset
  transaction?: { id: string; description: string } | null
}

export function AssetDetail({ asset, transaction }: AssetDetailProps) {
  const { preferred, format, exchangeRate } = useCurrency()

  const purchasePen = toPenAmount(asset.purchase_value, asset.currency, exchangeRate)
  const valuePen    = toPenAmount(asset.current_value, asset.currency, exchangeRate)
  const gainPen     = valuePen - purchasePen
  const gainPct     = purchasePen > 0 ? (gainPen / purchasePen) * 100 : 0

  const ASSET_TYPE_LABELS: Record<string, string> = {
    REAL_ESTATE: 'Inmueble', VEHICLE: 'Vehículo',
    EQUIPMENT: 'Equipo', INVESTMENT: 'Inversión', OTHER: 'Otro',
  }

  return (
    <>
      <BackLink href="/assets" label="Activos"/>
      <DetailShell twoColumn aside={
        <div className="space-y-4">
          {transaction && (
            <DetailCard className="p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/25 mb-3">
                Transacción origen
              </h3>
              <LinkedModuleBadge
                label={transaction.description}
                href={`/transactions/${transaction.id}`}
                color="#3b82f6"
              />
            </DetailCard>
          )}
          {/* Variación de valor */}
          {Math.abs(gainPct) > 0.5 && (
            <DetailCard className="p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/25 mb-3">
                Variación de valor
              </h3>
              <p className={`text-2xl font-bold tabular-nums ${gainPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPercent(gainPct, { fractionDigits: 1, signed: true })}
              </p>
              <p className={`text-[12px] tabular-nums mt-0.5 ${gainPct >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                {gainPct >= 0 ? '+' : ''}{formatCurrency(format(gainPen), preferred)}
              </p>
            </DetailCard>
          )}
        </div>
      }>
        <DetailCard>
          <div className="p-6 border-b border-white/[0.05]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide
                  text-purple-400/70 bg-purple-500/10 px-2 py-0.5 rounded-full">
                  {ASSET_TYPE_LABELS[asset.asset_type] ?? 'Activo'}
                </span>
                <h1 className="text-lg font-bold text-white/85 mt-2">{asset.name}</h1>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-purple-400">
                  {formatCurrency(format(valuePen), preferred)}
                </p>
                <p className="text-[11px] text-white/25">valor actual</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <FieldGrid>
              <DetailField label="Valor de compra" mono>
                {formatCurrency(format(purchasePen), preferred)}
              </DetailField>
              <DetailField label="Valor actual" mono>
                {formatCurrency(format(valuePen), preferred)}
              </DetailField>
              <DetailField label="Fecha de compra">
                {new Date(asset.purchase_date + 'T12:00:00').toLocaleDateString('es-PE', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </DetailField>
              <DetailField label="Moneda" mono>{asset.currency}</DetailField>
              {asset.serial_number && (
                <DetailField label="N° de serie" mono>{asset.serial_number}</DetailField>
              )}
              {asset.location && (
                <DetailField label="Ubicación">{asset.location}</DetailField>
              )}
              {asset.depreciation_rate != null && asset.depreciation_rate > 0 && (
                <DetailField label="Tasa depreciación" mono>
                  {formatPercent(asset.depreciation_rate * 100, { fractionDigits: 2 })} anual
                </DetailField>
              )}
              {asset.notes && (
                <DetailField label="Notas" full>
                  <p className="text-white/50 text-sm">{asset.notes}</p>
                </DetailField>
              )}
            </FieldGrid>
          </div>
        </DetailCard>
      </DetailShell>
    </>
  )
}

// =============================================================================
// RECEIVABLE DETAIL
// =============================================================================

interface ReceivableDetailProps {
  receivable:  AccountReceivable
  transaction?: { id: string; description: string } | null
}

export function ReceivableDetail({ receivable: rec, transaction }: ReceivableDetailProps) {
  const { preferred, format, exchangeRate } = useCurrency()
  const pending   = rec.amount - rec.collected_amount
  const amountPen = toPenAmount(rec.amount, rec.currency, exchangeRate)
  const pendingPen = toPenAmount(pending, rec.currency, exchangeRate)
  const collectedPct = rec.amount > 0 ? (rec.collected_amount / rec.amount) * 100 : 0

  const isOverdue = rec.due_date && new Date(rec.due_date) < new Date() && rec.status !== 'COLLECTED'

  return (
    <>
      <BackLink href="/receivables" label="Por cobrar"/>
      <DetailShell twoColumn aside={
        <div className="space-y-4">
          {transaction && (
            <DetailCard className="p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/25 mb-3">
                Transacción origen
              </h3>
              <LinkedModuleBadge
                label={transaction.description}
                href={`/transactions/${transaction.id}`}
                color="#3b82f6"
              />
            </DetailCard>
          )}
          {isOverdue && (
            <div className="rounded-xl bg-red-500/[0.08] border border-red-500/20 p-4">
              <p className="text-[12px] text-red-400 font-semibold">Cuenta vencida</p>
              <p className="text-[11px] text-red-400/60 mt-1">
                Venció el {new Date(rec.due_date! + 'T12:00:00').toLocaleDateString('es-PE', {
                  day: 'numeric', month: 'long',
                })}
              </p>
            </div>
          )}
        </div>
      }>
        <DetailCard>
          <div className="p-6 border-b border-white/[0.05]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide
                  text-cyan-400/70 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                  Por cobrar
                </span>
                <h1 className="text-lg font-bold text-white/85 mt-2">{rec.debtor_name}</h1>
                {rec.concept && (
                  <p className="text-sm text-white/35 mt-0.5">{rec.concept}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-cyan-400">
                  {formatCurrency(format(pendingPen), preferred)}
                </p>
                <p className="text-[11px] text-white/25">pendiente</p>
              </div>
            </div>

            {rec.status === 'PARTIAL' && (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-white/35 mb-2">
                  <span>Cobrado: {formatPercent(collectedPct, { fractionDigits: 0 })}</span>
                  <span>
                    {formatCurrency(format(toPenAmount(rec.collected_amount, rec.currency, exchangeRate)), preferred)}
                    {' / '}{formatCurrency(format(amountPen), preferred)}
                  </span>
                </div>
                <ProgressBar value={collectedPct} color="#06b6d4" height={5}/>
              </div>
            )}
          </div>

          <div className="p-6">
            <FieldGrid>
              <DetailField label="Monto total" mono>
                {formatCurrency(format(amountPen), preferred)}
              </DetailField>
              <DetailField label="Moneda" mono>{rec.currency}</DetailField>
              <DetailField label="Fecha de emisión">
                {new Date(rec.issue_date + 'T12:00:00').toLocaleDateString('es-PE', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </DetailField>
              {rec.due_date && (
                <DetailField label="Fecha de vencimiento">
                  <span className={isOverdue ? 'text-red-400' : ''}>
                    {new Date(rec.due_date + 'T12:00:00').toLocaleDateString('es-PE', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </DetailField>
              )}
              {rec.notes && (
                <DetailField label="Notas" full>
                  <p className="text-white/50 text-sm">{rec.notes}</p>
                </DetailField>
              )}
            </FieldGrid>
          </div>
        </DetailCard>
      </DetailShell>
    </>
  )
}

// =============================================================================
// PAYABLE DETAIL
// =============================================================================

interface PayableDetailProps {
  payable:     AccountPayable
  transaction?: { id: string; description: string } | null
}

export function PayableDetail({ payable: pay, transaction }: PayableDetailProps) {
  const { preferred, format, exchangeRate } = useCurrency()
  const pending    = pay.amount - pay.paid_amount
  const amountPen  = toPenAmount(pay.amount, pay.currency, exchangeRate)
  const pendingPen = toPenAmount(pending, pay.currency, exchangeRate)
  const paidPct    = pay.amount > 0 ? (pay.paid_amount / pay.amount) * 100 : 0

  const isOverdue = pay.due_date && new Date(pay.due_date) < new Date() && pay.status !== 'PAID'

  return (
    <>
      <BackLink href="/payables" label="Por pagar"/>
      <DetailShell twoColumn aside={
        <div className="space-y-4">
          {transaction && (
            <DetailCard className="p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/25 mb-3">
                Transacción origen
              </h3>
              <LinkedModuleBadge
                label={transaction.description}
                href={`/transactions/${transaction.id}`}
                color="#3b82f6"
              />
            </DetailCard>
          )}
          {isOverdue && (
            <div className="rounded-xl bg-red-500/[0.08] border border-red-500/20 p-4">
              <p className="text-[12px] text-red-400 font-semibold">Pago vencido</p>
              <p className="text-[11px] text-red-400/60 mt-1">
                Venció el {new Date(pay.due_date! + 'T12:00:00').toLocaleDateString('es-PE', {
                  day: 'numeric', month: 'long',
                })}
              </p>
            </div>
          )}
        </div>
      }>
        <DetailCard>
          <div className="p-6 border-b border-white/[0.05]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wide
                  text-orange-400/70 bg-orange-500/10 px-2 py-0.5 rounded-full">
                  Por pagar
                </span>
                <h1 className="text-lg font-bold text-white/85 mt-2">{pay.creditor_name}</h1>
                {pay.concept && (
                  <p className="text-sm text-white/35 mt-0.5">{pay.concept}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-orange-400">
                  {formatCurrency(format(pendingPen), preferred)}
                </p>
                <p className="text-[11px] text-white/25">pendiente</p>
              </div>
            </div>

            {pay.status === 'PARTIAL' && (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-white/35 mb-2">
                  <span>Pagado: {formatPercent(paidPct, { fractionDigits: 0 })}</span>
                  <span>
                    {formatCurrency(format(toPenAmount(pay.paid_amount, pay.currency, exchangeRate)), preferred)}
                    {' / '}{formatCurrency(format(amountPen), preferred)}
                  </span>
                </div>
                <ProgressBar value={paidPct} color="#f97316" height={5}/>
              </div>
            )}
          </div>

          <div className="p-6">
            <FieldGrid>
              <DetailField label="Monto total" mono>
                {formatCurrency(format(amountPen), preferred)}
              </DetailField>
              <DetailField label="Moneda" mono>{pay.currency}</DetailField>
              <DetailField label="Fecha de emisión">
                {new Date(pay.issue_date + 'T12:00:00').toLocaleDateString('es-PE', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </DetailField>
              {pay.due_date && (
                <DetailField label="Fecha de vencimiento">
                  <span className={isOverdue ? 'text-red-400' : ''}>
                    {new Date(pay.due_date + 'T12:00:00').toLocaleDateString('es-PE', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </DetailField>
              )}
              {pay.notes && (
                <DetailField label="Notas" full>
                  <p className="text-white/50 text-sm">{pay.notes}</p>
                </DetailField>
              )}
            </FieldGrid>
          </div>
        </DetailCard>
      </DetailShell>
    </>
  )
}
