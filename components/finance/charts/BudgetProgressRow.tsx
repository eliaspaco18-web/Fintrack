import Link from 'next/link'

type BudgetBase = {
  periodId: string
  href: string
  label: string
  spentLabel: string
  limitLabel: string
  basisLabel?: string
}

export type BudgetProgressRowProps = BudgetBase & (
  | { state: 'valid'; percentage: number; percentageLabel: string; remainingLabel: string; exceeded: boolean }
  | { state: 'invalid' | 'unavailable'; reason: string }
)

/** The caller supplies the existing period metric; only the visual track is capped. */
export function budgetTrackFill(percentage: number): number {
  return Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0
}

export function BudgetProgressRow(props: BudgetProgressRowProps) {
  const valid = props.state === 'valid'
  return (
    <Link
      href={props.href}
      className="ft-v3-budget-row"
      data-budget-period-id={props.periodId}
      data-budget-state={props.state}
      data-exceeded={valid && props.exceeded ? 'true' : undefined}
    >
      <span className="ft-v3-budget-heading">
        <span className="ft-v3-budget-name">{props.label}</span>
        <span className="ft-v3-budget-spent">{props.spentLabel}<small>de {props.limitLabel}</small></span>
      </span>
      {valid ? (
        <span className="ft-v3-budget-track" aria-hidden="true">
          <span style={{ width: `${budgetTrackFill(props.percentage)}%` }} /><i />
        </span>
      ) : null}
      <span className="ft-v3-budget-footer">
        <span>{valid ? props.percentageLabel : props.reason}</span>
        {valid ? <span>{props.remainingLabel}</span> : null}
      </span>
      {props.basisLabel ? <span className="ft-v3-budget-basis">{props.basisLabel}</span> : null}
    </Link>
  )
}
