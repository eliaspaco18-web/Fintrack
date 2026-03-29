// =============================================================================
// components/layout/NavItem.tsx
// Ítem de navegación individual del sidebar.
// Adapta su presentación según sidebarMode: expanded | collapsed | hidden.
// En modo collapsed muestra un tooltip accesible al hacer hover.
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
  mode:     SidebarMode | 'drawer'  // drawer = mobile, mismo display que expanded
  badge?:   number
  onClick?: () => void
}

export function NavItem({ item, mode, badge = 0, onClick }: NavItemProps) {
  const pathname   = usePathname()
  const isExpanded = mode === 'expanded' || mode === 'drawer'
  const isActive   = !!getActiveNavItem(pathname) &&
                     getActiveNavItem(pathname)?.key === item.key

  const handleClick = useCallback(() => {
    onClick?.()
  }, [onClick])

  if (mode === 'collapsed') {
    return (
      <li>
        <Link
          href={item.href}
          onClick={handleClick}
          aria-label={item.label}
          title={item.label}
          className={`
            group relative flex items-center justify-center
            w-11 h-11 mx-auto rounded-2xl
            transition-all duration-150
            ${isActive
              ? 'bg-emerald-500/14 text-emerald-400 border border-emerald-500/25'
              : 'text-[var(--color-text-muted)] border border-transparent hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:border-[color:var(--color-border)]'
            }
          `}
        >
          {/* Indicador activo */}
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5
              bg-emerald-500 rounded-r-full -ml-px"/>
          )}

          <NavIcon name={item.icon} size={18} strokeWidth={1.9}/>

          {/* Badge */}
          {badge > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5
              bg-red-500 rounded-full text-[8px] font-bold text-white
              flex items-center justify-center px-0.5">
              {badge > 9 ? '9+' : badge}
            </span>
          )}

          {/* Tooltip */}
          <span className="
            pointer-events-none absolute left-full ml-3 z-50
            px-2.5 py-1.5 rounded-lg
            bg-[var(--color-surface)] border border-[color:var(--color-border)]
            text-xs font-medium text-[var(--color-text)] whitespace-nowrap
            shadow-xl shadow-black/40
            opacity-0 translate-x-1
            group-hover:opacity-100 group-hover:translate-x-0
            transition-all duration-150
          ">
            {item.label}
            <span className="block text-[10px] text-[var(--color-text-muted)] font-normal mt-0.5">
              {item.description}
            </span>
          </span>
        </Link>
      </li>
    )
  }

  // Expanded / Drawer
  return (
    <li>
      <Link
        href={item.href}
        onClick={handleClick}
        className={`
          group relative flex items-center gap-3
          px-2.5 py-2 rounded-xl
          transition-all duration-150
          ${isActive
            ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/20'
            : 'text-[var(--color-text-muted)] border border-transparent hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:border-[color:var(--color-border)]'
          }
        `}
      >
        {/* Active bar */}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5
            bg-emerald-500 rounded-r-full -ml-px"/>
        )}

        <span className={`
          flex-shrink-0 w-8 h-8 rounded-lg border
          flex items-center justify-center transition-all duration-150
          ${isActive
            ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300'
            : 'border-[color:var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]'
          }
        `}>
          <NavIcon name={item.icon} size={17} strokeWidth={1.9}/>
        </span>

        <span className={`text-sm font-medium tracking-[-0.01em] flex-1 min-w-0 ${
          isActive ? 'text-emerald-400' : ''
        }`}>
          {item.label}
        </span>

        {badge > 0 && (
          <span className={`
            flex-shrink-0 min-w-[20px] h-5
            rounded-full text-[10px] font-bold
            flex items-center justify-center px-1.5
            ${isActive
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/15 text-red-400'
            }
          `}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    </li>
  )
}
