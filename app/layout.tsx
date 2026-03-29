// =============================================================================
// app/layout.tsx — Root layout con Providers globales
// =============================================================================

import type { Metadata, Viewport } from 'next'
import { Providers }               from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s — FinTrack',
    default:  'FinTrack · Finanzas inteligentes',
  },
  description: 'Plataforma de finanzas inteligentes: ingresos, egresos, créditos y activos.',
  icons: {
    icon: '/brand/fintrack-mark.svg',
    shortcut: '/brand/fintrack-mark.svg',
  },
  robots:      { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor:    '#070b10',
  colorScheme:   'dark light',
  width:         'device-width',
  initialScale:  1,
}

const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const key = 'fintrack.theme.v1'
    const saved = localStorage.getItem(key)
    const theme =
      saved === 'light' || saved === 'dark'
        ? saved
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.style.colorScheme = 'dark'
  }
})()
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
    >
      <body className="font-body antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}/>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
