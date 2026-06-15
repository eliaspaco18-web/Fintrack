'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppSelect, type AppSelectOption } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { ModuleHeader, PageLayout, StatusBadge } from '@/components/finance'
import { DeveloperEnvironmentBanner } from '@/components/developer/DeveloperEnvironmentBanner'
import type { AppControlConfig, AppControlModule, AppModuleStatus } from '@/lib/constants/app-control'
import { APP_CONTROL_CONFIG } from '@/lib/constants/app-control'

const STATUS_OPTIONS: AppSelectOption[] = [
  { value: 'live', label: 'Operativo', hint: 'Los usuarios ingresan con normalidad.' },
  { value: 'maintenance', label: 'En mejoras', hint: 'El usuario ve una pantalla amable mientras preparas cambios.' },
  { value: 'coming-soon', label: 'En camino', hint: 'El usuario sabe que algo nuevo está por llegar.' },
  { value: 'launch', label: 'Lanzamiento', hint: 'El módulo ya está listo y se presenta como novedad.' },
]

function cloneConfig(config: AppControlConfig): AppControlConfig {
  return JSON.parse(JSON.stringify(config)) as AppControlConfig
}

function statusTone(status: AppModuleStatus) {
  if (status === 'live') return 'success' as const
  if (status === 'maintenance') return 'warning' as const
  if (status === 'launch') return 'success' as const
  return 'primary' as const
}

function statusLabel(status: AppModuleStatus) {
  if (status === 'live') return 'Operativo'
  if (status === 'maintenance') return 'En mejoras'
  if (status === 'launch') return 'Lanzamiento'
  return 'En camino'
}

function moduleStatusMessage(module: AppControlModule, status: AppModuleStatus) {
  if (status === 'launch') {
    return `${module.label} ya está disponible. Entra para explorar sus novedades, organizar mejor tu información y aprovechar esta nueva experiencia dentro de FinTrack.`
  }

  if (status === 'coming-soon') {
    return `Estamos construyendo ${module.label} para que pronto tengas una nueva forma de avanzar dentro de FinTrack. Falta poco para estrenarlo.`
  }

  if (status === 'maintenance') {
    return `Estamos afinando ${module.label} para que vuelva más claro, rápido y cómodo.`
  }

  return ''
}

export function DeveloperControlCenter() {
  const [config, setConfig] = useState<AppControlConfig>(cloneConfig(APP_CONTROL_CONFIG))
  const [baseline, setBaseline] = useState<AppControlConfig>(cloneConfig(APP_CONTROL_CONFIG))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(baseline),
    [baseline, config],
  )

  const liveCount = useMemo(
    () => config.modules.filter(module => module.status === 'live').length,
    [config.modules],
  )
  const maintenanceCount = useMemo(
    () => config.modules.filter(module => module.status === 'maintenance').length,
    [config.modules],
  )
  const comingSoonCount = useMemo(
    () => config.modules.filter(module => module.status === 'coming-soon').length,
    [config.modules],
  )

  const groupedModules = useMemo(() => {
    return config.modules.reduce<Record<string, AppControlModule[]>>((acc, module) => {
      acc[module.section] ??= []
      acc[module.section]!.push(module)
      return acc
    }, {})
  }, [config.modules])

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const response = await fetch('/api/dev/app-control', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok || !payload?.config) {
          throw new Error(payload?.error ?? 'No se pudo cargar el centro de control.')
        }

        if (cancelled) return

        const nextConfig = cloneConfig(payload.config as AppControlConfig)
        setConfig(nextConfig)
        setBaseline(nextConfig)
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'No se pudo cargar el centro de control.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadConfig()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/dev/app-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok || !payload?.config) {
        throw new Error(payload?.error ?? 'No se pudo guardar el centro de control.')
      }

      const nextConfig = cloneConfig(payload.config as AppControlConfig)
      setConfig(nextConfig)
      setBaseline(nextConfig)
      setSuccess('Centro de control actualizado. La app ya puede respetar estos estados.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el centro de control.')
    } finally {
      setSaving(false)
    }
  }

  function updateMaintenance<K extends keyof AppControlConfig['maintenance']>(
    key: K,
    value: AppControlConfig['maintenance'][K],
  ) {
    setConfig(prev => ({
      ...prev,
      maintenance: {
        ...prev.maintenance,
        [key]: value,
      },
    }))
    setSuccess(null)
  }

  function updateModule(moduleKey: string, patch: Partial<AppControlModule>) {
    setConfig(prev => ({
      ...prev,
      modules: prev.modules.map(module => (
        module.key === moduleKey
          ? { ...module, ...patch }
          : module
      )),
    }))
    setSuccess(null)
  }

  return (
    <PageLayout
      className="developer-page max-w-[1240px] gap-5"
      header={(
        <ModuleHeader
          eyebrow="Admin local"
          title="Control Center"
          description="Esquema operativo de la app para decidir qué módulos están activos, en mejoras o en camino antes de publicar una versión."
          actions={(
            <>
              <Button href="/developer" variant="secondary" size="md">Volver a Developer</Button>
              <Button href="/maintenance" variant="ghost" size="md">Ver mantenimiento</Button>
            </>
          )}
        />
      )}
    >
      <DeveloperEnvironmentBanner />

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Estado global" value={config.maintenance.enabled ? 'Mantenimiento' : 'Operativa'} tone={config.maintenance.enabled ? 'warning' : 'success'} />
        <MetricCard label="Módulos activos" value={`${liveCount}`} tone="success" />
        <MetricCard label="En mejoras" value={`${maintenanceCount}`} tone="warning" />
        <MetricCard label="Novedades" value={`${comingSoonCount + config.modules.filter(module => module.status === 'launch').length}`} tone="primary" />
      </section>

      <section className="overflow-hidden rounded-[28px] border border-[rgba(180,83,9,0.16)] bg-[linear-gradient(135deg,rgba(255,251,235,0.9),rgba(255,255,255,0.88),rgba(240,253,250,0.84))] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="border-b border-[rgba(180,83,9,0.12)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(146,72,16)]">
                Esquema operativo
              </p>
              <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[var(--c-text)]">
                Mapa vivo de módulos y estados públicos
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
              <LegendChip label="Operativo" tone="success" />
              <LegendChip label="En mejoras" tone="warning" />
              <LegendChip label="En camino" tone="primary" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 xl:grid-cols-2">
          {Object.entries(groupedModules).map(([section, modules]) => (
            <div
              key={`map-${section}`}
              className="rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                    {section}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                    {modules.length} {modules.length === 1 ? 'módulo' : 'módulos'} conectados a esta zona.
                  </p>
                </div>
                <span className="rounded-full border border-[rgba(15,23,42,0.08)] bg-white/75 px-2.5 py-1 text-[11px] font-semibold text-[var(--c-text-muted)]">
                  {modules.filter(module => module.status === 'live').length}/{modules.length} activos
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                {modules.map(module => {
                  const previewHref = module.status === 'live'
                    ? module.href
                    : `/module-status/${module.key}`

                  return (
                    <Link
                      key={`map-chip-${module.key}`}
                      href={previewHref}
                      className={`group inline-flex min-w-[168px] flex-1 items-center justify-between gap-3 rounded-[18px] border px-3 py-2.5 transition-[transform,border-color,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${mapChipTone(module.status)}`}
                    >
                      <span>
                        <span className="block text-[12px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                          {module.label}
                        </span>
                        <span className="mt-1 block text-[11px] text-[var(--c-text-muted)]">
                          {statusLabel(module.status)}
                        </span>
                      </span>
                      <span className="rounded-full border border-current/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] opacity-80">
                        {module.status === 'live' ? 'Abrir' : 'Vista'}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(180,83,9,0.16)] bg-[rgba(255,255,255,0.78)] p-4 shadow-[0_12px_32px_rgba(31,41,55,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
                Mantenimiento global
              </p>
              <StatusBadge tone={config.maintenance.enabled ? 'warning' : 'success'}>
                {config.maintenance.enabled ? 'Activo' : 'Inactivo'}
              </StatusBadge>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[var(--c-text-muted)]">
              Si lo activas, los usuarios verán un mensaje claro y entusiasta mientras la app queda lista.
            </p>
          </div>

          <button
            type="button"
            onClick={() => updateMaintenance('enabled', !config.maintenance.enabled)}
            className={[
              'inline-flex h-11 min-w-[180px] items-center justify-between rounded-[16px] border px-3.5 text-[12px] font-semibold transition-[background-color,border-color,color,transform] duration-150',
              config.maintenance.enabled
                ? 'border-[rgba(180,83,9,0.22)] bg-[rgba(255,237,213,0.78)] text-[rgb(146,72,16)]'
                : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-muted)]',
            ].join(' ')}
          >
            <span>{config.maintenance.enabled ? 'Desactivar mantenimiento' : 'Activar mantenimiento'}</span>
            <span
              className={[
                'h-5 w-10 rounded-full p-0.5 transition-colors duration-150',
                config.maintenance.enabled ? 'bg-[rgb(245,158,11)]' : 'bg-[var(--c-border)]',
              ].join(' ')}
            >
              <span
                className={[
                  'block h-4 w-4 rounded-full bg-white transition-transform duration-150',
                  config.maintenance.enabled ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr,1.1fr]">
          <label className="block space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--c-text-muted)]">
              Título público
            </span>
            <input
              type="text"
              value={config.maintenance.title}
              onChange={event => updateMaintenance('title', event.target.value)}
              className="field-base ft-form-input h-11 w-full rounded-[16px]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--c-text-muted)]">
              Mensaje público
            </span>
            <textarea
              value={config.maintenance.message}
              onChange={event => updateMaintenance('message', event.target.value)}
              rows={3}
              className="field-base ft-form-input min-h-[92px] w-full rounded-[16px] py-3"
            />
          </label>
        </div>
      </section>

      {Object.entries(groupedModules).map(([section, modules]) => (
        <section key={section} className="rounded-2xl border border-[var(--c-border)] bg-[rgba(255,255,255,0.76)] p-4 shadow-[0_12px_32px_rgba(31,41,55,0.04)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--c-border)] pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                {section}
              </p>
              <p className="mt-1 text-[13px] text-[var(--c-text-muted)]">
                Define qué ve el usuario y cómo se comporta cada módulo.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {modules.map(module => (
              <article
                key={module.key}
                className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-[0_1px_2px_rgba(25,25,23,0.03)]"
              >
                <div className="grid gap-4 xl:grid-cols-[1.25fr,0.95fr,1fr]">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                        {module.label}
                      </p>
                      <StatusBadge tone={statusTone(module.status)}>
                        {statusLabel(module.status)}
                      </StatusBadge>
                    </div>
                    <p className="text-[12px] leading-5 text-[var(--c-text-muted)]">
                      {module.objective}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="inline-flex rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] px-2.5 py-1 text-[11px] text-[var(--c-text-muted)]">
                        {module.href}
                      </code>
                      <Link
                        href={module.status === 'live' ? module.href : `/module-status/${module.key}`}
                        className="inline-flex items-center rounded-full border border-[rgba(13,107,94,0.12)] bg-[rgba(240,253,250,0.7)] px-2.5 py-1 text-[11px] font-semibold text-[var(--c-primary)] transition-colors duration-150 hover:border-[rgba(13,107,94,0.18)] hover:bg-[rgba(204,251,241,0.7)]"
                      >
                        {module.status === 'live' ? 'Abrir módulo' : 'Ver pantalla pública'}
                      </Link>
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--c-text-muted)]">
                      Estado del módulo
                    </span>
                    <AppSelect
                      value={module.status}
                      onChange={value => {
                        const status = value as AppModuleStatus
                        updateModule(module.key, {
                          status,
                          note: moduleStatusMessage(module, status),
                        })
                      }}
                      options={STATUS_OPTIONS}
                      compact
                      searchable={false}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--c-text-muted)]">
                      Mensaje visible
                    </span>
                    <textarea
                      value={module.note}
                      onChange={event => updateModule(module.key, { note: event.target.value })}
                      rows={3}
                      placeholder={module.status === 'coming-soon'
                        ? 'Ej. Estamos construyendo esta sección para estrenarla muy pronto.'
                        : module.status === 'launch'
                          ? 'Ej. Ya puedes explorar esta novedad y aprovechar sus nuevas herramientas.'
                        : 'Ej. Estamos afinando esta sección para que vuelva más clara, rápida y útil.'}
                      className="field-base ft-form-input min-h-[92px] w-full rounded-[16px] py-3"
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {loading ? (
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-[12px] text-[var(--c-text-muted)]">
          Cargando centro de control...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[12px] text-red-600">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-[12px] text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={saving || !isDirty}
          onClick={() => {
            setConfig(cloneConfig(baseline))
            setError(null)
            setSuccess(null)
          }}
        >
          Descartar cambios
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={saving}
          disabled={!isDirty}
          onClick={() => void handleSave()}
        >
          Guardar control center
        </Button>
      </div>
    </PageLayout>
  )
}

function LegendChip({
  label,
  tone,
}: {
  label: string
  tone: 'success' | 'warning' | 'primary'
}) {
  const toneClasses = {
    success: 'border-[rgba(13,107,94,0.14)] bg-[rgba(240,253,250,0.9)] text-[var(--c-primary)]',
    warning: 'border-[rgba(180,83,9,0.16)] bg-[rgba(255,247,237,0.92)] text-[rgb(146,72,16)]',
    primary: 'border-[rgba(59,130,246,0.16)] bg-[rgba(239,246,255,0.92)] text-[rgb(29,78,216)]',
  } as const

  return (
    <span className={`rounded-full border px-2.5 py-1 ${toneClasses[tone]}`}>
      {label}
    </span>
  )
}

function mapChipTone(status: AppModuleStatus) {
  if (status === 'live') {
    return 'border-[rgba(13,107,94,0.14)] bg-[rgba(240,253,250,0.86)] text-[var(--c-primary)]'
  }

  if (status === 'maintenance') {
    return 'border-[rgba(180,83,9,0.18)] bg-[rgba(255,247,237,0.92)] text-[rgb(146,72,16)]'
  }

  if (status === 'launch') {
    return 'border-[rgba(13,107,94,0.2)] bg-[linear-gradient(135deg,rgba(204,251,241,0.82),rgba(240,253,250,0.92))] text-[var(--c-primary)]'
  }

  return 'border-[rgba(59,130,246,0.16)] bg-[rgba(239,246,255,0.92)] text-[rgb(29,78,216)]'
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'success' | 'warning' | 'primary'
}) {
  const toneClasses = {
    success: 'border-[rgba(13,107,94,0.14)] bg-[rgba(240,253,250,0.9)] text-[var(--c-primary)]',
    warning: 'border-[rgba(180,83,9,0.16)] bg-[rgba(255,247,237,0.94)] text-[rgb(146,72,16)]',
    primary: 'border-[rgba(59,130,246,0.16)] bg-[rgba(239,246,255,0.92)] text-[rgb(29,78,216)]',
  } as const

  return (
    <div className={`rounded-[18px] border px-4 py-3 shadow-[0_1px_2px_rgba(25,25,23,0.03)] ${toneClasses[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-70">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  )
}
