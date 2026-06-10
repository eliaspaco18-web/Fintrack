'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AppTheme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'fintrack.theme.v1'

interface ThemeContextValue {
  theme: AppTheme
  mounted: boolean
  setTheme: (theme: AppTheme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  mounted: false,
  setTheme: () => {},
  toggleTheme: () => {},
})

function getStoredTheme(): AppTheme | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

function getSystemTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light'
  return 'light'
}

function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'light'
    return getStoredTheme() ?? getSystemTheme()
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const initial = getStoredTheme() ?? getSystemTheme()
    setThemeState(initial)
    applyTheme(initial)
    setMounted(true)
  }, [])

  useEffect(() => {
    applyTheme(theme)
    if (!mounted || typeof window === 'undefined') return
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [mounted, theme])

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({
      theme,
      mounted,
      setTheme,
      toggleTheme,
    }),
    [mounted, setTheme, theme, toggleTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
