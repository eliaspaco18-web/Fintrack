'use client'

// =============================================================================
// components/alerts/AlertBadge.tsx
// PRD v3 — Módulo 9: Badge de severidad para la Risk Inbox
// Usa tokens del sistema financiero; evita colores Tailwind hardcodeados.
// =============================================================================

export type AlertSeverity = 'CRITICAL' | 'OPERATIONAL' | 'SUGGESTION'

const BADGE_CONFIG: Record<
  AlertSeverity,
  {
    label: string
    tone: 'danger' | 'warning' | 'info'
    color: string
    background: string
    border: string
  }
> = {
  CRITICAL: {
    label: 'Crítica',
    tone: 'danger',
    color: 'var(--ft-danger)',
    background: 'var(--ft-danger-soft)',
    border: 'color-mix(in srgb, var(--ft-danger) 16%, var(--ft-border))',
  },
  OPERATIONAL: {
    label: 'Operativa',
    tone: 'warning',
    color: 'var(--ft-warning)',
    background: 'var(--ft-warning-soft)',
    border: 'color-mix(in srgb, var(--ft-warning) 18%, var(--ft-border))',
  },
  SUGGESTION: {
    label: 'Sugerencia',
    tone: 'info',
    color: 'var(--ft-info)',
    background: 'var(--ft-info-soft)',
    border: 'color-mix(in srgb, var(--ft-info) 18%, var(--ft-border))',
  },
}

interface AlertBadgeProps {
  type: AlertSeverity
  /** Si true muestra solo el punto de color sin la etiqueta */
  dotOnly?: boolean
  className?: string
}

export function alertLabel(type: AlertSeverity) {
  return BADGE_CONFIG[type].label
}

export function alertTone(type: AlertSeverity) {
  return BADGE_CONFIG[type].tone
}

export function AlertBadge({ type, dotOnly = false, className = '' }: AlertBadgeProps) {
  const cfg = BADGE_CONFIG[type]

  if (dotOnly) {
    return (
      <span
        className={`inline-block h-2 w-2 rounded-full ${className}`}
        style={{ backgroundColor: cfg.color }}
        title={cfg.label}
      />
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${className}`}
      style={{
        color: cfg.color,
        backgroundColor: cfg.background,
        borderColor: cfg.border,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  )
}

/** Convierte el nombre del módulo de BD a etiqueta legible */
export function moduleLabel(module: string | null | undefined): string | null {
  const map: Record<string, string> = {
    credits:     'Créditos',
    budgets:     'Presupuestos',
    receivables: 'Por Cobrar',
    payables:    'Por Pagar',
    recurring:   'Plantillas',
    alerts:      'Avisos',
    assets:      'Activos',
    transactions:'Movimientos',
    portfolio:   'Cuentas',
  }
  const normalizedModule = module?.trim().toLowerCase() ?? ''
  return map[normalizedModule] ?? null
}
