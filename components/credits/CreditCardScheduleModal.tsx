'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FormActions } from '@/components/forms/primitives'
import { RecordModal } from '@/components/ui/RecordModal'
import {
  CREDIT_CARD_DATE_INPUT_MIN_WIDTH,
  CREDIT_CARD_MONTH_SELECT_MIN_WIDTH,
  CREDIT_CARD_YEAR_SELECT_MIN_WIDTH,
  SCHEDULE_MONTHS,
  formatBillingCycleLabel,
  formatDuplicateCycleMessage,
} from '@/components/credits/credits-schedule.constants'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import {
  ATTACHMENT_LEGACY_REFERENCE_NOTICE,
  ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
} from '@/modules/attachments/attachment-integrity'

type BillingCycleRow = {
  id: string
  billing_month: string
  billing_year: string
  consumption_from: string
  consumption_to: string
  payment_date: string
  total_to_pay: string
  total_to_pay_pen?: number
  total_to_pay_usd?: number
  movement_summary?: BillingCycleMovementSummary | null
  can_delete?: boolean
  statement_url: string | null
}

type BillingCycleMovement = {
  id: string
  type: string
  description: string
  amount: number
  currency: string
  transaction_date: string
  payment_method: string | null
  source_account_id: string | null
  destination_account_id: string | null
  movement_kind?: 'CONSUMPTION' | 'PAYMENT'
}

type BillingCycleMovementSummary = {
  initial_pen: number
  initial_usd: number
  consumption_pen: number
  consumption_usd: number
  payment_pen: number
  payment_usd: number
  total_pen: number
  total_usd: number
  movement_count: number
  consumptions: BillingCycleMovement[]
  payments: BillingCycleMovement[]
  movements: BillingCycleMovement[]
}

type YearOption = {
  value: string
  label: string
}

interface CreditCardScheduleEditorProps {
  cycles: BillingCycleRow[]
  duplicateCycleKeys: Set<string>
  duplicateCycleLabels: string[]
  yearOptions: YearOption[]
  disabled?: boolean
  compact?: boolean
  onAddCycle: () => void
  onRemoveCycle: (id: string) => void
  onUpdateCycle: (id: string, patch: Partial<BillingCycleRow>) => void
  onMovementModalOpenChange?: (open: boolean) => void
}

interface CreditCardScheduleModalProps extends CreditCardScheduleEditorProps {
  open: boolean
  onClose: () => void
}

const CREDIT_CARD_SCHEDULE_COLUMN_SHARES = {
  period: '22%',
  consumptionFrom: '12%',
  consumptionTo: '12%',
  paymentDate: '12%',
  totalPen: '9%',
  totalUsd: '9%',
  statement: '14%',
  actions: '10%',
} as const

function colWidth(value: string) {
  return { width: value }
}

function UploadDocumentIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15V4m0 0 4 4m-4-4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 14.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function OpenMovementsIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 7h10M8 12h10M8 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4h6m-8 4h10m-9 0 .7 11h6.6L16 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function cycleTotalPen(cycle: BillingCycleRow) {
  return Number(cycle.total_to_pay_pen ?? cycle.total_to_pay ?? 0)
}

function cycleTotalUsd(cycle: BillingCycleRow) {
  return Number(cycle.total_to_pay_usd ?? 0)
}

function closeMovementModal(
  setMovementCycleId: (value: string | null) => void,
  setMovementKindFilter: (value: 'ALL' | 'CONSUMPTION' | 'PAYMENT') => void,
  setMovementSearch: (value: string) => void,
) {
  setMovementCycleId(null)
  setMovementKindFilter('ALL')
  setMovementSearch('')
}

export function CreditCardScheduleEditor({
  cycles,
  duplicateCycleKeys,
  duplicateCycleLabels,
  yearOptions,
  disabled = false,
  compact = false,
  onAddCycle,
  onRemoveCycle,
  onUpdateCycle,
  onMovementModalOpenChange,
}: CreditCardScheduleEditorProps) {
  const duplicateMessage = formatDuplicateCycleMessage(duplicateCycleLabels)
  const [movementCycleId, setMovementCycleId] = useState<string | null>(null)
  const [movementKindFilter, setMovementKindFilter] = useState<'ALL' | 'CONSUMPTION' | 'PAYMENT'>('ALL')
  const [movementSearch, setMovementSearch] = useState('')
  const movementCycle = useMemo(
    () => cycles.find(cycle => cycle.id === movementCycleId) ?? null,
    [cycles, movementCycleId],
  )
  const movementSummary = movementCycle?.movement_summary ?? null
  const movementRows = useMemo(() => {
    const normalizedSearch = movementSearch.trim().toLocaleLowerCase('es')
    return (movementSummary?.movements ?? []).filter(movement => {
      const isPayment = movement.movement_kind === 'PAYMENT'
      if (movementKindFilter === 'CONSUMPTION' && isPayment) return false
      if (movementKindFilter === 'PAYMENT' && !isPayment) return false
      if (!normalizedSearch) return true
      return movement.description.toLocaleLowerCase('es').includes(normalizedSearch)
    })
  }, [movementKindFilter, movementSearch, movementSummary])
  const totalPen = useMemo(
    () => cycles.reduce((sum, cycle) => sum + cycleTotalPen(cycle), 0),
    [cycles],
  )
  const totalUsd = useMemo(
    () => cycles.reduce((sum, cycle) => sum + cycleTotalUsd(cycle), 0),
    [cycles],
  )

  useEffect(() => {
    onMovementModalOpenChange?.(Boolean(movementCycle))
  }, [movementCycle, onMovementModalOpenChange])

  return (
    <div className="flex min-h-0 w-full flex-col gap-3">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--ft-text)]">
            Ciclos de facturación
          </p>
          <p className="max-w-[68ch] text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
            Ajusta periodos y fechas, y revisa los movimientos del periodo desde esta misma vista.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="grid grid-cols-3 overflow-hidden rounded-[var(--ft-form-radius-sm)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] text-center">
            <div className="min-w-[74px] px-2.5 py-2">
              <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">Ciclos</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--ft-text)] tabular-nums">{cycles.length}</p>
            </div>
            <div className="min-w-[92px] border-l border-[var(--ft-form-border)] px-2.5 py-2">
              <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">PEN</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--ft-text)] tabular-nums">{formatNumber(totalPen)}</p>
            </div>
            <div className="min-w-[92px] border-l border-[var(--ft-form-border)] px-2.5 py-2">
              <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">USD</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--ft-text)] tabular-nums">{formatNumber(totalUsd)}</p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onAddCycle} disabled={disabled}>
            Agregar ciclo
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)]">
        <div className={`min-h-0 w-full overflow-x-auto overflow-y-auto ${compact ? 'max-h-[330px]' : 'max-h-[52vh]'}`}>
          <table className="w-full min-w-[1180px] table-fixed text-[12px]">
            <colgroup>
              <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.period)} />
              <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.consumptionFrom)} />
              <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.consumptionTo)} />
              <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.paymentDate)} />
              <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.totalPen)} />
              <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.totalUsd)} />
              <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.statement)} />
              <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.actions)} />
            </colgroup>
            <thead className="sticky top-0 z-[1] bg-[var(--ft-surface-muted)]">
              <tr className="text-[var(--ft-form-muted)]">
                <th rowSpan={2} className="px-3 py-2 text-center align-middle font-semibold">Periodo</th>
                <th rowSpan={2} className="px-3 py-2 text-center align-middle font-semibold">Consumo desde</th>
                <th rowSpan={2} className="px-3 py-2 text-center align-middle font-semibold">Consumo hasta</th>
                <th rowSpan={2} className="px-3 py-2 text-center align-middle font-semibold">Fecha de pago</th>
                <th colSpan={2} className="border-b border-[var(--ft-form-border)] px-3 py-2 text-center font-semibold">Total a pagar</th>
                <th rowSpan={2} className="px-3 py-2 text-center align-middle font-semibold">Estado de cuenta</th>
                <th rowSpan={2} className="px-3 py-2 text-center align-middle font-semibold">Acciones</th>
              </tr>
              <tr className="text-[10px] uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">
                <th className="px-3 py-1.5 text-right font-semibold">Soles</th>
                <th className="px-3 py-1.5 text-right font-semibold">Dólares</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map(cycle => {
                const cycleKey = `${cycle.billing_year}-${cycle.billing_month}`
                const isDuplicate = duplicateCycleKeys.has(cycleKey)
                const periodLabel = formatBillingCycleLabel(cycle.billing_month, cycle.billing_year)

                return (
                  <tr key={cycle.id} className="h-14 border-t border-[var(--ft-form-border)] align-top">
                    <td className="px-3 py-3 align-middle">
                      <div
                        className={`
                          rounded-[var(--ft-form-radius-sm)] border px-2 py-2
                          ${isDuplicate
                            ? 'border-[color:var(--ft-form-error)] bg-[var(--ft-danger-soft)]'
                            : 'border-[var(--ft-form-border)] bg-[var(--ft-form-surface)]'}
                        `}
                      >
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_84px] items-center gap-2">
                          <select
                            aria-label="Mes del periodo"
                            value={cycle.billing_month}
                            onChange={event => onUpdateCycle(cycle.id, { billing_month: event.target.value })}
                            className="field-base ft-form-input h-10 w-full min-w-[128px] px-2.5 py-0 text-left text-[12px]"
                            style={{ minWidth: `${CREDIT_CARD_MONTH_SELECT_MIN_WIDTH}px` }}
                            disabled={disabled}
                          >
                            {SCHEDULE_MONTHS.map(month => (
                              <option key={month.value} value={month.value}>
                                {month.label}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label="Año del periodo"
                            value={cycle.billing_year}
                            onChange={event => onUpdateCycle(cycle.id, { billing_year: event.target.value })}
                            className="field-base ft-form-input h-10 w-[84px] min-w-[84px] px-2.5 py-0 text-center text-[12px]"
                            style={{ minWidth: `${CREDIT_CARD_YEAR_SELECT_MIN_WIDTH}px` }}
                            disabled={disabled}
                          >
                            {yearOptions.map(year => (
                              <option key={year.value} value={year.value}>
                                {year.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {isDuplicate ? (
                          <p className="mt-2 text-[11px] font-medium text-[var(--ft-form-error)]">
                            Periodo duplicado.
                          </p>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-3 align-middle">
                      <input
                        type="date"
                        value={cycle.consumption_from}
                        onChange={event => onUpdateCycle(cycle.id, { consumption_from: event.target.value })}
                        className="field-base ft-form-input credits-date-input h-10 w-full min-w-[136px] px-2 py-2 text-[12px]"
                        style={{ minWidth: `${CREDIT_CARD_DATE_INPUT_MIN_WIDTH}px` }}
                        required
                        disabled={disabled}
                      />
                    </td>

                    <td className="px-3 py-3 align-middle">
                      <input
                        type="date"
                        value={cycle.consumption_to}
                        onChange={event => onUpdateCycle(cycle.id, { consumption_to: event.target.value })}
                        className="field-base ft-form-input credits-date-input h-10 w-full min-w-[136px] px-2 py-2 text-[12px]"
                        style={{ minWidth: `${CREDIT_CARD_DATE_INPUT_MIN_WIDTH}px` }}
                        required
                        disabled={disabled}
                      />
                    </td>

                    <td className="px-3 py-3 align-middle">
                      <input
                        type="date"
                        value={cycle.payment_date}
                        onChange={event => onUpdateCycle(cycle.id, { payment_date: event.target.value })}
                        className="field-base ft-form-input credits-date-input h-10 w-full min-w-[136px] px-2 py-2 text-[12px]"
                        style={{ minWidth: `${CREDIT_CARD_DATE_INPUT_MIN_WIDTH}px` }}
                        required
                        disabled={disabled}
                      />
                    </td>

                    <td className="px-3 py-3 text-right align-middle">
                      <span className="font-semibold text-[var(--ft-text)] tabular-nums">S/ {formatNumber(cycleTotalPen(cycle))}</span>
                    </td>

                    <td className="px-3 py-3 text-right align-middle">
                      <span className="font-semibold text-[var(--ft-text)] tabular-nums">USD {formatNumber(cycleTotalUsd(cycle))}</span>
                    </td>

                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span
                          title={cycle.statement_url
                            ? ATTACHMENT_LEGACY_REFERENCE_NOTICE
                            : ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE}
                          aria-label={`Carga de estado de cuenta no disponible para ${periodLabel}`}
                          className="
                            inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ft-radius-control)]
                            border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] text-[var(--ft-form-muted)]
                            cursor-not-allowed opacity-60
                          "
                          data-testid={`billing-cycle-attachment-unavailable-${cycle.id}`}
                        >
                          <UploadDocumentIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 text-[11px] font-medium leading-[1.35] text-[var(--ft-form-muted)]">
                          {cycle.statement_url ? 'Referencia anterior · no verificada' : 'Carga no disponible'}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMovementCycleId(cycle.id)}
                          className="
                            inline-flex h-9 w-9 items-center justify-center rounded-[var(--ft-radius-control)]
                            border border-[var(--ft-form-border)] text-[var(--ft-form-muted)]
                            transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
                            hover:border-[var(--ft-border-strong)] hover:text-[var(--ft-text)]
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ft-primary-soft)] focus-visible:ring-offset-2
                            focus-visible:ring-offset-[var(--ft-bg)]
                          "
                          title={`Ver movimientos de ${periodLabel}`}
                          aria-label={`Ver movimientos de ${periodLabel}`}
                          disabled={disabled}
                        >
                          <OpenMovementsIcon className="h-4 w-4" />
                        </button>
                        {cycles.length > 1 && cycle.can_delete ? (
                          <button
                            type="button"
                            onClick={() => onRemoveCycle(cycle.id)}
                            className="
                              inline-flex h-9 w-9 items-center justify-center rounded-[var(--ft-radius-control)]
                              border border-[var(--ft-form-border)] text-[var(--ft-form-muted)]
                              transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
                              hover:border-[rgba(184,74,74,0.22)] hover:bg-[var(--ft-danger-soft)] hover:text-[var(--ft-form-error)]
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ft-primary-soft)] focus-visible:ring-offset-2
                              focus-visible:ring-offset-[var(--ft-bg)]
                            "
                            title={`Eliminar ciclo ${periodLabel}`}
                            aria-label={`Eliminar ciclo ${periodLabel}`}
                            disabled={disabled}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[var(--ft-surface-muted)]">
              <tr className="border-t border-[var(--ft-form-border)]">
                <td colSpan={4} className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">
                  Total registrado
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold text-[var(--ft-text)] tabular-nums">
                  S/ {formatNumber(totalPen)}
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold text-[var(--ft-text)] tabular-nums">
                  USD {formatNumber(totalUsd)}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {duplicateMessage ? (
        <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
          <p className="text-[12px] font-medium text-[var(--ft-form-error)]">
            {duplicateMessage}
          </p>
        </div>
      ) : null}

      <RecordModal
        open={Boolean(movementCycle)}
        onClose={() => closeMovementModal(setMovementCycleId, setMovementKindFilter, setMovementSearch)}
        eyebrow="Créditos"
        title={movementCycle ? `Movimientos de ${formatBillingCycleLabel(movementCycle.billing_month, movementCycle.billing_year)}` : 'Movimientos del periodo'}
        subtitle="Consumos y pagos vinculados a esta tarjeta dentro del rango de facturación."
        widthClassName="w-[calc(100vw-32px)] max-w-[1040px]"
        overlayClassName="z-[142]"
        footer={(
          <FormActions
            primaryAction={null}
            secondaryAction={(
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => closeMovementModal(setMovementCycleId, setMovementKindFilter, setMovementSearch)}
              >
                Cerrar
              </Button>
            )}
          />
        )}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ['Inicial', `S/ ${formatNumber(movementSummary?.initial_pen ?? 0)}`, `USD ${formatNumber(movementSummary?.initial_usd ?? 0)}`],
              ['Consumos', `S/ ${formatNumber(movementSummary?.consumption_pen ?? 0)}`, `USD ${formatNumber(movementSummary?.consumption_usd ?? 0)}`],
              ['Pagos', `S/ ${formatNumber(movementSummary?.payment_pen ?? 0)}`, `USD ${formatNumber(movementSummary?.payment_usd ?? 0)}`],
              ['Total', `S/ ${formatNumber(movementSummary?.total_pen ?? 0)}`, `USD ${formatNumber(movementSummary?.total_usd ?? 0)}`],
            ].map(([label, pen, usd]) => (
              <div key={label} className="rounded-[var(--ft-form-radius-sm)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">{label}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2 text-[13px] font-semibold text-[var(--ft-text)] tabular-nums">
                  <span>{pen}</span>
                  <span className="text-right">{usd}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)]">
            <div className="flex flex-col gap-2 border-b border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['ALL', 'Todos'],
                  ['CONSUMPTION', 'Consumos'],
                  ['PAYMENT', 'Pagos'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMovementKindFilter(value)}
                    className={`rounded-[var(--ft-radius-control)] border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      movementKindFilter === value
                        ? 'border-[var(--ft-primary)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]'
                        : 'border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] text-[var(--ft-form-muted)] hover:text-[var(--ft-text)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={movementSearch}
                onChange={event => setMovementSearch(event.target.value)}
                className="field-base ft-form-input h-9 w-full px-3 py-2 text-[12px] sm:max-w-[280px]"
                placeholder="Buscar movimiento"
              />
            </div>
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full min-w-[720px] text-[12px]">
                <thead className="sticky top-0 bg-[var(--ft-surface-muted)] text-[var(--ft-form-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold">Descripción</th>
                    <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                    <th className="px-3 py-2 text-right font-semibold">PEN</th>
                    <th className="px-3 py-2 text-right font-semibold">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {movementRows.length > 0 ? movementRows.map(movement => {
                    const isPayment = movement.movement_kind === 'PAYMENT'
                    const movementTypeLabel = movement.type === 'TRANSFER'
                      ? (isPayment ? 'Pago TC' : 'Disposición')
                      : (isPayment ? 'Pago' : 'Consumo')
                    return (
                      <tr key={movement.id} className="border-t border-[var(--ft-form-border)]">
                        <td className="px-3 py-2 tabular-nums">{movement.transaction_date}</td>
                        <td className="px-3 py-2">{movement.description}</td>
                        <td className="px-3 py-2">{movementTypeLabel}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {movement.currency === 'PEN' ? `S/ ${formatNumber(Number(movement.amount ?? 0))}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {movement.currency === 'USD' ? `USD ${formatNumber(Number(movement.amount ?? 0))}` : '-'}
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[var(--ft-form-muted)]">
                        No hay movimientos en este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </RecordModal>
    </div>
  )
}

export function CreditCardScheduleModal({
  open,
  onClose,
  ...editorProps
}: CreditCardScheduleModalProps) {
  return (
    <RecordModal
      open={open}
      onClose={onClose}
      eyebrow="Créditos"
      title="Cronograma completo de la tarjeta"
      subtitle="Edita ciclos de facturación, estados de cuenta y movimientos del periodo en una lectura estable."
      size="full-form"
      widthClassName="w-[calc(100vw-32px)] max-w-[1240px]"
      overlayClassName="z-[132]"
      bodyClassName="credits-modal-body !overflow-hidden py-4"
      footer={(
        <FormActions
          secondaryAction={(
            <Button type="button" variant="secondary" size="lg" onClick={onClose}>
              Cerrar
            </Button>
          )}
          primaryAction={(
            <Button type="button" variant="primary" size="lg" onClick={onClose}>
              Listo
            </Button>
          )}
        />
      )}
    >
      <CreditCardScheduleEditor {...editorProps} />
    </RecordModal>
  )
}
