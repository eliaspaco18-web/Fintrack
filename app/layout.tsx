// =============================================================================
// app/layout.tsx — Root layout con Providers globales
// =============================================================================

import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Providers } from './providers'
import './globals.css'

// Next serves these local files under /_next/static, which is already exempt
// from the auth middleware. The variable alone does not restyle legacy routes.
const fintrackV3Font = localFont({
  src: [
    { path: '../public/fonts/v3/manrope-regular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/v3/manrope-semibold.ttf', weight: '600', style: 'normal' },
    { path: '../public/fonts/v3/manrope-bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-fintrack-v3',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: {
    template: '%s — FinTrack',
    default: 'FinTrack · Plataforma financiera',
  },
  description: 'Plataforma financiera para gestionar ingresos, egresos, créditos, activos y alertas.',
  icons: {
    icon: '/brand/fintrack-tab-icon.png',
    shortcut: '/brand/fintrack-tab-icon.png',
    apple: '/brand/fintrack-mark.png',
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#070b10',
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
}

const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const key = 'fintrack.theme.v1'
    const saved = localStorage.getItem(key)
    const theme =
      saved === 'light' || saved === 'dark'
        ? saved
        : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
  } catch {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.style.colorScheme = 'light'
  }
})()
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
    >
      <body className={`font-body antialiased ${fintrackV3Font.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
