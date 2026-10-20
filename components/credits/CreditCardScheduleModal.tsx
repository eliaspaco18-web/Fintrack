'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FormActions } from '@/components/forms/primitives'
import { RecordModal } from '@/components/ui/RecordModal'
import { AppSelect } from '@/components/ui/AppSelect'
import { CreditScheduleDateField } from '@/components/credits/CreditScheduleDateField'
import {
  SCHEDULE_MONTHS,
  formatBillingCycleLabel,
  formatDuplicateCycleMessage,
} from '@/components/credits/credits-schedule.constants'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import { getBillingCycleDateIssue } from '@/modules/credits/billing-cycle-integrity'
import workbenchStyles from '@/components/credits/CreditsWorkbench.module.css'

export type BillingCycleRow = {
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
  /** Client-only file staged before the billing-cycle record exists. */
  statement_file?: File | null
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
  onStatementUpload?: (cycleId: string, file: File) => void
  onStatementOpen?: (cycleId: string) => void
  statementUploadCycleId?: string | null
  onMovementModalOpenChange?: (open: boolean) => void
}

interface CreditCardScheduleModalProps extends CreditCardScheduleEditorProps {
  open: boolean
  onClose: () => void
  onExitComplete?: () => void
}

const CREDIT_CARD_SCHEDULE_COLUMN_SHARES = {
  period: '18%',
  consumptionFrom: '13%',
  consumptionTo: '13%',
  paymentDate: '13%',
  totalPen: '9%',
  totalUsd: '9%',
  statement: '11%',
  actions: '14%',
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

function OpenDocumentIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 4h6v6m-.5-5.5-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CyclePeriodFields({
  cycle,
  yearOptions,
  duplicate,
  dateIssue,
  disabled,
  suffix = '',
  compact = false,
  onUpdateCycle,
}: {
  cycle: BillingCycleRow
  yearOptions: YearOption[]
  duplicate: boolean
  dateIssue: string | null
  disabled: boolean
  suffix?: string
  compact?: boolean
  onUpdateCycle: (id: string, patch: Partial<BillingCycleRow>) => void
}) {
  return (
    <div className="min-w-0">
      <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)_76px] items-center ${compact ? 'gap-1.5' : 'gap-1'}`}>
        <AppSelect
          ariaLabel="Mes del periodo"
          value={cycle.billing_month}
          onChange={value => onUpdateCycle(cycle.id, { billing_month: value })}
          className="min-w-0 w-full"
          buttonClassName="h-10 min-h-10 px-2 text-left text-[12px]"
          compact
          searchable={false}
          matchTriggerWidth
          disabled={disabled}
          options={SCHEDULE_MONTHS}
          testId={`credit-cycle-month-${cycle.id}${suffix}`}
        />
        <AppSelect
          ariaLabel="Año del periodo"
          value={cycle.billing_year}
          onChange={value => onUpdateCycle(cycle.id, { billing_year: value })}
          className="w-[76px] min-w-[76px]"
          buttonClassName="h-10 min-h-10 px-1.5 text-center text-[12px]"
          compact
          searchable
          searchPlaceholder="Buscar año…"
          matchTriggerWidth
          disabled={disabled}
          options={yearOptions}
          testId={`credit-cycle-year-${cycle.id}${suffix}`}
        />
      </div>
      {duplicate || dateIssue ? (
        <p className="mt-1.5 text-[11px] font-medium leading-[1.35] text-[var(--ft-form-error)]">
          {duplicate ? 'Periodo duplicado.' : dateIssue}
        </p>
      ) : null}
    </div>
  )
}

function BillingCycleStatementControl({
  cycle,
  periodLabel,
  disabled,
  uploading,
  onUpload,
  onOpen,
  suffix = '',
}: {
  cycle: BillingCycleRow
  periodLabel: string
  disabled: boolean
  uploading: boolean
  onUpload?: (cycleId: string, file: File) => void
  onOpen?: (cycleId: string) => void
  suffix?: string
}) {
  const inputId = `billing-cycle-statement-upload-${cycle.id}${suffix}`
  const status = cycle.statement_url
    ? 'Estado adjunto'
    : cycle.statement_file
      ? `Listo al guardar: ${cycle.statement_file.name}`
      : onUpload
        ? 'Sin archivo'
        : 'Guarda para adjuntar'

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <div className="flex min-w-0 items-center gap-1.5">
        {cycle.statement_url && onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(cycle.id)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ft-radius-control)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] text-[var(--ft-form-muted)] transition-colors hover:border-[var(--ft-border-strong)] hover:text-[var(--ft-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ft-primary-soft)] focus-visible:ring-offset-2"
            aria-label={`Abrir estado de cuenta de ${periodLabel}`}
            title={`Abrir estado de cuenta de ${periodLabel}`}
            data-testid={`billing-cycle-statement-open-${cycle.id}${suffix}`}
          >
            <OpenDocumentIcon className="h-4 w-4" />
          </button>
        ) : null}
        {onUpload ? (
        <label
          htmlFor={inputId}
          tabIndex={disabled || uploading ? -1 : 0}
          role="button"
          aria-label={`${cycle.statement_url ? 'Reemplazar' : 'Adjuntar'} estado de cuenta de ${periodLabel}`}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              if (!disabled && !uploading) document.getElementById(inputId)?.click()
            }
          }}
          className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--ft-radius-control)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] text-[var(--ft-form-muted)] transition-colors hover:border-[var(--ft-border-strong)] hover:text-[var(--ft-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ft-primary-soft)] focus-visible:ring-offset-2 ${disabled || uploading ? 'pointer-events-none opacity-60' : ''}`}
          title={`${cycle.statement_url ? 'Reemplazar' : 'Adjuntar'} estado de cuenta de ${periodLabel}`}
        >
          <input
            id={inputId}
            type="file"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            data-testid={`billing-cycle-statement-upload-${cycle.id}${suffix}`}
            disabled={disabled || uploading}
            onChange={event => {
              const file = event.target.files?.[0]
              if (file) onUpload(cycle.id, file)
              event.currentTarget.value = ''
            }}
          />
          <UploadDocumentIcon className="h-4 w-4" />
        </label>
        ) : !cycle.statement_url ? (
          <span
            title="Guarda primero la tarjeta para adjuntar el estado de cuenta."
            aria-label="Guarda primero la tarjeta para adjuntar el estado de cuenta"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ft-radius-control)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] text-[var(--ft-form-muted)] opacity-60"
          >
            <UploadDocumentIcon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <span
        aria-live="polite"
        className="block min-w-0 max-w-full truncate text-[11px] font-medium leading-[1.35] text-[var(--ft-form-muted)]"
        title={status}
      >
        {uploading ? 'Cargando…' : status}
      </span>
    </div>
  )
}

function CycleActions({
  cycle,
  periodLabel,
  disabled,
  canDelete,
  onView,
  onDelete,
}: {
  cycle: BillingCycleRow
  periodLabel: string
  disabled: boolean
  canDelete: boolean
  onView: (cycleId: string) => void
  onDelete: (cycleId: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onView(cycle.id)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ft-radius-control)] border border-[var(--ft-form-border)] text-[var(--ft-form-muted)] transition-colors hover:border-[var(--ft-border-strong)] hover:text-[var(--ft-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ft-primary-soft)] focus-visible:ring-offset-2"
        title={`Ver movimientos de ${periodLabel}`}
        aria-label={`Ver movimientos de ${periodLabel}`}
        disabled={disabled}
      >
        <OpenMovementsIcon className="h-4 w-4" />
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={() => onDelete(cycle.id)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ft-radius-control)] border border-[var(--ft-form-border)] text-[var(--ft-form-muted)] transition-colors hover:border-[rgba(184,74,74,0.22)] hover:bg-[var(--ft-danger-soft)] hover:text-[var(--ft-form-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ft-primary-soft)] focus-visible:ring-offset-2"
          title={`Eliminar ciclo ${periodLabel}`}
          aria-label={`Eliminar ciclo ${periodLabel}`}
          disabled={disabled}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
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
  onStatementUpload,
  onStatementOpen,
  statementUploadCycleId = null,
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
  const scheduleRows = useMemo(() => cycles.map(cycle => ({
    cycle,
    cycleKey: `${cycle.billing_year}-${cycle.billing_month}`,
    periodLabel: formatBillingCycleLabel(cycle.billing_month, cycle.billing_year),
    dateIssue: getBillingCycleDateIssue({
      billing_month: Number(cycle.billing_month),
      billing_year: Number(cycle.billing_year),
      consumption_from: cycle.consumption_from,
      consumption_to: cycle.consumption_to,
      payment_date: cycle.payment_date,
    }),
  })), [cycles])

  const openMovementModal = (cycleId: string) => {
    onMovementModalOpenChange?.(true)
    setMovementCycleId(cycleId)
  }
  const finishMovementModalClose = () => onMovementModalOpenChange?.(false)

  return (
    <div className="flex min-h-0 w-full flex-col gap-3">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--ft-text-strong)]">
            Ciclos de facturación
          </p>
          <p className="max-w-[68ch] text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
            Fechas, estados de cuenta e importes por periodo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="grid grid-cols-3 overflow-hidden rounded-[var(--ft-form-radius-sm)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] text-center">
            <div className="min-w-[74px] px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--ft-form-muted)]">Ciclos</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--ft-text)] tabular-nums">{cycles.length}</p>
            </div>
            <div className="min-w-[92px] border-l border-[var(--ft-form-border)] px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--ft-form-muted)]">PEN</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--ft-text)] tabular-nums">{formatNumber(totalPen)}</p>
            </div>
            <div className="min-w-[92px] border-l border-[var(--ft-form-border)] px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--ft-form-muted)]">USD</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--ft-text)] tabular-nums">{formatNumber(totalUsd)}</p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onAddCycle} disabled={disabled}>
            Agregar ciclo
          </Button>
        </div>
      </div>

      <div className="min-h-0 w-full overflow-hidden rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)]">
        <div
          className="hidden max-h-[52vh] min-h-0 w-full overflow-x-hidden overflow-y-auto xl:block"
          data-testid="credit-card-schedule-table-scroll"
        >
          <table className="w-full min-w-0 table-fixed text-[12px]" data-testid="credit-card-schedule-table">
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
              <tr className="text-[12px] text-[var(--ft-form-muted)]">
                <th rowSpan={2} className="px-1.5 py-2 text-center align-middle font-semibold">Periodo</th>
                <th rowSpan={2} className="px-1.5 py-2 text-center align-middle font-semibold">Consumo desde</th>
                <th rowSpan={2} className="px-1.5 py-2 text-center align-middle font-semibold">Consumo hasta</th>
                <th rowSpan={2} className="px-1.5 py-2 text-center align-middle font-semibold">Fecha de pago</th>
                <th colSpan={2} className="border-b border-[var(--ft-form-border)] px-1.5 py-2 text-center font-semibold">Total a pagar</th>
                <th rowSpan={2} className="px-1.5 py-2 text-center align-middle font-semibold">Estado de cuenta</th>
                <th rowSpan={2} className="px-1.5 py-2 text-center align-middle font-semibold">Acciones</th>
              </tr>
              <tr className="text-[11px] uppercase tracking-[0.04em] text-[var(--ft-form-muted)]">
                <th className="px-1.5 py-1.5 text-right font-semibold">PEN</th>
                <th className="px-1.5 py-1.5 text-right font-semibold">USD</th>
              </tr>
            </thead>
            <tbody>
              {scheduleRows.map(({ cycle, cycleKey, periodLabel, dateIssue }) => {
                const isDuplicate = duplicateCycleKeys.has(cycleKey)

                return (
                  <tr key={cycle.id} className="border-t border-[var(--ft-form-border)] align-middle">
                    <td className="px-1.5 py-2 align-middle">
                      <CyclePeriodFields cycle={cycle} yearOptions={yearOptions} duplicate={isDuplicate} dateIssue={dateIssue} disabled={disabled} onUpdateCycle={onUpdateCycle} />
                    </td>

                    <td className="px-1.5 py-2 align-middle">
                      <CreditScheduleDateField
                        value={cycle.consumption_from}
                        onChange={value => onUpdateCycle(cycle.id, { consumption_from: value })}
                        label={`Inicio de consumo, ${periodLabel}`}
                        testId={`credit-cycle-from-${cycle.id}`}
                        disabled={disabled}
                      />
                    </td>

                    <td className="px-1.5 py-2 align-middle">
                      <CreditScheduleDateField
                        value={cycle.consumption_to}
                        onChange={value => onUpdateCycle(cycle.id, { consumption_to: value })}
                        label={`Fin de consumo, ${periodLabel}`}
                        testId={`credit-cycle-to-${cycle.id}`}
                        disabled={disabled}
                      />
                    </td>

                    <td className="px-1.5 py-2 align-middle">
                      <CreditScheduleDateField
                        value={cycle.payment_date}
                        onChange={value => onUpdateCycle(cycle.id, { payment_date: value })}
                        label={`Fecha de pago, ${periodLabel}`}
                        testId={`credit-cycle-payment-${cycle.id}`}
                        disabled={disabled}
                      />
                    </td>

                    <td className="px-1.5 py-2 text-right align-middle">
                      <span className="block min-w-0 break-all font-semibold text-[var(--ft-text)] tabular-nums" title={`S/ ${formatNumber(cycleTotalPen(cycle))}`}>{formatNumber(cycleTotalPen(cycle))}</span>
                    </td>

                    <td className="px-1.5 py-2 text-right align-middle">
                      <span className="block min-w-0 break-all font-semibold text-[var(--ft-text)] tabular-nums" title={`USD ${formatNumber(cycleTotalUsd(cycle))}`}>{formatNumber(cycleTotalUsd(cycle))}</span>
                    </td>

                    <td className="px-1.5 py-2 align-middle">
                      <BillingCycleStatementControl cycle={cycle} periodLabel={periodLabel} disabled={disabled} uploading={statementUploadCycleId === cycle.id} onUpload={onStatementUpload} onOpen={onStatementOpen} />
                    </td>

                    <td className="px-1.5 py-2 align-middle">
                      <CycleActions cycle={cycle} periodLabel={periodLabel} disabled={disabled} canDelete={cycles.length > 1 && Boolean(cycle.can_delete)} onView={openMovementModal} onDelete={onRemoveCycle} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[var(--ft-surface-muted)]">
              <tr className="border-t border-[var(--ft-form-border)]">
                <td colSpan={4} className="px-1.5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">
                  Total registrado
                </td>
                <td className="px-1.5 py-3 text-right text-[12px] font-semibold text-[var(--ft-text)] tabular-nums">
                  <span className="block min-w-0 break-all" title={`S/ ${formatNumber(totalPen)}`}>{formatNumber(totalPen)}</span>
                </td>
                <td className="px-1.5 py-3 text-right text-[12px] font-semibold text-[var(--ft-text)] tabular-nums">
                  <span className="block min-w-0 break-all" title={`USD ${formatNumber(totalUsd)}`}>{formatNumber(totalUsd)}</span>
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div
          className={`max-h-[52vh] min-h-0 space-y-2 overflow-y-auto p-2 xl:hidden ${compact ? 'max-h-[330px]' : ''}`}
          data-testid="credit-card-schedule-compact-list"
        >
          {scheduleRows.map(({ cycle, cycleKey, periodLabel, dateIssue }) => {
            const isDuplicate = duplicateCycleKeys.has(cycleKey)
            return (
              <article key={cycle.id} className="min-w-0 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-3" data-testid={`credit-cycle-compact-${cycle.id}`}>
                <div className="flex min-w-0 flex-col gap-2 border-b border-[var(--ft-form-border)] pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ft-form-muted)]">Periodo</p>
                    <CyclePeriodFields cycle={cycle} yearOptions={yearOptions} duplicate={isDuplicate} dateIssue={dateIssue} disabled={disabled} suffix="-compact" compact onUpdateCycle={onUpdateCycle} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:min-w-[220px] sm:text-right">
                    <div className="min-w-0 rounded-[var(--ft-form-radius-sm)] bg-[var(--ft-surface-muted)] px-2.5 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--ft-form-muted)]">Total PEN</p>
                      <p className="break-all text-[13px] font-semibold tabular-nums text-[var(--ft-text)]">{formatNumber(cycleTotalPen(cycle))}</p>
                    </div>
                    <div className="min-w-0 rounded-[var(--ft-form-radius-sm)] bg-[var(--ft-surface-muted)] px-2.5 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--ft-form-muted)]">Total USD</p>
                      <p className="break-all text-[13px] font-semibold tabular-nums text-[var(--ft-text)]">{formatNumber(cycleTotalUsd(cycle))}</p>
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="min-w-0 space-y-1.5">
                    <label className="block text-[11px] font-medium text-[var(--ft-form-muted)]">Consumo desde</label>
                    <CreditScheduleDateField value={cycle.consumption_from} onChange={value => onUpdateCycle(cycle.id, { consumption_from: value })} label={`Inicio de consumo, ${periodLabel}`} testId={`credit-cycle-from-${cycle.id}-compact`} disabled={disabled} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <label className="block text-[11px] font-medium text-[var(--ft-form-muted)]">Consumo hasta</label>
                    <CreditScheduleDateField value={cycle.consumption_to} onChange={value => onUpdateCycle(cycle.id, { consumption_to: value })} label={`Fin de consumo, ${periodLabel}`} testId={`credit-cycle-to-${cycle.id}-compact`} disabled={disabled} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <label className="block text-[11px] font-medium text-[var(--ft-form-muted)]">Fecha de pago</label>
                    <CreditScheduleDateField value={cycle.payment_date} onChange={value => onUpdateCycle(cycle.id, { payment_date: value })} label={`Fecha de pago, ${periodLabel}`} testId={`credit-cycle-payment-${cycle.id}-compact`} disabled={disabled} />
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-2 border-t border-[var(--ft-form-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-medium text-[var(--ft-form-muted)]">Estado de cuenta</p>
                    <BillingCycleStatementControl cycle={cycle} periodLabel={periodLabel} disabled={disabled} uploading={statementUploadCycleId === cycle.id} onUpload={onStatementUpload} onOpen={onStatementOpen} suffix="-compact" />
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="text-[11px] font-medium text-[var(--ft-form-muted)]">Acciones</span>
                    <CycleActions cycle={cycle} periodLabel={periodLabel} disabled={disabled} canDelete={cycles.length > 1 && Boolean(cycle.can_delete)} onView={openMovementModal} onDelete={onRemoveCycle} />
                  </div>
                </div>
              </article>
            )
          })}
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
        onExitComplete={finishMovementModalClose}
        eyebrow="Créditos"
        title={movementCycle ? `Movimientos de ${formatBillingCycleLabel(movementCycle.billing_month, movementCycle.billing_year)}` : 'Movimientos del periodo'}
        subtitle="Consumos y pagos vinculados a esta tarjeta dentro del rango de facturación."
        widthClassName="w-[calc(100vw-32px)] max-w-[1040px]"
        overlayClassName="z-[142]"
        presentation="workbench"
        workbenchKind="schedule"
        motionSource="pointer"
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
  onExitComplete,
  ...editorProps
}: CreditCardScheduleModalProps) {
  const [movementModalOpen, setMovementModalOpen] = useState(false)

  return (
    <RecordModal
      open={open}
      onClose={onClose}
      onExitComplete={onExitComplete}
      eyebrow="Créditos"
      title="Cronograma completo de la tarjeta"
      subtitle="Edita ciclos de facturación, estados de cuenta y movimientos del periodo en una lectura estable."
      size="full-form"
      widthClassName="w-[calc(100vw-32px)] max-w-[1240px]"
      overlayClassName={`z-[132] ${workbenchStyles.creditScheduleOverlay}`}
      bodyClassName="credits-modal-body !overflow-hidden py-4"
      presentation="workbench"
      workbenchKind="schedule"
      focusTrapActive={!movementModalOpen}
      preserveFocusOnResume
      motionSource="pointer"
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
      <CreditCardScheduleEditor {...editorProps} onMovementModalOpenChange={setMovementModalOpen} />
    </RecordModal>
  )
}
