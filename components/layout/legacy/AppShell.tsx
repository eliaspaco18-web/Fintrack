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
import { usePathname, useRouter }   from 'next/navigation'
import { createClient }             from '@/lib/supabase.client'
import { useNavBadges }              from '@/lib/hooks/useNavBadges'
import { LayoutProvider, useLayout } from './useLayout'
import { CurrencyProvider }         from '@/lib/hooks/useDashboard'
import { StaticSidebar, MobileDrawer } from './Sidebar'
import { ProductUpdatesBanner }    from '../ProductUpdatesBanner'
import { ReleaseAnnouncementGate } from '../ReleaseAnnouncementGate'
import { Topbar }                   from './Topbar'
import { QuickActionsFAB }          from './QuickActionsFAB'
import { NavBadgesErrorNotice }     from '../NavBadgesErrorNotice'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface ShellUser {
  id:      string
  email:   string
  name?:   string | null
  avatar?: string | null
}

interface AppShellProps {
  user:            ShellUser
  /** Tipo de cambio inicial para el CurrencyProvider (viene del servidor) */
  exchangeRate:    number | null
  /** Badges de alertas por key de nav (cuotas vencidas, etc.) */
  navBadges?:      Partial<Record<string, number>>
  children:        React.ReactNode
}

// ─── INNER SHELL (consume useLayout) ─────────────────────────────────────────
// Separado del provider para poder usar el hook

function InnerShell({ user, navBadges = {}, children }: Omit<AppShellProps, 'exchangeRate'>) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const {
    sidebarMode,
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
  } = useLayout()
  const {
    data: resolvedNavBadges,
    error: navBadgesError,
    isValidating: navBadgesValidating,
    retry: retryNavBadges,
  } = useNavBadges(navBadges, user.id)

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [supabase, router])

  return (
    // h-dvh + overflow-hidden en el shell evita que el sidebar haga scroll
    // Solo el <main> scrollea internamente
    <div data-ft-legacy-shell="" className="fin-shell flex h-dvh overflow-hidden bg-[var(--ft-canvas)] text-[var(--ft-text-strong)]">
      <ReleaseAnnouncementGate />

      {/* Sidebar estático — tablet y desktop */}
      <StaticSidebar
        mode={sidebarMode}
        user={user}
        badges={resolvedNavBadges}
      />

      {/* Drawer — mobile */}
      <MobileDrawer
        open={mobileDrawerOpen}
        onClose={closeMobileDrawer}
        user={user}
        badges={resolvedNavBadges}
      />

      {/* Área principal — columna derecha, scroll independiente */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar fija en la parte superior de la columna derecha */}
        <Topbar
          user={user}
          navBadges={resolvedNavBadges}
          onMenuClick={openMobileDrawer}
          onSignOut={handleSignOut}
        />

        {/* Scroll container del contenido — solo esta área scrollea */}
        <main id="main-content" className="relative flex-1 overflow-x-hidden overflow-y-auto bg-[var(--ft-canvas)]">
          <div
            key={pathname}
            className="page-transition-enter w-full px-4 pt-4 md:px-6 md:pt-5 xl:px-8 xl:pt-6"
            style={{ paddingBottom: 'max(6rem, calc(var(--fab-safe-area, 0px) + 1.5rem))' }}
          >
            <ProductUpdatesBanner />
            {navBadgesError ? (
              <NavBadgesErrorNotice isRetrying={navBadgesValidating} onRetry={retryNavBadges} />
            ) : null}
            {children}
          </div>

          {/* FAB de accesos rápidos — posición fija dentro del scroll container */}
          <QuickActionsFAB />
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
