// =============================================================================
// lib/constants/nav.ts
// Configuración completa de navegación de la aplicación.
// Fuente de verdad para sidebar, breadcrumbs y metadatos de página.
// =============================================================================

export interface NavItem {
  key:         string
  label:       string
  href:        string
  icon:        NavIconKey
  /** Si true, solo matchea la ruta exacta (no subpáginas) */
  exact?:      boolean
  /** Descripción para tooltips en modo colapsado */
  description: string
  /** Sección del sidebar donde aparece */
  section:     'main' | 'secondary'
}

export type NavIconKey =
  | 'dashboard'
  | 'portfolio'
  | 'transactions'
  | 'credits'
  | 'budgets'
  | 'assets'
  | 'receivables'
  | 'payables'
  | 'recurring'
  | 'alerts'
  | 'admin'
  | 'settings'

export const NAV_ITEMS: NavItem[] = [
  {
    key:         'dashboard',
    label:       'Dashboard',
    href:        '/dashboard',
    icon:        'dashboard',
    exact:       true,
    description: 'Vista general de saldos, flujo y alertas clave',
    section:     'main',
  },
  {
    key:         'portfolio',
    label:       'Portafolio',
    href:        '/portfolio',
    icon:        'portfolio',
    description: 'Cuentas bancarias, tarjetas y productos financieros',
    section:     'main',
  },
  {
    key:         'transactions',
    label:       'Movimientos',
    href:        '/transactions',
    icon:        'transactions',
    description: 'Registro de ingresos, egresos y transferencias',
    section:     'main',
  },
  {
    key:         'credits',
    label:       'Créditos',
    href:        '/credits',
    icon:        'credits',
    description: 'Control de tarjetas, préstamos y cuotas',
    section:     'main',
  },
  {
    key:         'budgets',
    label:       'Presupuestos',
    href:        '/budgets',
    icon:        'budgets',
    description: 'Límites de gasto por categoría y período',
    section:     'main',
  },
  {
    key:         'assets',
    label:       'Activos',
    href:        '/assets',
    icon:        'assets',
    description: 'Patrimonio, bienes e inversiones',
    section:     'main',
  },
  {
    key:         'receivables',
    label:       'Por cobrar',
    href:        '/receivables',
    icon:        'receivables',
    description: 'Seguimiento de dinero pendiente por cobrar',
    section:     'main',
  },
  {
    key:         'payables',
    label:       'Por pagar',
    href:        '/payables',
    icon:        'payables',
    description: 'Seguimiento de deudas y pagos pendientes',
    section:     'main',
  },
  {
    key:         'recurring',
    label:       'Recurrentes',
    href:        '/recurring',
    icon:        'recurring',
    description: 'Plantillas para movimientos automáticos',
    section:     'main',
  },
  {
    key:         'alerts',
    label:       'Alertas',
    href:        '/alerts',
    icon:        'alerts',
    description: 'Riesgos, vencimientos y recomendaciones',
    section:     'main',
  },
  {
    key:         'admin',
    label:       'Administración',
    href:        '/admin',
    icon:        'admin',
    description: 'Catálogos base y parámetros del sistema',
    section:     'secondary',
  },
  {
    key:         'settings',
    label:       'Configuración',
    href:        '/settings',
    icon:        'settings',
    description: 'Perfil, seguridad y preferencias',
    section:     'secondary',
  },
]

/** Mapa de ruta → item para lookups O(1) */
export const NAV_BY_HREF = Object.fromEntries(
  NAV_ITEMS.map(item => [item.href, item])
) as Record<string, NavItem>

/** Dado un pathname, retorna el NavItem activo (si existe) */
export function getActiveNavItem(pathname: string): NavItem | null {
  // Buscar match exacto primero
  const exact = NAV_ITEMS.find(item => item.exact && pathname === item.href)
  if (exact) return exact

  // Match por prefijo (más específico primero)
  const prefix = NAV_ITEMS
    .filter(item => !item.exact && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return prefix ?? null
}

/** Items por sección, para renderizar grupos en el sidebar */
export const NAV_MAIN      = NAV_ITEMS.filter(i => i.section === 'main')
export const NAV_SECONDARY = NAV_ITEMS.filter(i => i.section === 'secondary')
