'use client'

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import { BrandMark, BrandWordmark } from '@/components/layout/Brand'

type NavLink = {
  href: string
  label: string
}

type LandingMetric = {
  value: number
  suffix: string
  label: string
  detail: string
}

type ProductCard = {
  eyebrow: string
  title: string
  description: string
  points: [string, string]
  tone: 'primary' | 'sage' | 'ink'
  icon: ({ className }: { className?: string }) => JSX.Element
}

type WorkflowCard = {
  step: string
  title: string
  description: string
}

type SecurityItem = {
  title: string
  description: string
}

function IconArrowUpRight({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 17 17 7M9 7h8v8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconGrid({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.75 4.75h6.5v6.5h-6.5zm8.5 0h6v4.75h-6zm0 6.75h6v7.75h-6zm-8.5 1.75h6.5v6h-6.5z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconFlow({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h7m0 0-2.5-2.5M11 7 8.5 9.5M20 17h-7m0 0 2.5-2.5M13 17l2.5 2.5M7 7v10a2 2 0 0 0 2 2h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconVault({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5zm4 0h6m-3 4.5a2.5 2.5 0 1 1 0 5m0-5v-1m0 6v-1"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconPulse({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12h3.5l2-4 4.25 8 2.25-4H20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconBell({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 9a6 6 0 1 0-12 0c0 5.25-2.25 7-2.25 7h16.5S18 14.25 18 9Zm-7.25 10a1.75 1.75 0 0 0 3.5 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconShield({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.75 5.75 6.5v5.2c0 4.45 2.85 7.95 6.25 8.55 3.4-.6 6.25-4.1 6.25-8.55V6.5Zm-2.4 7.6 1.7 1.7 3.15-3.15"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconClock({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5.25v6l4 2.25M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCheck({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12.5 4.2 4.2L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTrend({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16.5 9 11.5l3.5 3.5L20 7.5M14.5 7.5H20V13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function useCountUp(end: number, shouldStart: boolean, duration = 1400) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!shouldStart) return

    let frameId = 0
    let startedAt: number | null = null

    const tick = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp

      const progress = Math.min((timestamp - startedAt) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(end * eased))

      if (progress < 1) frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => window.cancelAnimationFrame(frameId)
  }, [duration, end, shouldStart])

  return value
}

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

const NAV_LINKS: NavLink[] = [
  { href: '#producto', label: 'Producto' },
  { href: '#modulos', label: 'Módulos' },
  { href: '#control', label: 'Control' },
  { href: '#seguridad', label: 'Seguridad' },
]

const HERO_KPIS = [
  { label: 'Caja disponible', value: 'S/ 248.4k', note: '+5.8% vs. mes anterior' },
  { label: 'Compromisos próximos', value: '07', note: '3 requieren atención esta semana' },
  { label: 'Presupuesto operativo', value: '73%', note: 'En rango sobre el plan mensual' },
]

const HERO_QUEUE = [
  { title: 'Cobros pendientes', value: 'S/ 42.8k', tone: 'primary' },
  { title: 'Alertas críticas', value: '03', tone: 'danger' },
  { title: 'Créditos activos', value: '12', tone: 'neutral' },
]

const HERO_LEDGER = [
  { name: 'Transferencia recibida', meta: 'Cliente corporativo', amount: '+ S/ 12,480', tone: 'positive' },
  { name: 'Cuota BCP', meta: 'Vence en 3 días', amount: '- S/ 3,900', tone: 'warning' },
  { name: 'Pago proveedor', meta: 'Operaciones', amount: '- S/ 1,860', tone: 'neutral' },
]

const LANDING_METRICS: LandingMetric[] = [
  { value: 4, suffix: '', label: 'Patrones de trabajo', detail: 'Dashboard, registro, ledger y catálogo unificados' },
  { value: 8, suffix: '+', label: 'Módulos conectados', detail: 'Desde portafolio y movimientos hasta alertas y settings' },
  { value: 120, suffix: 'ms', label: 'Feedback visual', detail: 'Microinteracciones sobrias con tiempos de respuesta cortos' },
  { value: 1, suffix: '', label: 'Fuente de verdad', detail: 'Una sola vista para operar, revisar y decidir' },
]

const PRODUCT_CARDS: ProductCard[] = [
  {
    eyebrow: 'Centro financiero',
    title: 'Dashboard ejecutivo',
    description:
      'Liquidez, flujo pendiente y exposición operativa en una sola superficie, sin widgets compitiendo entre sí.',
    points: ['KPIs claros y comparables', 'Panel de riesgo con prioridades reales'],
    tone: 'primary',
    icon: IconTrend,
  },
  {
    eyebrow: 'Registro oficial',
    title: 'Movimientos y ledger',
    description:
      'La tabla más madura del producto se convierte en el estándar para búsqueda, filtros, vistas guardadas y seguimiento.',
    points: ['Densidad profesional', 'Operación rápida sin fricción visual'],
    tone: 'ink',
    icon: IconFlow,
  },
  {
    eyebrow: 'Capital y líneas',
    title: 'Portafolio, créditos y presupuestos',
    description:
      'Cuentas, límites, cupos y ejecución presupuestal alineados bajo las mismas reglas visuales y de lectura.',
    points: ['Montos alineados con figures tabulares', 'Estados discretos, no decorativos'],
    tone: 'sage',
    icon: IconVault,
  },
  {
    eyebrow: 'Riesgo operativo',
    title: 'Alertas, recurrentes y vencimientos',
    description:
      'La plataforma deja de parecer una colección de CRUDs y pasa a comportarse como un inbox financiero accionable.',
    points: ['Prioridad explícita', 'Siguiente acción siempre visible'],
    tone: 'primary',
    icon: IconBell,
  },
]

const WORKFLOW: WorkflowCard[] = [
  {
    step: '01',
    title: 'Captura',
    description:
      'Ingresos, egresos, transferencias, activos y cuentas por cobrar entran al sistema con la misma estructura.',
  },
  {
    step: '02',
    title: 'Control',
    description:
      'Filtros, estados y vistas repetibles permiten revisar caja, créditos y riesgo sin cambiar de lógica mental.',
  },
  {
    step: '03',
    title: 'Decisión',
    description:
      'La lectura final es ejecutiva: métricas comparables, alertas accionables y reportes listos para compartir.',
  },
]

const SECURITY_ITEMS: SecurityItem[] = [
  {
    title: 'Acceso protegido',
    description: 'Autenticación segura y sesiones controladas para equipos que necesitan continuidad sin improvisación.',
  },
  {
    title: 'Operación trazable',
    description: 'Cada módulo comunica estados, próximos vencimientos y contexto suficiente para auditar decisiones.',
  },
  {
    title: 'Diseño orientado a foco',
    description: 'Menos ruido visual, menos sobresaturación y más jerarquía en las superficies que importan.',
  },
]

const TRUST_TICKERS = [
  'Multiportafolio y multimoneda',
  'Créditos, presupuestos y activos',
  'Alertas y vencimientos visibles',
  'Reportes listos para exportar',
]

export function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const metricsSection = useInView<HTMLDivElement>(0.3)

  const metric0 = useCountUp(LANDING_METRICS[0]?.value ?? 0, metricsSection.inView, 1050)
  const metric1 = useCountUp(LANDING_METRICS[1]?.value ?? 0, metricsSection.inView, 1210)
  const metric2 = useCountUp(LANDING_METRICS[2]?.value ?? 0, metricsSection.inView, 1370)
  const metric3 = useCountUp(LANDING_METRICS[3]?.value ?? 0, metricsSection.inView, 1530)
  const animatedMetrics = [metric0, metric1, metric2, metric3]

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('.fin-landing [data-reveal]')
    )

    if (!nodes.length) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const onResize = () => {
      if (window.innerWidth >= 960) setMobileMenuOpen(false)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mobileMenuOpen])

  const handleAnchorClick = (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return

    event.preventDefault()
    const target = document.querySelector(href)

    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setMobileMenuOpen(false)
    }
  }

  return (
    <div className="fin-landing">
      <div className="fin-landing-noise" aria-hidden />
      <div className="fin-landing-glow fin-landing-glow-a" aria-hidden />
      <div className="fin-landing-glow fin-landing-glow-b" aria-hidden />

      <nav className={`fin-landing-nav ${navScrolled ? 'is-scrolled' : ''}`} aria-label="Principal">
        <div className="fin-landing-shell">
          <div className="fin-landing-nav-frame">
            <Link href="/" className="fin-landing-brand" aria-label="FinTrack inicio">
              <BrandMark size={34} />
              <BrandWordmark
                titleClassName="fin-landing-brand-wordmark"
                subtitle="Financial workspace"
                subtitleClassName="fin-landing-brand-caption"
              />
            </Link>

            <div className="fin-landing-nav-links">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="fin-landing-nav-link"
                  onClick={(event) => handleAnchorClick(event, link.href)}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="fin-landing-nav-actions">
              <Link href="/login" className="fin-landing-link-button">
                Iniciar sesión
              </Link>
              <Link href="/login?mode=signup" className="fin-landing-button fin-landing-button-primary">
                <span>Crear cuenta</span>
                <span className="fin-landing-button-orb">
                  <IconArrowUpRight className="fin-landing-button-icon" />
                </span>
              </Link>
            </div>

            <button
              type="button"
              className={`fin-landing-menu-toggle ${mobileMenuOpen ? 'is-open' : ''}`}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          {mobileMenuOpen ? (
            <div className="fin-landing-mobile-menu">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="fin-landing-mobile-link"
                  onClick={(event) => handleAnchorClick(event, link.href)}
                >
                  {link.label}
                </a>
              ))}
              <div className="fin-landing-mobile-actions">
                <Link href="/login" className="fin-landing-link-button fin-landing-link-button-mobile">
                  Iniciar sesión
                </Link>
                <Link href="/login?mode=signup" className="fin-landing-button fin-landing-button-primary fin-landing-button-mobile">
                  <span>Crear cuenta</span>
                  <span className="fin-landing-button-orb">
                    <IconArrowUpRight className="fin-landing-button-icon" />
                  </span>
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </nav>

      <main>
        <section className="fin-landing-hero" id="producto">
          <div className="fin-landing-shell fin-landing-hero-grid">
            <div className="fin-landing-hero-copy" data-reveal>
              <span className="fin-landing-eyebrow">Paso 13 · Landing alineada al producto</span>

              <h1 className="fin-landing-title">
                Una mesa financiera para operar,
                <br />
                controlar y decidir.
              </h1>

              <p className="fin-landing-subtitle">
                FinTrack reúne dashboard, movimientos, portafolio, créditos, presupuestos y alertas
                en un solo flujo de trabajo. Menos pantallas aisladas, más lectura ejecutiva.
              </p>

              <div className="fin-landing-hero-actions">
                <Link href="/login?mode=signup" className="fin-landing-button fin-landing-button-primary">
                  <span>Entrar a FinTrack</span>
                  <span className="fin-landing-button-orb">
                    <IconArrowUpRight className="fin-landing-button-icon" />
                  </span>
                </Link>
                <a
                  href="#modulos"
                  className="fin-landing-button fin-landing-button-secondary"
                  onClick={(event) => handleAnchorClick(event, '#modulos')}
                >
                  <span>Ver módulos clave</span>
                </a>
              </div>

              <div className="fin-landing-ticker" aria-label="Capacidades clave">
                {TRUST_TICKERS.map((item) => (
                  <span key={item} className="fin-landing-ticker-item">
                    <span className="fin-landing-ticker-dot" aria-hidden />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="fin-landing-stage-wrap" data-reveal>
              <div className="fin-landing-stage-float fin-landing-stage-float-a">
                <span className="fin-landing-float-label">Riesgo operativo</span>
                <strong>3 alertas</strong>
                <p>Crédito, cobranza y una categoría fuera de rango.</p>
              </div>

              <div className="fin-landing-stage-shell">
                <div className="fin-landing-stage">
                  <header className="fin-landing-stage-top">
                    <div>
                      <p className="fin-landing-stage-kicker">Centro financiero</p>
                      <h2 className="fin-landing-stage-title">Dashboard</h2>
                    </div>
                    <div className="fin-landing-stage-top-meta">
                      <span>Este mes</span>
                      <span className="fin-landing-stage-sync">Sincronizado</span>
                    </div>
                  </header>

                  <div className="fin-landing-stage-kpis">
                    {HERO_KPIS.map((item) => (
                      <article key={item.label} className="fin-landing-stage-kpi">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <p>{item.note}</p>
                      </article>
                    ))}
                  </div>

                  <div className="fin-landing-stage-grid">
                    <section className="fin-landing-stage-panel fin-landing-stage-panel-chart">
                      <div className="fin-landing-stage-panel-head">
                        <div>
                          <p>Flujo comparado</p>
                          <strong>Ingresos vs. egresos</strong>
                        </div>
                        <span className="fin-landing-stage-pill">6 meses</span>
                      </div>

                      <div className="fin-landing-stage-bars" aria-hidden>
                        {[52, 74, 63, 88, 66, 84].map((value, index) => (
                          <div key={index} className="fin-landing-stage-bar-group">
                            <span className="fin-landing-stage-bar-track">
                              <span className="fin-landing-stage-bar fin-landing-stage-bar-income" style={{ height: `${value}%` }} />
                            </span>
                            <span className="fin-landing-stage-bar-track">
                              <span className="fin-landing-stage-bar fin-landing-stage-bar-expense" style={{ height: `${Math.max(24, value - 18)}%` }} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <aside className="fin-landing-stage-panel fin-landing-stage-panel-queue">
                      <div className="fin-landing-stage-panel-head">
                        <div>
                          <p>Inbox operativo</p>
                          <strong>Atención inmediata</strong>
                        </div>
                      </div>

                      <div className="fin-landing-stage-stack">
                        {HERO_QUEUE.map((item) => (
                          <article
                            key={item.title}
                            className={`fin-landing-stage-stack-item fin-landing-stage-stack-item-${item.tone}`}
                          >
                            <span>{item.title}</span>
                            <strong>{item.value}</strong>
                          </article>
                        ))}
                      </div>
                    </aside>
                  </div>

                  <section className="fin-landing-stage-ledger">
                    <div className="fin-landing-stage-panel-head">
                      <div>
                        <p>Movimientos recientes</p>
                        <strong>Registro unificado</strong>
                      </div>
                      <span className="fin-landing-stage-pill">Vista guardada</span>
                    </div>

                    <div className="fin-landing-stage-ledger-list">
                      {HERO_LEDGER.map((entry) => (
                        <article key={entry.name} className="fin-landing-stage-ledger-row">
                          <div className="fin-landing-stage-ledger-copy">
                            <strong>{entry.name}</strong>
                            <span>{entry.meta}</span>
                          </div>
                          <span className={`fin-landing-stage-ledger-amount fin-landing-stage-ledger-amount-${entry.tone}`}>
                            {entry.amount}
                          </span>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <div className="fin-landing-stage-float fin-landing-stage-float-b">
                <span className="fin-landing-float-label">Presupuesto</span>
                <strong>73% ejecutado</strong>
                <p>La señal existe, pero no grita. Solo informa lo necesario.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="fin-landing-metrics" ref={metricsSection.ref}>
          <div className="fin-landing-shell">
            <div className="fin-landing-metrics-frame" data-reveal>
              {LANDING_METRICS.map((metric, index) => (
                <article key={metric.label} className="fin-landing-metric-card">
                  <span className="fin-landing-metric-value">
                    {animatedMetrics[index]}
                    {metric.suffix}
                  </span>
                  <strong className="fin-landing-metric-label">{metric.label}</strong>
                  <p className="fin-landing-metric-detail">{metric.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="fin-landing-product" id="modulos">
          <div className="fin-landing-shell">
            <header className="fin-landing-section-heading" data-reveal>
              <span className="fin-landing-eyebrow">Producto</span>
              <h2>La identidad pública ahora vende la misma experiencia que existe dentro de la app.</h2>
              <p>
                La landing deja atrás el lenguaje dark-tech paralelo y adopta la misma calma operativa
                del workspace: superficies cálidas, jerarquía precisa y módulos con función clara.
              </p>
            </header>

            <div className="fin-landing-product-grid">
              {PRODUCT_CARDS.map((card) => {
                const Icon = card.icon

                return (
                  <article
                    key={card.title}
                    className={`fin-landing-product-card fin-landing-product-card-${card.tone}`}
                    data-reveal
                  >
                    <div className="fin-landing-product-card-shell">
                      <div className="fin-landing-product-card-core">
                        <div className="fin-landing-product-card-head">
                          <div>
                            <span className="fin-landing-product-card-eyebrow">{card.eyebrow}</span>
                            <h3>{card.title}</h3>
                          </div>
                          <span className="fin-landing-product-icon-wrap">
                            <Icon className="fin-landing-product-icon" />
                          </span>
                        </div>

                        <p className="fin-landing-product-description">{card.description}</p>

                        <ul className="fin-landing-product-points">
                          {card.points.map((point) => (
                            <li key={point}>
                              <IconCheck className="fin-landing-check-icon" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="fin-landing-workflow" id="control">
          <div className="fin-landing-shell fin-landing-workflow-grid">
            <div className="fin-landing-workflow-copy" data-reveal>
              <span className="fin-landing-eyebrow">Control operativo</span>
              <h2>Un sistema financiero serio no depende de adornos. Depende de repetición, lectura y foco.</h2>
              <p>
                Esta landing explica el producto con la misma lógica con la que luego se usa: primero
                capturas, luego controlas, después decides. Sin saltos de personalidad entre marketing y app.
              </p>

              <div className="fin-landing-principles">
                <article className="fin-landing-principle">
                  <span className="fin-landing-principle-icon">
                    <IconGrid className="fin-landing-principle-svg" />
                  </span>
                  <div>
                    <strong>Arquitectura consistente</strong>
                    <p>Page layouts, cards, controles y tablas hablan el mismo idioma visual.</p>
                  </div>
                </article>

                <article className="fin-landing-principle">
                  <span className="fin-landing-principle-icon">
                    <IconPulse className="fin-landing-principle-svg" />
                  </span>
                  <div>
                    <strong>Microinteracciones discretas</strong>
                    <p>Feedback rápido, easing cuidado y nada de efectos que estorben la operación.</p>
                  </div>
                </article>

                <article className="fin-landing-principle">
                  <span className="fin-landing-principle-icon">
                    <IconClock className="fin-landing-principle-svg" />
                  </span>
                  <div>
                    <strong>Menos fricción cognitiva</strong>
                    <p>El usuario no reaprende cada pantalla; encuentra patrones conocidos y los reutiliza.</p>
                  </div>
                </article>
              </div>
            </div>

            <div className="fin-landing-workflow-cards" data-reveal>
              {WORKFLOW.map((item) => (
                <article key={item.step} className="fin-landing-workflow-card">
                  <span className="fin-landing-workflow-step">{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="fin-landing-security" id="seguridad">
          <div className="fin-landing-shell fin-landing-security-grid">
            <div className="fin-landing-security-copy" data-reveal>
              <span className="fin-landing-eyebrow">Seguridad y confianza</span>
              <h2>Claridad visual también es una forma de control.</h2>
              <p>
                Cuando estados, vencimientos y prioridades se entienden al primer vistazo, la plataforma
                ayuda a reducir errores antes de que se conviertan en un problema operativo.
              </p>
            </div>

            <div className="fin-landing-security-panel" data-reveal>
              <div className="fin-landing-security-card">
                <div className="fin-landing-security-card-head">
                  <span className="fin-landing-security-icon">
                    <IconShield className="fin-landing-security-svg" />
                  </span>
                  <div>
                    <strong>Base segura para equipos financieros</strong>
                    <p>Protección de acceso, visibilidad de tareas y una experiencia más legible para operar.</p>
                  </div>
                </div>

                <div className="fin-landing-security-list">
                  {SECURITY_ITEMS.map((item) => (
                    <article key={item.title} className="fin-landing-security-item">
                      <span className="fin-landing-security-check">
                        <IconCheck className="fin-landing-check-icon" />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fin-landing-cta" data-reveal>
          <div className="fin-landing-shell">
            <div className="fin-landing-cta-shell">
              <div className="fin-landing-cta-core">
                <div className="fin-landing-cta-copy">
                  <span className="fin-landing-eyebrow">FinTrack</span>
                  <h2>La landing ya no promete una app distinta. Presenta la misma plataforma que luego se usa.</h2>
                  <p>
                    El resultado es una identidad mucho más madura: precisa, cálida y consistente con el
                    rediseño sistémico del producto.
                  </p>
                </div>

                <div className="fin-landing-cta-actions">
                  <Link href="/login?mode=signup" className="fin-landing-button fin-landing-button-primary">
                    <span>Crear cuenta</span>
                    <span className="fin-landing-button-orb">
                      <IconArrowUpRight className="fin-landing-button-icon" />
                    </span>
                  </Link>
                  <Link href="/login" className="fin-landing-button fin-landing-button-secondary">
                    <span>Iniciar sesión</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="fin-landing-footer">
        <div className="fin-landing-shell fin-landing-footer-grid">
          <div className="fin-landing-footer-brand">
            <Link href="/" className="fin-landing-brand fin-landing-brand-footer" aria-label="FinTrack inicio">
              <BrandMark size={32} />
              <BrandWordmark
                titleClassName="fin-landing-brand-wordmark"
                subtitle="Financial workspace"
                subtitleClassName="fin-landing-brand-caption"
              />
            </Link>
            <p>
              Plataforma financiera con una sola identidad visual: clara para operar, sobria para decidir y
              consistente desde la landing hasta el dashboard.
            </p>
          </div>

          <div className="fin-landing-footer-links">
            <div>
              <span className="fin-landing-footer-heading">Producto</span>
              <a href="#producto" onClick={(event) => handleAnchorClick(event, '#producto')}>Vista general</a>
              <a href="#modulos" onClick={(event) => handleAnchorClick(event, '#modulos')}>Módulos</a>
              <a href="#control" onClick={(event) => handleAnchorClick(event, '#control')}>Control</a>
            </div>

            <div>
              <span className="fin-landing-footer-heading">Acceso</span>
              <Link href="/login">Iniciar sesión</Link>
              <Link href="/login?mode=signup">Crear cuenta</Link>
              <Link href="/login?mode=recovery">Recuperar acceso</Link>
            </div>

            <div>
              <span className="fin-landing-footer-heading">Principios</span>
              <span>Jerarquía sobre ornamento</span>
              <span>Consistencia sobre efectos</span>
              <span>Producto antes que espectáculo</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
