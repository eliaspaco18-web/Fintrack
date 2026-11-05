'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppSelect } from '@/components/ui/AppSelect'
import type { AnchoredAction } from '@/components/ui/AnchoredActionMenu'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { RecordModal } from '@/components/ui/RecordModal'
import { ConfirmDialog, DataErrorBanner, DataSearchField, EmptyState, PageLayout } from '@/components/finance'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { useToast } from '@/lib/toast/toast'
import { AlertFilters, type TypeFilter, type ModuleFilter } from './AlertFilters'
import { AlertCard } from './AlertCard'
import { moduleLabel, type AlertSeverity } from './AlertBadge'
import styles from './AlertsWorkspace.module.css'
import { filterAlertRows, isValidAlertHref } from './alerts-presentation'

export interface AlertRow {
  id: string
  alert_type: AlertSeverity
  source_module: string
  source_record_id: string | null
  title: string
  message: string | null
  href: string | null
  is_read: boolean
  created_at: string
}

interface AlertCounts {
  total: number
  unread: number
}

type AlertLoadResult =
  | { ok: true; data: AlertRow[]; counts: AlertCounts }
  | { ok: false; message: string }

type ReadFilter = 'unread' | 'read'
type ManualSeverity = AlertSeverity
type DiscardTarget = 'create' | null

const MANUAL_ALERT_DEFAULTS = {
  title: '',
  module: 'budgets',
  severity: 'OPERATIONAL' as ManualSeverity,
  channel: 'inbox_email',
  threshold: '',
}

function formatAlertDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function AlertsWorkspace() {
  const { toast } = useToast()
  const hasLoadedOnce = useRef(false)
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [counts, setCounts] = useState<AlertCounts>({ total: 0, unread: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('unread')
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all')
  const [query, setQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [savingManualAlert, setSavingManualAlert] = useState(false)
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget>(null)
  const [deleteReadConfirmOpen, setDeleteReadConfirmOpen] = useState(false)
  const [clearInboxConfirmOpen, setClearInboxConfirmOpen] = useState(false)
  const [manualTitle, setManualTitle] = useState(MANUAL_ALERT_DEFAULTS.title)
  const [manualModule, setManualModule] = useState(MANUAL_ALERT_DEFAULTS.module)
  const [manualSeverity, setManualSeverity] = useState<ManualSeverity>(MANUAL_ALERT_DEFAULTS.severity)
  const [manualChannel, setManualChannel] = useState(MANUAL_ALERT_DEFAULTS.channel)
  const [manualThreshold, setManualThreshold] = useState(MANUAL_ALERT_DEFAULTS.threshold)

  const loadAlerts = useCallback(async (): Promise<AlertLoadResult> => {
    setLoading(!hasLoadedOnce.current)
    setError(null)
    try {
      const response = await fetchWithTimeout('/api/alerts', { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los avisos.'))
      if (!Array.isArray(json.data)
        || !Number.isSafeInteger(json.counts?.total)
        || !Number.isSafeInteger(json.counts?.unread)
        || json.counts.total < 0
        || json.counts.unread < 0
        || json.counts.unread > json.counts.total) {
        throw new Error('El servidor no devolvió contadores verificables para los avisos.')
      }
      const data = json.data as AlertRow[]
      const nextCounts = { total: json.counts.total as number, unread: json.counts.unread as number }
      setAlerts(data)
      setCounts(nextCounts)
      hasLoadedOnce.current = true
      return { ok: true, data, counts: nextCounts }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Error al cargar los avisos.'
      setError(message)
      return { ok: false, message }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAlerts() }, [loadAlerts])

  const unreadCount = counts.unread
  const readCount = Math.max(0, counts.total - counts.unread)
  const filtered = useMemo(() => {
    return filterAlertRows(alerts, { type: typeFilter, read: readFilter, module: moduleFilter, query })
  }, [alerts, moduleFilter, query, readFilter, typeFilter])

  const resetFilters = useCallback(() => {
    setQuery('')
    setTypeFilter('all')
    setModuleFilter('all')
  }, [])

  const hasActiveFilters = typeFilter !== 'all' || moduleFilter !== 'all' || query.trim().length > 0
  const activeFilterCount = Number(typeFilter !== 'all') + Number(moduleFilter !== 'all') + Number(query.trim().length > 0)

  const handleToggleRead = useCallback(async (id: string, next: boolean) => {
    const currentAlert = alerts.find(alert => alert.id === id)
    if (!currentAlert || currentAlert.is_read === next) return
    setBusyId(id)
    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_read: next }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el aviso.'))
      setAlerts(previous => previous.map(alert => alert.id === id ? { ...alert, is_read: next } : alert))
      setCounts(previous => ({
        ...previous,
        unread: Math.max(0, previous.unread + (next ? -1 : 1)),
      }))
    } catch (caught) {
      toast.error('No se pudo actualizar el aviso', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setBusyId(null)
    }
  }, [alerts, toast])

  const handleDelete = useCallback(async (id: string) => {
    const target = alerts.find(alert => alert.id === id)
    if (!target) return
    setBusyId(id)
    try {
      const response = await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 204) {
        const json = await response.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el aviso.'))
      }
      setAlerts(previous => previous.filter(alert => alert.id !== id))
      setCounts(previous => ({
        total: Math.max(0, previous.total - 1),
        unread: Math.max(0, previous.unread - (target.is_read ? 0 : 1)),
      }))
      toast.success('Aviso eliminado', undefined, { persist: false })
    } catch (caught) {
      toast.error('No se pudo eliminar el aviso', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setBusyId(null)
    }
  }, [alerts, toast])

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return
    setBulkBusy(true)
    try {
      const response = await fetch('/api/alerts', { method: 'PATCH', cache: 'no-store' })
      const json = await response.json().catch(() => null)
      const updatedCount = json?.data?.updatedCount
      if (!response.ok || !json?.ok || !Number.isSafeInteger(updatedCount) || json.data?.remainingUnreadCount !== 0) {
        await loadAlerts()
        throw new Error(getApiErrorMessage(json, 'No se pudo confirmar la lectura de todos los avisos.'))
      }

      setAlerts(previous => previous.map(alert => ({ ...alert, is_read: true })))
      setCounts(previous => ({ ...previous, unread: 0 }))

      const refreshed = await loadAlerts()
      if (!refreshed.ok) {
        throw new Error('El servidor confirmó la operación, pero no se pudo recargar la bandeja. Actualízala para verificar el estado.')
      }
      if (refreshed.counts.unread > 0) {
        throw new Error(`La verificación encontró ${refreshed.counts.unread} aviso(s) todavía sin leer. Puedes reintentar.`)
      }

      toast.success(`${updatedCount} aviso(s) marcado(s) como leídos`, undefined, { persist: false })
    } catch (caught) {
      toast.error('No se pudieron marcar todos como leídos', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setBulkBusy(false)
    }
  }, [loadAlerts, toast, unreadCount])

  const handleDeleteRead = useCallback(async () => {
    setBulkBusy(true)
    try {
      const response = await fetch('/api/alerts?scope=read', { method: 'DELETE', cache: 'no-store' })
      const json = await response.json().catch(() => null)
      const deletedCount = json?.data?.deletedCount
      if (!response.ok || !json?.ok || !Number.isSafeInteger(deletedCount) || json.data?.remainingReadCount !== 0) {
        await loadAlerts()
        throw new Error(getApiErrorMessage(json, 'No se pudo confirmar la eliminación de los avisos leídos.'))
      }

      const refreshed = await loadAlerts()
      if (!refreshed.ok) {
        throw new Error('El servidor confirmó la eliminación, pero no se pudo recargar la bandeja. Actualízala para verificar el estado.')
      }
      if (refreshed.counts.total - refreshed.counts.unread > 0) {
        throw new Error(`La verificación encontró ${refreshed.counts.total - refreshed.counts.unread} aviso(s) leído(s) todavía en la bandeja.`)
      }

      setDeleteReadConfirmOpen(false)
      toast.success(`${deletedCount} aviso(s) leído(s) eliminado(s)`, undefined, { persist: false })
    } catch (caught) {
      toast.error('No se pudieron eliminar los avisos', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setBulkBusy(false)
    }
  }, [loadAlerts, toast])

  const handleClearInbox = useCallback(async () => {
    setBulkBusy(true)
    try {
      const response = await fetch('/api/alerts?scope=all', { method: 'DELETE', cache: 'no-store' })
      const json = await response.json().catch(() => null)
      const deletedCount = json?.data?.deletedCount
      if (!response.ok || !json?.ok || !Number.isSafeInteger(deletedCount) || json.data?.remainingCount !== 0) {
        await loadAlerts()
        throw new Error(getApiErrorMessage(json, 'No se pudo confirmar que la bandeja quedó vacía.'))
      }

      const refreshed = await loadAlerts()
      if (!refreshed.ok) {
        throw new Error('El servidor confirmó la eliminación, pero no se pudo recargar la bandeja. Actualízala para verificar el estado.')
      }
      if (refreshed.counts.total > 0) {
        throw new Error(`La verificación encontró ${refreshed.counts.total} aviso(s) todavía en la bandeja. Puedes volver a vaciarla.`)
      }

      setClearInboxConfirmOpen(false)
      toast.success('Bandeja vacía', `${deletedCount} aviso(s) eliminado(s).`, { persist: false })
    } catch (caught) {
      toast.error('No se pudo vaciar la bandeja', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setBulkBusy(false)
    }
  }, [loadAlerts, toast])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await loadAlerts()
      if (!result.ok) throw new Error(result.message)
      toast.success('Bandeja actualizada', `${result.counts.total} aviso(s) en tu cuenta.`, { persist: false })
    } catch (caught) {
      toast.error('No se pudo recargar la bandeja', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setRefreshing(false)
    }
  }, [loadAlerts, toast])

  const resetManualAlertForm = useCallback(() => {
    setManualTitle(MANUAL_ALERT_DEFAULTS.title)
    setManualModule(MANUAL_ALERT_DEFAULTS.module)
    setManualSeverity(MANUAL_ALERT_DEFAULTS.severity)
    setManualChannel(MANUAL_ALERT_DEFAULTS.channel)
    setManualThreshold(MANUAL_ALERT_DEFAULTS.threshold)
  }, [])

  const manualFormDirty = manualTitle !== MANUAL_ALERT_DEFAULTS.title
    || manualModule !== MANUAL_ALERT_DEFAULTS.module
    || manualSeverity !== MANUAL_ALERT_DEFAULTS.severity
    || manualChannel !== MANUAL_ALERT_DEFAULTS.channel
    || manualThreshold !== MANUAL_ALERT_DEFAULTS.threshold

  const requestCreateClose = useCallback(() => {
    if (savingManualAlert) return
    if (manualFormDirty) setDiscardTarget('create')
    else setShowCreateModal(false)
  }, [manualFormDirty, savingManualAlert])

  const confirmDiscardCreate = useCallback(() => {
    resetManualAlertForm()
    setDiscardTarget(null)
    setShowCreateModal(false)
  }, [resetManualAlertForm])

  const handleSaveManualAlert = useCallback(async () => {
    if (savingManualAlert) return
    const trimmedTitle = manualTitle.trim()
    if (trimmedTitle.length < 3 || trimmedTitle.length > 140) {
      toast.error('Revisa el título', 'Debe contener entre 3 y 140 caracteres.')
      return
    }
    if (manualThreshold.trim().length > 20) {
      toast.error('Revisa el umbral de referencia', 'El valor admite hasta 20 caracteres.')
      return
    }
    setSavingManualAlert(true)
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          source_module: manualModule,
          alert_type: manualSeverity,
          channel: manualChannel,
          threshold: manualThreshold.trim() || undefined,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo guardar el aviso.'))
      const created = json.data as AlertRow | undefined
      if (created?.id) setAlerts(previous => previous.some(alert => alert.id === created.id) ? previous : [created, ...previous])
      setShowCreateModal(false)
      setDiscardTarget(null)
      resetManualAlertForm()
      toast.success('Aviso guardado', 'Se guardó en la bandeja. Los metadatos no activan reglas ni envíos automáticos.', { persist: false })
      void loadAlerts()
    } catch (caught) {
      toast.error('No se pudo guardar el aviso', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setSavingManualAlert(false)
    }
  }, [loadAlerts, manualChannel, manualModule, manualSeverity, manualThreshold, manualTitle, resetManualAlertForm, savingManualAlert, toast])

  const originModuleOptions = [
    { value: 'all', label: 'Todos los módulos' },
    { value: 'credits', label: moduleLabel('credits') ?? 'Créditos' },
    { value: 'budgets', label: moduleLabel('budgets') ?? 'Presupuestos' },
    { value: 'receivables', label: moduleLabel('receivables') ?? 'Por cobrar' },
    { value: 'payables', label: moduleLabel('payables') ?? 'Por pagar' },
    { value: 'recurring', label: moduleLabel('recurring') ?? 'Plantillas' },
    { value: 'alerts', label: moduleLabel('alerts') ?? 'Avisos' },
  ]
  const manualModuleOptions = originModuleOptions.filter(option => option.value !== 'all')
  const manualSeverityOptions = [
    { value: 'CRITICAL', label: 'Crítica' },
    { value: 'OPERATIONAL', label: 'Operativa' },
    { value: 'SUGGESTION', label: 'Sugerencia' },
  ]
  const manualChannelOptions = [
    { value: 'inbox_email', label: 'Inbox + correo (referencia)' },
    { value: 'inbox', label: 'Solo inbox (referencia)' },
    { value: 'digest', label: 'Resumen semanal (referencia)' },
  ]

  const createDiscardMessage = 'Los cambios del aviso se descartarán. El aviso solo se guarda manualmente en la bandeja; el canal y el umbral se conservan como metadatos.'
  const deleteReadCount = `${readCount} aviso${readCount === 1 ? '' : 's'} leído${readCount === 1 ? '' : 's'}`
  const deleteReadMessage = `Se eliminará${readCount === 1 ? '' : 'n'} ${deleteReadCount} de la bandeja. Los avisos no leídos no se eliminarán.`
  const clearInboxMessage = 'Se eliminarán permanentemente todos los avisos de tu cuenta, leídos y sin leer, incluido el historial informativo guardado en esta bandeja, incluso los que no coincidan con los filtros. Esta acción no se puede deshacer. Solo se eliminarán estos avisos y registros informativos; tus movimientos y demás datos financieros permanecerán intactos.'

  return (
    <>
      <PageLayout className={`max-w-none !gap-0 ${movementStyles.v3ModuleContent} ${styles.page}`}>
        <div className={movementStyles.pageOverview} data-testid="alerts-page-overview">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 data-ft-route-heading="" tabIndex={-1} className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">Avisos</h1>
              <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">Lo que cambió y lo que merece una revisión.</p>
            </div>
            <div className={styles.headerActions}>
              <CreateModuleButton onClick={() => { resetManualAlertForm(); setShowCreateModal(true) }} label="Nuevo aviso" className={movementStyles.v3ModulePrimaryAction} testId="alerts-create-button" />
            </div>
          </header>
        </div>

        <nav className={movementStyles.tabs + ' ' + styles.statusTabs} aria-label="Estado de avisos" data-testid="alerts-status-tabs">
          {([
            ['unread', 'Sin leer'],
            ['read', 'Leídos'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={readFilter === value} onClick={() => setReadFilter(value)} className={styles.statusTab} data-active={readFilter === value}>
              {label}{value === 'unread' ? <span className={styles.tabCount}>{loading && alerts.length === 0 ? '—' : unreadCount}</span> : null}
            </button>
          ))}
        </nav>

        <div className={styles.actionToolbar} data-testid="alerts-secondary-actions">
          <Button
            type="button"
            variant={filtersOpen ? 'secondary' : 'ghost'}
            size="sm"
            leadingIcon={<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10m-7 6h4" /></svg>}
            aria-expanded={filtersOpen}
            aria-controls="alerts-filters-panel"
            onClick={() => setFiltersOpen(open => !open)}
            testId="alerts-filter-toggle"
          >
            Filtros{activeFilterCount > 0 ? <span className={styles.filterCount}>{activeFilterCount}</span> : null}
          </Button>
          <div className={styles.bulkActions}>
            <Button type="button" variant="ghost" size="sm" loading={refreshing} disabled={bulkBusy} onClick={() => void handleRefresh()} testId="alerts-refresh-button">Actualizar avisos</Button>
            <Button type="button" variant="ghost" size="sm" disabled={bulkBusy || refreshing || unreadCount === 0} title="Marca como leídos todos los avisos sin leer de la cuenta, aunque no estén visibles o coincidan con los filtros." ariaLabel="Marcar como leídos todos los avisos sin leer de la cuenta" onClick={() => void handleMarkAllRead()} testId="alerts-mark-all-read-button">Marcar todos como leídos</Button>
            <Button type="button" variant="ghost" size="sm" disabled={bulkBusy || refreshing || readCount === 0} onClick={() => setDeleteReadConfirmOpen(true)} testId="alerts-delete-read-button">Eliminar leídos</Button>
            <Button type="button" variant="danger" size="sm" disabled={bulkBusy || refreshing || counts.total === 0} title="Elimina todos los avisos leídos y sin leer de la cuenta." onClick={() => setClearInboxConfirmOpen(true)} testId="alerts-clear-inbox-button">Vaciar bandeja</Button>
          </div>
        </div>

        {filtersOpen ? (
          <div className={styles.filterPanel} id="alerts-filters-panel" data-testid="alerts-filter-toolbar">
            <div className={movementStyles.controlsMain + ' ' + styles.filterToolbarMain}>
              <div className={movementStyles.searchControl + ' ' + styles.searchControl}>
                <DataSearchField value={query} onChange={setQuery} placeholder="Buscar un aviso" aria-label="Buscar avisos" data-testid="alerts-search" className={styles.searchInput} />
              </div>
              <AlertFilters typeFilter={typeFilter} moduleFilter={moduleFilter} onTypeChange={setTypeFilter} onModuleChange={setModuleFilter} originModuleOptions={originModuleOptions} />
            </div>
            {hasActiveFilters ? <Button type="button" onClick={resetFilters} variant="ghost" size="sm" className={styles.clearFilters}>Limpiar filtros</Button> : null}
          </div>
        ) : null}

        {error ? <DataErrorBanner message={error} onRetry={() => void loadAlerts()} /> : null}

        {error && alerts.length === 0 ? null : <section className={styles.register} aria-label="Bandeja de avisos" data-testid="alerts-register">
          {loading && alerts.length === 0 ? (
            <div className={styles.loadingRows} aria-label="Cargando avisos" aria-busy="true">
              {[0, 1, 2].map(index => <div className={styles.loadingRow} key={index} aria-hidden="true"><span /><span /><span /></div>)}
            </div>
          ) : error && alerts.length === 0 ? null : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <EmptyState compact title={hasActiveFilters ? 'No hay avisos con estos filtros.' : readFilter === 'unread' ? 'No hay avisos sin leer.' : 'No hay avisos leídos.'} description={hasActiveFilters ? 'Prueba otra búsqueda, severidad o módulo de origen.' : 'Los avisos que requieren revisión aparecerán aquí.'} action={hasActiveFilters ? <Button type="button" onClick={resetFilters} variant="secondary" size="md">Limpiar filtros</Button> : null} />
            </div>
          ) : (
            <div className={styles.rows}>
              {filtered.map(alert => {
                const actions: AnchoredAction[] = [{
                  id: 'delete', label: 'Eliminar aviso', destructive: true, disabled: busyId === alert.id || bulkBusy,
                  onSelect: () => void handleDelete(alert.id),
                }]
                return <AlertCard key={alert.id} {...alert} dateLabel={formatAlertDate(alert.created_at)} href={isValidAlertHref(alert.href) ? alert.href : null} busy={busyId === alert.id || bulkBusy} actions={actions} onToggleRead={(id, next) => void handleToggleRead(id, next)} />
              })}
            </div>
          )}
        </section>}
      </PageLayout>

      <RecordModal
        open={showCreateModal}
        onClose={requestCreateClose}
        testId="alerts-create-modal"
        title="Nuevo aviso"
        eyebrow="Avisos"
        subtitle="Guarda un aviso manual en tu bandeja."
        widthClassName="w-[calc(100vw-32px)] max-w-[580px]"
        size="md"
        presentation="workbench"
        focusTrapActive={discardTarget !== 'create'}
        preserveFocusOnResume
        bodyClassName="space-y-5"
        footer={(
          <FormActions
            secondaryAction={<Button type="button" variant="secondary" size="md" disabled={savingManualAlert} onClick={requestCreateClose}>Cancelar</Button>}
            primaryAction={<Button type="button" variant="primary" size="md" loading={savingManualAlert} disabled={manualTitle.trim().length < 3 || manualTitle.trim().length > 140} onClick={() => void handleSaveManualAlert()} testId="alerts-save-rule-button">Guardar aviso</Button>}
          />
        )}
      >
        <div className={styles.manualNotice} role="note">
          Se guarda manualmente. Los datos opcionales son referencias y no activan reglas ni envíos automáticos.
        </div>
        <FormSection title="Contenido del aviso" columns="1" className="gap-y-4">
          <FormField label="Título" htmlFor="alerts-rule-title" hint={`${manualTitle.trim().length}/140`}>
            <input id="alerts-rule-title" value={manualTitle} onChange={event => setManualTitle(event.target.value)} maxLength={140} data-testid="alerts-rule-title-input" className="field-base w-full" autoComplete="off" />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Módulo relacionado">
              <AppSelect value={manualModule} onChange={setManualModule} options={manualModuleOptions} ariaLabel="Módulo relacionado" testId="alerts-rule-module-select" compact matchTriggerWidth />
            </FormField>
            <FormField label="Severidad">
              <AppSelect value={manualSeverity} onChange={value => setManualSeverity(value as ManualSeverity)} options={manualSeverityOptions} ariaLabel="Severidad del aviso" testId="alerts-rule-severity-select" compact matchTriggerWidth />
            </FormField>
          </div>
        </FormSection>
        <FormSection title="Metadatos opcionales" columns="1" className="gap-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Umbral de referencia" optional hint="Se guarda como texto informativo; no ejecuta una regla.">
              <input value={manualThreshold} onChange={event => setManualThreshold(event.target.value)} maxLength={20} data-testid="alerts-rule-threshold-input" className="field-base w-full" inputMode="decimal" />
            </FormField>
            <FormField label="Canal asociado" optional hint="Referencia guardada, sin envío automático.">
              <AppSelect value={manualChannel} onChange={setManualChannel} options={manualChannelOptions} ariaLabel="Canal asociado como metadato" testId="alerts-rule-channel-select" compact matchTriggerWidth />
            </FormField>
          </div>
        </FormSection>
      </RecordModal>

      <ConfirmDialog open={discardTarget === 'create'} title="¿Descartar cambios?" message={createDiscardMessage} onConfirm={confirmDiscardCreate} onCancel={() => setDiscardTarget(null)} confirmLabel="Descartar cambios" cancelLabel="Seguir editando" danger testId="alerts-discard-confirmation" />
      <ConfirmDialog open={deleteReadConfirmOpen} title="Eliminar avisos leídos" message={deleteReadMessage} onConfirm={() => void handleDeleteRead()} onCancel={() => setDeleteReadConfirmOpen(false)} loading={bulkBusy} danger confirmLabel="Eliminar avisos leídos" testId="alerts-delete-read-confirmation" />
      <ConfirmDialog open={clearInboxConfirmOpen} title="¿Vaciar toda la bandeja?" message={clearInboxMessage} onConfirm={() => void handleClearInbox()} onCancel={() => setClearInboxConfirmOpen(false)} loading={bulkBusy} danger confirmLabel="Vaciar bandeja" cancelLabel="Conservar avisos" testId="alerts-clear-inbox-confirmation" />
    </>
  )
}
