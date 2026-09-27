// =============================================================================
// components/layout/Sidebar.tsx
// Sidebar — Redesign v3: Warm Neutral + Teal Accent
// Active: tinted bg + teal text + left indicator (no full-green fill)
// Shadow: sm (not lg) — borders handle separation in dark mode
// =============================================================================

'use client'

import Link                               from 'next/link'
import Image                              from 'next/image'
import { createPortal }                    from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter }                      from 'next/navigation'
import { createClient }                   from '@/lib/supabase.client'
import { NavItem }                        from './NavItem'
import { IconLogOut, IconX }             from './LayoutIcons'
import { NAV_GROUPS, NAV_ITEMS }         from '@/lib/constants/nav'
import { resolveUserAvatar }              from '@/lib/constants/avatar-presets'
import type { SidebarMode }               from '@/lib/hooks/useLayout'
import { CURRENT_RELEASE }                from '@/lib/release/current-release'
import { FocusTrap }                     from '@/components/ui/accessibility'
import { acquireV3ModalBackground }     from '@/lib/ui/v3-modal-background'
import { FTMark }                       from './FTMark'
import { RecordModal }                  from '@/components/ui/RecordModal'

// ─── LOGO ─────────────────────────────────────────────────────────────────────

function SidebarLogo({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      aria-label="Ir al dashboard"
      className="ft-sidebar-logo group flex min-w-0 items-center gap-3 rounded-control outline-none focus-visible:shadow-[var(--ft-focus-ring)]"
    >
      <FTMark size={32} className="ft-sidebar-mark shrink-0" />
      <div
        className="ft-sidebar-wordmark overflow-hidden whitespace-nowrap"
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        <span className="text-[21px] font-bold tracking-[-0.7px] text-[var(--sidebar-brand-text)]">FinTrack</span>
      </div>
    </Link>
  )
}

// ─── PERFIL ───────────────────────────────────────────────────────────────────

interface SidebarProfileProps {
  user:      { email: string; name?: string | null; avatar?: string | null }
  collapsed: boolean
}

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-2 pt-2 text-[12px] font-medium leading-none text-[var(--sidebar-section-text)]">
      {children}
    </p>
  )
}

function SidebarNavigation({
  mode,
  badges,
  onNavigate,
}: {
  mode: SidebarMode | 'drawer'
  badges: Partial<Record<string, number>>
  onNavigate?: () => void
}) {
  const collapsed = mode === 'collapsed'
  const byKey = new Map(NAV_ITEMS.map(item => [item.key, item]))
  const footerKeys = ['alerts', 'admin', 'developer', 'settings']
  const [tooltip, setTooltip] = useState<{ label: string; left: number; top: number } | null>(null)
  const tooltipTimer = useRef<number | null>(null)
  const lastTooltipLeave = useRef(0)

  const dismissTooltip = () => {
    if (tooltipTimer.current !== null) window.clearTimeout(tooltipTimer.current)
    tooltipTimer.current = null
    lastTooltipLeave.current = Date.now()
    setTooltip(null)
  }

  const showTooltip = (element: HTMLElement, label: string, immediate: boolean) => {
    if (tooltipTimer.current !== null) window.clearTimeout(tooltipTimer.current)
    const show = () => {
      const rect = element.getBoundingClientRect()
      setTooltip({ label, left: rect.right + 10, top: Math.max(20, Math.min(window.innerHeight - 20, rect.top + rect.height / 2)) })
      tooltipTimer.current = null
    }
    if (immediate || Date.now() - lastTooltipLeave.current < 800) show()
    else tooltipTimer.current = window.setTimeout(show, 300)
  }

  useEffect(() => () => {
    if (tooltipTimer.current !== null) window.clearTimeout(tooltipTimer.current)
  }, [])

  return (
    <>
    <nav
      className={`flex-1 overflow-y-auto overflow-x-visible py-3 ${collapsed ? 'px-3' : 'px-3'}`}
      aria-label="Navegación principal"
      onScroll={dismissTooltip}
    >
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label} className={index > 0 ? 'mt-3 border-t border-[var(--sidebar-panel-border)] pt-2' : ''}>
          {!collapsed && <SidebarSectionLabel>{group.label}</SidebarSectionLabel>}
          <ul className="space-y-1">
            {group.keys.map(key => {
              const item = byKey.get(key)
              return item ? <NavItem key={key} item={item} mode={mode} badge={badges[key]} onClick={() => { dismissTooltip(); onNavigate?.() }} onRailTooltipEnter={showTooltip} onRailTooltipLeave={dismissTooltip} /> : null
            })}
          </ul>
        </div>
      ))}
      <div className="mt-3 border-t border-[var(--sidebar-panel-border)] pt-2">
        <ul className="space-y-1">
          {footerKeys.map(key => {
            const item = byKey.get(key)
            return item ? <NavItem key={key} item={item} mode={mode} badge={badges[key]} onClick={() => { dismissTooltip(); onNavigate?.() }} onRailTooltipEnter={showTooltip} onRailTooltipLeave={dismissTooltip} /> : null
          })}
        </ul>
      </div>
    </nav>
    {tooltip && collapsed && typeof document !== 'undefined' ? createPortal(
      <span className="ft-rail-tooltip" style={{ left: tooltip.left, top: tooltip.top }} aria-hidden="true">{tooltip.label}</span>,
      document.body,
    ) : null}
    </>
  )
}

function SidebarProfile({ user, collapsed }: SidebarProfileProps) {
  const router   = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const avatarSrc   = resolveUserAvatar(user.avatar, user.email || user.name)
  const displayName = (() => {
    const candidate = (user.name ?? '').trim()
    if (!candidate || candidate.includes('@')) return 'Usuario'
    return candidate
  })()

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Link
          href="/settings?tab=profile"
          className="sidebar-avatar-button"
          aria-label={`Cuenta de ${displayName}`}
          title={displayName}
        >
          <Image
            src={avatarSrc}
            alt="Avatar de usuario"
            width={30}
            height={30}
            unoptimized
            className="h-[30px] w-[30px] rounded-[10px] object-cover shadow-[inset_0_0_0_1px_var(--sidebar-avatar-border)]"
          />
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="sidebar-icon-button"
        >
          <IconLogOut size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="sidebar-account-card">
      <div className="flex-shrink-0">
        <Image
          src={avatarSrc}
          alt="Avatar de usuario"
          width={32}
          height={32}
          unoptimized
          className="sidebar-account-avatar"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold leading-tight text-[var(--sidebar-account-name)]">
          {displayName}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-[var(--sidebar-account-email)]">
          {user.email}
        </p>
        <p className="mt-1 truncate text-[11px] font-medium text-[var(--sidebar-section-text)]">
          {CURRENT_RELEASE.version}
        </p>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className="sidebar-icon-button"
      >
        <IconLogOut size={14} />
      </button>
    </div>
  )
}

// ─── SIDEBAR ESTÁTICO (desktop + tablet) ─────────────────────────────────────

interface StaticSidebarProps {
  mode:    SidebarMode
  animate?: boolean
  user:    { email: string; name?: string | null; avatar?: string | null }
  badges?: Partial<Record<string, number>>
}

export function StaticSidebar({ mode, animate = false, user, badges = {} }: StaticSidebarProps) {
  const collapsed = mode === 'collapsed'

  return (
    <aside
      id="ft-primary-navigation"
      className="fin-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-[var(--sidebar-panel-border)] md:flex"
      style={{
        width: collapsed
          ? 'var(--sidebar-width-collapsed)'
          : 'var(--sidebar-width-expanded)',
        '--ft-sidebar-scale': collapsed ? String(68 / 208) : '1',
        '--ft-sidebar-motion-duration': animate ? '240ms' : '0ms',
      } as React.CSSProperties}
    >
      <div className="relative z-[1] flex h-full flex-col overflow-visible bg-transparent">
        <div className="flex h-[var(--sidebar-header-height)] shrink-0 items-center border-b border-[var(--sidebar-panel-border)] pl-[18px]">
          <SidebarLogo collapsed={collapsed} />
        </div>

        <SidebarNavigation mode={mode} badges={badges} />

        <div className={`border-t border-[var(--sidebar-panel-border)] px-3 py-3 ${
          collapsed ? 'flex flex-col items-center gap-2' : ''
        }`}>
          <SidebarProfile user={user} collapsed={collapsed} />
        </div>
      </div>
    </aside>
  )
}

/** Tablet labels are a temporary modal above the 68px rail, not a new layout width. */
export function TabletNavigation({ open, onClose, user, badges = {} }: MobileDrawerProps) {
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!open) return
    const element = document.createElement('div')
    element.className = 'ft-tablet-navigation-root'
    document.body.appendChild(element)
    setRoot(element)
    return () => {
      element.remove()
      setRoot(null)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!root) return
    return acquireV3ModalBackground(root)
  }, [root])

  if (!root) return null
  return createPortal(
    <div className="ft-tablet-navigation-layer" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <FocusTrap active onEscape={onClose} initialFocusRef={headingRef} deferRestoreFocus className="ft-tablet-navigation-trap">
        <aside id="ft-tablet-navigation-panel" className="ft-tablet-navigation-panel" role="dialog" aria-modal="true" aria-labelledby="ft-tablet-navigation-title">
          <div className="flex h-[var(--sidebar-header-height)] shrink-0 items-center justify-between border-b border-[var(--sidebar-panel-border)] pl-[18px] pr-2">
            <SidebarLogo collapsed={false} onNavigate={onClose} />
            <button type="button" onClick={onClose} aria-label="Cerrar navegación" className="sidebar-icon-button !h-11 !w-11">
              <IconX size={17} />
            </button>
          </div>
          <h2 ref={headingRef} tabIndex={-1} id="ft-tablet-navigation-title" className="sr-only">Navegación</h2>
          <SidebarNavigation mode="drawer" badges={badges} onNavigate={onClose} />
          <div className="border-t border-[var(--sidebar-panel-border)] px-3 py-3">
            <SidebarProfile user={user} collapsed={false} />
          </div>
        </aside>
      </FocusTrap>
    </div>, root,
  )
}

export function MobileModulesWorkbench({
  open, onClose, user, badges = {}, motionSource = 'keyboard',
}: MobileDrawerProps & { motionSource?: 'pointer' | 'keyboard' }) {
  return (
    <RecordModal
      open={open}
      onClose={onClose}
      title="Módulos"
      eyebrow="FinTrack"
      subtitle="Accede a todas las secciones"
      presentation="workbench"
      motionSource={motionSource}
      bodyClassName="!p-0"
    >
      <SidebarNavigation mode="drawer" badges={badges} onNavigate={onClose} />
      <div className="border-t border-[var(--sidebar-panel-border)] px-3 py-3">
        <SidebarProfile user={user} collapsed={false} />
      </div>
    </RecordModal>
  )
}

// ─── MOBILE DRAWER ────────────────────────────────────────────────────────────

interface MobileDrawerProps {
  open:    boolean
  onClose: () => void
  user:    { email: string; name?: string | null; avatar?: string | null }
  badges?: Partial<Record<string, number>>
}

export function MobileDrawer({ open, onClose, user, badges = {} }: MobileDrawerProps) {
  return (
    <>
      <div
        className={`
          fixed inset-0 z-dropdown bg-[var(--ft-overlay)] md:hidden
          transition-opacity duration-base ease-[var(--ft-ease-out)] motion-reduce:transition-none
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`
          fin-mobile-drawer
          fixed inset-y-0 left-0 z-drawer flex w-[min(300px,calc(100vw-16px))] flex-col p-2 md:hidden
          transition-transform duration-slow ease-[var(--ft-ease-out)] motion-reduce:transition-none
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Menú de navegación"
      >
        <div className="flex h-full flex-col overflow-visible rounded-panel border border-[var(--sidebar-panel-border)] bg-[var(--sidebar-panel-bg)] shadow-elevation-xl">
          <div className="flex h-[var(--sidebar-header-height)] items-center justify-between border-b border-[var(--sidebar-panel-border)] px-3">
            <SidebarLogo collapsed={false} />
            <button
              onClick={onClose}
              aria-label="Cerrar menú"
              title="Cerrar menú"
              className="sidebar-icon-button sidebar-drawer-close-button"
            >
              <IconX size={16} />
            </button>
          </div>

          <SidebarNavigation mode="drawer" badges={badges} />

          <div className="border-t border-[var(--sidebar-panel-border)] px-3 py-3">
            <SidebarProfile user={user} collapsed={false} />
          </div>
        </div>
      </aside>
    </>
  )
}
