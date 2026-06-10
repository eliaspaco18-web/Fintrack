'use client'

import { Button } from '@/components/ui/Button'
import { NumericInput } from '@/components/ui/NumericInput'
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

type BillingCycleRow = {
  id: string
  billing_month: string
  billing_year: string
  consumption_from: string
  consumption_to: string
  payment_date: string
  total_to_pay: string
  statement_file: File | null
}

type YearOption = {
  value: string
  label: string
}

interface CreditCardScheduleModalProps {
  open: boolean
  onClose: () => void
  cycles: BillingCycleRow[]
  duplicateCycleKeys: Set<string>
  duplicateCycleLabels: string[]
  registeredTotal: number
  yearOptions: YearOption[]
  disabled?: boolean
  onAddCycle: () => void
  onRemoveCycle: (id: string) => void
  onUpdateCycle: (id: string, patch: Partial<BillingCycleRow>) => void
  onFileChange: (id: string, file: File | null) => void
}

const CREDIT_CARD_SCHEDULE_COLUMN_SHARES = {
  period: '26%',
  consumptionFrom: '13%',
  consumptionTo: '13%',
  paymentDate: '13%',
  totalToPay: '12%',
  statement: '16%',
  actions: '7%',
} as const

function colWidth(value: string) {
  return { width: value }
}

export function CreditCardScheduleModal({
  open,
  onClose,
  cycles,
  duplicateCycleKeys,
  duplicateCycleLabels,
  registeredTotal,
  yearOptions,
  disabled = false,
  onAddCycle,
  onRemoveCycle,
  onUpdateCycle,
  onFileChange,
}: CreditCardScheduleModalProps) {
  const duplicateMessage = formatDuplicateCycleMessage(duplicateCycleLabels)

  return (
    <RecordModal
      open={open}
      onClose={onClose}
      eyebrow="Créditos"
      title="Cronograma completo de la tarjeta"
      subtitle="Edita todos los ciclos de facturación en una ventana dedicada, con ancho completo y lectura estable de punta a punta."
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
      <div className="flex h-full min-h-0 w-full flex-col gap-4">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--ft-text)]">
              Ciclos de facturación
            </p>
            <p className="text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
              Ajusta períodos, fechas y estado de cuenta sin comprimir la lectura del cronograma.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-[var(--ft-form-radius-sm)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3 py-2 text-center">
              <p className="text-[10px] font-medium tracking-[0.08em] text-[var(--ft-form-muted)]">
                Ciclos
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--ft-text)] tabular-nums">
                {cycles.length}
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={onAddCycle} disabled={disabled}>
              Agregar ciclo
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)]">
          <div className="min-h-0 w-full flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[1180px] table-fixed text-[12px]">
              <colgroup>
                <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.period)} />
                <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.consumptionFrom)} />
                <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.consumptionTo)} />
                <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.paymentDate)} />
                <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.totalToPay)} />
                <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.statement)} />
                <col style={colWidth(CREDIT_CARD_SCHEDULE_COLUMN_SHARES.actions)} />
              </colgroup>
              <thead className="sticky top-0 z-[1] bg-[var(--ft-surface-muted)]">
                <tr className="text-[var(--ft-form-muted)]">
                  <th className="px-3 py-2 text-center font-semibold">Periodo</th>
                  <th className="px-3 py-2 text-center font-semibold">Consumo desde</th>
                  <th className="px-3 py-2 text-center font-semibold">Consumo hasta</th>
                  <th className="px-3 py-2 text-center font-semibold">Fecha de pago</th>
                  <th className="px-3 py-2 text-center font-semibold">Total a pagar</th>
                  <th className="px-3 py-2 text-center font-semibold">Estado de cuenta</th>
                  <th className="px-3 py-2 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map(cycle => {
                  const cycleKey = `${cycle.billing_year}-${cycle.billing_month}`
                  const isDuplicate = duplicateCycleKeys.has(cycleKey)
                  const inputId = `cycle-statement-${cycle.id}`
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
                              aria-label="Mes del período"
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
                              aria-label="Año del período"
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
                              Período duplicado.
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

                      <td className="px-3 py-3 align-middle">
                        <NumericInput
                          step="0.01"
                          decimals={2}
                          min={0}
                          value={cycle.total_to_pay}
                          onValueChange={value => onUpdateCycle(cycle.id, { total_to_pay: value })}
                          className="field-base ft-form-input h-10 w-full px-3 py-2 text-right text-[12px] tabular-nums"
                          disabled={disabled}
                        />
                      </td>

                      <td className="px-3 py-3 align-middle">
                        <input
                          id={inputId}
                          type="file"
                          className="sr-only"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                          onChange={event => onFileChange(cycle.id, event.target.files?.[0] ?? null)}
                          disabled={disabled}
                        />
                        <label
                          htmlFor={inputId}
                          role="button"
                          tabIndex={disabled ? -1 : 0}
                          title={cycle.statement_file ? cycle.statement_file.name : `Subir estado de cuenta de ${periodLabel}`}
                          aria-label={cycle.statement_file
                            ? `Reemplazar estado de cuenta de ${periodLabel}`
                            : `Subir estado de cuenta de ${periodLabel}`}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              document.getElementById(inputId)?.click()
                            }
                          }}
                          className="
                            inline-flex h-10 w-full items-center rounded-[var(--ft-radius-control)] border border-[var(--ft-form-border)]
                            bg-[var(--ft-surface-muted)] px-3 text-left text-[11px] font-medium text-[var(--ft-form-muted)]
                            transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
                            hover:border-[var(--ft-border-strong)] hover:text-[var(--ft-text)]
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ft-primary-soft)] focus-visible:ring-offset-2
                            focus-visible:ring-offset-[var(--ft-bg)]
                          "
                        >
                          <span className="block w-full truncate">
                            {cycle.statement_file ? cycle.statement_file.name : 'Subir archivo'}
                          </span>
                        </label>
                      </td>

                      <td className="px-3 py-3 text-center align-middle">
                        {cycles.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => onRemoveCycle(cycle.id)}
                            className="
                              inline-flex h-8 min-w-[72px] items-center justify-center rounded-[var(--ft-radius-control)]
                              border border-[var(--ft-form-border)] px-2 text-[11px] font-medium text-[var(--ft-form-muted)]
                              transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
                              hover:border-[rgba(184,74,74,0.22)] hover:bg-[var(--ft-danger-soft)] hover:text-[var(--ft-form-error)]
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ft-primary-soft)] focus-visible:ring-offset-2
                              focus-visible:ring-offset-[var(--ft-bg)]
                            "
                            aria-label={`Eliminar ciclo ${periodLabel}`}
                            disabled={disabled}
                          >
                            Eliminar
                          </button>
                        ) : null}
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
                    {formatNumber(registeredTotal)}
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
      </div>
    </RecordModal>
  )
}
