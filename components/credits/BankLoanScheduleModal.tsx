'use client'

import { Button } from '@/components/ui/Button'
import { NumericInput } from '@/components/ui/NumericInput'
import { FormActions } from '@/components/forms/primitives'
import { RecordModal } from '@/components/ui/RecordModal'
import {
  BANK_LOAN_DATE_INPUT_MIN_WIDTH,
} from '@/components/credits/credits-schedule.constants'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import { parseNumericInput } from '@/lib/utils/numeric-input'

type InstallmentRow = {
  id: string
  due_date: string
  principal_amount: string
  interest_amount: string
  insurance_amount: string
  other_charges: string
}

type ScheduleTotals = {
  principal: number
  interest: number
  insurance: number
  others: number
  installmentTotal: number
}

interface BankLoanScheduleModalProps {
  open: boolean
  onClose: () => void
  installments: InstallmentRow[]
  totalInstallmentsNum: number
  scheduleTotal: ScheduleTotals
  disabled?: boolean
  onUpdateInstallment: (id: string, patch: Partial<InstallmentRow>) => void
}

const BANK_LOAN_SCHEDULE_COLUMN_SHARES = {
  installmentNumber: '6%',
  dueDate: '16%',
  principal: '15%',
  interest: '15%',
  insurance: '15%',
  others: '15%',
  installmentTotal: '18%',
} as const

function colWidth(value: string) {
  return { width: value }
}

function SummaryMetric({
  label,
  value,
  emphasized = false,
}: {
  label: string
  value: number
  emphasized?: boolean
}) {
  return (
    <div
      className={`
        min-h-[84px] rounded-[var(--ft-form-radius-sm)] border border-[var(--ft-form-border)] px-3.5 py-3
        ${emphasized ? 'bg-[var(--ft-form-surface)]' : 'bg-[var(--ft-surface-muted)]'}
      `}
    >
      <p className="text-[11px] font-medium leading-[1.35] text-[var(--ft-form-muted)]">
        {label}
      </p>
      <p
        className={`
          mt-2 text-[15px] font-semibold leading-[1.35] text-[var(--ft-text)] tabular-nums
          ${emphasized ? 'text-[16px] tracking-[-0.01em]' : ''}
        `}
      >
        {formatNumber(value)}
      </p>
    </div>
  )
}

export function BankLoanScheduleModal({
  open,
  onClose,
  installments,
  totalInstallmentsNum,
  scheduleTotal,
  disabled = false,
  onUpdateInstallment,
}: BankLoanScheduleModalProps) {
  const showEmptyState = totalInstallmentsNum < 1 || installments.length === 0

  return (
    <RecordModal
      open={open}
      onClose={onClose}
      eyebrow="Créditos"
      title="Cronograma completo del préstamo"
      subtitle="Edita el calendario entero de cuotas en una ventana dedicada, con columnas estables y totales visibles."
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
        <div className="space-y-1">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--ft-text)]">
            Editor completo de cuotas
          </p>
          <p className="text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
            Revisa capital, intereses, seguro y total de cada cuota desde una tabla de ancho completo.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryMetric label="Capital" value={scheduleTotal.principal} />
          <SummaryMetric label="Intereses" value={scheduleTotal.interest} />
          <SummaryMetric label="Seguro" value={scheduleTotal.insurance} />
          <SummaryMetric label="Otros" value={scheduleTotal.others} />
          <SummaryMetric label="Total estimado" value={scheduleTotal.installmentTotal} emphasized />
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)]">
          <div className="min-h-0 w-full flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[1080px] table-fixed text-[12px]">
              <colgroup>
                <col style={colWidth(BANK_LOAN_SCHEDULE_COLUMN_SHARES.installmentNumber)} />
                <col style={colWidth(BANK_LOAN_SCHEDULE_COLUMN_SHARES.dueDate)} />
                <col style={colWidth(BANK_LOAN_SCHEDULE_COLUMN_SHARES.principal)} />
                <col style={colWidth(BANK_LOAN_SCHEDULE_COLUMN_SHARES.interest)} />
                <col style={colWidth(BANK_LOAN_SCHEDULE_COLUMN_SHARES.insurance)} />
                <col style={colWidth(BANK_LOAN_SCHEDULE_COLUMN_SHARES.others)} />
                <col style={colWidth(BANK_LOAN_SCHEDULE_COLUMN_SHARES.installmentTotal)} />
              </colgroup>
              <thead className="sticky top-0 z-[1] bg-[var(--ft-surface-muted)]">
                <tr className="text-[var(--ft-form-muted)]">
                  <th className="px-3 py-2 text-center font-semibold">#</th>
                  <th className="px-3 py-2 text-center font-semibold">Vencimiento</th>
                  <th className="px-3 py-2 text-center font-semibold">Capital</th>
                  <th className="px-3 py-2 text-center font-semibold">Intereses</th>
                  <th className="px-3 py-2 text-center font-semibold">Seguro</th>
                  <th className="px-3 py-2 text-center font-semibold">Otros</th>
                  <th className="px-3 py-2 text-center font-semibold">Cuota</th>
                </tr>
              </thead>
              <tbody>
                {showEmptyState ? (
                  <tr className="border-t border-[var(--ft-form-border)]">
                    <td colSpan={7} className="px-4 py-10 text-center text-[12px] text-[var(--ft-form-muted)]">
                      Ingresa el número de cuotas para generar el cronograma.
                    </td>
                  </tr>
                ) : (
                  installments.map((row, index) => {
                    const principal = parseNumericInput(row.principal_amount, 0) ?? 0
                    const interest = parseNumericInput(row.interest_amount, 0) ?? 0
                    const insurance = parseNumericInput(row.insurance_amount, 0) ?? 0
                    const others = parseNumericInput(row.other_charges, 0) ?? 0
                    const installmentTotal = principal + interest + insurance + others

                    return (
                      <tr key={row.id} className="h-[52px] border-t border-[var(--ft-form-border)]">
                        <td className="px-3 py-3 text-center align-middle font-semibold text-[var(--ft-text)] tabular-nums">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <input
                            type="date"
                            value={row.due_date}
                            onChange={event => onUpdateInstallment(row.id, { due_date: event.target.value })}
                            className="field-base ft-form-input credits-date-input h-10 w-full min-w-[136px] px-2 py-2 text-[12px]"
                            style={{ minWidth: `${BANK_LOAN_DATE_INPUT_MIN_WIDTH}px` }}
                            required
                            disabled={disabled}
                          />
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <NumericInput
                            step="0.01"
                            decimals={2}
                            min={0}
                            value={row.principal_amount}
                            onValueChange={value => onUpdateInstallment(row.id, { principal_amount: value })}
                            className="field-base ft-form-input h-10 w-full px-3 py-2 text-right text-[12px] tabular-nums"
                            disabled={disabled}
                          />
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <NumericInput
                            step="0.01"
                            decimals={2}
                            min={0}
                            value={row.interest_amount}
                            onValueChange={value => onUpdateInstallment(row.id, { interest_amount: value })}
                            className="field-base ft-form-input h-10 w-full px-3 py-2 text-right text-[12px] tabular-nums"
                            disabled={disabled}
                          />
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <NumericInput
                            step="0.01"
                            decimals={2}
                            min={0}
                            value={row.insurance_amount}
                            onValueChange={value => onUpdateInstallment(row.id, { insurance_amount: value })}
                            className="field-base ft-form-input h-10 w-full px-3 py-2 text-right text-[12px] tabular-nums"
                            disabled={disabled}
                          />
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <NumericInput
                            step="0.01"
                            decimals={2}
                            min={0}
                            value={row.other_charges}
                            onValueChange={value => onUpdateInstallment(row.id, { other_charges: value })}
                            className="field-base ft-form-input h-10 w-full px-3 py-2 text-right text-[12px] tabular-nums"
                            disabled={disabled}
                          />
                        </td>
                        <td className="px-3 py-3 text-right align-middle text-[13px] font-semibold text-[var(--ft-text)] tabular-nums">
                          {formatNumber(installmentTotal)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[var(--ft-surface-muted)]">
                <tr className="border-t border-[var(--ft-form-border)]">
                  <td colSpan={2} className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">
                    Totales
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-[var(--ft-text)] tabular-nums">
                    {formatNumber(scheduleTotal.principal)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-[var(--ft-text)] tabular-nums">
                    {formatNumber(scheduleTotal.interest)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-[var(--ft-text)] tabular-nums">
                    {formatNumber(scheduleTotal.insurance)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-[var(--ft-text)] tabular-nums">
                    {formatNumber(scheduleTotal.others)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-[var(--ft-text)] tabular-nums">
                    {formatNumber(scheduleTotal.installmentTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </RecordModal>
  )
}
