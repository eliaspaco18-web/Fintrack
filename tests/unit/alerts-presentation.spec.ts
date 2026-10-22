import { expect, test } from '@playwright/test'
import { filterAlertRows, isValidAlertHref, markAlertsReadIndividually } from '@/components/alerts/alerts-presentation'
import { moduleLabel } from '@/components/alerts/AlertBadge'
import { formatManualAlertMessage } from '@/modules/alerts/manual-alert-message'

test.describe('Alerts R1 presentation and bulk reconciliation', () => {
  test('marks only individually confirmed unread notices and leaves failed ones retryable', async () => {
    const notices = [
      { id: 'confirmed', is_read: false },
      { id: 'http-failure', is_read: false },
      { id: 'network-failure', is_read: false },
    ]
    const result = await markAlertsReadIndividually(notices, async id => {
      if (id === 'confirmed') return true
      if (id === 'network-failure') throw new Error('offline')
      return false
    })

    expect(result).toEqual({ confirmedIds: ['confirmed'], failedIds: ['http-failure', 'network-failure'] })
    expect(notices.filter(notice => !result.confirmedIds.includes(notice.id)).every(notice => !notice.is_read)).toBe(true)
  })

  test('keeps a successful bulk read result exact when every request succeeds', async () => {
    const result = await markAlertsReadIndividually([
      { id: 'one', is_read: false },
      { id: 'two', is_read: false },
    ], async () => true)

    expect(result).toEqual({ confirmedIds: ['one', 'two'], failedIds: [] })
  })

  test('combines read state, severity, module and accent-insensitive search without changing classification', () => {
    const alerts = [
      { id: 'target', is_read: false, alert_type: 'CRITICAL', source_module: 'budgets', title: 'Vencimiento próximo', message: 'Revisar presupuesto' },
      { id: 'other-severity', is_read: false, alert_type: 'OPERATIONAL', source_module: 'budgets', title: 'Vencimiento próximo', message: null },
      { id: 'other-module', is_read: false, alert_type: 'CRITICAL', source_module: 'credits', title: 'Vencimiento próximo', message: null },
      { id: 'read', is_read: true, alert_type: 'CRITICAL', source_module: 'budgets', title: 'Vencimiento próximo', message: null },
    ]

    expect(filterAlertRows(alerts, { read: 'unread', type: 'CRITICAL', module: 'budgets', query: 'vencimiento PROXIMO' }).map(alert => alert.id)).toEqual(['target'])
    expect(filterAlertRows(alerts, { read: 'read', type: 'all', module: 'all', query: 'presupuestos' }).map(alert => alert.id)).toEqual(['read'])
  })

  test('allows only same-origin links to known in-app record areas', () => {
    expect(isValidAlertHref('/budgets?month=2026-10')).toBe(true)
    expect(isValidAlertHref('/receivables/debtor-1')).toBe(true)
    expect(isValidAlertHref('/alerts')).toBe(false)
    expect(isValidAlertHref('/alerts?source=manual')).toBe(false)
    expect(isValidAlertHref('https://outside.example/record')).toBe(false)
    expect(isValidAlertHref('//outside.example/record')).toBe(false)
    expect(isValidAlertHref('/unknown-module/record')).toBe(false)
    expect(isValidAlertHref(null)).toBe(false)
  })

  test('uses the approved Plantillas label and does not invent an unknown source label', () => {
    expect(moduleLabel('recurring')).toBe('Plantillas')
    expect(moduleLabel('UNKNOWN')).toBeNull()
    expect(moduleLabel('')).toBeNull()
    expect(moduleLabel(null)).toBeNull()
  })

  test('describes channel and threshold as stored metadata, never as scheduled delivery', () => {
    const message = formatManualAlertMessage({ sourceModule: 'budgets', channel: 'inbox_email', threshold: '80' })
    expect(message).toContain('Aviso manual relacionado con Presupuestos.')
    expect(message).toContain('Umbral de referencia: 80%.')
    expect(message).toContain('Canal guardado como referencia: Inbox y correo.')
    expect(message).toContain('No se programan reglas ni se realizan envíos automáticos.')
    expect(message).not.toContain('Entrega esperada')
  })
})
