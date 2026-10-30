// =============================================================================
// lib/hooks/useLayout.tsx
// Estado del layout: sidebar abierto/cerrado, modo colapsado, detección mobile.
// Persiste preferencia de sidebar en localStorage.
// =============================================================================

'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
}                    from 'react'
import {
  LAYOUT_MOBILE_MAX,
  LAYOUT_TABLET_MAX,
  readSidebarPreference,
  resolveSidebarMode,
  writeSidebarPreference,
  type SidebarMode,
} from './layout-state'

// ─── BREAKPOINTS ──────────────────────────────────────────────────────────────

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export type { SidebarMode } from './layout-state'

export interface LayoutContextValue {
  /** Modo actual del sidebar según viewport + preferencia */
  sidebarMode:       SidebarMode
  /** Solo móvil: controla si el drawer está abierto */
  mobileDrawerOpen:  boolean
  /** Temporary labeled tablet navigation; never persisted. */
  tabletNavigationOpen: boolean
  /** El usuario puede colapsar/expandir manualmente en desktop */
  userCollapsed:     boolean
  openMobileDrawer:  () => void
  closeMobileDrawer: () => void
  openTabletNavigation: () => void
  closeTabletNavigation: () => void
  toggleUserCollapse: () => void
  /** True si el viewport es mobile (<768px) */
  isMobile:          boolean
  /** True si el viewport es tablet (768-1199px) */
  isTablet:          boolean
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

const LayoutContext = createContext<LayoutContextValue>({
  sidebarMode:        'expanded',
  mobileDrawerOpen:   false,
  tabletNavigationOpen: false,
  userCollapsed:      false,
  openMobileDrawer:   () => {},
  closeMobileDrawer:  () => {},
  openTabletNavigation: () => {},
  closeTabletNavigation: () => {},
  toggleUserCollapse: () => {},
  isMobile:           false,
  isTablet:           false,
})

// ─── PROVIDER ─────────────────────────────────────────────────────────────────

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [viewportWidth,    setViewportWidth]    = useState(0)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [tabletNavigationOpen, setTabletNavigationOpen] = useState(false)
  const [userCollapsed,    setUserCollapsed]    = useState(false)
  const userCollapsedRef = useRef(false)

  // Leer preferencia de localStorage al montar
  useEffect(() => {
    let stored = false
    try { stored = readSidebarPreference(window.localStorage) } catch { /* storage getter denied */ }
    userCollapsedRef.current = stored
    setUserCollapsed(stored)
    setViewportWidth(window.innerWidth)
  }, [])

  // Listener de resize con debounce implícito via requestAnimationFrame
  useEffect(() => {
    let raf: number
    const handler = () => {
      raf = requestAnimationFrame(() => {
        setViewportWidth(window.innerWidth)
      })
    }
    window.addEventListener('resize', handler, { passive: true })
    return () => {
      window.removeEventListener('resize', handler)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Cerrar drawer móvil al crecer el viewport
  useEffect(() => {
    if (viewportWidth > LAYOUT_MOBILE_MAX && mobileDrawerOpen) {
      setMobileDrawerOpen(false)
    }
  }, [viewportWidth, mobileDrawerOpen])

  useEffect(() => {
    if ((viewportWidth <= LAYOUT_MOBILE_MAX || viewportWidth > LAYOUT_TABLET_MAX) && tabletNavigationOpen) {
      setTabletNavigationOpen(false)
    }
  }, [viewportWidth, tabletNavigationOpen])

  const isMobile = viewportWidth > 0 && viewportWidth <= LAYOUT_MOBILE_MAX
  const isTablet = viewportWidth > LAYOUT_MOBILE_MAX && viewportWidth <= LAYOUT_TABLET_MAX

  const sidebarMode: SidebarMode = resolveSidebarMode(viewportWidth, userCollapsed)

  const openMobileDrawer  = useCallback(() => { if (window.innerWidth <= LAYOUT_MOBILE_MAX) setMobileDrawerOpen(true) }, [])
  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), [])
  const openTabletNavigation = useCallback(() => {
    if (window.innerWidth > LAYOUT_MOBILE_MAX && window.innerWidth <= LAYOUT_TABLET_MAX) {
      setTabletNavigationOpen(true)
    }
  }, [])
  const closeTabletNavigation = useCallback(() => setTabletNavigationOpen(false), [])

  const toggleUserCollapse = useCallback(() => {
    const next = !userCollapsedRef.current
    userCollapsedRef.current = next
    setUserCollapsed(next)
    try { writeSidebarPreference(window.localStorage, next) } catch { /* storage getter denied */ }
  }, [])

  return (
    <LayoutContext.Provider value={{
      sidebarMode,
      mobileDrawerOpen,
      tabletNavigationOpen,
      userCollapsed,
      openMobileDrawer,
      closeMobileDrawer,
      openTabletNavigation,
      closeTabletNavigation,
      toggleUserCollapse,
      isMobile,
      isTablet,
    }}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout(): LayoutContextValue {
  return useContext(LayoutContext)
}
