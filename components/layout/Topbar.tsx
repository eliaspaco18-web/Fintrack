// =============================================================================
// components/layout/Topbar.tsx
// Barra superior sticky.
// Contenido: breadcrumb/título | divider | currency toggle | nueva tx | perfil
// =============================================================================

'use client'

import Link                   from 'next/link'
import Image                  from 'next/image'
import { usePathname }        from 'next/navigation'
import { useState, useRef,
         useEffect }          from 'react'
import { useCurrency }        from '@/lib/hooks/useDashboard'
import { useTheme }           from '@/lib/hooks/useTheme'
import { getActiveNavItem }   from '@/lib/constants/nav'
import { resolveUserAvatar }  from '@/lib/constants/avatar-presets'
import {
  IconMenu,
  IconPlus,
  IconCurrencyDollar,
  IconUser,
  IconLogOut,
  IconBell,
  IconChevronRight,
  IconSun,
  IconMoon,
}                             from './LayoutIcons'

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────

function Breadcrumb() {
  const pathname   = usePathname()
  const activeItem = getActiveNavItem(pathname)

  // Detectar sub-páginas para el breadcrumb secundario
  const parts    = pathname.split('/').filter(Boolean)
  const isDetail = parts.length > 1
  const lastSegment = parts.at(-1)

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {activeItem && (
        <span className="text-[13px] font-semibold text-[var(--color-text-muted)] hidden md:block truncate">
          {activeItem.label}
        </span>
      )}
      {isDetail && (
        <>
          <IconChevronRight size={12} className="text-[var(--color-text-faint)] flex-shrink-0 hidden md:block"/>
          <span className="text-[13px] font-semibold text-[var(--color-text)] capitalize hidden md:block truncate">
            {decodeURIComponent(lastSegment === 'new' ? 'Nueva' : (lastSegment ?? 'Detalle'))}
          </span>
        </>
      )}
      {/* Fallback mobile: solo el título de la sección activa */}
      {activeItem && (
        <span className="md:hidden text-sm font-semibold text-[var(--color-text-muted)]">
          {activeItem.label}
        </span>
      )}
    </div>
  )
}

// ─── CURRENCY TOGGLE ──────────────────────────────────────────────────────────

function CurrencyToggle() {
  const { preferred, toggle } = useCurrency()

  return (
    <button
      onClick={toggle}
      aria-label={`Cambiar moneda a ${preferred === 'PEN' ? 'USD' : 'PEN'}`}
      className="
        flex items-center gap-1.5 px-2.5 py-1.5
        rounded-lg border border-[color:var(--color-border)]
        bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)]
        text-[var(--color-text-muted)] hover:text-[var(--color-text)]
        transition-all duration-150 text-xs font-bold
        tracking-wide
      "
    >
      <IconCurrencyDollar size={12}/>
      <span>{preferred}</span>
    </button>
  )
}

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useTheme()
  const isLight = mounted && theme === 'light'

  return (
    <button
      onClick={toggleTheme}
      data-testid="theme-toggle-button"
      aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      className="
        flex items-center gap-1.5 px-2.5 py-1.5
        rounded-lg border border-[color:var(--color-border)]
        bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)]
        text-[var(--color-text-muted)] hover:text-[var(--color-text)]
        transition-all duration-150 text-xs font-bold
      "
    >
      {isLight ? <IconMoon size={12}/> : <IconSun size={12}/>}
      <span>{isLight ? 'Oscuro' : 'Claro'}</span>
    </button>
  )
}

// ─── NUEVA TRANSACCIÓN ────────────────────────────────────────────────────────

function NewTransactionButton() {
  return (
    <Link
      href="/transactions/new"
      className="
        flex items-center gap-1.5 px-3 py-1.5
        rounded-lg bg-emerald-500 hover:bg-emerald-400
        text-black text-xs font-bold tracking-wide
        transition-all duration-150
        shadow-md shadow-emerald-500/20
        hover:shadow-emerald-400/30
      "
    >
      <IconPlus size={12}/>
      <span className="hidden sm:inline">Nueva</span>
    </Link>
  )
}

// ─── USER MENU ────────────────────────────────────────────────────────────────

interface UserMenuProps {
  user: { email: string; name?: string | null; avatar?: string | null }
  onSignOut: () => void
}

function UserMenu({ user, onSignOut }: UserMenuProps) {
  const [open, setOpen]       = useState(false)
  const ref                   = useRef<HTMLDivElement>(null)
  const { preferred, toggle } = useCurrency()
  const { theme, mounted, toggleTheme } = useTheme()
  const isLight = mounted && theme === 'light'
  const displayName = (() => {
    const candidate = (user.name ?? '').trim()
    if (!candidate || candidate.includes('@')) return 'Usuario'
    return candidate
  })()
  const avatarSrc = resolveUserAvatar(user.avatar, user.email || displayName)
  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buen día'
    if (hour < 19) return 'Buena tarde'
    return 'Buena noche'
  })()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-label="Menú de usuario"
        aria-expanded={open}
        className="
          flex items-center justify-center
          w-7 h-7 rounded-lg overflow-hidden
          bg-[var(--color-surface-2)] border border-[color:var(--color-border)]
          text-[var(--color-text-muted)] hover:text-[var(--color-text)]
          hover:bg-[var(--color-surface)] hover:border-[color:var(--color-border-hover)]
          transition-all duration-150
          text-[11px] font-bold
        "
      >
        <Image
          src={avatarSrc}
          alt="Avatar de usuario"
          width={28}
          height={28}
          unoptimized
          className="w-full h-full object-cover"
        />
      </button>

      {/* Dropdown */}
      <div
        className={`
          absolute right-0 top-full mt-2 z-50
          w-[320px] rounded-2xl overflow-hidden
          bg-[var(--color-surface)] border border-[color:var(--color-border)]
          shadow-2xl shadow-black/30
          transition-all duration-200 origin-top-right
          ${open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          }
        `}
      >
        {/* Info */}
        <div className="px-4 py-4 border-b border-[color:var(--color-border)] bg-[linear-gradient(140deg,rgba(16,185,129,0.14),transparent,rgba(59,130,246,0.1))]">
          <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--color-text-muted)]">{greeting}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[var(--color-surface-2)] border border-[color:var(--color-border)] flex items-center justify-center text-[12px] font-bold text-[var(--color-text-muted)]">
              <Image
                src={avatarSrc}
                alt="Avatar de usuario"
                width={40}
                height={40}
                unoptimized
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text)] truncate">{displayName}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{user.email}</p>
              <p className="text-[10px] text-emerald-400/80 mt-1">Cuenta personal activa</p>
            </div>
          </div>
        </div>

        {/* Atajos */}
        <div className="px-3 py-3 border-b border-[color:var(--color-border)]">
          <p className="px-1 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-faint)] mb-2">
            Accesos rápidos
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/transactions/new"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2
                text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/15 transition-colors"
            >
              + Nueva transacción
            </Link>
            <Link
              href="/portfolio"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2
                text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]
                hover:border-[color:var(--color-border-hover)] transition-colors"
            >
              Ver portafolio
            </Link>
          </div>
        </div>

        {/* Preferencias rápidas */}
        <div className="px-3 py-3 border-b border-[color:var(--color-border)]">
          <p className="px-1 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-faint)] mb-2">
            Preferencias
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={toggle}
              className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2
                text-left transition-colors hover:border-[color:var(--color-border-hover)]"
            >
              <p className="text-[10px] text-[var(--color-text-faint)] uppercase tracking-wide">Moneda</p>
              <p className="text-[12px] font-semibold text-[var(--color-text)] mt-0.5">{preferred}</p>
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2
                text-left transition-colors hover:border-[color:var(--color-border-hover)]"
            >
              <p className="text-[10px] text-[var(--color-text-faint)] uppercase tracking-wide">Tema</p>
              <p className="text-[12px] font-semibold text-[var(--color-text)] mt-0.5">
                {isLight ? 'Claro' : 'Oscuro'}
              </p>
            </button>
          </div>
        </div>

        {/* Acciones de cuenta */}
        <div className="py-2">
          <Link
            href="/settings?tab=profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2
              text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]
              hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <IconUser size={13}/>
            Perfil y cuenta
          </Link>
          <Link
            href="/settings?tab=security"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2
              text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]
              hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <IconBell size={13}/>
            Alertas y seguridad
          </Link>
          <Link
            href="/settings?tab=preferences"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2
              text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]
              hover:bg-[var(--color-surface-2)] transition-colors"
          >
            {isLight ? <IconSun size={13}/> : <IconMoon size={13}/>}
            Preferencias avanzadas
          </Link>
        </div>

        <div className="px-3 py-2 border-t border-[color:var(--color-border)]">
          <button
            onClick={() => { setOpen(false); onSignOut() }}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl
              text-[13px] font-semibold text-red-400/75 hover:text-red-400
              bg-red-500/[0.04] hover:bg-red-500/[0.08] transition-colors"
          >
            <IconLogOut size={13}/>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TOPBAR PRINCIPAL ─────────────────────────────────────────────────────────

interface TopbarProps {
  user:            { email: string; name?: string | null; avatar?: string | null }
  onMenuClick:     () => void
  onSignOut:       () => void
}

export function Topbar({ user, onMenuClick, onSignOut }: TopbarProps) {
  return (
    <header
      className="fin-topbar
        sticky top-0 z-30 flex items-center gap-3
        px-4 md:px-5 py-3
        bg-[var(--color-topbar-bg)] backdrop-blur-md
        border-b border-[color:var(--color-border)]
        h-[52px]"
    >
      {/* Burger — solo mobile */}
      <button
        onClick={onMenuClick}
        aria-label="Abrir menú"
        className="md:hidden p-1.5 rounded-lg text-[var(--color-text-muted)]
          hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]
          transition-all duration-150 flex-shrink-0"
      >
        <IconMenu size={19}/>
      </button>

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <Breadcrumb/>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <CurrencyToggle/>
        <ThemeToggle/>
        <NewTransactionButton/>
        <div className="w-px h-4 bg-[var(--color-border)] hidden sm:block"/>
        <UserMenu user={user} onSignOut={onSignOut}/>
      </div>
    </header>
  )
}
