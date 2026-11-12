'use client'

interface NavBadgesErrorNoticeProps {
  isRetrying: boolean
  onRetry: () => void
}

export function NavBadgesErrorNotice({ isRetrying, onRetry }: NavBadgesErrorNoticeProps) {
  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex flex-col gap-2 rounded-lg border border-[var(--ft-warning-soft)] bg-[var(--ft-warning-soft)] px-3 py-2 text-xs text-[var(--ft-warning)] sm:flex-row sm:items-center sm:justify-between md:mx-6 xl:mx-8"
      aria-busy={isRetrying}
    >
      <span>No se pudieron verificar los indicadores de navegación.</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="min-h-8 self-start rounded-md border border-current px-2.5 font-semibold transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
        aria-label="Reintentar verificación de indicadores de navegación"
      >
        {isRetrying ? 'Verificando…' : 'Reintentar'}
      </button>
    </div>
  )
}
