// =============================================================================
// components/dashboard/widgets/FinanceWidgets.tsx
// Widget legacy de activos.
// =============================================================================

'use client'

import Link                          from 'next/link'
import { useCurrency }               from '@/lib/hooks/useDashboard'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import {
  WidgetShell,
  SectionHeader,
  EmptyWidget,
  ProgressBar,
}                                    from '../primitives'
import type { AssetsSummary }        from '@/modules/dashboard/dashboard.types'

// ─── HELPER: skeleton row ─────────────────────────────────────────────────────

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex justify-between">
          <div className="h-3 rounded" style={{ width: `${50 + i * 10}%`, backgroundColor: 'color-mix(in srgb, var(--c-text-faint) 22%, transparent)' }}/>
          <div className="h-3 w-16 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--c-text-faint) 26%, transparent)' }}/>
        </div>
      ))}
    </div>
  )
}

interface AssetsWidgetProps {
  assets?:  AssetsSummary
  loading?: boolean
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  REAL_ESTATE: 'Inmuebles',
  VEHICLE:     'Vehículos',
  EQUIPMENT:   'Equipos',
  INVESTMENT:  'Inversiones',
  OTHER:       'Otros',
}

const ASSET_TYPE_COLORS: Record<string, string> = {
  REAL_ESTATE: '#8b5cf6',
  VEHICLE:     '#3b82f6',
  EQUIPMENT:   'var(--c-primary)',
  INVESTMENT:  '#f59e0b',
  OTHER:       '#6b7280',
}

export function AssetsWidget({ assets, loading }: AssetsWidgetProps) {
  const { preferred, format } = useCurrency()

  return (
    <WidgetShell>
      <SectionHeader
        title="Activos"
        accent="var(--c-primary)"
        action={
          <Link href="/assets"
            className="text-[var(--c-text-faint)] hover:text-[var(--c-text)] transition-colors">
            Ver todos →
          </Link>
        }
      />

      {loading ? <SkeletonRows count={2}/> : (
        <>
          {!assets || assets.count === 0 ? (
            <EmptyWidget
              message="Sin activos registrados"
              hint="Se crean al registrar un egreso de tipo activo"
            />
          ) : (
            <>
              {/* Total */}
              <div className="mb-4">
                <p className="text-[10px] text-[var(--c-text-faint)] uppercase tracking-wide mb-1">
                  Valor total
                </p>
                <p className="text-[1.45rem] font-semibold tabular-nums text-[var(--c-primary)]">
                  {formatCurrency(format(assets.totalValuePen), preferred)}
                </p>
                <p className="text-[11px] text-[var(--c-text-faint)] mt-0.5">
                  {assets.count} activo{assets.count !== 1 ? 's' : ''} activo{assets.count !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Por tipo */}
              {assets.byType.length > 0 && (
                <div className="space-y-2.5">
                  {assets.byType.map(item => {
                    const color = ASSET_TYPE_COLORS[item.assetType] ?? '#6b7280'
                    const pct   = assets.totalValuePen > 0
                      ? (item.totalPen / assets.totalValuePen) * 100
                      : 0

                    return (
                      <div key={item.assetType}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}/>
                            <span className="text-[11px] text-[var(--c-text-muted)]">
                              {ASSET_TYPE_LABELS[item.assetType] ?? item.assetType}
                            </span>
                          </div>
                          <span className="text-[11px] text-[var(--c-text-faint)] tabular-nums">
                            {formatCurrency(format(item.totalPen), preferred)}
                          </span>
                        </div>
                        <ProgressBar value={pct} color={color} height={3}/>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </WidgetShell>
  )
}
