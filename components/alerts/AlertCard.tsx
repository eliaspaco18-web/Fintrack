'use client'

import { StatusBadge } from '@/components/finance'
import { AnchoredActionMenu, type AnchoredAction } from '@/components/ui/AnchoredActionMenu'
import { Button } from '@/components/ui/Button'
import { AlertBadge, moduleLabel, type AlertSeverity } from './AlertBadge'
import styles from './AlertCard.module.css'

export interface AlertCardProps {
  id: string
  alert_type: AlertSeverity
  source_module: string
  title: string
  message: string | null
  href: string | null
  is_read: boolean
  created_at: string
  dateLabel: string
  actions: AnchoredAction[]
  onToggleRead: (id: string, next: boolean) => void
  busy: boolean
}

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  CRITICAL: 'var(--ft-danger)',
  OPERATIONAL: 'var(--ft-warning)',
  SUGGESTION: 'var(--ft-info)',
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
  dateLabel,
  actions,
  onToggleRead,
  busy,
}: AlertCardProps) {
  const trigger = (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
    </svg>
  )

  return (
    <article
      data-testid={`alert-row-${id}`}
      className={styles.row}
      data-read={is_read}
      style={{ boxShadow: !is_read ? `inset 2px 0 0 ${SEVERITY_COLOR[alert_type]}` : undefined }}
    >
      <div className={styles.rowHeader}>
        <div className={styles.severity}><AlertBadge type={alert_type} /></div>
        <div className={styles.rowActions}>
          {href ? (
            <Button
              href={href}
              variant="ghost"
              size="icon-sm"
              className={styles.openAction}
              ariaLabel={`Abrir origen del aviso: ${title}`}
              title="Abrir registro de origen"
            >
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
              </svg>
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={busy}
            onClick={() => onToggleRead(id, !is_read)}
            testId={`alert-toggle-${id}`}
            variant={is_read ? 'secondary' : 'ghost'}
            size="sm"
            className={styles.toggleAction}
          >
            {is_read ? 'Marcar como no leído' : 'Marcar como leído'}
          </Button>
          <AnchoredActionMenu
            label={`Más acciones del aviso: ${title}`}
            triggerContent={trigger}
            className={styles.menuTrigger}
            actions={actions}
            align="end"
            dismissOnSourceScroll
          />
        </div>
      </div>

      <div className={styles.content}>
        <h3>{title}</h3>
        {message ? <p>{message}</p> : null}
      </div>

      <div className={styles.metadata}>
        <div className={styles.moduleCell}>
          <span className={styles.mobileLabel}>Origen</span>
          <span>{moduleLabel(source_module)}</span>
        </div>
        <div className={styles.dateCell}>
          <span className={styles.mobileLabel}>Fecha</span>
          <time dateTime={created_at}>{dateLabel}</time>
        </div>
        <div className={styles.stateCell}>
          <StatusBadge tone={is_read ? 'muted' : 'primary'} dot={!is_read}>{is_read ? 'Leído' : 'No leído'}</StatusBadge>
        </div>
      </div>
    </article>
  )
}
