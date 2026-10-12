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
  linkLabel?: string
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
    <section className={main ? 'col-span-2 min-w-0 md:col-span-1 md:pr-5' : 'min-w-0 border-t border-[var(--ft-border)] pt-4 md:border-t-0 md:border-l md:pl-6 md:pt-0'}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[12px] font-semibold text-[var(--ft-text-muted)]">{group.label}</h3>
        <Link href={group.href} className="rounded-[var(--ft-radius-control)] text-[12px] font-semibold text-[var(--ft-primary)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--ft-primary)]">
          {group.linkLabel ?? <span className="sr-only">Ver {group.label}</span>}
          <span aria-hidden="true"> ›</span>
        </Link>
      </div>
      {main ? <p className="sr-only">{group.scope}</p> : null}
      {group.amounts.length ? (
        <ul className={main ? 'mt-3 grid grid-cols-2 gap-3 xl:grid-cols-[174px_minmax(0,1fr)]' : 'mt-2 flex flex-wrap gap-x-3 gap-y-1'}>
          {group.amounts.map((item, index) => (
            <li key={`${item.currency ?? 'unknown'}-${index}`} className={main ? 'min-w-0' : 'flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5'}>
              {main ? <span className="mb-1 block text-[11px] text-[var(--ft-text-muted)]">{item.currency === 'PEN' ? 'Soles · PEN' : item.currency === 'USD' ? 'Dólares · USD' : item.currency ?? 'Moneda no disponible'}</span> : null}
              <MoneyText
                value={item.value}
                currency={item.currency}
                availability={item.availability}
                className={main ? 'block whitespace-nowrap text-[19px] font-semibold leading-[27px] tracking-[-.7px] xl:text-[26px] xl:leading-[34px]' : 'text-[16px] font-semibold leading-[24px]'}
              />
              {item.note ? <span className="text-[11px] text-[var(--ft-text-muted)]">{item.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : !group.unavailableReason ? (
        <p className="mt-3 text-[12px] text-[var(--ft-text-muted)]">Sin registros verificados</p>
      ) : null}
      {!main ? <p className="mt-2 text-[10px] leading-4 text-[var(--ft-text-subtle)]">{group.scope}</p> : null}
      {group.unavailableReason ? (
        <p className="mt-2 text-[12px] text-[var(--ft-warning)]">{group.unavailableReason}</p>
      ) : null}
    </section>
  )
}

/** Ordered, already-verified native groups. No sums or conversion happen here. */
export function PositionBand({ accounts, receivables, payables, className = '' }: PositionBandProps) {
  return (
    <section data-ft-route-group="summary" aria-label="Posición y pendientes registrados" className={`grid grid-cols-2 gap-4 rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-5 py-4 shadow-[var(--ft-shadow-contact)] md:grid-cols-[1.75fr_1fr_1fr] md:gap-0 ${className}`.trim()}>
      <Group group={accounts} main />
      <Group group={receivables} main={false} />
      <Group group={payables} main={false} />
    </section>
  )
}
