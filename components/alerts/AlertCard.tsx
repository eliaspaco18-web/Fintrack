'use client'

// =============================================================================
// components/alerts/AlertCard.tsx
// PRD v3 — Módulo 9: Fila operativa de la Risk Inbox
// =============================================================================

import { StatusBadge } from '@/components/finance'
import { Button } from '@/components/ui/Button'
import { AlertBadge, moduleLabel, type AlertSeverity } from './AlertBadge'

export interface AlertCardProps {
  id:            string
  alert_type:    AlertSeverity
  source_module: string
  title:         string
  message:       string | null
  href:          string | null
  is_read:       boolean
  created_at:    string
  /** Callback al marcar como leída/no leída — recibe el nuevo valor */
  onToggleRead:  (id: string, next: boolean) => void
  /** Callback al eliminar */
  onDelete:      (id: string) => void
  /** Si hay una acción en curso para este ID */
  busy:          boolean
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Ahora mismo'
  if (mins < 60)  return `Hace ${mins} min`
  if (hours < 24) return `Hace ${hours}h`
  if (days < 7)   return `Hace ${days}d`
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

const BORDER_COLOR: Record<AlertSeverity, string> = {
  CRITICAL: 'var(--c-danger)',
  OPERATIONAL: 'var(--c-warning)',
  SUGGESTION: 'var(--c-info)',
}

export function AlertCard({
  id,
  alert_type,
  source_module,
  title,
  message,
  href,
  is_read,
  created_at,
  onToggleRead,
  onDelete,
  busy,
}: AlertCardProps) {
  const moduleName = moduleLabel(source_module)
  const stateTone = is_read ? 'muted' : 'primary'

  return (
    <article
      data-testid={`alert-row-${id}`}
      className="grid gap-3 border-b border-[var(--c-border)] px-4 py-4 transition-[background-color] duration-150 last:border-b-0 hover:bg-[var(--c-surface-2)] md:grid-cols-[minmax(0,1.6fr)_140px_110px_120px_auto] md:items-center"
      style={{
        boxShadow: !is_read
          ? `inset 2px 0 0 ${BORDER_COLOR[alert_type]}`
          : undefined,
      }}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <AlertBadge type={alert_type} />
        </div>

        <p className={`text-sm font-semibold leading-snug ${is_read ? 'text-[var(--c-text-muted)]' : 'text-[var(--c-text)]'}`}>
          {title}
        </p>

        {message && (
          <p className="text-[12px] leading-relaxed text-[var(--c-text-muted)]">{message}</p>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:hidden">
          Módulo
        </p>
        <p className="text-[12px] font-medium text-[var(--c-text-muted)]">{moduleName}</p>
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:hidden">
          Estado
        </p>
        <StatusBadge tone={stateTone} dot={!is_read}>
          {is_read ? 'Resuelta' : 'Pendiente'}
        </StatusBadge>
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:hidden">
          Ingreso
        </p>
        <p className="font-mono text-[12px] font-medium tabular-nums text-[var(--c-text-muted)]">
          {relativeTime(created_at)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {href ? (
          <Button href={href} variant="secondary" size="sm">
            Abrir
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={busy}
          onClick={() => onToggleRead(id, !is_read)}
          testId={`alert-toggle-${id}`}
          variant={is_read ? 'ghost' : 'success'}
          size="sm"
        >
          {is_read ? 'Reabrir' : 'Resolver'}
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => onDelete(id)}
          testId={`alert-delete-${id}`}
          variant="danger"
          size="icon-sm"
          ariaLabel="Eliminar alerta"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4.5h8V6" />
            <path d="M7 6l1 13h8l1-13" />
            <path d="M10 10.5v5.5" />
            <path d="M14 10.5v5.5" />
          </svg>
        </Button>
      </div>
    </article>
  )
}
