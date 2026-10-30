import { expect, test } from '@playwright/test'
import { getSettingsTabValue, SETTINGS_NAV_ITEMS } from '@/components/settings/config'

test('settings keeps the established tab identifiers and presents the requested navigation labels', () => {
  expect(SETTINGS_NAV_ITEMS.map(item => item.key)).toEqual([
    'profile', 'security', 'preferences', 'notifications', 'accounts', 'export', 'support',
  ])
  expect(SETTINGS_NAV_ITEMS.map(item => item.shortLabel)).toEqual([
    'Perfil', 'Seguridad', 'Preferencias', 'Notificaciones', 'Cuentas', 'Datos', 'Soporte',
  ])
  expect(getSettingsTabValue('preferences')).toBe('preferences')
  expect(getSettingsTabValue('export')).toBe('export')
  expect(getSettingsTabValue('unknown')).toBe('profile')
})
