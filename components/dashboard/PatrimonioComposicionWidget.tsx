'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type { DashboardSummary as FullDashboardSummary } from '@/modules/dashboard/dashboard.types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const VIEW = 196
const CENTER = 98
const RADIUS = 66
const STROKE = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const MAX_ITEMS = 6
const COLOR_SCALE = [
  'color-mix(in oklch, var(--ft-primary) 78%, var(--ft-surface))',
  'color-mix(in oklch, var(--ft-info) 74%, var(--ft-surface))',
  'color-mix(in oklch, var(--ft-success) 72%, var(--ft-surface))',
  'color-mix(in oklch, var(--ft-warning) 76%, var(--ft-surface))',
  'color-mix(in oklch, var(--ft-danger) 70%, var(--ft-surface))',
  'color-mix(in oklch, var(--ft-primary) 54%, var(--ft-info))',
]

type CompositionItem = {
  id: string
  label: string
  helper: string
  value: number
  color: string
}

const fetcher = (url: string) => fetchDashboardData<FullDashboardSummary>(url)

function assetTypeLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function EmptyState() {
  return (
    <div className="mt-5 rounded-[20px] border border-dashed border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-5 py-6 text-center">
      <p className="text-[13px] font-semibold text-[var(--ft-text)]">Composición pendiente</p>
      <p className="mx-auto mt-2 max-w-[20rem] text-[11px] leading-5 text-[var(--ft-text-muted)]">
        Agrega cuentas o activos para leer la distribución de tu patrimonio.
      </p>
      <Link
        href="/assets"
        className="mt-4 inline-flex rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-4 py-2 text-[11px] font-semibold text-[var(--ft-primary)] transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--ft-primary)] hover:text-[var(--ft-text-on-primary)] active:scale-[0.98]"
      >
        Ir a Activos
      </Link>
    </div>
  )
}

function buildItems(data: FullDashboardSummary | undefined): CompositionItem[] {
  if (!data) return []

  const liquidity = data.accounts
    .filter((account) => account.balancePen > 0)
    .reduce((sum, account) => sum + account.balancePen, 0)

  const rawItems: CompositionItem[] = []
  if (liquidity > 0) {
    rawItems.push({
      id: 'liquidity',
      label: 'Liquidez bancaria',
      helper: `${data.accounts.filter((account) => account.balancePen > 0).length} cuenta(s)`,
      value: liquidity,
      color: COLOR_SCALE[0]!,
    })
  }

  for (const asset of data.assets.byType) {
    if (asset.totalPen <= 0) continue
    rawItems.push({
      id: `asset-${asset.assetType}`,
      label: assetTypeLabel(asset.assetType),
      helper: `${asset.count} activo(s)`,
      value: asset.totalPen,
      color: COLOR_SCALE[rawItems.length % COLOR_SCALE.length]!,
    })
  }

  const sorted = rawItems.sort((left, right) => right.value - left.value)
  const visible = sorted.slice(0, MAX_ITEMS)
  const hidden = sorted.slice(MAX_ITEMS)
  const hiddenTotal = hidden.reduce((sum, item) => sum + item.value, 0)

  if (hiddenTotal > 0) {
    visible.push({
      id: 'other',
      label: 'Otros',
      helper: `${hidden.length} grupo(s)`,
      value: hiddenTotal,
      color: COLOR_SCALE[(MAX_ITEMS - 1) % COLOR_SCALE.length]!,
    })
  }

  return visible.map((item, index) => ({
    ...item,
    color: COLOR_SCALE[index % COLOR_SCALE.length]!,
  }))
}

export function PatrimonioComposicionWidget() {
  const { data, isLoading } = useSWR('/api/dashboard', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const items = buildItems(data)
  const total = items.reduce((sum, item) => sum + item.value, 0)
  let offset = 0

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5">
        <div className="animate-pulse space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-48 rounded-full bg-[var(--ft-surface-muted)]" />
              <div className="h-3 w-60 rounded-full bg-[var(--ft-surface-muted)]" />
            </div>
            <div className="h-7 w-24 rounded-full bg-[var(--ft-surface-muted)]" />
          </div>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="h-[220px] rounded-[20px] bg-[var(--ft-surface-muted)]" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-11 rounded-[14px] bg-[var(--ft-surface-muted)]" />
              ))}
            </div>
          </div>
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Composición patrimonial
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
            Liquidez y activos agrupados por fuente de valor.
          </p>
        </div>
        <span className="rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-primary)]">
          {items.length} grupos
        </span>
      </div>

      {items.length === 0 || total <= 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
          <div className="relative mx-auto grid h-[220px] w-full max-w-[220px] place-items-center rounded-[22px] bg-[color-mix(in_oklch,var(--ft-surface-muted)_62%,transparent)]">
            <svg
              viewBox={`0 0 ${VIEW} ${VIEW}`}
              className="h-[196px] w-[196px]"
              role="img"
              aria-label="Composición patrimonial por fuente de valor"
            >
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="var(--ft-surface)"
                strokeWidth={STROKE}
              />
              {items.map((item, index) => {
                const ratio = item.value / total
                const dash = Math.max(0, ratio * CIRCUMFERENCE - 2)
                const dashOffset = -offset
                offset += ratio * CIRCUMFERENCE

                return (
                  <circle
                    key={item.id}
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                    className="patrimonio-segment"
                    style={{ animationDelay: `${index * 70}ms` }}
                  />
                )
              })}
              <text
                x={CENTER}
                y={CENTER - 6}
                textAnchor="middle"
                fontSize="19"
                fontWeight="700"
                fill="var(--ft-text)"
              >
                {formatNumber(100, { maximumFractionDigits: 0 })}%
              </text>
              <text
                x={CENTER}
                y={CENTER + 14}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                letterSpacing="0.14em"
                fill="var(--ft-text-subtle)"
              >
                ASIGNADO
              </text>
            </svg>
          </div>

          <div className="min-w-0 space-y-2.5">
            <div className="rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--ft-text-subtle)]">
                Total observado
              </p>
              <p className="mt-1 text-[1.05rem] font-semibold tabular-nums text-[var(--ft-text)]">
                {formatCurrency(total, 'PEN')}
              </p>
            </div>

            {items.map((item) => {
              const pct = total > 0 ? (item.value / total) * 100 : 0
              return (
                <div key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[12px] font-semibold text-[var(--ft-text)]">{item.label}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-[var(--ft-text)]">
                        {formatNumber(pct, { maximumFractionDigits: 1 })}%
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-[var(--ft-text-muted)]">{item.helper}</p>
                  </div>
                  <span className="text-[11px] tabular-nums text-[var(--ft-text-muted)]">
                    {formatCurrency(item.value, 'PEN')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .patrimonio-segment {
          animation: patrimonio-segment-enter 620ms cubic-bezier(0.32, 0.72, 0, 1) both;
          transform-box: fill-box;
          transform-origin: center;
        }

        @keyframes patrimonio-segment-enter {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .patrimonio-segment {
            animation: none;
          }
        }
      `}</style>
    </PremiumCard>
  )
}
