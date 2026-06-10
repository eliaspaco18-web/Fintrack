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
    <main className="min-h-dvh bg-[var(--c-bg)] px-6 py-10 text-[var(--c-text)]">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-[640px] flex-col items-start justify-center gap-6">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--c-text-faint)]">
            FinTrack
          </p>
          <h1 className="text-balance text-[32px] font-semibold leading-tight tracking-[-0.03em] text-[var(--c-text)]">
            Algo salió mal al cargar esta vista.
          </h1>
          <p className="max-w-[60ch] text-pretty text-[15px] leading-6 text-[var(--c-text-muted)]">
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
          <p className="font-mono text-[12px] text-[var(--c-text-faint)]">
            Ref: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  )
}
