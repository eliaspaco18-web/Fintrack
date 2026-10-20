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
import tableHeaderStyles from '@/components/credits/CreditsTableHeader.module.css'
import workbenchStyles from '@/components/credits/CreditsWorkbench.module.css'
import styles from '@/components/credits/CreditCardScheduleModal.module.css'

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
  onUpdateCycle,
}: {
  cycle: BillingCycleRow
  yearOptions: YearOption[]
  duplicate: boolean
  dateIssue: string | null
  disabled: boolean
  suffix?: string
  onUpdateCycle: (id: string, patch: Partial<BillingCycleRow>) => void
}) {
  return (
    <div className={styles.periodFields}>
      <div className={styles.periodControls}>
        <AppSelect
          ariaLabel="Mes del periodo"
          value={cycle.billing_month}
          onChange={value => onUpdateCycle(cycle.id, { billing_month: value })}
          className={styles.monthSelect}
          buttonClassName="h-9 min-h-9 px-2 text-left text-[12px]"
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
          className={styles.yearSelect}
          buttonClassName="h-9 min-h-9 px-1.5 text-center text-[12px]"
          searchable
          searchPlaceholder="Buscar año…"
          matchTriggerWidth
          disabled={disabled}
          options={yearOptions}
          testId={`credit-cycle-year-${cycle.id}${suffix}`}
        />
      </div>
      {duplicate || dateIssue ? (
        <p className={styles.cycleIssue}>
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
    <div className={styles.statementControl}>
      <div className={styles.statementButtons}>
        {cycle.statement_url && onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(cycle.id)}
            className={styles.iconButton}
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
          className={`${styles.iconButton} ${disabled || uploading ? styles.disabledIconButton : ''}`}
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
            className={`${styles.iconButton} ${styles.disabledIconButton}`}
          >
            <UploadDocumentIcon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <span
        aria-live="polite"
        className={styles.statementStatus}
        aria-label={status}
        title={status}
      >
        {uploading ? 'Cargando…' : cycle.statement_url ? 'Estado adjunto' : cycle.statement_file ? 'Pendiente' : onUpload ? 'Sin archivo' : 'No disponible'}
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
    <div className={styles.cycleActions}>
      <button
        type="button"
        onClick={() => onView(cycle.id)}
        className={styles.iconButton}
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
          className={`${styles.iconButton} ${styles.deleteButton}`}
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
    <section className={styles.scheduleEditor} data-testid="credit-card-schedule-editor">
      <header className={styles.scheduleHeader}>
        <div className={styles.scheduleHeading}>
          <div>
            <p className={styles.scheduleTitle}>Ciclos de facturación</p>
            <p className={styles.scheduleSubtitle}>Fechas, importes y estados de cuenta registrados.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onAddCycle} disabled={disabled}>
            Agregar ciclo
          </Button>
        </div>
        <dl className={styles.scheduleTotals} aria-label="Totales de los ciclos">
          <div><dt>Ciclos</dt><dd>{cycles.length}</dd></div>
          <div><dt>Total PEN</dt><dd>{formatNumber(totalPen)}</dd></div>
          <div><dt>Total USD</dt><dd>{formatNumber(totalUsd)}</dd></div>
        </dl>
      </header>

      <div className={styles.cycleList} data-testid="credit-card-schedule-table-scroll">
        <div className={styles.cycleTable} role="table" aria-label="Ciclos de facturación" data-testid="credit-card-schedule-table">
          <div className={styles.cycleHeader} role="rowgroup">
            <div className={`${styles.cycleHeaderRow} ${tableHeaderStyles.creditsTableHead}`} role="row">
              {['Periodo', 'Consumo desde', 'Consumo hasta', 'Fecha de pago', 'Total PEN', 'Total USD', 'Estado de cuenta', 'Acciones'].map(label => (
                <div key={label} role="columnheader" className={`${tableHeaderStyles.creditsTableHeaderGridCell} ${tableHeaderStyles.creditsTableHeaderCenter}`}>{label}</div>
              ))}
            </div>
          </div>
          <div className={styles.cycleRows} role="rowgroup" data-testid="credit-card-schedule-cycles">
        {scheduleRows.map(({ cycle, cycleKey, periodLabel, dateIssue }) => {
          const isDuplicate = duplicateCycleKeys.has(cycleKey)
          return (
            <article key={cycle.id} className={styles.cycleRow} role="row" data-testid={`credit-cycle-row-${cycle.id}`}>
              <div className={`${styles.cycleCell} ${styles.periodCell}`} role="cell">
                <span className={styles.cellLabel}>Periodo</span>
                <CyclePeriodFields cycle={cycle} yearOptions={yearOptions} duplicate={isDuplicate} dateIssue={dateIssue} disabled={disabled} onUpdateCycle={onUpdateCycle} />
              </div>
              <div className={styles.cycleCell} role="cell">
                <span className={styles.cellLabel}>Consumo desde</span>
                <CreditScheduleDateField value={cycle.consumption_from} onChange={value => onUpdateCycle(cycle.id, { consumption_from: value })} label={`Consumo desde, ${periodLabel}`} testId={`credit-cycle-from-${cycle.id}`} disabled={disabled} />
              </div>
              <div className={styles.cycleCell} role="cell">
                <span className={styles.cellLabel}>Consumo hasta</span>
                <CreditScheduleDateField value={cycle.consumption_to} onChange={value => onUpdateCycle(cycle.id, { consumption_to: value })} label={`Consumo hasta, ${periodLabel}`} testId={`credit-cycle-to-${cycle.id}`} disabled={disabled} />
              </div>
              <div className={styles.cycleCell} role="cell">
                <span className={styles.cellLabel}>Fecha de pago</span>
                <CreditScheduleDateField value={cycle.payment_date} onChange={value => onUpdateCycle(cycle.id, { payment_date: value })} label={`Fecha de pago, ${periodLabel}`} testId={`credit-cycle-payment-${cycle.id}`} disabled={disabled} />
              </div>
              <div className={`${styles.cycleCell} ${styles.amountCell}`} role="cell">
                <span className={styles.cellLabel}>Total PEN</span>
                <strong title={`S/ ${formatNumber(cycleTotalPen(cycle))}`}>{formatNumber(cycleTotalPen(cycle))}</strong>
              </div>
              <div className={`${styles.cycleCell} ${styles.amountCell}`} role="cell">
                <span className={styles.cellLabel}>Total USD</span>
                <strong title={`USD ${formatNumber(cycleTotalUsd(cycle))}`}>{formatNumber(cycleTotalUsd(cycle))}</strong>
              </div>
              <div className={styles.cycleCell} role="cell">
                <span className={styles.cellLabel}>Estado de cuenta</span>
                <BillingCycleStatementControl cycle={cycle} periodLabel={periodLabel} disabled={disabled} uploading={statementUploadCycleId === cycle.id} onUpload={onStatementUpload} onOpen={onStatementOpen} />
              </div>
              <div className={styles.cycleCell} role="cell">
                <span className={styles.cellLabel}>Acciones</span>
                <CycleActions cycle={cycle} periodLabel={periodLabel} disabled={disabled} canDelete={cycles.length > 1 && Boolean(cycle.can_delete)} onView={openMovementModal} onDelete={onRemoveCycle} />
              </div>
            </article>
          )
        })}
          </div>
        </div>
      </div>

      <div className={styles.registeredTotals} data-testid="credit-card-schedule-grand-totals">
        <span>Total registrado</span>
        <strong title={`S/ ${formatNumber(totalPen)}`}>S/ {formatNumber(totalPen)}</strong>
        <strong title={`USD ${formatNumber(totalUsd)}`}>USD {formatNumber(totalUsd)}</strong>
      </div>

      {duplicateMessage ? (
        <div className={styles.duplicateNotice}>
          <p>
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
                <thead className={`sticky top-0 z-[1] ${tableHeaderStyles.creditsTableHead}`}>
                  <tr>
                    <th className={`${tableHeaderStyles.creditsTableHeaderTableCell} ${tableHeaderStyles.creditsTableHeaderLeft}`}>Fecha</th>
                    <th className={`${tableHeaderStyles.creditsTableHeaderTableCell} ${tableHeaderStyles.creditsTableHeaderLeft}`}>Descripción</th>
                    <th className={`${tableHeaderStyles.creditsTableHeaderTableCell} ${tableHeaderStyles.creditsTableHeaderLeft}`}>Tipo</th>
                    <th className={`${tableHeaderStyles.creditsTableHeaderTableCell} ${tableHeaderStyles.creditsTableHeaderRight}`}>PEN</th>
                    <th className={`${tableHeaderStyles.creditsTableHeaderTableCell} ${tableHeaderStyles.creditsTableHeaderRight}`}>USD</th>
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
    </section>
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
      overlayClassName={`z-[132] ${workbenchStyles.creditCardScheduleOverlay}`}
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
