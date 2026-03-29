// =============================================================================
// components/layout/Sidebar.tsx
// Sidebar de navegación principal.
// Modos: expanded (desktop) | collapsed (tablet) | drawer (mobile overlay)
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
    <Link href="/dashboard" className="flex items-center gap-3 group min-w-0">
      <BrandMark
        size={collapsed ? 34 : 40}
        className="shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"
      />

      {/* Wordmark — oculto en collapsed */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out whitespace-nowrap ${
          collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        }`}
      >
        <BrandWordmark
          titleClassName="text-[20px]"
          subtitleClassName="text-[9px] tracking-[0.15em]"
          subtitle="Money OS"
        />
      </div>
    </Link>
  )
}

// ─── TOGGLE DE COLAPSO (solo desktop) ────────────────────────────────────────

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle:  () => void
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      className="flex items-center justify-center w-8 h-8 rounded-full
        border border-[color:var(--color-border)] bg-[var(--color-surface)]
        text-[var(--color-text-muted)] shadow-lg shadow-black/30
        hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:border-[color:var(--color-border-hover)]
        transition-all duration-150"
    >
      {collapsed
        ? <IconChevronRight size={14}/>
        : <IconChevronLeft  size={14}/>
      }
    </button>
  )
}

// ─── PERFIL ───────────────────────────────────────────────────────────────────

interface SidebarProfileProps {
  user:      { email: string; name?: string | null; avatar?: string | null }
  collapsed: boolean
}

function SidebarProfile({ user, collapsed }: SidebarProfileProps) {
  const router    = useRouter()
  const supabase  = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const avatarSrc = resolveUserAvatar(user.avatar, user.email || user.name)
  const displayName = (() => {
    const candidate = (user.name ?? '').trim()
    if (!candidate || candidate.includes('@')) return 'Usuario'
    return candidate
  })()

  return (
    <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-lg overflow-hidden
        bg-[var(--color-surface-2)] border border-[color:var(--color-border)]
        flex items-center justify-center text-[11px] font-bold text-[var(--color-text-muted)]">
        <Image
          src={avatarSrc}
          alt="Avatar de usuario"
          width={28}
          height={28}
          unoptimized
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      {!collapsed && (
        <>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[var(--color-text)] truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] truncate">{user.email}</p>
          </div>

          {/* Logout */}
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)]
              hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]
              transition-all duration-150"
          >
            <IconLogOut size={14}/>
          </button>
        </>
      )}
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
      className={`
        fin-sidebar
        hidden md:flex flex-col
        h-screen sticky top-0
        bg-[var(--color-sidebar-bg)] border-r border-[color:var(--color-border)]
        transition-all duration-300 ease-out
        ${collapsed ? 'w-[68px]' : 'w-[220px]'}
      `}
    >
      {/* Header: logo */}
      <div className={`
        relative flex items-center gap-3 px-4 py-5
        border-b border-[color:var(--color-border)]
        ${collapsed ? 'justify-center' : 'justify-start'}
      `}>
        <SidebarLogo collapsed={collapsed}/>
      </div>

      {/* Toggle flotante siempre visible en el borde del sidebar */}
      <div className="absolute right-[-14px] top-1/2 -translate-y-1/2 z-30 hidden md:block">
        <CollapseToggle collapsed={collapsed} onToggle={toggleUserCollapse}/>
      </div>

      {/* Nav principal */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${
        collapsed ? 'px-2' : 'px-2.5'
      }`}>
        <ul className="space-y-0.5">
          {NAV_MAIN.map(item => (
            <NavItem
              key={item.key}
              item={item}
              mode={mode}
              badge={badges[item.key]}
            />
          ))}
        </ul>

        {/* Separador */}
        <div className={`my-3 ${collapsed ? 'mx-2' : 'mx-1'} h-px bg-[var(--color-border)]`}/>

        {/* Nav secundaria */}
        <ul className="space-y-0.5">
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

      {/* Footer: perfil */}
      <div className={`
        border-t border-[color:var(--color-border)] px-3 py-3
        ${collapsed ? 'flex flex-col items-center gap-2' : ''}
      `}>
        <SidebarProfile user={user} collapsed={collapsed}/>
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
      {/* Backdrop */}
      <div
        className={`
          md:hidden fixed inset-0 z-40
          bg-black/60 backdrop-blur-[2px]
          transition-opacity duration-300
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <aside
        className={`
          fin-mobile-drawer
          md:hidden fixed inset-y-0 left-0 z-50
          w-[260px] flex flex-col
          bg-[var(--color-sidebar-bg)] border-r border-[color:var(--color-border)]
          shadow-2xl shadow-black/60
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Menú de navegación"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-5
          border-b border-[color:var(--color-border)]">
          <SidebarLogo collapsed={false}/>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)]
              hover:bg-[var(--color-surface-2)] transition-all duration-150"
          >
            <IconX size={16}/>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          <ul className="space-y-0.5">
            {NAV_MAIN.map(item => (
              <NavItem
                key={item.key}
                item={item}
                mode="drawer"
                badge={badges[item.key]}
                onClick={onClose}
              />
            ))}
          </ul>
          <div className="my-3 mx-1 h-px bg-[var(--color-border)]"/>
          <ul className="space-y-0.5">
            {NAV_SECONDARY.map(item => (
              <NavItem
                key={item.key}
                item={item}
                mode="drawer"
                badge={badges[item.key]}
                onClick={onClose}
              />
            ))}
          </ul>
        </nav>

        {/* Profile */}
        <div className="border-t border-[color:var(--color-border)] px-3 py-3">
          <SidebarProfile user={user} collapsed={false}/>
        </div>
      </aside>
    </>
  )
}
