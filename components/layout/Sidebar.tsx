// =============================================================================
// components/layout/Sidebar.tsx
// Sidebar — Redesign v3: Warm Neutral + Teal Accent
// Active: tinted bg + teal text + left indicator (no full-green fill)
// Shadow: sm (not lg) — borders handle separation in dark mode
// =============================================================================

'use client'

import Link                               from 'next/link'
import Image                              from 'next/image'
import { useRouter }                      from 'next/navigation'
import { createClient }                   from '@/lib/supabase.client'
import { NavItem }                        from './NavItem'
import { IconChevronLeft, IconChevronRight,
         IconLogOut, IconX }              from './LayoutIcons'
import { NAV_MAIN, NAV_SECONDARY }        from '@/lib/constants/nav'
import { resolveUserAvatar }              from '@/lib/constants/avatar-presets'
import type { SidebarMode }               from '@/lib/hooks/useLayout'
import { useLayout }                      from '@/lib/hooks/useLayout'
import { BrandMark, BrandWordmark }       from './Brand'

// ─── LOGO ─────────────────────────────────────────────────────────────────────

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label="Ir al dashboard"
      className="group flex min-w-0 items-center gap-2.5 rounded-[var(--sidebar-control-radius)] outline-none transition-[background-color,box-shadow] duration-150 ease-[var(--ease-out)] focus-visible:shadow-[var(--sidebar-focus-ring)]"
    >
      <BrandMark
        size={collapsed ? 30 : 32}
        variant="default"
        className="shrink-0 transition-[box-shadow,opacity] duration-150 ease-[var(--ease-out)] group-hover:opacity-95"
      />
      <div
        className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-180 ease-[var(--ease-out)] ${
          collapsed
            ? 'max-w-0 -translate-x-1 opacity-0'
            : 'max-w-[160px] translate-x-0 opacity-100'
        }`}
      >
        <BrandWordmark
          titleClassName="text-[16px] font-semibold tracking-[-0.018em] text-[var(--sidebar-brand-text)]"
          variant="default"
        />
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
    <p className="px-2 pb-1.5 pt-2 text-[11px] font-medium leading-none text-[var(--sidebar-section-text)]">
      {children}
    </p>
  )
}

function SidebarNavigation({
  mode,
  badges,
}: {
  mode: SidebarMode | 'drawer'
  badges: Partial<Record<string, number>>
}) {
  const collapsed = mode === 'collapsed'

  return (
    <nav
      className="flex-1 overflow-y-auto overflow-x-visible px-2 py-3"
      aria-label="Navegación principal"
    >
      {!collapsed && <SidebarSectionLabel>Principal</SidebarSectionLabel>}
      <ul className="space-y-1">
        {NAV_MAIN.map(item => (
          <NavItem
            key={item.key}
            item={item}
            mode={mode}
            badge={badges[item.key]}
          />
        ))}
      </ul>

      <div className="mx-2 my-3 h-px bg-gradient-to-r from-transparent via-[var(--sidebar-panel-border)] to-transparent" />

      {!collapsed && <SidebarSectionLabel>Sistema</SidebarSectionLabel>}
      <ul className="space-y-1">
        {NAV_SECONDARY.map(item => (
          <NavItem
            key={item.key}
            item={item}
            mode={mode}
            badge={badges[item.key]}
          />
        ))}
      </ul>
    </nav>
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
        <button
          type="button"
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
        </button>

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
      <div className="flex-shrink-0 rounded-[10px] bg-white/40 p-[1px] dark:bg-white/[0.03]">
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
  user:    { email: string; name?: string | null; avatar?: string | null }
  badges?: Partial<Record<string, number>>
}

export function StaticSidebar({ mode, user, badges = {} }: StaticSidebarProps) {
  const { toggleUserCollapse } = useLayout()
  const collapsed = mode === 'collapsed'

  return (
    <aside
      className="fin-sidebar sticky top-0 hidden h-screen flex-col p-[var(--sidebar-shell-gap)] transition-[width] duration-300 ease-[var(--ease-out)] md:flex"
      style={{
        width: collapsed
          ? 'var(--sidebar-width-collapsed)'
          : 'var(--sidebar-width-expanded)',
      }}
    >
      <div className="relative flex h-full flex-col overflow-visible rounded-[var(--sidebar-panel-radius)] border border-[var(--sidebar-panel-border)] bg-[var(--sidebar-panel-bg)] shadow-[var(--sidebar-panel-shadow)]">
        <div className="relative flex h-[var(--sidebar-header-height)] items-center border-b border-[var(--sidebar-panel-border)] px-3">
          <div className={collapsed ? 'mx-auto' : 'min-w-0 flex-1 pr-10'}>
            <SidebarLogo collapsed={collapsed} />
          </div>

          <button
            onClick={toggleUserCollapse}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            title={collapsed ? 'Expandir' : 'Colapsar'}
            className="sidebar-collapse-button absolute right-3 top-1/2 -translate-y-1/2"
          >
            {collapsed ? <IconChevronRight size={13} /> : <IconChevronLeft size={13} />}
          </button>
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
          md:hidden fixed inset-0 z-40
          bg-[var(--c-overlay)] backdrop-blur-[4px]
          transition-opacity duration-[220ms] ease-[var(--ease-out)]
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`
          fin-mobile-drawer
          md:hidden fixed inset-y-0 left-0 z-50
          w-[286px] p-[var(--sidebar-shell-gap)] flex flex-col
          bg-transparent
          transition-transform duration-300 ease-[var(--ease-out)]
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Menú de navegación"
      >
        <div className="flex h-full flex-col overflow-visible rounded-[var(--sidebar-panel-radius)] border border-[var(--sidebar-panel-border)] bg-[var(--sidebar-panel-bg)] shadow-[var(--sidebar-panel-shadow)]">
          <div className="flex h-[var(--sidebar-header-height)] items-center justify-between border-b border-[var(--sidebar-panel-border)] px-3">
            <SidebarLogo collapsed={false} />
            <button
              onClick={onClose}
              aria-label="Cerrar menú"
              title="Cerrar menú"
              className="sidebar-icon-button"
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
