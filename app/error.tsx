'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error boundary caught:', error)
  }, [error])

  return (
    <main className="min-h-dvh bg-[var(--ft-canvas)] px-4 py-8 text-[var(--ft-text-strong)] sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[640px] flex-col items-start justify-center gap-6 sm:min-h-[calc(100dvh-5rem)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-surface border border-[color-mix(in_srgb,var(--ft-danger)_20%,var(--ft-border))] bg-[var(--ft-danger-soft)] text-[var(--ft-danger)]">
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
        </div>

        <div className="space-y-3">
          <p className="text-[12px] font-semibold tracking-[0.02em] text-[var(--ft-text-subtle)]">
            FinTrack
          </p>
          <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[var(--ft-text-strong)] sm:text-[32px]">
            Algo salió mal al cargar esta vista.
          </h1>
          <p className="max-w-[60ch] text-pretty text-[15px] leading-6 text-[var(--ft-text-muted)]">
            Puedes intentar recargar esta sección. Si el problema continúa, vuelve al dashboard y repite la acción.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" size="lg" onClick={reset}>
            Reintentar
          </Button>
          <Button href="/dashboard" variant="secondary" size="lg">
            Ir al dashboard
          </Button>
        </div>

        {error.digest ? (
          <p className="font-mono text-[12px] text-[var(--ft-text-subtle)]">
            Ref: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  )
}
