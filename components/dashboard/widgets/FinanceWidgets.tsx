// =============================================================================
// components/dashboard/widgets/FinanceWidgets.tsx
// Tres widgets medianos: Cuentas, Créditos y Activos.
// =============================================================================

'use client'

import Link                          from 'next/link'
import { useCurrency }               from '@/lib/hooks/useDashboard'
import { formatCurrency, formatPercent } from '@/lib/contracts/ui.contracts'
import {
  WidgetShell,
  SectionHeader,
  MoneyRow,
  EmptyWidget,
  ProgressBar,
  WidgetDivider,
}                                    from '../primitives'
import type {
  AccountBalance,
  CreditSummaryItem,
  AssetsSummary,
}                                    from '@/modules/dashboard/dashboard.types'

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

// =============================================================================
// CUENTAS WIDGET
// =============================================================================

interface AccountsWidgetProps {
  accounts?: AccountBalance[]
  loading?:  boolean
}

export function AccountsWidget({ accounts, loading }: AccountsWidgetProps) {
  const { preferred, format } = useCurrency()

  const totalPen = (accounts ?? []).reduce((s, a) => s + a.balancePen, 0)

  return (
    <WidgetShell>
      <SectionHeader
        title="Cuentas"
        accent="var(--c-primary)"
        action={
          <Link href="/portfolio"
            className="text-[var(--c-text-faint)] hover:text-[var(--c-text)] transition-colors">
            Gestionar →
          </Link>
        }
      />

      {loading ? <SkeletonRows count={3}/> : (
        <>
          {/* Total consolidado */}
          {(accounts ?? []).length > 0 && (
            <div className="mb-4 pb-4 border-b border-[var(--c-border)]">
              <p className="text-[10px] text-[var(--c-text-faint)] uppercase tracking-wide mb-1">
                Total consolidado
              </p>
              <p className="text-[1.45rem] font-semibold tabular-nums text-[var(--c-text)]">
                {formatCurrency(format(totalPen), preferred)}
              </p>
            </div>
          )}

          {(accounts ?? []).length === 0 ? (
            <EmptyWidget
              message="Sin cuentas activas"
              hint="Crea tu primera cuenta en Portafolio"
            />
          ) : (
            <div>
              {(accounts ?? []).slice(0, 5).map(acc => (
                <MoneyRow
                  key={acc.id}
                  label={acc.name}
                  sublabel={`${acc.type} · ${acc.currency}`}
                  amount={formatCurrency(format(acc.balancePen), preferred)}
                  accent={acc.color}
                />
              ))}
              {(accounts ?? []).length > 5 && (
                <p className="text-[11px] text-[var(--c-text-faint)] mt-2 text-center">
                  +{(accounts ?? []).length - 5} más
                </p>
              )}
            </div>
          )}
        </>
      )}
    </WidgetShell>
  )
}

// =============================================================================
// CRÉDITOS WIDGET
// =============================================================================

interface CreditsWidgetProps {
  credits?: CreditSummaryItem[]
  loading?: boolean
}

const UTILIZATION_COLORS = (pct: number) => {
  if (pct >= 90) return { bar: '#ef4444', text: 'text-red-400' }
  if (pct >= 70) return { bar: '#f97316', text: 'text-orange-400' }
  if (pct >= 50) return { bar: '#eab308', text: 'text-yellow-400' }
  return { bar: 'var(--c-primary)', text: 'text-[var(--c-primary)]' }
}

export function CreditsWidget({ credits, loading }: CreditsWidgetProps) {
  const { preferred, format } = useCurrency()

  const totalUsed = (credits ?? []).reduce((s, c) => s + c.usedAmount, 0)
  const totalLimit = (credits ?? []).reduce((s, c) => s + c.creditLimit, 0)
  const globalUtilization = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0
  const globalColors = UTILIZATION_COLORS(globalUtilization)

  return (
    <WidgetShell>
      <SectionHeader
        title="Créditos"
        accent="var(--c-primary)"
        action={
          <Link href="/credits"
            className="text-[var(--c-text-faint)] hover:text-[var(--c-text)] transition-colors">
            Ver todos →
          </Link>
        }
      />

      {loading ? <SkeletonRows count={3}/> : (
        <>
          {(credits ?? []).length === 0 ? (
            <EmptyWidget
              message="Sin créditos activos"
              hint="Los créditos aparecerán al registrar un egreso de crédito"
            />
          ) : (
            <>
              {/* Global utilization */}
              <div className="mb-4">
                <div className="flex justify-between items-baseline mb-1.5">
                  <p className="text-[10px] text-[var(--c-text-faint)] uppercase tracking-wide">
                    Uso total
                  </p>
                  <span className={`text-[11px] font-bold tabular-nums ${globalColors.text}`}>
                    {formatPercent(globalUtilization, { fractionDigits: 0 })}
                  </span>
                </div>
                <ProgressBar value={globalUtilization} color={globalColors.bar} height={5}/>
                <div className="flex justify-between text-[10px] text-[var(--c-text-faint)] mt-1 tabular-nums">
                  <span>Usado: {formatCurrency(format(totalUsed), preferred)}</span>
                  <span>Límite: {formatCurrency(format(totalLimit), preferred)}</span>
                </div>
              </div>

              <WidgetDivider/>

              {/* Tarjetas individuales */}
              <div className="space-y-3">
                {(credits ?? []).slice(0, 3).map(credit => {
                  const utilPct = credit.utilizationPct ?? 0
                  const colors  = UTILIZATION_COLORS(utilPct)

                  return (
                    <div key={credit.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[12px] text-[var(--c-text-muted)] font-medium truncate">
                          {credit.name}
                        </span>
                        <span className={`text-[10px] font-bold tabular-nums ${colors.text}`}>
                          {formatPercent(utilPct, { fractionDigits: 0 })}
                        </span>
                      </div>
                      <ProgressBar value={utilPct} color={colors.bar} height={3}/>
                      {credit.nextClosingDate && (
                        <p className="text-[10px] text-[var(--c-text-faint)] mt-0.5">
                          Corte: {new Date(credit.nextClosingDate + 'T12:00:00').toLocaleDateString('es-PE', {
                            day: 'numeric', month: 'short'
                          })}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </WidgetShell>
  )
}

// =============================================================================
// ACTIVOS WIDGET
// =============================================================================

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
