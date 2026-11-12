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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname, useRouter }   from 'next/navigation'
import { createClient }             from '@/lib/supabase.client'
import { useNavBadges }              from '@/lib/hooks/useNavBadges'
import { LayoutProvider, useLayout } from '@/lib/hooks/useLayout'
import { workspaceFlipOffset } from '@/lib/hooks/layout-state'
import { useV3RouteReveal } from '@/lib/ui/use-v3-route-reveal'
import { CurrencyProvider }         from '@/lib/hooks/useDashboard'
import { StaticSidebar, MobileModulesWorkbench, TabletNavigation } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'
import { ProductUpdatesBanner }    from './ProductUpdatesBanner'
import { ReleaseAnnouncementGate } from './ReleaseAnnouncementGate'
import { Topbar }                   from './Topbar'
import { QuickActionsFAB }          from './QuickActionsFAB'
import { NavBadgesErrorNotice }     from './NavBadgesErrorNotice'
import transactionStyles from '@/components/tables/TransactionsRound07.module.css'

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
  initialRateSnapshot?: { rate: number; fetched_at: string; source: string } | null
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
  const workspaceRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const routeContentRef = useRef<HTMLDivElement>(null)
  const previousModeRef = useRef<string | null>(null)
  const shellMotionSourceRef = useRef<'pointer' | 'keyboard' | null>(null)
  const workspaceAnimationRef = useRef<Animation | null>(null)
  const shellMotionTimerRef = useRef<number | null>(null)
  const [shellMotionActive, setShellMotionActive] = useState(false)
  const [mobileNavMotionSource, setMobileNavMotionSource] = useState<'pointer' | 'keyboard'>('keyboard')
  const routeAnnouncement = useV3RouteReveal(pathname, routeContentRef, mainRef)

  const {
    sidebarMode,
    isTablet,
    tabletNavigationOpen,
    openTabletNavigation,
    closeTabletNavigation,
    toggleUserCollapse,
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

  useEffect(() => {
    closeMobileDrawer()
    closeTabletNavigation()
  }, [pathname, closeMobileDrawer, closeTabletNavigation])

  const toggleNavigation = useCallback((source: 'pointer' | 'keyboard') => {
    if (isTablet) {
      openTabletNavigation()
    } else {
      shellMotionSourceRef.current = source
      if (shellMotionTimerRef.current !== null) window.clearTimeout(shellMotionTimerRef.current)
      const allowMotion = source === 'pointer' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setShellMotionActive(allowMotion)
      if (allowMotion) shellMotionTimerRef.current = window.setTimeout(() => {
        shellMotionTimerRef.current = null
        setShellMotionActive(false)
      }, 260)
      toggleUserCollapse()
    }
  }, [isTablet, openTabletNavigation, toggleUserCollapse])

  useLayoutEffect(() => {
    const previousMode = previousModeRef.current
    previousModeRef.current = sidebarMode
    const source = shellMotionSourceRef.current
    shellMotionSourceRef.current = null
    const workspace = workspaceRef.current
    if (!workspace || !previousMode || previousMode === sidebarMode) return

    const computedTransform = getComputedStyle(workspace).transform
    const currentTranslation = computedTransform === 'none'
      ? 0
      : new DOMMatrixReadOnly(computedTransform).m41
    workspaceAnimationRef.current?.cancel()
    workspaceAnimationRef.current = null

    if (source !== 'pointer' || window.innerWidth < 1200 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const previousWidth = previousMode === 'expanded' ? 208 : 72
    const nextWidth = sidebarMode === 'expanded' ? 208 : 72
    const fromX = workspaceFlipOffset(previousWidth, nextWidth, currentTranslation)
    const animation = workspace.animate(
      [{ transform: `translateX(${fromX}px)` }, { transform: 'translateX(0)' }],
      { duration: 240, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both' },
    )
    workspaceAnimationRef.current = animation
    animation.onfinish = () => {
      if (workspaceAnimationRef.current !== animation) return
      animation.cancel()
      workspaceAnimationRef.current = null
    }
  }, [sidebarMode])

  useLayoutEffect(() => () => {
    workspaceAnimationRef.current?.cancel()
    if (shellMotionTimerRef.current !== null) window.clearTimeout(shellMotionTimerRef.current)
  }, [])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const settle = () => {
      if (!preference.matches && window.innerWidth >= 1200) return
      workspaceAnimationRef.current?.cancel()
      workspaceAnimationRef.current = null
      if (shellMotionTimerRef.current !== null) window.clearTimeout(shellMotionTimerRef.current)
      shellMotionTimerRef.current = null
      setShellMotionActive(false)
    }
    preference.addEventListener('change', settle)
    window.addEventListener('resize', settle, { passive: true })
    return () => {
      preference.removeEventListener('change', settle)
      window.removeEventListener('resize', settle)
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [supabase, router])

  return (
    // h-dvh + overflow-hidden en el shell evita que el sidebar haga scroll
    // Solo el <main> scrollea internamente
    <div
      data-ft-v3-shell=""
      className="fin-shell flex h-dvh overflow-hidden bg-[var(--ft-canvas)] text-[var(--ft-text-strong)]"
    >
      <ReleaseAnnouncementGate />

      {/* Sidebar estático — tablet y desktop */}
      <StaticSidebar
        mode={sidebarMode}
        animate={shellMotionActive}
        user={user}
        badges={resolvedNavBadges}
      />

      {/* Drawer — mobile */}
      <MobileModulesWorkbench
        open={mobileDrawerOpen}
        onClose={closeMobileDrawer}
        user={user}
        badges={resolvedNavBadges}
        motionSource={mobileNavMotionSource}
      />

      <TabletNavigation
        open={tabletNavigationOpen}
        onClose={closeTabletNavigation}
        user={user}
        badges={resolvedNavBadges}
      />

      {/* Área principal — columna derecha, scroll independiente */}
      <div ref={workspaceRef} className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar fija en la parte superior de la columna derecha */}
        <Topbar
          user={user}
          navBadges={resolvedNavBadges}
          onNavigationToggle={toggleNavigation}
          navigationExpanded={isTablet ? tabletNavigationOpen : sidebarMode === 'expanded'}
          onSignOut={handleSignOut}
        />

        {/* Scroll container del contenido — solo esta área scrollea */}
        <main ref={mainRef} id="main-content" className="relative flex-1 overflow-x-hidden overflow-y-auto bg-[var(--ft-canvas)]">
          <div
            key={pathname}
            ref={routeContentRef}
            className={`ft-shell-content w-full ${pathname === '/dashboard' ? 'ft-shell-content-dashboard' : ''} ${pathname === '/transactions' || pathname === '/portfolio' || pathname === '/budgets' || pathname === '/credits' || pathname.startsWith('/credits/') ? transactionStyles.v3ModuleContent : ''}`}
            data-ft-v3={pathname === '/portfolio' || pathname === '/credits' || pathname.startsWith('/credits/') ? '' : undefined}
            style={{ paddingBottom: 'max(6rem, calc(var(--fab-safe-area, 0px) + 1.5rem))' }}
          >
            <ProductUpdatesBanner />
            {navBadgesError ? (
              <NavBadgesErrorNotice isRetrying={navBadgesValidating} onRetry={retryNavBadges} />
            ) : null}
            {children}
          </div>

        </main>
      </div>
      <MobileBottomNav
        moreOpen={mobileDrawerOpen}
        onMore={source => { setMobileNavMotionSource(source); openMobileDrawer() }}
      />
      <QuickActionsFAB />
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{routeAnnouncement ? `${routeAnnouncement} abierto` : ''}</p>
    </div>
  )
}


// ─── SHELL PRINCIPAL (con providers) ─────────────────────────────────────────

export function AppShell({ user, exchangeRate, initialRateSnapshot, navBadges, children }: AppShellProps) {
  return (
    <LayoutProvider>
      <CurrencyProvider initialRate={exchangeRate} initialRateSnapshot={initialRateSnapshot}>
        <InnerShell user={user} navBadges={navBadges}>
          {children}
        </InnerShell>
      </CurrencyProvider>
    </LayoutProvider>
  )
}
