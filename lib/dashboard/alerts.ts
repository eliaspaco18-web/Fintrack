import type { DashboardAlertItem } from './types'

const URGENCY_ORDER: Record<DashboardAlertItem['urgency'], number> = {
  OVERDUE: 0,
  DUE_SOON: 1,
}

export function sortDashboardAlerts(alerts: DashboardAlertItem[]): DashboardAlertItem[] {
  return [...alerts].sort((a, b) => {
    const urgencyDelta = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
    if (urgencyDelta !== 0) return urgencyDelta

    if (!a.dueDate && b.dueDate) return 1
    if (a.dueDate && !b.dueDate) return -1
    if (a.dueDate && b.dueDate) {
      const dateDelta = a.dueDate.localeCompare(b.dueDate)
      if (dateDelta !== 0) return dateDelta
    }

    return Math.abs(b.amountPen) - Math.abs(a.amountPen)
  })
}

export function isCriticalDashboardUrgency(
  urgency: string | null | undefined,
): urgency is DashboardAlertItem['urgency'] {
  return urgency === 'OVERDUE' || urgency === 'DUE_SOON'
}
