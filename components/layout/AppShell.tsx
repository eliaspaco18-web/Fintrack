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
import useSWR from 'swr'
import { usePathname, useRouter }   from 'next/navigation'
import { createClient }             from '@/lib/supabase.client'
import { LayoutProvider, useLayout } from '@/lib/hooks/useLayout'
import { CurrencyProvider }         from '@/lib/hooks/useDashboard'
import { StaticSidebar, MobileDrawer } from './Sidebar'
import { ProductUpdatesBanner }    from './ProductUpdatesBanner'
import { Topbar }                   from './Topbar'
import { QuickActionsFAB }          from './QuickActionsFAB'

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
  const pathname = usePathname()
  const supabase = createClient()

  const {
    sidebarMode,
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
  } = useLayout()
  const { data: liveNavBadges } = useSWR<Partial<Record<string, number>>>(
    '/api/dashboard/nav-badges',
    async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? 'No se pudo cargar el estado del sidebar')
      }
      return payload.data as Partial<Record<string, number>>
    },
    {
      fallbackData: navBadges,
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      refreshInterval: 60_000,
    },
  )

  const resolvedNavBadges = liveNavBadges ?? navBadges

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [supabase, router])

  return (
    // h-screen + overflow-hidden en el shell evita que el sidebar haga scroll
    // Solo el <main> scrollea internamente
    <div className="fin-shell flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--c-bg)', color: 'var(--c-text)' }}>
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
      <div className="flex-1 flex min-w-0 flex-col overflow-hidden">
        {/* Topbar fija en la parte superior de la columna derecha */}
        <Topbar
          user={user}
          navBadges={resolvedNavBadges}
          onMenuClick={openMobileDrawer}
          onSignOut={handleSignOut}
        />

        {/* Scroll container del contenido — solo esta área scrollea */}
        <main id="main-content" className="relative flex-1 overflow-y-auto overflow-x-hidden">
          <div key={pathname} className="page-transition-enter w-full px-3 pt-4 sm:px-4 lg:px-5 xl:px-6" style={{ paddingBottom: 'max(6rem, calc(var(--fab-safe-area, 0px) + 1.5rem))' }}>
            <ProductUpdatesBanner />
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
