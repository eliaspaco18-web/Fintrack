'use client'

import { useEffect } from 'react'
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error)
  }, [error])

  return (
    <html lang="es">
      <body className="bg-[var(--c-bg)] font-body antialiased text-[var(--c-text)]">
        <main className="min-h-dvh px-6 py-10">
          <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-[640px] flex-col items-start justify-center gap-6">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--c-text-faint)]">
                FinTrack
              </p>
              <h1 className="text-balance text-[32px] font-semibold leading-tight tracking-[-0.03em] text-[var(--c-text)]">
                Ocurrió un error inesperado en la aplicación.
              </h1>
              <p className="max-w-[60ch] text-pretty text-[15px] leading-6 text-[var(--c-text-muted)]">
                La interfaz no pudo renderizarse correctamente. Intenta recargar la aplicación completa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="ui-pressable inline-flex h-10 items-center justify-center rounded-[var(--ft-radius-control)] border border-transparent bg-[var(--c-primary)] px-[1.125rem] text-sm font-medium tracking-[-0.01em] text-[var(--c-text-on-primary)] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--c-primary-hover)]"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/dashboard')}
                className="ui-pressable inline-flex h-10 items-center justify-center rounded-[var(--ft-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-[1.125rem] text-sm font-medium tracking-[-0.01em] text-[var(--c-text)] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface-2)]"
              >
                Ir al dashboard
              </button>
            </div>

            {error.digest ? (
              <p className="font-mono text-[12px] text-[var(--c-text-faint)]">
                Ref: {error.digest}
              </p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  )
}
