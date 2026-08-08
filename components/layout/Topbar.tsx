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
import { CURRENT_RELEASE } from '@/lib/release/current-release'
import {
  IconBell,
  IconChevronRight,
  IconLogOut,
  IconMenu,
  IconMoon,
  IconPlus,
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
  onMenuClick: () => void
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
  const { user, navBadges = {}, lastSyncedAt, onMenuClick, onSignOut } = props
  const pathname = usePathname()
  const { mounted, theme, toggleTheme } = useTheme()
  const [quickOpen, setQuickOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
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

  const connectionLabel = !isOnline
    ? 'Sin conexión'
    : lastSyncedAt
      ? `Actualizado ${lastSyncedAt}`
      : 'Conectado'

  useEffect(() => {
    setQuickOpen(false)
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(window.navigator.onLine)
    handleOnline()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOnline)
    }
  }, [])

  return (
    <header className="
      fin-topbar sticky top-0 z-sticky h-[var(--topbar-height)] shrink-0
      border-b border-[var(--ft-border)]
      bg-[var(--ft-topbar-bg)]
    ">
      <div className="flex h-full min-w-0 items-center justify-between gap-3 px-4 md:px-6 xl:px-8">
        {/* Mobile menu button */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Abrir menú"
            className="
              flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control md:hidden
              border border-[var(--ft-border)] bg-[var(--ft-surface)]
              text-[var(--ft-text-muted)] transition-colors duration-fast motion-reduce:transition-none
              hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)]
              hover:text-[var(--ft-text-strong)] focus-visible:outline-none focus-visible:ring-[3px]
              focus-visible:ring-[var(--ft-focus-ring-color)]
            "
          >
            <IconMenu size={15} />
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
                className="hidden shrink-0 text-[var(--ft-primary)] sm:block"
              />
            ) : null}

            <h1 className="truncate text-[15px] font-semibold leading-none tracking-[-0.015em] text-[var(--ft-text-strong)]">
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

          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setQuickOpen(open => !open)}
              aria-expanded={quickOpen}
              aria-haspopup="true"
              className="
                ui-pressable inline-flex h-9 items-center gap-2
                rounded-control border border-transparent bg-[var(--ft-primary)]
                pl-3 pr-2 text-[12px] font-semibold
                text-[var(--ft-text-on-primary)]
                shadow-elevation-sm transition-[background-color,transform] duration-fast
                ease-[var(--ft-ease-out)] motion-reduce:transition-none hover:bg-[var(--ft-primary-hover)]
                active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-[3px]
                focus-visible:ring-[var(--ft-focus-ring-color)]
              "
            >
              Nueva
              <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-white/15">
                <IconPlus size={13} />
              </span>
            </button>

            {quickOpen ? (
              <div
                className="
                  absolute right-0 top-[calc(100%+8px)] z-dropdown w-60 rounded-surface
                  border border-[var(--ft-border)] bg-[var(--ft-surface)]
                  p-1.5 shadow-elevation-md
                "
              >
                <Link className="topbar-menu-item" href="/transactions?new=transaction" prefetch={false}>
                  Nueva transacción
                </Link>
                <Link className="topbar-menu-item" href="/portfolio?new=portfolio" prefetch={false}>
                  Nuevo portafolio
                </Link>
                <Link className="topbar-menu-item" href="/budgets?new=budget" prefetch={false}>
                  Nuevo presupuesto
                </Link>
                <Link className="topbar-menu-item" href="/recurring?new=template" prefetch={false}>
                  Nuevo recurrente
                </Link>
              </div>
            ) : null}
          </div>

          <div
            className="
              hidden h-9 items-center gap-2 rounded-control
              border border-[var(--ft-border)] bg-[var(--ft-surface)]
              px-2.5 text-[11px] font-medium text-[var(--ft-text-muted)]
              lg:flex
            "
            title={connectionLabel}
          >
            <span className={`h-1.5 w-1.5 rounded-[var(--radius-pill)] ${isOnline ? 'bg-[var(--ft-success)]' : 'bg-[var(--ft-danger)]'}`} />
            <span>{connectionLabel}</span>
          </div>

          <div
            className="
              hidden h-9 items-center rounded-control
              border border-[var(--ft-border)] bg-[var(--ft-surface)]
              px-2.5 text-[11px] font-semibold text-[var(--ft-text-muted)]
              lg:flex
            "
            title={`Versión actual ${CURRENT_RELEASE.version}`}
          >
            {CURRENT_RELEASE.version}
          </div>

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
