// =============================================================================
// components/layout/LayoutIcons.tsx
// Iconos SVG inline para el layout. Sin dependencias externas.
// Stroke-based, 24x24 viewBox, strokeWidth ajustable.
// =============================================================================

import type { NavIconKey } from '@/lib/constants/nav'

interface IconProps {
  size?:        number
  strokeWidth?: number
  className?:   string
}

// ─── PATHS POR CLAVE ─────────────────────────────────────────────────────────

const NAV_ICON_PATHS: Record<NavIconKey, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2"/>
      <rect x="13" y="3" width="8" height="5" rx="2"/>
      <rect x="13" y="10" width="8" height="11" rx="2"/>
      <rect x="3" y="13" width="8" height="8" rx="2"/>
    </>
  ),
  portfolio: (
    <>
      <rect x="2.5" y="6" width="19" height="14" rx="3"/>
      <path d="M8 6V4.5A2.5 2.5 0 0 1 10.5 2h3A2.5 2.5 0 0 1 16 4.5V6"/>
      <path d="M2.5 11.5h19"/>
      <circle cx="16.8" cy="15.2" r="1.3"/>
    </>
  ),
  transactions: (
    <>
      <path d="M5 7h11"/>
      <path d="m13 3 4 4-4 4"/>
      <path d="M19 17H8"/>
      <path d="m11 13-4 4 4 4"/>
    </>
  ),
  credits: (
    <>
      <rect x="2" y="5.5" width="20" height="13" rx="2.5"/>
      <path d="M2 10.2h20"/>
      <rect x="5.2" y="13.2" width="5" height="2.6" rx="1.2"/>
      <path d="M14.5 14.5h3.8"/>
    </>
  ),
  assets: (
    <>
      <path d="m12 3 8.5 4.8v8.4L12 21l-8.5-4.8V7.8L12 3Z"/>
      <path d="M12 21v-9.6"/>
      <path d="m3.7 8 8.3 4.7 8.3-4.7"/>
    </>
  ),
  receivables: (
    <>
      <path d="M14 2.5H6.5A2.5 2.5 0 0 0 4 5v14a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V8.5L14 2.5Z"/>
      <path d="M14 2.5V8h6"/>
      <path d="m8.8 14.8 2.3 2.3 4.2-4.2"/>
    </>
  ),
  payables: (
    <>
      <path d="M14 2.5H6.5A2.5 2.5 0 0 0 4 5v14a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V8.5L14 2.5Z"/>
      <path d="M14 2.5V8h6"/>
      <path d="M8.8 14.8h6.4"/>
    </>
  ),
  alerts: (
    <>
      <path d="M18.5 9.3a6.5 6.5 0 1 0-13 0c0 2.8-.9 4.8-2.2 6.1h17.4c-1.3-1.3-2.2-3.3-2.2-6.1Z"/>
      <path d="M9.6 19a2.4 2.4 0 0 0 4.8 0"/>
      <path d="M12 3V2"/>
    </>
  ),
  admin: (
    <>
      <path d="M4 7h16"/>
      <path d="M4 12h16"/>
      <path d="M4 17h16"/>
      <circle cx="9" cy="7" r="2"/>
      <circle cx="15" cy="12" r="2"/>
      <circle cx="11" cy="17" r="2"/>
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </>
  ),
}

// ─── NAV ICON ─────────────────────────────────────────────────────────────────

export function NavIcon({ name, size = 18, strokeWidth = 1.7, className = '' }: IconProps & { name: NavIconKey }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {NAV_ICON_PATHS[name]}
    </svg>
  )
}

// ─── ICONOS DE UI GENERAL ─────────────────────────────────────────────────────

export function IconPlus({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

export function IconMenu({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16"/>
    </svg>
  )
}

export function IconX({ size = 18, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  )
}

export function IconChevronLeft({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="m15 18-6-6 6-6"/>
    </svg>
  )
}

export function IconChevronRight({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}

export function IconLogOut({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

export function IconUser({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  )
}

export function IconCurrencyDollar({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <line x1="12" y1="2" x2="12" y2="22"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )
}

export function IconBell({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

export function IconSun({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>
    </svg>
  )
}

export function IconMoon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>
    </svg>
  )
}
