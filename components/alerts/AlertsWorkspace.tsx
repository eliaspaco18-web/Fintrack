'use client'

// =============================================================================
// components/alerts/AlertsWorkspace.tsx
// PRD v3 — Módulo 9: Risk Inbox
// Consolida alertas en una bandeja operativa sobria y priorizable.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ControlsBar,
  DataErrorBanner,
  DataFilterPreset,
  DataSearchField,
  EmptyState,
  ModuleHeader,
  PageLayout,
  StatCard,
  StatGrid,
  StatusBadge,
} from '@/components/finance'
import {
  SettingsBadge,
  SettingsMetric,
  settingsInputClassName,
} from '@/components/settings/primitives'
import { Button } from '@/components/ui/Button'
import { RecordModal } from '@/components/ui/RecordModal'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { useToast } from '@/lib/toast/toast'
import { AlertFilters, type TypeFilter, type ReadFilter, type ModuleFilter } from './AlertFilters'
import { AlertCard } from './AlertCard'
import { moduleLabel, type AlertSeverity } from './AlertBadge'

// ─── Tipo público compartido con AlertSummaryBar ──────────────────────────────
export interface AlertRow {
  id:               string
  alert_type:       AlertSeverity
  source_module:    string
  source_record_id: string | null
  title:            string
  message:          string | null
  href:             string | null
  is_read:          boolean
  created_at:       string
}

function normalizeSearch(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const LIST_GRID_CLASS =
  'md:grid-cols-[minmax(0,1.6fr)_140px_110px_120px_auto]'

// ─── Componente ───────────────────────────────────────────────────────────────

export function AlertsWorkspace() {
  const { toast } = useToast()

  // ── Datos ───────────────────────────────────────────────────────────────────
  const [alerts,    setAlerts]    = useState<AlertRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [busyId,    setBusyId]    = useState<string | null>(null)
  const [bulkBusy,  setBulkBusy]  = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all')
  const [readFilter,   setReadFilter]   = useState<ReadFilter>('all')
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all')
  const [query, setQuery] = useState('')
  const [showManualAlertModal, setShowManualAlertModal] = useState(false)
  const [savingManualAlert, setSavingManualAlert] = useState(false)
  const [manualRuleTitle, setManualRuleTitle] = useState('Desvío de presupuesto mensual')
  const [manualModule, setManualModule] = useState('budgets')
  const [manualSeverity, setManualSeverity] = useState<'CRITICAL' | 'OPERATIONAL'>('OPERATIONAL')
  const [manualChannel, setManualChannel] = useState('inbox_email')
  const [manualThreshold, setManualThreshold] = useState('80')

  // ── Cargar alertas ───────────────────────────────────────────────────────────
  const loadAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetchWithTimeout('/api/alerts', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las alertas'))
      setAlerts((json.data as AlertRow[]) ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar alertas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAlerts() }, [loadAlerts])

  // ── Filtrado en cliente ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim())

    return alerts.filter(a => {
      if (typeFilter !== 'all' && a.alert_type !== typeFilter) return false
      if (moduleFilter !== 'all' && a.source_module !== moduleFilter) return false

      if (readFilter === 'read' && !a.is_read) return false
      if (readFilter === 'unread' && a.is_read) return false

      if (!normalizedQuery) return true

      const haystack = normalizeSearch([
        a.title,
        a.message ?? '',
        moduleLabel(a.source_module),
      ].join(' '))

      return haystack.includes(normalizedQuery)
    })
  }, [alerts, moduleFilter, query, readFilter, typeFilter])

  // ── Acciones individuales ────────────────────────────────────────────────────
  const handleToggleRead = useCallback(async (id: string, next: boolean) => {
    setBusyId(id)
    try {
      const res  = await fetch(`/api/alerts/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_read: next }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo actualizar la alerta'))
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: next } : a))
    } catch (e) {
      toast.error('Error', e instanceof Error ? e.message : 'No se pudo actualizar la alerta')
    } finally {
      setBusyId(null)
    }
  }, [toast])

  const handleDelete = useCallback(async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar la alerta'))
      }
      setAlerts(prev => prev.filter(a => a.id !== id))
      toast.success('Alerta eliminada', undefined, { persist: false })
    } catch (e) {
      toast.error('Error', e instanceof Error ? e.message : 'No se pudo eliminar la alerta')
    } finally {
      setBusyId(null)
    }
  }, [toast])

  // ── Acciones bulk ────────────────────────────────────────────────────────────
  const handleMarkAllRead = useCallback(async () => {
    const unread = alerts.filter(a => !a.is_read)
    if (unread.length === 0) return
    setBulkBusy(true)
    let ok = 0
    for (const a of unread) {
      try {
        const res = await fetch(`/api/alerts/${a.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ is_read: true }),
        })
        if (res.ok) ok++
      } catch {/* continue */}
    }
    setAlerts(prev => prev.map(a => !a.is_read ? { ...a, is_read: true } : a))
    toast.success(`${ok} alerta(s) marcadas como leídas`, undefined, { persist: false })
    setBulkBusy(false)
  }, [alerts, toast])

  const handleDeleteRead = useCallback(async () => {
    setBulkBusy(true)
    try {
      const res = await fetch('/api/alerts', { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar las alertas'))
      }
      setAlerts(prev => prev.filter(a => !a.is_read))
      toast.success('Alertas leídas eliminadas', undefined, { persist: false })
    } catch (e) {
      toast.error('Error', e instanceof Error ? e.message : 'No se pudieron eliminar las alertas')
    } finally {
      setBulkBusy(false)
    }
  }, [toast])

  // ── Generar alertas (on-demand) ──────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res  = await fetch('/api/alerts/generate', { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'Error al generar alertas'))
      const { created, skipped } = json.data as { created: number; skipped: number }
      toast.success(
        `Alertas actualizadas`,
        `${created} nueva(s) · ${skipped} ya existente(s)`,
        { persist: false }
      )
      await loadAlerts()
    } catch (e) {
      toast.error('Error', e instanceof Error ? e.message : 'No se pudo generar alertas')
    } finally {
      setRefreshing(false)
    }
  }, [loadAlerts, toast])

  const resetManualAlertForm = useCallback(() => {
    setManualRuleTitle('Desvío de presupuesto mensual')
    setManualModule('budgets')
    setManualSeverity('OPERATIONAL')
    setManualChannel('inbox_email')
    setManualThreshold('80')
  }, [])

  const handleSaveManualAlert = useCallback(async () => {
    if (savingManualAlert) return

    const trimmedTitle = manualRuleTitle.trim()
    if (trimmedTitle.length < 3) {
      toast.error('No se pudo guardar la regla', 'El nombre debe tener al menos 3 caracteres.')
      return
    }

    setSavingManualAlert(true)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          source_module: manualModule,
          alert_type: manualSeverity,
          channel: manualChannel,
          threshold: manualThreshold,
        }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar la regla'))
      }

      await loadAlerts()
      setShowManualAlertModal(false)
      resetManualAlertForm()
      toast.success('Regla guardada', 'La alerta manual ya aparece en tu inbox.', { persist: false })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo guardar la regla'
      toast.error('No se pudo guardar la regla', message)
    } finally {
      setSavingManualAlert(false)
    }
  }, [loadAlerts, manualChannel, manualModule, manualRuleTitle, manualSeverity, manualThreshold, resetManualAlertForm, savingManualAlert, toast])

  // ── Estado vacío ─────────────────────────────────────────────────────────────
  const hasActiveFilters =
    typeFilter !== 'all' ||
    readFilter !== 'all' ||
    moduleFilter !== 'all' ||
    query.trim().length > 0

  const unreadCount = useMemo(() => alerts.filter(a => !a.is_read).length, [alerts])
  const readCount = alerts.length - unreadCount
  const criticalUnreadCount = useMemo(
    () => alerts.filter(a => !a.is_read && a.alert_type === 'CRITICAL').length,
    [alerts],
  )
  const operationalUnreadCount = useMemo(
    () => alerts.filter(a => !a.is_read && a.alert_type === 'OPERATIONAL').length,
    [alerts],
  )
  const activeModules = useMemo(
    () => new Set(alerts.filter(a => !a.is_read).map(a => a.source_module)).size,
    [alerts],
  )
  const resolutionRate = alerts.length === 0
    ? 100
    : Math.round((readCount / alerts.length) * 100)

  const resetFilters = useCallback(() => {
    setTypeFilter('all')
    setReadFilter('all')
    setModuleFilter('all')
    setQuery('')
  }, [])

  const sectionDescription = loading
    ? 'Actualizando bandeja de riesgo.'
    : `${filtered.length} alerta(s) visibles de ${alerts.length} registradas.`
  const manualPreviewTone = manualSeverity === 'CRITICAL' ? 'danger' : 'warning'
  const manualChannelLabel = manualChannel === 'inbox_email'
    ? 'Inbox + correo'
    : manualChannel === 'inbox'
      ? 'Solo inbox'
      : 'Resumen semanal'
  const manualModuleLabel = moduleLabel(manualModule)

  return (
    <>
      <PageLayout
      className="max-w-[1320px] gap-5"
      header={(
        <ModuleHeader
          eyebrow="Bandeja de riesgo"
          title="Alertas"
          description="Vencimientos, desvíos y recordatorios críticos en una sola bandeja priorizable."
          mode="content"
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowManualAlertModal(true)}
                variant="primary"
                size="md"
                testId="alerts-create-button"
              >
                Nueva alerta
              </Button>
              <Button
                type="button"
                onClick={() => void handleRefresh()}
                variant="secondary"
                size="md"
                loading={refreshing}
              >
                Actualizar inbox
              </Button>
            </div>
          )}
        />
      )}
      stats={(
        <StatGrid>
          <StatCard
            label="Pendientes"
            value={unreadCount}
            detail={criticalUnreadCount > 0 ? `${criticalUnreadCount} críticas` : 'Sin críticas'}
            caption="Alertas activas que todavía requieren atención."
            tone={unreadCount > 0 ? 'primary' : 'neutral'}
          />
          <StatCard
            label="Críticas activas"
            value={criticalUnreadCount}
            detail={criticalUnreadCount > 0 ? 'Escalar hoy' : 'Bandeja estable'}
            caption="Incidencias con mayor impacto sobre pagos, cobranzas o crédito."
            tone={criticalUnreadCount > 0 ? 'danger' : 'success'}
          />
          <StatCard
            label="Operativas activas"
            value={operationalUnreadCount}
            detail={activeModules > 0 ? `${activeModules} módulos` : 'Sin frentes abiertos'}
            caption="Tareas de seguimiento que ordenan el flujo financiero diario."
            tone={operationalUnreadCount > 0 ? 'warning' : 'neutral'}
          />
          <StatCard
            label="Cobertura"
            value={`${resolutionRate}%`}
            detail={`${readCount} resueltas`}
            caption="Porcentaje de alertas ya atendidas dentro de la bandeja."
            tone={resolutionRate >= 70 ? 'success' : resolutionRate >= 40 ? 'warning' : 'info'}
          />
        </StatGrid>
      )}
      controls={(
        <ControlsBar
          presets={(
            <>
              <DataFilterPreset
                label="Todo"
                active={!hasActiveFilters}
                onClick={resetFilters}
                count={alerts.length}
              />
              <DataFilterPreset
                label="Pendientes"
                active={readFilter === 'unread' && typeFilter === 'all' && moduleFilter === 'all' && query.trim().length === 0}
                onClick={() => {
                  setTypeFilter('all')
                  setReadFilter('unread')
                  setModuleFilter('all')
                  setQuery('')
                }}
                count={unreadCount}
                color="var(--c-primary)"
              />
              <DataFilterPreset
                label="Críticas"
                active={typeFilter === 'CRITICAL' && readFilter === 'unread' && moduleFilter === 'all' && query.trim().length === 0}
                onClick={() => {
                  setTypeFilter('CRITICAL')
                  setReadFilter('unread')
                  setModuleFilter('all')
                  setQuery('')
                }}
                count={criticalUnreadCount}
                color="var(--c-danger)"
              />
              <DataFilterPreset
                label="Resueltas"
                active={readFilter === 'read' && typeFilter === 'all' && moduleFilter === 'all' && query.trim().length === 0}
                onClick={() => {
                  setTypeFilter('all')
                  setReadFilter('read')
                  setModuleFilter('all')
                  setQuery('')
                }}
                count={readCount}
              />
            </>
          )}
          search={(
            <DataSearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar por alerta, mensaje o módulo"
              className="filters-search"
            />
          )}
          filters={(
            <AlertFilters
              typeFilter={typeFilter}
              readFilter={readFilter}
              moduleFilter={moduleFilter}
              onTypeChange={setTypeFilter}
              onReadChange={setReadFilter}
              onModuleChange={setModuleFilter}
            />
          )}
          actions={alerts.length > 0 ? (
            <>
              <Button
                type="button"
                disabled={bulkBusy || unreadCount === 0}
                onClick={() => void handleMarkAllRead()}
                variant="secondary"
                size="sm"
              >
                Resolver pendientes
              </Button>
              <Button
                type="button"
                disabled={bulkBusy || readCount === 0}
                onClick={() => void handleDeleteRead()}
                variant="danger"
                size="sm"
              >
                Limpiar resueltas
              </Button>
            </>
          ) : null}
        />
      )}
    >
      {error ? (
        <DataErrorBanner
          message={error}
          onRetry={() => {
            void loadAlerts()
          }}
        />
      ) : null}

      <section className="overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
              Cola operativa
            </p>
            <h2 className="mt-1 text-sm font-semibold text-[var(--c-text)]">
              Riesgos priorizados para actuar sin fricción
            </h2>
            <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
              {sectionDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={unreadCount > 0 ? 'primary' : 'muted'} dot={unreadCount > 0}>
              {unreadCount} pendientes
            </StatusBadge>
            {hasActiveFilters ? (
              <Button type="button" onClick={resetFilters} variant="ghost" size="sm">
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-[var(--c-border)]">
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className={`grid gap-3 px-4 py-4 ${LIST_GRID_CLASS}`}
              >
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="h-7 w-24 animate-pulse rounded-md bg-[var(--c-surface-2)]" />
                    <div className="h-7 w-20 animate-pulse rounded-md bg-[var(--c-surface-2)]" />
                  </div>
                  <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--c-surface-2)]" />
                  <div className="h-3 w-full animate-pulse rounded bg-[var(--c-surface-2)]" />
                </div>
                <div className="h-4 w-24 animate-pulse self-center rounded bg-[var(--c-surface-2)]" />
                <div className="h-7 w-20 animate-pulse self-center rounded-md bg-[var(--c-surface-2)]" />
                <div className="h-4 w-16 animate-pulse self-center rounded bg-[var(--c-surface-2)]" />
                <div className="flex gap-2 md:justify-end">
                  <div className="h-8 w-16 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                  <div className="h-8 w-24 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              compact
              title={hasActiveFilters ? 'No hay alertas con este corte.' : 'La bandeja está bajo control.'}
              description={hasActiveFilters
                ? 'Ajusta la prioridad, el estado o el módulo para volver a abrir la cola operativa.'
                : 'Genera alertas nuevas para revisar riesgos, vencimientos y recordatorios desde tus módulos financieros.'}
              action={hasActiveFilters ? (
                <Button type="button" onClick={resetFilters} variant="secondary" size="md">
                  Limpiar filtros
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void handleRefresh()}
                  variant="primary"
                  size="md"
                  loading={refreshing}
                >
                  Actualizar inbox
                </Button>
              )}
            />
          </div>
        ) : (
          <>
            <div className={`hidden border-b border-[var(--c-border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:grid ${LIST_GRID_CLASS}`}>
              <span>Detalle</span>
              <span>Módulo</span>
              <span>Estado</span>
              <span>Ingreso</span>
              <span className="text-right">Acciones</span>
            </div>

            <div>
              {filtered.map(a => (
                <AlertCard
                  key={a.id}
                  {...a}
                  busy={busyId === a.id || bulkBusy}
                  onToggleRead={(id, next) => void handleToggleRead(id, next)}
                  onDelete={id => void handleDelete(id)}
                />
              ))}
            </div>
          </>
        )}
      </section>
      </PageLayout>

      <RecordModal
        open={showManualAlertModal}
        onClose={() => {
          if (savingManualAlert) return
          setShowManualAlertModal(false)
        }}
        testId="alerts-create-modal"
        title="Nueva alerta manual"
        subtitle="Define una alerta manual, guarda la regla y publícala directamente en tu inbox operativo."
        eyebrow="Alertas · Standalone"
        widthClassName="w-[calc(100vw-32px)] max-w-[980px]"
        bodyClassName="space-y-0"
        footer={(
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[42ch] text-[12px] leading-5 text-[var(--c-text-muted)]">
              La regla crea una alerta manual en tu bandeja para dejar visible el seguimiento mientras definimos automatizaciones más profundas.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={savingManualAlert}
                onClick={() => {
                  setShowManualAlertModal(false)
                  resetManualAlertForm()
                }}
              >
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSaveManualAlert()}
                loading={savingManualAlert}
                disabled={manualRuleTitle.trim().length < 3}
                testId="alerts-save-rule-button"
              >
                Guardar regla
              </Button>
            </div>
          </div>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            <div className="rounded-[22px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <SettingsBadge tone="accent">Regla</SettingsBadge>
                <SettingsBadge tone="neutral">{manualModuleLabel}</SettingsBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--c-text-muted)]">
                Define la condición base y el módulo financiero que disparará la alerta. El objetivo aquí es validar la composición de la ventana, no crear nueva lógica operativa.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                  Nombre de la regla
                </span>
                <input
                  value={manualRuleTitle}
                  onChange={event => setManualRuleTitle(event.target.value)}
                  data-testid="alerts-rule-title-input"
                  className={settingsInputClassName()}
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                  Módulo
                </span>
                <select
                  value={manualModule}
                  onChange={event => setManualModule(event.target.value)}
                  data-testid="alerts-rule-module-select"
                  className={settingsInputClassName()}
                >
                  <option value="budgets">Presupuestos</option>
                  <option value="payables">Cuentas por pagar</option>
                  <option value="receivables">Cuentas por cobrar</option>
                  <option value="credits">Créditos</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                  Severidad
                </span>
                <select
                  value={manualSeverity}
                  onChange={event => setManualSeverity(event.target.value as 'CRITICAL' | 'OPERATIONAL')}
                  data-testid="alerts-rule-severity-select"
                  className={settingsInputClassName()}
                >
                  <option value="OPERATIONAL">Operativa</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                  Umbral
                </span>
                <input
                  value={manualThreshold}
                  onChange={event => setManualThreshold(event.target.value)}
                  inputMode="numeric"
                  data-testid="alerts-rule-threshold-input"
                  className={settingsInputClassName()}
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                  Entrega
                </span>
                <select
                  value={manualChannel}
                  onChange={event => setManualChannel(event.target.value)}
                  data-testid="alerts-rule-channel-select"
                  className={settingsInputClassName()}
                >
                  <option value="inbox_email">Inbox + correo</option>
                  <option value="inbox">Solo inbox</option>
                  <option value="digest">Resumen semanal</option>
                </select>
              </label>
            </div>
          </section>

          <aside className="space-y-3">
            <div className="rounded-[22px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <SettingsBadge tone={manualPreviewTone}>Preview</SettingsBadge>
                <SettingsBadge tone="neutral">{manualChannelLabel}</SettingsBadge>
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--c-text)]">{manualRuleTitle}</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                {manualModuleLabel} disparará una alerta {manualSeverity === 'CRITICAL' ? 'crítica' : 'operativa'} cuando el umbral llegue a {manualThreshold}%.
              </p>
            </div>

            <SettingsMetric
              label="Módulo"
              value={manualModuleLabel}
              caption="Contexto financiero que originará la señal."
            />
            <SettingsMetric
              label="Entrega"
              value={manualChannelLabel}
              caption="Canal estimado para la recepción de la alerta."
            />
            <SettingsMetric
              label="Estado"
              value="Shell listo"
              caption="La interacción visual ya quedó separada de la persistencia futura."
            />
          </aside>
        </div>
      </RecordModal>
    </>
  )
}
