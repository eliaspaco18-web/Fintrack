'use client'

// =============================================================================
// components/layout/AppShell.tsx
// Shell del cliente autenticado. Gestiona el estado del layout y coordina
// sidebar, topbar y área de contenido.
//
// Jerarquía de componentes:
//   layout.tsx (Server) → AppShell (Client) → Sidebar + Topbar + children
//
// Por qué Client Component: necesita useLayout (sidebar state), useCurrency,
// y useRouter para el logout. El Server Component solo pasa los datos del user.
// =============================================================================

import { useCallback }              from 'react'
import { useRouter }                from 'next/navigation'
import { createClient }             from '@/lib/supabase.client'
import { LayoutProvider, useLayout } from '@/lib/hooks/useLayout'
import { CurrencyProvider }         from '@/lib/hooks/useDashboard'
import { StaticSidebar, MobileDrawer } from './Sidebar'
import { Topbar }                   from './Topbar'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface ShellUser {
  email:   string
  name?:   string | null
  avatar?: string | null
}

interface AppShellProps {
  user:            ShellUser
  /** Tipo de cambio inicial para el CurrencyProvider (viene del servidor) */
  exchangeRate:    number
  /** Badges de alertas por key de nav (cuotas vencidas, etc.) */
  navBadges?:      Partial<Record<string, number>>
  children:        React.ReactNode
}

// ─── INNER SHELL (consume useLayout) ─────────────────────────────────────────
// Separado del provider para poder usar el hook

function InnerShell({ user, navBadges = {}, children }: Omit<AppShellProps, 'exchangeRate'>) {
  const router   = useRouter()
  const supabase = createClient()

  const {
    sidebarMode,
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
  } = useLayout()

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [supabase, router])

  return (
    <div className="fin-shell density-compact flex h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Sidebar estático — tablet y desktop */}
      <StaticSidebar
        mode={sidebarMode}
        user={user}
        badges={navBadges}
      />

      {/* Drawer — mobile */}
      <MobileDrawer
        open={mobileDrawerOpen}
        onClose={closeMobileDrawer}
        user={user}
        badges={navBadges}
      />

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Topbar
          user={user}
          onMenuClick={openMobileDrawer}
          onSignOut={handleSignOut}
        />

        {/* Scroll container del contenido */}
        <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Inner wrapper con max-width y padding responsive */}
          <div className="max-w-[1400px] mx-auto px-3 md:px-5 lg:px-6 py-4 md:py-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── SHELL PRINCIPAL (con providers) ─────────────────────────────────────────

export function AppShell({ user, exchangeRate, navBadges, children }: AppShellProps) {
  return (
    <LayoutProvider>
      <CurrencyProvider initialRate={exchangeRate}>
        <InnerShell user={user} navBadges={navBadges}>
          {children}
        </InnerShell>
      </CurrencyProvider>
    </LayoutProvider>
  )
}
