export function DeveloperEnvironmentBanner() {
  return (
    <section className="developer-mode-strip" aria-label="Entorno de administrador local">
      <div className="developer-mode-strip__rail" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="developer-mode-strip__content">
        <div className="flex min-w-0 items-center gap-2">
          <span className="developer-mode-strip__mark" aria-hidden>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4.5 6.5v5.7c0 4.2 3.1 7.2 7.5 8.8 4.4-1.6 7.5-4.6 7.5-8.8V6.5L12 3Z" />
              <path d="M9.5 12.3 11.2 14l3.6-4" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(146,72,16)]">
              Modo administrador
            </p>
            <p className="truncate text-[12px] font-medium text-[var(--c-text-muted)]">
              Entorno local delicado
            </p>
          </div>
        </div>
        <div className="developer-mode-strip__chips">
          <span data-tone="amber">Local</span>
          <span data-tone="red">No producción</span>
          <span data-tone="teal">Assets del sistema</span>
        </div>
      </div>
    </section>
  )
}
