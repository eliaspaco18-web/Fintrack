import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ModuleHeader, PageLayout, StatusBadge } from '@/components/finance'
import { DeveloperEnvironmentBanner } from '@/components/developer/DeveloperEnvironmentBanner'

const TOOL_CARDS = [
  {
    title: 'Control Center',
    description: 'Esquema operativo de la app para activar mantenimiento global y decidir qué módulos están activos, en mejoras o en camino.',
    href: '/developer/control-center',
    status: 'Disponible',
    tone: 'amber',
  },
  {
    title: 'Logos bancarios',
    description: 'Sube, encuadra y guarda los PNG oficiales que FinTrack ofrece como logos predefinidos.',
    href: '/developer/bank-icons',
    status: 'Disponible',
    tone: 'teal',
  },
  {
    title: 'Catálogos iniciales',
    description: 'Espacio reservado para bancos, categorías, colores e iconos que vendrán por defecto en nuevas cuentas.',
    href: null,
    status: 'Próximo',
    tone: 'amber',
  },
  {
    title: 'Actualizaciones',
    description: 'Base futura para preparar cambios de versión antes de correr el release de producción.',
    href: null,
    status: 'Próximo',
    tone: 'slate',
  },
] as const

export function DeveloperWorkspace() {
  return (
    <PageLayout
      className="developer-page max-w-[1120px] gap-5"
      header={(
        <ModuleHeader
          eyebrow="Admin local"
          title="Developer"
          description="Herramientas internas para preparar assets, presets y catálogos que quedan guardados en la app antes de lanzar una versión."
          actions={<Button href="/admin" variant="secondary" size="md">Ir a Administración</Button>}
        />
      )}
    >
      <DeveloperEnvironmentBanner />

      <section className="developer-tools-panel">
        <div className="developer-tools-panel__header">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[rgb(245,158,11)] shadow-[0_0_0_4px_rgba(245,158,11,0.12)]" />
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[rgb(146,72,16)]">
              Herramientas sensibles
            </p>
          </div>
          <StatusBadge tone="warning">Solo local</StatusBadge>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          {TOOL_CARDS.map(card => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
                    {card.title}
                  </p>
                  <StatusBadge tone={card.href ? 'success' : 'muted'}>{card.status}</StatusBadge>
                </div>
                <p className="mt-3 text-[12px] leading-5 text-[var(--c-text-muted)]">
                  {card.description}
                </p>
                <span className="mt-5 inline-flex text-[12px] font-semibold text-[var(--c-primary)]">
                  {card.href ? 'Abrir herramienta' : 'Preparado para crecer'}
                </span>
              </>
            )

            if (!card.href) {
              return (
                <div
                  key={card.title}
                  className="developer-tool-card"
                  data-tone={card.tone}
                  data-disabled="true"
                >
                  {content}
                </div>
              )
            }

            return (
              <Link
                key={card.title}
                href={card.href}
                className="developer-tool-card ui-pressable"
                data-tone={card.tone}
              >
                {content}
              </Link>
            )
          })}
        </div>
      </section>

      <section className="developer-release-strip">
        <p className="text-[12px] font-semibold text-[rgb(146,72,16)]">Flujo recomendado</p>
        <p className="text-[12px] leading-5 text-[var(--c-text-muted)]">
          Editas aquí en local, revisas que los assets se vean bien, haces commit y luego ejecutas
          {' '}<code className="rounded bg-white/55 px-1 py-0.5 text-[11px]">npm run release:production -- &quot;release: descripción corta&quot;</code>.
        </p>
      </section>
    </PageLayout>
  )
}
