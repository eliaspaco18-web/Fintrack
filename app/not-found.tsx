// app/not-found.tsx
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--ft-canvas)] px-4 py-8 text-center text-[var(--ft-text-strong)] sm:px-6">
      <div className="flex max-w-[520px] flex-col items-center">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-surface border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-[var(--ft-text-subtle)]">
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
            <path d="M9.5 9a2.5 2.5 0 0 1 4.87.8c0 1.7-2.37 2-2.37 3.7" />
            <path d="M12 17h.01" />
          </svg>
        </div>
        <p className="mb-2 text-[12px] font-semibold tracking-[0.02em] text-[var(--ft-text-subtle)]">Error 404</p>
        <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]">
          Página no encontrada
        </h1>
        <p className="mb-7 mt-3 max-w-[48ch] text-pretty text-[15px] leading-6 text-[var(--ft-text-muted)]">
          La URL que buscas no existe o fue eliminada.
        </p>
        <Button href="/dashboard" variant="primary" size="lg">
          Ir al dashboard
        </Button>
      </div>
    </main>
  )
}
