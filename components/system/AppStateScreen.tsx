import Link from 'next/link'
import type { CSSProperties } from 'react'

const PRIMARY_LINK_CLASS = [
  'inline-flex items-center justify-center whitespace-nowrap rounded-[16px] border border-transparent',
  'bg-[var(--c-primary)] px-[1.125rem] text-sm font-medium tracking-[-0.01em] text-[var(--c-text-on-primary)]',
  'shadow-[0_1px_2px_rgba(13,107,94,0.18)] transition-[background-color,border-color,color,box-shadow,transform]',
  'duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--c-primary-hover)] hover:shadow-[0_6px_16px_rgba(13,107,94,0.14)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-primary-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)]',
  'h-10 gap-2',
].join(' ')

const SECONDARY_LINK_CLASS = [
  'inline-flex items-center justify-center whitespace-nowrap rounded-[16px] border border-[var(--c-border)]',
  'bg-[var(--c-surface)] px-[1.125rem] text-sm font-medium tracking-[-0.01em] text-[var(--c-text)]',
  'shadow-[0_1px_2px_rgba(25,25,23,0.04)] transition-[background-color,border-color,color,box-shadow,transform]',
  'duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface-2)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-primary-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)]',
  'h-10 gap-2',
].join(' ')

export function AppStateScreen({
  eyebrow,
  title,
  message,
  tone = 'maintenance',
  scope = 'global',
  primaryHref = '/dashboard',
  primaryLabel = 'Volver al inicio',
  secondaryHref,
  secondaryLabel,
  featureItems,
}: {
  eyebrow: string
  title: string
  message: string
  tone?: 'maintenance' | 'coming-soon' | 'launch'
  scope?: 'global' | 'module'
  primaryHref?: string
  primaryLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
  featureItems?: string[]
}) {
  const isEmbedded = scope === 'module'
  const isComingSoon = tone === 'coming-soon'
  const isLaunch = tone === 'launch'
  const helperMessage = isComingSoon
    ? 'Estamos preparando este espacio con cuidado. Cuando esté listo, aparecerá aquí como una nueva forma de trabajar en FinTrack.'
    : isLaunch
      ? 'Esta novedad ya está lista para que la explores. Entra, pruébala y empieza a usarla dentro de tu flujo financiero.'
    : isEmbedded
      ? 'Mientras terminamos esta parte, puedes seguir moviéndote por las demás secciones disponibles.'
      : 'Gracias por la paciencia. Estamos dejando todo listo para que vuelvas a entrar con una experiencia más clara y estable.'
  const assuranceItems = isLaunch
    ? ['Disponible desde ahora', 'Novedad lista para usar']
    : isComingSoon
    ? ['Nuevo espacio en preparación', 'Te espera una mejora útil']
    : isEmbedded
      ? ['Tu información sigue segura', 'El resto de FinTrack sigue disponible']
      : ['Tus datos siguen protegidos', 'No necesitas hacer nada']
  const palette = tone === 'maintenance'
    ? {
        shell: 'from-[rgba(245,158,11,0.3)] via-[rgba(20,184,166,0.18)] to-[rgba(15,118,110,0.18)]',
        badge: 'border-[rgba(180,83,9,0.18)] bg-[rgba(255,237,213,0.8)] text-[rgb(146,72,16)]',
        accent: 'rgb(245,158,11)',
        accentSoft: 'rgba(245,158,11,0.14)',
      }
    : {
        shell: 'from-[rgba(20,184,166,0.24)] via-[rgba(59,130,246,0.14)] to-[rgba(13,107,94,0.12)]',
        badge: 'border-[rgba(13,107,94,0.14)] bg-[rgba(204,251,241,0.7)] text-[var(--c-primary)]',
        accent: 'rgb(13,107,94)',
        accentSoft: 'rgba(13,107,94,0.12)',
      }

  return (
    <main
      className={[
        'state-screen relative overflow-hidden',
        isEmbedded ? 'state-screen--embedded min-h-[calc(100vh-9rem)] rounded-[28px]' : 'min-h-screen',
      ].join(' ')}
    >
      <div className="state-screen__grid" aria-hidden />
      <div className="state-screen__beam" aria-hidden />

      <div className={isEmbedded
        ? 'relative mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-[1180px] items-center px-1 py-6 sm:px-3'
        : 'relative mx-auto flex min-h-screen w-full max-w-[1180px] items-center px-5 py-10 sm:px-6 lg:px-8'}
      >
        <section className="state-screen__panel w-full overflow-hidden">
          <div className={`h-1.5 w-full bg-gradient-to-r ${palette.shell}`} />
          <div className="grid gap-8 px-6 py-7 lg:grid-cols-[0.96fr,1.04fr] lg:px-9 lg:py-9">
            <div className="state-screen__copy">
              <span className={`state-screen__badge inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase ${palette.badge}`}>
                {eyebrow}
              </span>
              <h1 className="mt-5 max-w-[15ch] text-[34px] font-semibold leading-[1.05] text-[var(--c-text)] md:text-[46px]">
                {title}
              </h1>
              <p className="mt-4 max-w-[58ch] text-[15px] leading-7 text-[var(--c-text-muted)]">
                {message}
              </p>
              <p className="mt-3 max-w-[58ch] text-[13px] leading-6 text-[var(--c-text-muted)]">
                {helperMessage}
              </p>
              <div className="state-screen__assurance" aria-label="Información importante">
                {assuranceItems.map(item => (
                  <span key={item}>
                    <span aria-hidden />
                    {item}
                  </span>
                ))}
              </div>
              {featureItems?.length ? (
                <div className="state-screen__features" aria-label="Qué puedes hacer">
                  <p>Qué puedes hacer aquí</p>
                  <ul>
                    {featureItems.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={primaryHref} className={PRIMARY_LINK_CLASS}>
                  <span>{primaryLabel}</span>
                </Link>
                {secondaryHref && secondaryLabel ? (
                  <Link href={secondaryHref} className={SECONDARY_LINK_CLASS}>
                    <span>{secondaryLabel}</span>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="state-screen__visual self-center" style={{ '--state-accent': palette.accent, '--state-accent-soft': palette.accentSoft } as CSSProperties}>
              <ConstructionVisual tone={tone} />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function ConstructionVisual({ tone }: { tone: 'maintenance' | 'coming-soon' | 'launch' }) {
  const isComingSoon = tone === 'coming-soon'
  const isLaunch = tone === 'launch'
  const stageLabel = isLaunch ? 'Lanzamiento activo' : isComingSoon ? 'Preparando estreno' : 'Mejorando experiencia'

  return (
    <div className="state-build" data-tone={tone} aria-hidden>
      <div className="state-build__header">
        <span />
        <span />
        <span />
        <strong>{stageLabel}</strong>
      </div>
      <div className="state-build__stage">
        <div className="state-build__brandmark">F</div>
        <div className="state-build__scanner" />
        <div className="state-build__crane">
          <div className="state-build__crane-mast" />
          <div className="state-build__crane-arm" />
          <div className="state-build__crane-counterweight" />
          <div className="state-build__crane-cable" />
          <div className="state-build__crane-hook" />
          <div className="state-build__crane-load" />
        </div>
        <div className="state-build__foundation state-build__foundation--one" />
        <div className="state-build__foundation state-build__foundation--two" />
        <div className="state-build__spark state-build__spark--one" />
        <div className="state-build__spark state-build__spark--two" />
        <div className="state-build__burst state-build__burst--one" />
        <div className="state-build__burst state-build__burst--two" />
        <div className="state-build__burst state-build__burst--three" />
        <div className="state-build__launch-card">
          <strong>NEW</strong>
          <span>Disponible</span>
        </div>
        <div className="state-build__rail state-build__rail--top" />
        <div className="state-build__rail state-build__rail--middle" />
        <div className="state-build__rail state-build__rail--bottom" />
        <div className="state-build__rail state-build__rail--diagonal" />
        <div className="state-build__signal" />
        <div className="state-build__node state-build__node--one" />
        <div className="state-build__node state-build__node--two" />
        <div className="state-build__node state-build__node--three" />
        <div className="state-build__block state-build__block--one" />
        <div className="state-build__block state-build__block--two" />
        <div className="state-build__block state-build__block--three" />
        <div className="state-build__tile state-build__tile--one" />
        <div className="state-build__tile state-build__tile--two" />
        <div className="state-build__card">
          <div />
          <div />
          <div />
        </div>
        <div className="state-build__log">
          <span>{isLaunch ? 'Estrenado' : isComingSoon ? 'Diseñando' : 'Revisando'}</span>
          <span>{isLaunch ? 'Explorable' : isComingSoon ? 'Conectando' : 'Ordenando'}</span>
          <span>{isLaunch ? 'Listo para usar' : isComingSoon ? 'Casi listo' : 'Probando'}</span>
        </div>
        <div className="state-build__progress">
          <span />
        </div>
        <div className="state-build__tag">
          {isLaunch ? 'Nuevo en la app' : isComingSoon ? 'Nuevo espacio' : 'Afinando detalles'}
        </div>
      </div>
    </div>
  )
}
