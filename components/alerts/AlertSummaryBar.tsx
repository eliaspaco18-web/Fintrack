'use client'

import { Button } from '@/components/ui/Button'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'
import type { AlertRow } from './AlertsWorkspace'

interface AlertSummaryBarProps {
  alerts: AlertRow[]
  onRefresh: () => void
  refreshing: boolean
}

export function AlertSummaryBar({ alerts, onRefresh, refreshing }: AlertSummaryBarProps) {
  const unread = alerts.filter(alert => !alert.is_read).length
  const read = alerts.length - unread
  const criticalUnread = alerts.filter(alert => !alert.is_read && alert.alert_type === 'CRITICAL').length

  return (
    <section className={movementStyles.summary} aria-label="Resumen de avisos">
      <div className={movementStyles.summaryItem}>
        <p>No leídos</p>
        <div className={`${movementStyles.summaryValue} tabular-nums`}>{unread}</div>
        <span className={movementStyles.summaryDetail}>Pendientes de lectura</span>
      </div>
      <div className={movementStyles.summaryItem}>
        <p>Críticos no leídos</p>
        <div className={`${movementStyles.summaryValue} tabular-nums`}>{criticalUnread}</div>
        <span className={movementStyles.summaryDetail}>Por severidad registrada</span>
      </div>
      <div className={`${movementStyles.summaryItem} ${movementStyles.summaryQualitative}`}>
        <p>Leídos</p>
        <div className={`${movementStyles.summaryValue} tabular-nums`}>{read}</div>
        <span className={movementStyles.summaryDetail}>Leer no resuelve el asunto financiero relacionado</span>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onRefresh} loading={refreshing}>Actualizar</Button>
    </section>
  )
}
