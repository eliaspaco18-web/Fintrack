'use client'

import { AnchoredActionMenu, type AnchoredAction } from '@/components/ui/AnchoredActionMenu'
import { Button } from '@/components/ui/Button'
import { AlertBadge, alertLabel, moduleLabel, type AlertSeverity } from './AlertBadge'
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
  const sourceLabel = moduleLabel(source_module)
  const trigger = (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
    </svg>
  )

  return (
    <article data-testid={'alert-row-' + id} className={styles.row} data-read={is_read} data-has-context={Boolean(sourceLabel)}>
      <div className={styles.content}>
        {sourceLabel ? <span data-testid="alert-context-label" className={styles.contextLabel}>{sourceLabel}</span> : null}
        <h3>{title}</h3>
        {message ? <p>{message}</p> : null}
        <div className={styles.metaLine}>
          <span className={styles.severityMeta}>
            <AlertBadge type={alert_type} dotOnly />
            {alertLabel(alert_type)}
          </span>
          <span aria-hidden="true" className={styles.metaSeparator}>·</span>
          <time dateTime={created_at}>{dateLabel}</time>
        </div>
        {href ? (
          <a className={styles.originLink} href={href}>
            {sourceLabel ? 'Revisar ' + sourceLabel : 'Abrir registro'}
            <span aria-hidden="true">→</span>
          </a>
        ) : null}
      </div>

      <div className={styles.rowActions}>
        <Button
          type="button"
          disabled={busy}
          onClick={() => onToggleRead(id, !is_read)}
          testId={'alert-toggle-' + id}
          variant={is_read ? 'secondary' : 'ghost'}
          size="sm"
          className={styles.toggleAction}
        >
          {is_read ? 'Marcar no leído' : 'Marcar leído'}
        </Button>
        <AnchoredActionMenu
          label={'Más acciones del aviso: ' + title}
          triggerContent={trigger}
          className={styles.menuTrigger}
          actions={actions}
          align="end"
          dismissOnSourceScroll
        />
      </div>
    </article>
  )
}
