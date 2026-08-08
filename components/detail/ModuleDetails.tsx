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
  CanonicalDetailBackLink,
  CanonicalDetailBadge,
  CanonicalDetailFact,
  CanonicalDetailFacts,
  CanonicalDetailLayout,
  CanonicalDetailNotice,
  CanonicalDetailRailSection,
  CanonicalDetailSection,
  CanonicalDetailSummary,
  CanonicalRelatedRecordLink,
  ConfirmDialog,
  LinkedModuleBadge,
  InlineError,
  type CanonicalDetailTone,
}                                  from './primitives'
import { ProgressBar } from '@/components/tables/primitives'
import type { Credit, Asset,
  AccountReceivable, AccountPayable,
  Installment }                    from '@/types/database.types'

// ─── INSTALLMENT LIST ─────────────────────────────────────────────────────────

const INSTALLMENT_STATUS = {
  PENDING: { label: 'Pendiente', tone: 'neutral' },
  PAID:    { label: 'Pagada',    tone: 'success' },
  OVERDUE: { label: 'Vencida',   tone: 'danger' },
  PARTIAL: { label: 'Parcial',   tone: 'warning' },
} satisfies Record<Installment['status'], {
  label: string
  tone: CanonicalDetailTone
}>

function InstallmentRow({
  inst,
  currency,
}: {
  inst: Installment
  currency: 'PEN' | 'USD'
}) {
  const isOverdue = inst.status === 'OVERDUE'
  const isPaid    = inst.status === 'PAID'
  const status     = INSTALLMENT_STATUS[inst.status]

  return (
    <li className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-[var(--ft-border)] px-4 py-3.5 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5 ${isOverdue ? 'bg-[var(--ft-danger-soft)]' : ''}`}>
      <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border text-[11px] font-bold tabular-nums ${
        isPaid
          ? 'border-[color-mix(in_srgb,var(--ft-success)_20%,transparent)] bg-[var(--ft-success-soft)] text-[var(--ft-success)]'
          : isOverdue
            ? 'border-[color-mix(in_srgb,var(--ft-danger)_20%,transparent)] bg-[var(--ft-danger-soft)] text-[var(--ft-danger)]'
            : 'border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-[var(--ft-text-muted)]'
      }`}>
        {isPaid ? '✓' : inst.installment_number}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-5 text-[var(--ft-text-strong)] tabular-nums">
          Cuota {inst.installment_number}
        </p>
        {inst.due_date && (
          <p className="mt-0.5 text-xs leading-4 text-[var(--ft-text-muted)] tabular-nums">
            {new Date(inst.due_date + 'T12:00:00').toLocaleDateString('es-PE', {
              day: 'numeric', month: 'short', year: '2-digit',
            })}
          </p>
        )}
      </div>
      <div className="col-start-2 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:col-start-3 sm:block sm:text-right">
        <CanonicalDetailBadge tone={status.tone}>{status.label}</CanonicalDetailBadge>
        <div className="text-right sm:mt-1.5">
          <p className="text-[13px] font-semibold leading-5 text-[var(--ft-text-strong)] tabular-nums">
            {formatCurrency(inst.total_amount, currency)}
          </p>
          {inst.interest_amount > 0 && (
            <p className="text-[11px] leading-4 text-[var(--ft-text-subtle)] tabular-nums">
              Int. {formatCurrency(inst.interest_amount, currency)}
            </p>
          )}
        </div>
      </div>
    </li>
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
    <CanonicalDetailLayout
      back={<CanonicalDetailBackLink href="/credits" label="Créditos"/>}
      summary={
        <CanonicalDetailSummary
          marker={credit.credit_type === 'CREDIT_CARD' ? (
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="5" width="19" height="14" rx="2.5"/>
              <path d="M2.5 10h19M6.5 15h3"/>
            </svg>
          ) : (
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 18h18M12 3l9 5H3l9-5Z"/>
            </svg>
          )}
          tone="primary"
          badges={
            <CanonicalDetailBadge>
              {credit.credit_type === 'CREDIT_CARD' ? 'Tarjeta de crédito' : 'Crédito bancario'}
            </CanonicalDetailBadge>
          }
          title={credit.name}
          amount={formatCurrency(format(credit.available_amount ?? 0), preferred)}
          amountMeta={
            <span className="text-xs font-medium text-[var(--ft-text-muted)]">disponible</span>
          }
          supporting={
            <div>
              <div className="flex flex-col gap-1 text-xs leading-4 text-[var(--ft-text-muted)] sm:flex-row sm:items-center sm:justify-between">
                <span>Utilización: {formatPercent(utilPct, { fractionDigits: 1 })}</span>
                <span className="tabular-nums">
                  {formatCurrency(format(credit.used_amount), preferred)} / {formatCurrency(format(credit.credit_limit), preferred)}
                </span>
              </div>
              <div className="mt-2.5">
                <ProgressBar
                  value={utilPct}
                  color={utilPct >= 90 ? 'var(--ft-danger)' : utilPct >= 70 ? 'var(--ft-warning)' : 'var(--ft-primary)'}
                  height={6}
                />
              </div>
            </div>
          }
        />
      }
      aside={(transaction || overdueInstallments.length > 0) ? (
        <div className="space-y-4">
          {transaction && (
            <CanonicalDetailRailSection title="Transacción origen">
              <CanonicalRelatedRecordLink
                label={transaction.description}
                href={`/transactions/${transaction.id}`}
              />
            </CanonicalDetailRailSection>
          )}
          {overdueInstallments.length > 0 && (
            <CanonicalDetailNotice
              tone="danger"
              title={`${overdueInstallments.length} cuota${overdueInstallments.length > 1 ? 's' : ''} vencida${overdueInstallments.length > 1 ? 's' : ''}`}
            >
              <p>
                Total vencido: {formatCurrency(
                  overdueInstallments.reduce((s, i) => s + i.total_amount, 0),
                  credit.currency as 'PEN' | 'USD'
                )}
              </p>
            </CanonicalDetailNotice>
          )}
        </div>
      ) : undefined}
    >
      <div className="space-y-4 sm:space-y-5">
        <CanonicalDetailFacts>
          <CanonicalDetailFact label="Límite de crédito" mono>
            {formatCurrency(format(credit.credit_limit), preferred)}
          </CanonicalDetailFact>
          <CanonicalDetailFact label="Monto usado" mono>
            {formatCurrency(format(credit.used_amount), preferred)}
          </CanonicalDetailFact>
          <CanonicalDetailFact label="Tasa de interés" mono>
            {formatPercent(credit.interest_rate, { fractionDigits: 2 })} mensual
          </CanonicalDetailFact>
          <CanonicalDetailFact label="Moneda" mono>{credit.currency}</CanonicalDetailFact>
          {credit.closing_day && (
            <CanonicalDetailFact label="Día de corte">Día {credit.closing_day}</CanonicalDetailFact>
          )}
          {credit.payment_day && (
            <CanonicalDetailFact label="Día de pago">Día {credit.payment_day}</CanonicalDetailFact>
          )}
        </CanonicalDetailFacts>

        {installments.length > 0 && (
          <CanonicalDetailSection
            title="Cronograma de cuotas"
            meta={<>{paidInstallments}/{totalInstallments} pagadas</>}
          >
            <ol className="max-h-[400px] overflow-y-auto">
              {installments.map(inst => (
                <InstallmentRow key={inst.id} inst={inst} currency={credit.currency as 'PEN' | 'USD'}/>
              ))}
            </ol>
          </CanonicalDetailSection>
        )}
      </div>
    </CanonicalDetailLayout>
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
              <p className={`text-2xl font-bold tabular-nums ${gainPct >= 0 ? 'text-[var(--c-primary)]' : 'text-red-400'}`}>
                {formatPercent(gainPct, { fractionDigits: 1, signed: true })}
              </p>
              <p className={`text-[12px] tabular-nums mt-0.5 ${gainPct >= 0 ? 'text-[var(--c-primary)]/60' : 'text-red-400/60'}`}>
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
