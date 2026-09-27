'use client'

// =============================================================================
// components/layout/Topbar.tsx
// Header superior — Redesign v3
// Sin rounded card, sin kicker, borde inferior simple.
// Limpio: estilo Vercel/Linear dashboard.
// =============================================================================

import Link                from 'next/link'
import { usePathname }      from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getActiveNavItem } from '@/lib/constants/nav'
import { useTheme } from '@/lib/hooks/useTheme'
import { useCurrency } from '@/lib/hooks/useDashboard'
import { CURRENT_RELEASE } from '@/lib/release/current-release'
import { FTMark } from './FTMark'
import {
  IconBell,
  IconChevronRight,
  IconLogOut,
  IconMenu,
  IconMoon,
  IconSun,
  IconUser,
  NavIcon,
} from './LayoutIcons'

function resolveCrumbs(pathname: string) {
  const activeItem = getActiveNavItem(pathname)
  const parts = pathname.split('/').filter(Boolean)
  const lastSeg = parts.at(-1)
  const activeSegment = activeItem?.href.replace('/', '')
  const detailLabel = lastSeg && lastSeg !== activeSegment
    ? lastSeg === 'new'
      ? 'Nueva'
      : decodeURIComponent(lastSeg).replace(/[-_]/g, ' ')
    : null

  return {
    activeItem,
    title: activeItem?.label ?? 'FinTrack',
    detailLabel,
  }
}

interface TopbarProps {
  user: { email: string; name?: string | null; avatar?: string | null }
  navBadges?: Partial<Record<string, number>>
  lastSyncedAt?: string | null
  onNavigationToggle: (source: 'pointer' | 'keyboard') => void
  navigationExpanded: boolean
  onSignOut: () => void
}

function TopbarIconButton({
  children,
  label,
  onClick,
  className = '',
}: {
  children: ReactNode
  label: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`
        ui-pressable relative inline-flex h-9 w-9 items-center justify-center
        rounded-control border border-[var(--ft-border)]
        bg-[var(--ft-surface)] text-[var(--ft-text-muted)]
        transition-[background-color,border-color,color,transform] duration-fast
        ease-[var(--ft-ease-out)] motion-reduce:transition-none
        hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)]
        hover:text-[var(--ft-text-strong)]
        active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-[3px]
        focus-visible:ring-[var(--ft-focus-ring-color)] focus-visible:ring-offset-2
        focus-visible:ring-offset-[var(--ft-topbar-bg)]
        ${className}
      `.trim()}
    >
      {children}
    </button>
  )
}

export function Topbar(props: TopbarProps) {
  const { user, navBadges = {}, onNavigationToggle, navigationExpanded, onSignOut } = props
  const pathname = usePathname()
  const { mounted, theme, toggleTheme } = useTheme()
  const { preferred, toggle: toggleCurrency } = useCurrency()
  const [profileOpen, setProfileOpen] = useState(false)
  const { activeItem, title, detailLabel } = resolveCrumbs(pathname)
  const alertCount = navBadges.alerts ?? 0
  const isLight = mounted && theme === 'light'

  const displayName = useMemo(
    () => user.name?.trim() || user.email || 'Usuario',
    [user.email, user.name],
  )

  const initials = useMemo(
    () => displayName
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    [displayName],
  )

  useEffect(() => {
    setProfileOpen(false)
  }, [pathname])

  return (
    <header className="
      fin-topbar sticky top-0 z-sticky h-[var(--topbar-height)] shrink-0
      border-b border-[var(--ft-border)]
      bg-[var(--ft-topbar-bg)]
    ">
      <div className="ft-topbar-inner flex h-full min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/dashboard" aria-label="Ir a Inicio" prefetch={false} className="mr-1 inline-flex shrink-0 rounded-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)] md:hidden">
            <FTMark size={27} />
          </Link>
          <button
            type="button"
            onClick={event => onNavigationToggle(event.detail === 0 ? 'keyboard' : 'pointer')}
            aria-controls="ft-primary-navigation"
            aria-expanded={navigationExpanded}
            aria-label={navigationExpanded ? 'Contraer navegación' : 'Expandir navegación'}
            title={navigationExpanded ? 'Contraer navegación' : 'Expandir navegación'}
            className="ft-navigation-toggle hidden h-9 w-9 shrink-0 items-center justify-center rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)] md:inline-flex"
          >
            <IconMenu size={18} />
          </button>
          {activeItem ? (
            <span className="hidden shrink-0 text-[12px] font-medium text-[var(--ft-text-subtle)] md:inline">
              FinTrack
            </span>
          ) : null}

          {activeItem ? (
            <IconChevronRight
              size={13}
              className="hidden shrink-0 text-[var(--ft-text-subtle)] md:block"
            />
          ) : null}

          <div className="flex min-w-0 items-center gap-2">
            {activeItem ? (
              <NavIcon
                name={activeItem.icon}
                size={15}
                strokeWidth={1.75}
                className="shrink-0 text-[var(--ft-primary)]"
              />
            ) : null}

            <h1 tabIndex={-1} className="truncate text-[15px] font-semibold leading-none tracking-[-0.015em] text-[var(--ft-text-strong)]">
              {title}
            </h1>

            {detailLabel ? (
              <>
                <IconChevronRight
                  size={13}
                  className="hidden shrink-0 text-[var(--ft-text-subtle)] sm:block"
                />
                <span className="hidden max-w-[180px] truncate text-[12px] font-medium capitalize text-[var(--ft-text-muted)] sm:inline">
                  {detailLabel}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/alerts"
            prefetch={false}
            aria-label={alertCount > 0 ? `${alertCount} alertas críticas` : 'Alertas'}
            title="Alertas"
            className="
              ui-pressable relative inline-flex h-9 w-9 items-center justify-center
              rounded-control border border-[var(--ft-border)]
              bg-[var(--ft-surface)] text-[var(--ft-text-muted)]
              transition-[background-color,border-color,color,transform] duration-fast
              ease-[var(--ft-ease-out)] motion-reduce:transition-none
              hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)]
              hover:text-[var(--ft-text-strong)] active:scale-[0.97]
              focus-visible:outline-none focus-visible:ring-[3px]
              focus-visible:ring-[var(--ft-focus-ring-color)]
            "
          >
            <IconBell size={16} />
            {alertCount > 0 ? (
              <span
                className="
                  absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center
                  rounded-[var(--radius-pill)] bg-[var(--ft-danger)]
                  px-1 text-[10px] font-semibold leading-none
                  text-[var(--ft-text-on-primary)]
                "
              >
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            ) : null}
          </Link>

          <TopbarIconButton
            label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            onClick={toggleTheme}
            className="hidden sm:inline-flex"
          >
            {isLight ? <IconMoon size={16} /> : <IconSun size={16} />}
          </TopbarIconButton>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen(open => !open)}
              aria-label="Abrir perfil"
              aria-expanded={profileOpen}
              aria-haspopup="true"
              className="
                ui-pressable flex h-9 items-center gap-2 rounded-control
                border border-[var(--ft-border)] bg-[var(--ft-surface)]
                px-1.5 pr-2 text-[var(--ft-text-strong)]
                transition-[background-color,border-color,transform] duration-fast
                ease-[var(--ft-ease-out)] motion-reduce:transition-none hover:border-[var(--ft-border-strong)]
                hover:bg-[var(--ft-surface-hover)] active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-[3px]
                focus-visible:ring-[var(--ft-focus-ring-color)]
              "
            >
              <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-[6px] bg-[var(--ft-primary-soft)] text-[10px] font-semibold text-[var(--ft-primary)]">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                ) : initials ? (
                  initials
                ) : (
                  <IconUser size={13} />
                )}
              </span>
              <span className="hidden max-w-[120px] truncate text-[12px] font-medium md:inline">
                {displayName}
              </span>
            </button>

            {profileOpen ? (
              <div
                className="
                  absolute right-0 top-[calc(100%+8px)] z-dropdown w-64 rounded-surface
                  border border-[var(--ft-border)] bg-[var(--ft-surface)]
                  p-1.5 shadow-elevation-md
                "
              >
                <div className="px-3 py-2">
                  <p className="truncate text-[13px] font-semibold text-[var(--ft-text-strong)]">{displayName}</p>
                  <p className="truncate text-[11px] text-[var(--ft-text-muted)]">{user.email}</p>
                  <p className="mt-1 text-[11px] font-medium text-[var(--ft-primary)]">Plan Personal</p>
                  <p className="mt-1 text-[11px] text-[var(--ft-text-subtle)]">Versión {CURRENT_RELEASE.version}</p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="topbar-menu-item w-full sm:hidden"
                >
                  {isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
                </button>
                <button type="button" onClick={toggleCurrency} className="topbar-menu-item w-full">
                  Vista de importes: {preferred} · cambiar a {preferred === 'PEN' ? 'USD' : 'PEN'}
                </button>
                <Link className="topbar-menu-item" href="/settings?tab=profile" prefetch={false}>
                  Configuración
                </Link>
                <Link className="topbar-menu-item" href="/settings?tab=security" prefetch={false}>
                  Seguridad
                </Link>
                <button type="button" onClick={onSignOut} className="topbar-menu-item w-full">
                  <IconLogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
