import { ProgressMetric, StatusBadge } from '@/components/finance'
import {
  formatVerifiedObligationAmount,
  obligationProgress,
  type ObligationCurrencySummary,
} from '@/modules/obligations/obligation-currency-presentation'

type Props = {
  summaries: readonly ObligationCurrencySummary[]
  kind: 'receivable' | 'payable'
  hasUnverifiedInitialBalance?: boolean
  unverifiedRecordCount?: number
  compact?: boolean
}

export function ObligationCurrencyProgress({
  summaries,
  kind,
  hasUnverifiedInitialBalance = false,
  unverifiedRecordCount = 0,
  compact = false,
}: Props) {
  const resolvedLabel = kind === 'receivable' ? 'Cobrado' : 'Pagado'
  const pendingDescription = kind === 'receivable' ? 'por ingresar' : 'por pagar'
  const tone = kind === 'receivable' ? 'warning' as const : 'danger' as const
  const hasLimitation = hasUnverifiedInitialBalance || unverifiedRecordCount > 0

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {summaries.length === 0 ? (
        <p className="text-[12px] leading-5 text-[var(--c-text-muted)]">
          No hay importes documentados con moneda verificable.
        </p>
      ) : summaries.map(summary => {
        const progress = obligationProgress(summary)
        return (
          <ProgressMetric
            key={summary.currency}
            value={progress}
            label={`${resolvedLabel} · ${summary.currency}`}
            valueLabel={`${progress.toFixed(1)}%`}
            tone={progress >= 100 ? 'success' : tone}
            description={`${formatVerifiedObligationAmount(summary.pending, summary.currency)} ${pendingDescription}.`}
          />
        )
      })}

      {hasLimitation ? (
        <div
          className="rounded-xl border border-[color-mix(in_srgb,var(--c-warning)_30%,var(--c-border))] bg-[var(--c-warning-soft)] px-3 py-2.5"
          data-testid={`${kind}-currency-unverified-note`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="warning" dot={false}>Moneda no verificable</StatusBadge>
            <p className="text-[11px] leading-4 text-[var(--c-text-muted)]">
              {[
                hasUnverifiedInitialBalance ? 'El saldo inicial no tiene moneda confirmada' : null,
                unverifiedRecordCount > 0
                  ? `${unverifiedRecordCount} registro${unverifiedRecordCount === 1 ? '' : 's'} sin moneda verificable`
                  : null,
              ].filter(Boolean).join(' · ')}. Estos importes no se incluyen en los totales por moneda.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
