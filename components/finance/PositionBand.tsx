import Link from 'next/link'
import { MoneyText } from './MoneyText'
import type { MoneyAvailability } from '@/lib/finance/v3-money-display'

export interface PositionAmount {
  currency: string | null
  value: number | null
  availability?: MoneyAvailability
  /** Existing source coverage, never inferred from the visible row count. */
  note?: string
}

export interface PositionGroup {
  label: string
  href: string
  scope: string
  amounts: readonly PositionAmount[]
  unavailableReason?: string
}

export interface PositionBandProps {
  accounts: PositionGroup
  receivables: PositionGroup
  payables: PositionGroup
  className?: string
}

function Group({ group, main }: { group: PositionGroup; main: boolean }) {
  return (
    <section className={main ? 'col-span-2 min-w-0 md:col-span-1' : 'min-w-0 border-t border-[var(--ft-border)] pt-4 md:border-t-0 md:border-l md:pl-5 md:pt-0'}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[12px] font-semibold text-[var(--ft-text-muted)]">{group.label}</h3>
        <Link href={group.href} className="rounded-[var(--ft-radius-control)] text-[12px] font-semibold text-[var(--ft-primary)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--ft-primary)]">
          Ver
          <span className="sr-only"> {group.label}</span>
        </Link>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[var(--ft-text-subtle)]">{group.scope}</p>
      {group.amounts.length ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {group.amounts.map((item, index) => (
            <li key={`${item.currency ?? 'unknown'}-${index}`} className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <MoneyText
                value={item.value}
                currency={item.currency}
                availability={item.availability}
                className={main ? 'text-[23px] font-semibold leading-[30px] tracking-[-.7px] sm:text-[26px] sm:leading-[34px]' : 'text-[16px] font-semibold leading-[24px]'}
              />
              {item.note ? <span className="text-[11px] text-[var(--ft-text-muted)]">{item.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : !group.unavailableReason ? (
        <p className="mt-3 text-[12px] text-[var(--ft-text-muted)]">Sin registros verificados</p>
      ) : null}
      {group.unavailableReason ? (
        <p className="mt-3 text-[12px] text-[var(--ft-warning)]">{group.unavailableReason}</p>
      ) : null}
    </section>
  )
}

/** Ordered, already-verified native groups. No sums or conversion happen here. */
export function PositionBand({ accounts, receivables, payables, className = '' }: PositionBandProps) {
  return (
    <section aria-label="Posición y pendientes registrados" className={`grid grid-cols-2 gap-4 rounded-[var(--ft-radius-surface)] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-5 py-4 shadow-[var(--ft-shadow-contact)] md:grid-cols-[1.75fr_1fr_1fr] md:gap-6 ${className}`.trim()}>
      <Group group={accounts} main />
      <Group group={receivables} main={false} />
      <Group group={payables} main={false} />
    </section>
  )
}
