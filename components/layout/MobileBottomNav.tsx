'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getActiveNavItem } from '@/lib/constants/nav'
import { IconMenu, NavIcon } from './LayoutIcons'

const DESTINATIONS = [
  { key: 'dashboard', label: 'Inicio', href: '/dashboard', icon: 'dashboard' },
  { key: 'transactions', label: 'Movimientos', href: '/transactions', icon: 'transactions' },
  { key: 'portfolio', label: 'Cuentas', href: '/portfolio', icon: 'portfolio' },
] as const

export function MobileBottomNav({ onMore, moreOpen }: { onMore: (source: 'pointer' | 'keyboard') => void; moreOpen: boolean }) {
  const pathname = usePathname()
  const activeKey = getActiveNavItem(pathname)?.key
  const moreActive = moreOpen || !DESTINATIONS.some(item => item.key === activeKey)

  return (
    <nav className="ft-mobile-dock" aria-label="Destinos principales">
      <div className="ft-mobile-dock-destinations">
        {DESTINATIONS.map(item => (
          <Link key={item.key} href={item.href} prefetch={false} aria-current={activeKey === item.key ? 'page' : undefined} className="ft-mobile-dock-item" data-active={activeKey === item.key ? 'true' : 'false'}>
            <NavIcon name={item.icon} size={19} strokeWidth={1.7} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button type="button" onClick={event => onMore(event.detail === 0 ? 'keyboard' : 'pointer')} aria-expanded={moreOpen} className="ft-mobile-dock-item" data-active={moreActive ? 'true' : 'false'}>
          <IconMenu size={19} />
          <span>Más</span>
        </button>
      </div>
      <span className="sr-only">Registrar se encuentra en el extremo derecho</span>
    </nav>
  )
}
