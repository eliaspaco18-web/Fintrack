import { moduleLabel } from './AlertBadge'

export interface ReadableAlert {
  id: string
  is_read: boolean
}

export type AlertReadFilter = 'unread' | 'read' | 'all'

export interface FilterableAlert extends ReadableAlert {
  alert_type: string
  source_module: string
  title: string
  message: string | null
}

export interface AlertFilterValues {
  type: string
  read: AlertReadFilter
  module: string
  query: string
}

export interface BulkReadResult {
  confirmedIds: string[]
  failedIds: string[]
}

const INTERNAL_ALERT_PATHS = [
  '/alerts',
  '/assets',
  '/budgets',
  '/credits',
  '/payables',
  '/portfolio',
  '/receivables',
  '/recurring',
  '/transactions',
]

function normalizeSearch(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function filterAlertRows<TAlert extends FilterableAlert>(alerts: readonly TAlert[], filters: AlertFilterValues): TAlert[] {
  const normalizedQuery = normalizeSearch(filters.query.trim())
  return alerts.filter(alert => {
    if (filters.type !== 'all' && alert.alert_type !== filters.type) return false
    if (filters.module !== 'all' && alert.source_module !== filters.module) return false
    if (filters.read === 'read' && !alert.is_read) return false
    if (filters.read === 'unread' && alert.is_read) return false
    if (!normalizedQuery) return true
    return normalizeSearch([alert.title, alert.message ?? '', moduleLabel(alert.source_module)].join(' ')).includes(normalizedQuery)
  })
}

export function isValidAlertHref(href: string | null | undefined): href is string {
  if (!href || !href.startsWith('/') || href.startsWith('//') || href.includes('\\')) return false
  try {
    const parsed = new URL(href, 'https://fintrack.invalid')
    if (parsed.origin !== 'https://fintrack.invalid') return false
    return parsed.pathname !== '/alerts'
      && INTERNAL_ALERT_PATHS.some(path => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`))
  } catch {
    return false
  }
}

export async function markAlertsReadIndividually<TAlert extends ReadableAlert>(
  unreadAlerts: readonly TAlert[],
  confirmRead: (id: string) => Promise<boolean>,
): Promise<BulkReadResult> {
  const confirmedIds: string[] = []
  const failedIds: string[] = []

  for (const alert of unreadAlerts) {
    try {
      if (await confirmRead(alert.id)) confirmedIds.push(alert.id)
      else failedIds.push(alert.id)
    } catch {
      failedIds.push(alert.id)
    }
  }

  return { confirmedIds, failedIds }
}
