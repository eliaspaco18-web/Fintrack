import type { ComponentType, ReactNode, SVGProps } from 'react'

export type SettingsTab =
  | 'profile'
  | 'preferences'
  | 'security'
  | 'notifications'
  | 'accounts'
  | 'export'
  | 'support'

type SettingsIconProps = SVGProps<SVGSVGElement> & {
  size?: number
}

function makeIcon(path: ReactNode) {
  return function SettingsIcon({ size = 16, ...props }: SettingsIconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {path}
      </svg>
    )
  }
}

export const SettingsUserIcon = makeIcon(
  <>
    <path d="M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21" />
    <circle cx="12" cy="8" r="4" />
  </>,
)

export const SettingsLockIcon = makeIcon(
  <>
    <rect x="4" y="11" width="16" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 1 1 8 0v3" />
  </>,
)

export const SettingsSlidersIcon = makeIcon(
  <>
    <path d="M4 6h8" />
    <path d="M16 6h4" />
    <path d="M4 18h4" />
    <path d="M12 18h8" />
    <path d="M4 12h12" />
    <path d="M20 12h0" />
    <circle cx="14" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="10" cy="18" r="2" />
  </>,
)

export const SettingsBellIcon = makeIcon(
  <>
    <path d="M18 15V10a6 6 0 1 0-12 0v5l-2 2h16z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </>,
)

export const SettingsWalletIcon = makeIcon(
  <>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H19v4H6.5A2.5 2.5 0 0 1 4 7.5z" />
    <path d="M4 8v9.5A2.5 2.5 0 0 0 6.5 20H20v-6h-4a2 2 0 1 1 0-4h4V6" />
    <circle cx="16" cy="12" r="0.85" fill="currentColor" stroke="none" />
  </>,
)

export const SettingsDownloadIcon = makeIcon(
  <>
    <path d="M12 3v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4 17.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
  </>,
)

export const SettingsHelpIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.25 9.25a3 3 0 0 1 5.25 2c0 1.75-2.5 2.5-2.5 2.5" />
    <circle cx="12" cy="16.75" r="0.75" fill="currentColor" stroke="none" />
  </>,
)

export interface SettingsNavItem {
  key: SettingsTab
  label: string
  shortLabel: string
  description: string
  group: string
  eyebrow: string
  icon: ComponentType<SettingsIconProps>
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    key: 'profile',
    label: 'Perfil',
    shortLabel: 'Perfil',
    description: 'Nombre, avatar y datos visibles de tu cuenta.',
    group: 'Cuenta',
    eyebrow: 'Cuenta',
    icon: SettingsUserIcon,
  },
  {
    key: 'security',
    label: 'Seguridad',
    shortLabel: 'Seguridad',
    description: 'Contraseña, sesiones y acciones sensibles.',
    group: 'Cuenta',
    eyebrow: 'Cuenta',
    icon: SettingsLockIcon,
  },
  {
    key: 'preferences',
    label: 'Preferencias',
    shortLabel: 'Preferencias',
    description: 'Apariencia, privacidad y región financiera.',
    group: 'Preferencias',
    eyebrow: 'Preferencias',
    icon: SettingsSlidersIcon,
  },
  {
    key: 'notifications',
    label: 'Alertas',
    shortLabel: 'Alertas',
    description: 'Reglas críticas, seguimiento y avisos por correo.',
    group: 'Preferencias',
    eyebrow: 'Preferencias',
    icon: SettingsBellIcon,
  },
  {
    key: 'accounts',
    label: 'Cuentas',
    shortLabel: 'Cuentas',
    description: 'Cuentas conectadas y balances consolidados.',
    group: 'Datos',
    eyebrow: 'Datos',
    icon: SettingsWalletIcon,
  },
  {
    key: 'export',
    label: 'Datos',
    shortLabel: 'Datos',
    description: 'Importación, respaldo y archivos de trabajo.',
    group: 'Datos',
    eyebrow: 'Datos',
    icon: SettingsDownloadIcon,
  },
  {
    key: 'support',
    label: 'Soporte',
    shortLabel: 'Soporte',
    description: 'Contacto, ayuda y recursos del producto.',
    group: 'Ayuda',
    eyebrow: 'Ayuda',
    icon: SettingsHelpIcon,
  },
]

export const SETTINGS_TAB_MAP = Object.fromEntries(
  SETTINGS_NAV_ITEMS.map(item => [item.key, item]),
) as Record<SettingsTab, SettingsNavItem>

export const SETTINGS_NAV_GROUPS = Object.entries(
  SETTINGS_NAV_ITEMS.reduce<Record<string, SettingsNavItem[]>>((acc, item) => {
    acc[item.group] ??= []
    acc[item.group]!.push(item)
    return acc
  }, {}),
).map(([label, items]) => ({ label, items }))

export function getSettingsTabValue(input?: string): SettingsTab {
  const valid = new Set<SettingsTab>(SETTINGS_NAV_ITEMS.map(item => item.key))
  return valid.has(input as SettingsTab) ? (input as SettingsTab) : 'profile'
}
