// =============================================================================
// components/layout/NavItem.tsx — Redesign v3
// Active: tinted bg + teal text + left border indicator (no full-green fill)
// Hover: surface-2 bg, text transition
// Collapsed: icon centered + tooltip via CSS tokens
// =============================================================================

'use client'

import Link                           from 'next/link'
import { usePathname }                from 'next/navigation'
import { useCallback }                from 'react'
import type { NavItem as NavItemType } from '@/lib/constants/nav'
import { getActiveNavItem }           from '@/lib/constants/nav'
import { NavIcon }                    from './LayoutIcons'
import type { SidebarMode }           from '@/lib/hooks/useLayout'

interface NavItemProps {
  item:     NavItemType
  mode:     SidebarMode | 'drawer'
  badge?:   number
  onClick?: () => void
}

function SidebarBadge({ value, active }: { value: number; active: boolean }) {
  if (value <= 0) return null

  return (
    <span
      className="sidebar-badge"
      data-active={active ? 'true' : 'false'}
      aria-label={`${value} notificaciones`}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

function CollapsedNavItem({
  item,
  badge,
  isActive,
  onClick,
}: {
  item: NavItemType
  badge: number
  isActive: boolean
  onClick: () => void
}) {
  const tooltipLabel = item.description
    ? `${item.label}: ${item.description}`
    : item.label

  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        aria-label={tooltipLabel}
        aria-current={isActive ? 'page' : undefined}
        title={item.label}
        className="group sidebar-nav-link sidebar-nav-link-collapsed"
        data-active={isActive ? 'true' : 'false'}
      >
        <NavIcon name={item.icon} size={17} strokeWidth={1.65} />
        {badge > 0 && (
          <span className="sidebar-collapsed-badge">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        <span className="sidebar-tooltip">{item.label}</span>
      </Link>
    </li>
  )
}

export function NavItem({ item, mode, badge = 0, onClick }: NavItemProps) {
  const pathname = usePathname()
  const activeItem = getActiveNavItem(pathname)
  const isActive = activeItem?.key === item.key

  const handleClick = useCallback(() => { onClick?.() }, [onClick])

  if (mode === 'collapsed') {
    return (
      <CollapsedNavItem
        item={item}
        badge={badge}
        isActive={isActive}
        onClick={handleClick}
      />
    )
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={handleClick}
        className="sidebar-nav-link"
        data-active={isActive ? 'true' : 'false'}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="sidebar-nav-icon">
          <NavIcon name={item.icon} size={16} strokeWidth={1.65} />
        </span>
        <span className="text-[13px] font-medium tracking-[-0.01em] flex-1 min-w-0 truncate">
          {item.label}
        </span>
        <SidebarBadge value={badge} active={isActive} />
      </Link>
    </li>
  )
}
