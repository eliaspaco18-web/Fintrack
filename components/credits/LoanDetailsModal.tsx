'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { RecordModal } from '@/components/ui/RecordModal'
import { LoanMarketRateComparison } from '@/components/credits/LoanMarketRateComparison'
import { formatScheduleDateLabel } from '@/components/credits/credits-schedule.constants'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import { getLoanTypeLabel } from '@/modules/loans/loan-type'
import { calculateScheduleTceaPercent } from '@/modules/loans/loan-rate-analysis'
import type { CreditListItem } from '@/lib/credits/display-type'

type LoanDetails = {
  credit: {
    currency: string
    credit_limit: number
    name: string
  }
  loan: {
    principal_amount: number
    loan_type: string
    creditor_name: string
    start_date: string
    end_date: string
  } | null
  disbursement: {
    transaction_date: string
  } | null
  installments: Array<{
    id: string
    installment_number: number
    due_date: string
    principal_amount: number
    interest_amount: number
    insurance_amount: number
    other_charges: number
    total_amount: number
    status: string
    paid_amount: number | null
  }>
  permissions?: { can_edit_loan_finances?: boolean }
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--ft-form-radius-sm)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
      <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">{label}</p>
      <p className="mt-1.5 text-[14px] font-semibold text-[var(--ft-text)]">{value}</p>
    </div>
  )
}

export function LoanDetailsModal({
  credit,
  open,
  onClose,
  onEdit,
}: {
  credit: CreditListItem | null
  open: boolean
  onClose: () => void
  onEdit: (credit: CreditListItem) => void
}) {
  const [details, setDetails] = useState<LoanDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!credit) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/credits/${credit.id}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? 'No se pudo cargar el préstamo.')
      }
      setDetails(payload.data as LoanDetails)
    } catch (caught) {
      setDetails(null)
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar el préstamo.')
    } finally {
      setLoading(false)
    }
  }, [credit])

  useEffect(() => {
    if (open) void load()
    else {
      setDetails(null)
      setError(null)
    }
  }, [load, open])

  const currency = details?.credit.currency === 'USD' ? 'USD' : 'PEN'
  const tceaPercent = useMemo(() => {
    if (!details?.loan || !details.disbursement) return null
    return calculateScheduleTceaPercent({
      principalAmount: Number(details.loan.principal_amount),
      disbursementDate: details.disbursement.transaction_date,
      payments: details.installments.map(installment => ({
        dueDate: installment.due_date,
        totalAmount: Number(installment.total_amount),
      })),
    })
  }, [details])

  return (
    <RecordModal
      open={open}
      onClose={onClose}
      eyebrow="Créditos"
      title={credit?.name ?? 'Préstamo bancario'}
      subtitle="Consulta el desembolso, la tasa y las cuotas sin salir del módulo Créditos."
      size="xl"
      widthClassName="w-[calc(100vw-32px)] max-w-[1120px]"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>Cerrar</Button>
          {credit && details?.permissions?.can_edit_loan_finances ? (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => {
                onClose()
                onEdit(credit)
              }}
            >
              Editar préstamo
            </Button>
          ) : null}
        </div>
      )}
    >
      {loading ? (
        <div className="space-y-3" aria-live="polite">
          <div className="h-20 animate-pulse rounded-[var(--ft-form-radius)] bg-[var(--ft-surface-muted)]" />
          <div className="h-44 animate-pulse rounded-[var(--ft-form-radius)] bg-[var(--ft-surface-muted)]" />
        </div>
      ) : error ? (
        <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-4 py-4">
          <p className="text-[13px] font-medium text-[var(--ft-form-error)]">{error}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : details?.loan ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailStat label="Capital original" value={formatCurrency(Number(details.loan.principal_amount), currency)} />
            <DetailStat label="Entidad" value={details.loan.creditor_name} />
            <DetailStat label="Tipo de préstamo" value={getLoanTypeLabel(details.loan.loan_type)} />
            <DetailStat label="Desembolso" value={details.disbursement ? formatScheduleDateLabel(details.disbursement.transaction_date) : 'No disponible'} />
          </div>

          <section className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)]">
            <div className="border-b border-[var(--ft-form-border)] px-4 py-3">
              <h3 className="text-[13px] font-semibold text-[var(--ft-text)]">Comparación de tasa</h3>
            </div>
            <div className="px-4 py-3">
              <LoanMarketRateComparison loanType={details.loan.loan_type} currency={currency} tceaPercent={tceaPercent} />
            </div>
          </section>

          <section className="overflow-hidden rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ft-form-border)] px-4 py-3">
              <h3 className="text-[13px] font-semibold text-[var(--ft-text)]">Cronograma de cuotas</h3>
              <span className="text-[12px] text-[var(--ft-form-muted)]">{details.installments.length} cuotas</span>
            </div>
            <div className="max-h-[42dvh] overflow-auto">
              <table className="w-full min-w-[760px] text-left text-[12px]">
                <thead className="sticky top-0 bg-[var(--ft-surface-muted)] text-[var(--ft-form-muted)]">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Cuota</th>
                    <th className="px-4 py-2.5 font-semibold">Vencimiento</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Capital</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Interés</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {details.installments.map(installment => (
                    <tr key={installment.id} className="border-t border-[var(--ft-form-border)]">
                      <td className="px-4 py-3 font-semibold text-[var(--ft-text)]">{installment.installment_number}</td>
                      <td className="px-4 py-3 text-[var(--ft-text-muted)]">{formatScheduleDateLabel(installment.due_date)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--ft-text)]">{formatNumber(Number(installment.principal_amount))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--ft-text)]">{formatNumber(Number(installment.interest_amount))}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--ft-text)]">{formatCurrency(Number(installment.total_amount), currency)}</td>
                      <td className="px-4 py-3 text-right text-[var(--ft-text-muted)]">{installment.status === 'PAID' ? 'Pagada' : 'Pendiente'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </RecordModal>
  )
}
