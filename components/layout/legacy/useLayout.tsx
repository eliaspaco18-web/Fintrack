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
  createContext,
  useContext,
}                    from 'react'

// ─── BREAKPOINTS ──────────────────────────────────────────────────────────────

const BREAKPOINT_MD = 768   // tablet
const BREAKPOINT_LG = 1024  // desktop

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export type SidebarMode =
  | 'expanded'   // 240px — desktop, sidebar completo con labels
  | 'collapsed'  // 56px  — tablet, solo iconos + tooltip
  | 'hidden'     // 0px   — mobile, se muestra como drawer overlay

export interface LayoutContextValue {
  /** Modo actual del sidebar según viewport + preferencia */
  sidebarMode:       SidebarMode
  /** Solo móvil: controla si el drawer está abierto */
  mobileDrawerOpen:  boolean
  /** El usuario puede colapsar/expandir manualmente en desktop */
  userCollapsed:     boolean
  openMobileDrawer:  () => void
  closeMobileDrawer: () => void
  toggleUserCollapse: () => void
  /** True si el viewport es mobile (<768px) */
  isMobile:          boolean
  /** True si el viewport es tablet (768-1023px) */
  isTablet:          boolean
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

const LayoutContext = createContext<LayoutContextValue>({
  sidebarMode:        'expanded',
  mobileDrawerOpen:   false,
  userCollapsed:      false,
  openMobileDrawer:   () => {},
  closeMobileDrawer:  () => {},
  toggleUserCollapse: () => {},
  isMobile:           false,
  isTablet:           false,
})

// ─── PROVIDER ─────────────────────────────────────────────────────────────────

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [viewportWidth,    setViewportWidth]    = useState(0)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [userCollapsed,    setUserCollapsed]    = useState(false)

  // Leer preferencia de localStorage al montar
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setUserCollapsed(true)
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
    if (viewportWidth >= BREAKPOINT_MD && mobileDrawerOpen) {
      setMobileDrawerOpen(false)
    }
  }, [viewportWidth, mobileDrawerOpen])

  const isMobile = viewportWidth > 0 && viewportWidth < BREAKPOINT_MD
  const isTablet = viewportWidth >= BREAKPOINT_MD && viewportWidth < BREAKPOINT_LG

  const sidebarMode: SidebarMode = (() => {
    if (isMobile)                        return 'hidden'
    if (isTablet || userCollapsed)       return 'collapsed'
    return 'expanded'
  })()

  const openMobileDrawer  = useCallback(() => setMobileDrawerOpen(true), [])
  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), [])

  const toggleUserCollapse = useCallback(() => {
    setUserCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }, [])

  return (
    <LayoutContext.Provider value={{
      sidebarMode,
      mobileDrawerOpen,
      userCollapsed,
      openMobileDrawer,
      closeMobileDrawer,
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
