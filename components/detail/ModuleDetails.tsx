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
  DetailSection,
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
  InlineError,
  type CanonicalDetailTone,
}                                  from './primitives'
import { ProgressBar } from '@/components/tables/primitives'
import type { Credit,
  AccountReceivable, AccountPayable,
  Installment }                    from '@/types/database.types'
import type { LoanScheduleIntegrity } from '@/modules/credits/loan-schedule-integrity'
import {
  getCreditDetailPresentation,
  type CreditDetailLoanEvidence,
  type CreditNativeCurrency,
} from '@/modules/credits/credit-detail-presentation'
import {
  getAssetStatusPresentation,
  getAssetTypePresentation,
  type AssetWithTypeInfo,
} from '@/modules/assets/asset-presentation'
import {
  formatVerifiedObligationAmount,
  resolveVerifiedObligationCurrency,
} from '@/modules/obligations/obligation-currency-presentation'

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
  currency: CreditNativeCurrency | null
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
            {currency ? formatCurrency(inst.total_amount, currency) : 'Moneda no verificable'}
          </p>
          <p className="text-[11px] leading-4 text-[var(--ft-text-subtle)] tabular-nums">
            {currency
              ? <>Cap. {formatCurrency(inst.principal_amount, currency)} · Int. {formatCurrency(inst.interest_amount, currency)}</>
              : 'Componentes sin moneda verificable'}
          </p>
          <p className="text-[11px] leading-4 text-[var(--ft-text-subtle)] tabular-nums">
            {currency
              ? <>Seg. {formatCurrency(inst.insurance_amount, currency)} · Otros {formatCurrency(inst.other_charges, currency)}</>
              : null}
          </p>
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
  scheduleIntegrity?: LoanScheduleIntegrity
  loanEvidence?: CreditDetailLoanEvidence
  transaction?: { id: string; description: string } | null
}

export function CreditDetail({
  credit,
  installments = [],
  scheduleIntegrity,
  loanEvidence = { status: 'UNAVAILABLE' },
  transaction,
}: CreditDetailProps) {
  const presentation = getCreditDetailPresentation(credit, loanEvidence)
  const availability = presentation.availability
  const displayCurrency = presentation.currency
  const canShowAvailability = availability.status === 'AVAILABLE' && displayCurrency !== null
  const primaryAmount = presentation.primaryAmount.status === 'AVAILABLE'
    && presentation.primaryAmount.amount !== null
    && presentation.currency
      ? formatCurrency(presentation.primaryAmount.amount, presentation.currency)
      : 'No verificable'

  const paidInstallments = installments.filter(i => i.status === 'PAID').length
  const totalInstallments = installments.length
  const overdueInstallments = installments.filter(i => i.status === 'OVERDUE')
  const requiresSchedule = scheduleIntegrity
    ? scheduleIntegrity.status !== 'NOT_APPLICABLE'
    : installments.length > 0
  const scheduleIsLimited = requiresSchedule && scheduleIntegrity && !scheduleIntegrity.isComplete

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
              {presentation.productLabel}
            </CanonicalDetailBadge>
          }
          title={credit.name}
          amount={primaryAmount}
          amountMeta={
            <span className="text-xs font-medium text-[var(--ft-text-muted)]">
              {presentation.primaryAmount.label}
              {canShowAvailability ? ` en ${presentation.currencyLabel}` : ''}
            </span>
          }
          supporting={
            canShowAvailability && availability.status === 'AVAILABLE' ? <div>
              <div className="flex flex-col gap-1 text-xs leading-4 text-[var(--ft-text-muted)] sm:flex-row sm:items-center sm:justify-between">
                <span>Utilización: {formatPercent(availability.utilizationPct, { fractionDigits: 1 })}</span>
                <span className="tabular-nums">
                  {formatCurrency(availability.used, displayCurrency)} / {formatCurrency(availability.limit, displayCurrency)}
                </span>
              </div>
              <div className="mt-2.5">
                <ProgressBar
                  value={availability.utilizationPct}
                  color={availability.utilizationPct >= 90 ? 'var(--ft-danger)' : availability.utilizationPct >= 70 ? 'var(--ft-warning)' : 'var(--ft-primary)'}
                  height={6}
                />
              </div>
            </div> : (
              <p className="text-xs leading-5 text-[var(--ft-text-muted)]">
                {presentation.availabilityMessage}
              </p>
            )
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
                Total vencido: {presentation.currency
                  ? formatCurrency(
                      overdueInstallments.reduce((s, i) => s + i.total_amount, 0),
                      presentation.currency,
                    )
                  : 'Moneda no verificable'}
              </p>
            </CanonicalDetailNotice>
          )}
        </div>
      ) : undefined}
    >
      <div className="space-y-4 sm:space-y-5">
        <CanonicalDetailFacts>
          {presentation.product === 'LOAN' ? (
            <CanonicalDetailFact label="Capital original" mono>
              {primaryAmount}
            </CanonicalDetailFact>
          ) : (
            <>
              <CanonicalDetailFact label="Límite de crédito" mono>
                {canShowAvailability && availability.status === 'AVAILABLE'
                  ? formatCurrency(availability.limit, displayCurrency)
                  : 'No verificable'}
              </CanonicalDetailFact>
              <CanonicalDetailFact label="Monto usado" mono>
                {canShowAvailability && availability.status === 'AVAILABLE'
                  ? formatCurrency(availability.used, displayCurrency)
                  : 'No verificable'}
              </CanonicalDetailFact>
            </>
          )}
          <CanonicalDetailFact label="Tasa de interés" mono>
            {formatPercent(credit.interest_rate, { fractionDigits: 2 })} mensual
          </CanonicalDetailFact>
          <CanonicalDetailFact label="Moneda" mono>{presentation.currencyLabel}</CanonicalDetailFact>
          {credit.closing_day && (
            <CanonicalDetailFact label="Día de corte">Día {credit.closing_day}</CanonicalDetailFact>
          )}
          {credit.payment_day && (
            <CanonicalDetailFact label="Día de pago">Día {credit.payment_day}</CanonicalDetailFact>
          )}
        </CanonicalDetailFacts>

        {requiresSchedule && (scheduleIntegrity || installments.length > 0) && (
          <CanonicalDetailSection
            title="Cronograma de cuotas"
            meta={scheduleIntegrity?.expectedInstallments
              ? <>{totalInstallments}/{scheduleIntegrity.expectedInstallments} cuotas · {paidInstallments} pagadas</>
              : <>{paidInstallments}/{totalInstallments} pagadas</>}
          >
            <div>
              {scheduleIsLimited ? (
                <div className="border-b border-[var(--ft-border)] p-4 sm:p-5">
                  <CanonicalDetailNotice tone="warning" title="Cronograma no verificado">
                    <p>{scheduleIntegrity.message}</p>
                  </CanonicalDetailNotice>
                </div>
              ) : null}
              {installments.length > 0 ? (
                <ol className="max-h-[400px] overflow-y-auto">
                  {installments.map(inst => (
                    <InstallmentRow key={inst.id} inst={inst} currency={presentation.currency}/>
                  ))}
                </ol>
              ) : null}
            </div>
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
  asset:       AssetWithTypeInfo
  transaction?: { id: string; description: string } | null
}

export function AssetDetail({ asset, transaction }: AssetDetailProps) {
  const { preferred, format, exchangeRate } = useCurrency()
  const assetStatus = getAssetStatusPresentation(asset.status)
  const assetType = getAssetTypePresentation(asset)

  const purchasePen = toPenAmount(asset.purchase_value, asset.currency, exchangeRate)
  const valuePen    = toPenAmount(asset.current_value, asset.currency, exchangeRate)
  const gainPen     = valuePen - purchasePen
  const gainPct     = purchasePen > 0 ? (gainPen / purchasePen) * 100 : 0

  return (
    <CanonicalDetailLayout
      back={<CanonicalDetailBackLink href="/assets" label="Activos"/>}
      summary={
        <CanonicalDetailSummary
          marker={
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/>
              <path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>
            </svg>
          }
          tone="primary"
          badges={
            <>
              <CanonicalDetailBadge>
                {assetType.label}
              </CanonicalDetailBadge>
              <CanonicalDetailBadge tone={assetStatus.tone}>
                {assetStatus.label}
              </CanonicalDetailBadge>
            </>
          }
          title={asset.name}
          amount={formatCurrency(format(valuePen), preferred)}
          amountMeta={
            <span className="text-xs font-medium text-[var(--ft-text-muted)]">valor actual</span>
          }
          supporting={Math.abs(gainPct) > 0.5 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium leading-4 text-[var(--ft-text-muted)]">Variación de valor</p>
                <p className={`mt-1 text-xl font-bold leading-6 tabular-nums ${gainPct >= 0 ? 'text-[var(--ft-primary)]' : 'text-[var(--ft-danger)]'}`}>
                  {formatPercent(gainPct, { fractionDigits: 1, signed: true })}
                </p>
              </div>
              <p className={`text-[13px] font-semibold leading-5 tabular-nums ${gainPct >= 0 ? 'text-[var(--ft-primary)]' : 'text-[var(--ft-danger)]'}`}>
                {gainPct >= 0 ? '+' : ''}{formatCurrency(format(gainPen), preferred)}
              </p>
            </div>
          ) : undefined}
        />
      }
      aside={transaction ? (
        <CanonicalDetailRailSection title="Transacción origen">
          <CanonicalRelatedRecordLink
            label={transaction.description}
            href={`/transactions/${transaction.id}`}
          />
        </CanonicalDetailRailSection>
      ) : undefined}
    >
      <CanonicalDetailFacts>
        <CanonicalDetailFact label="Valor de compra" mono>
          {formatCurrency(format(purchasePen), preferred)}
        </CanonicalDetailFact>
        <CanonicalDetailFact label="Valor actual" mono>
          {formatCurrency(format(valuePen), preferred)}
        </CanonicalDetailFact>
        <CanonicalDetailFact label="Fecha de compra">
          {new Date(asset.purchase_date + 'T12:00:00').toLocaleDateString('es-PE', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </CanonicalDetailFact>
        <CanonicalDetailFact label="Moneda" mono>{asset.currency}</CanonicalDetailFact>
        <CanonicalDetailFact label={assetType.source === 'CUSTOM' ? 'Tipo personalizado' : 'Tipo'}>
          {assetType.label}
        </CanonicalDetailFact>
        <CanonicalDetailFact label="Estado">{assetStatus.label}</CanonicalDetailFact>
        {asset.serial_number && (
          <CanonicalDetailFact label="N° de serie" mono>{asset.serial_number}</CanonicalDetailFact>
        )}
        {asset.location && (
          <CanonicalDetailFact label="Ubicación">{asset.location}</CanonicalDetailFact>
        )}
        {asset.depreciation_rate != null && asset.depreciation_rate > 0 && (
          <CanonicalDetailFact label="Tasa depreciación" mono>
            {formatPercent(asset.depreciation_rate * 100, { fractionDigits: 2 })} anual
          </CanonicalDetailFact>
        )}
        {asset.notes && (
          <CanonicalDetailFact label="Notas" full>
            <p className="text-sm leading-relaxed text-[var(--ft-text-muted)]">{asset.notes}</p>
          </CanonicalDetailFact>
        )}
      </CanonicalDetailFacts>
    </CanonicalDetailLayout>
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
  const pending   = rec.amount - rec.collected_amount
  const currency = resolveVerifiedObligationCurrency(rec.currency)
  const totalDisplay = currency
    ? formatVerifiedObligationAmount(rec.amount, currency)
    : 'Importe no verificable'
  const collectedDisplay = currency
    ? formatVerifiedObligationAmount(rec.collected_amount, currency)
    : 'Importe no verificable'
  const pendingDisplay = currency
    ? formatVerifiedObligationAmount(pending, currency)
    : 'Importe no verificable'
  const collectedPct = rec.amount > 0 ? (rec.collected_amount / rec.amount) * 100 : 0

  const isOverdue = rec.due_date && new Date(rec.due_date) < new Date() && rec.status !== 'COLLECTED'

  return (
    <CanonicalDetailLayout
      back={<CanonicalDetailBackLink href="/receivables" label="Por cobrar"/>}
      summary={
        <CanonicalDetailSummary
          marker={
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12"/>
              <path d="m7 10 5 5 5-5M5 21h14"/>
            </svg>
          }
          tone="primary"
          badges={<CanonicalDetailBadge>Por cobrar</CanonicalDetailBadge>}
          title={rec.debtor_name}
          subtitle={rec.concept || undefined}
          amount={pendingDisplay}
          amountMeta={
            <span className="text-xs font-medium text-[var(--ft-text-muted)]">
              {currency ? `pendiente · ${currency}` : 'moneda no verificable'}
            </span>
          }
          supporting={rec.status === 'PARTIAL' ? (
            <div>
              <div className="flex flex-col gap-1 text-xs leading-4 text-[var(--ft-text-muted)] sm:flex-row sm:items-center sm:justify-between">
                <span>Cobrado: {formatPercent(collectedPct, { fractionDigits: 0 })}</span>
                <span className="tabular-nums">
                  {collectedDisplay}
                  {' / '}{totalDisplay}
                </span>
              </div>
              <div className="mt-2.5">
                <ProgressBar value={collectedPct} color="var(--ft-primary)" height={5}/>
              </div>
            </div>
          ) : undefined}
        />
      }
      aside={(transaction || isOverdue) ? (
        <div className="space-y-4">
          {transaction && (
            <CanonicalDetailRailSection title="Transacción origen">
              <CanonicalRelatedRecordLink
                label={transaction.description}
                href={`/transactions/${transaction.id}`}
              />
            </CanonicalDetailRailSection>
          )}
          {isOverdue && (
            <CanonicalDetailNotice tone="danger" title="Cuenta vencida">
              <p>
                Venció el {new Date(rec.due_date! + 'T12:00:00').toLocaleDateString('es-PE', {
                  day: 'numeric', month: 'long',
                })}
              </p>
            </CanonicalDetailNotice>
          )}
        </div>
      ) : undefined}
    >
      <CanonicalDetailFacts>
        <CanonicalDetailFact label="Monto total" mono>
          {totalDisplay}
        </CanonicalDetailFact>
        <CanonicalDetailFact label="Moneda" mono>
          {currency ?? 'No verificable'}
        </CanonicalDetailFact>
        <CanonicalDetailFact label="Fecha de emisión">
          {new Date(rec.issue_date + 'T12:00:00').toLocaleDateString('es-PE', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </CanonicalDetailFact>
        {rec.due_date && (
          <CanonicalDetailFact label="Fecha de vencimiento">
            <span className={isOverdue ? 'text-[var(--ft-danger)]' : ''}>
              {new Date(rec.due_date + 'T12:00:00').toLocaleDateString('es-PE', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
          </CanonicalDetailFact>
        )}
        {rec.notes && (
          <CanonicalDetailFact label="Notas" full>
            <p className="text-sm leading-relaxed text-[var(--ft-text-muted)]">{rec.notes}</p>
          </CanonicalDetailFact>
        )}
      </CanonicalDetailFacts>
    </CanonicalDetailLayout>
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
  const pending    = pay.amount - pay.paid_amount
  const currency = resolveVerifiedObligationCurrency(pay.currency)
  const totalDisplay = currency
    ? formatVerifiedObligationAmount(pay.amount, currency)
    : 'Importe no verificable'
  const paidDisplay = currency
    ? formatVerifiedObligationAmount(pay.paid_amount, currency)
    : 'Importe no verificable'
  const pendingDisplay = currency
    ? formatVerifiedObligationAmount(pending, currency)
    : 'Importe no verificable'
  const paidPct    = pay.amount > 0 ? (pay.paid_amount / pay.amount) * 100 : 0

  const isOverdue = pay.due_date && new Date(pay.due_date) < new Date() && pay.status !== 'PAID'

  return (
    <CanonicalDetailLayout
      back={<CanonicalDetailBackLink href="/payables" label="Por pagar"/>}
      summary={
        <CanonicalDetailSummary
          marker={
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21V9"/>
              <path d="m7 14 5-5 5 5M5 3h14"/>
            </svg>
          }
          badges={<CanonicalDetailBadge>Por pagar</CanonicalDetailBadge>}
          title={pay.creditor_name}
          subtitle={pay.concept || undefined}
          amount={pendingDisplay}
          amountMeta={
            <span className="text-xs font-medium text-[var(--ft-text-muted)]">
              {currency ? `pendiente · ${currency}` : 'moneda no verificable'}
            </span>
          }
          supporting={pay.status === 'PARTIAL' ? (
            <div>
              <div className="flex flex-col gap-1 text-xs leading-4 text-[var(--ft-text-muted)] sm:flex-row sm:items-center sm:justify-between">
                <span>Pagado: {formatPercent(paidPct, { fractionDigits: 0 })}</span>
                <span className="tabular-nums">
                  {paidDisplay}
                  {' / '}{totalDisplay}
                </span>
              </div>
              <div className="mt-2.5">
                <ProgressBar value={paidPct} color="var(--ft-primary)" height={5}/>
              </div>
            </div>
          ) : undefined}
        />
      }
      aside={(transaction || isOverdue) ? (
        <div className="space-y-4">
          {transaction && (
            <CanonicalDetailRailSection title="Transacción origen">
              <CanonicalRelatedRecordLink
                label={transaction.description}
                href={`/transactions/${transaction.id}`}
              />
            </CanonicalDetailRailSection>
          )}
          {isOverdue && (
            <CanonicalDetailNotice tone="danger" title="Pago vencido">
              <p>
                Venció el {new Date(pay.due_date! + 'T12:00:00').toLocaleDateString('es-PE', {
                  day: 'numeric', month: 'long',
                })}
              </p>
            </CanonicalDetailNotice>
          )}
        </div>
      ) : undefined}
    >
      <CanonicalDetailFacts>
        <CanonicalDetailFact label="Monto total" mono>
          {totalDisplay}
        </CanonicalDetailFact>
        <CanonicalDetailFact label="Moneda" mono>
          {currency ?? 'No verificable'}
        </CanonicalDetailFact>
        <CanonicalDetailFact label="Fecha de emisión">
          {new Date(pay.issue_date + 'T12:00:00').toLocaleDateString('es-PE', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </CanonicalDetailFact>
        {pay.due_date && (
          <CanonicalDetailFact label="Fecha de vencimiento">
            <span className={isOverdue ? 'text-[var(--ft-danger)]' : ''}>
              {new Date(pay.due_date + 'T12:00:00').toLocaleDateString('es-PE', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
          </CanonicalDetailFact>
        )}
        {pay.notes && (
          <CanonicalDetailFact label="Notas" full>
            <p className="text-sm leading-relaxed text-[var(--ft-text-muted)]">{pay.notes}</p>
          </CanonicalDetailFact>
        )}
      </CanonicalDetailFacts>
    </CanonicalDetailLayout>
  )
}
