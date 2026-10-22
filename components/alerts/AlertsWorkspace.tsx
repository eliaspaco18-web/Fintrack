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
import { filterAlertRows, isValidAlertHref, markAlertsReadIndividually } from './alerts-presentation'

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

type ReadFilter = 'unread' | 'read' | 'all'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all')
  const [query, setQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [savingManualAlert, setSavingManualAlert] = useState(false)
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget>(null)
  const [deleteReadConfirmOpen, setDeleteReadConfirmOpen] = useState(false)
  const [manualTitle, setManualTitle] = useState(MANUAL_ALERT_DEFAULTS.title)
  const [manualModule, setManualModule] = useState(MANUAL_ALERT_DEFAULTS.module)
  const [manualSeverity, setManualSeverity] = useState<ManualSeverity>(MANUAL_ALERT_DEFAULTS.severity)
  const [manualChannel, setManualChannel] = useState(MANUAL_ALERT_DEFAULTS.channel)
  const [manualThreshold, setManualThreshold] = useState(MANUAL_ALERT_DEFAULTS.threshold)

  const loadAlerts = useCallback(async () => {
    setLoading(!hasLoadedOnce.current)
    setError(null)
    try {
      const response = await fetchWithTimeout('/api/alerts', { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los avisos.'))
      setAlerts((json.data as AlertRow[]) ?? [])
      hasLoadedOnce.current = true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error al cargar los avisos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAlerts() }, [loadAlerts])

  const unreadCount = alerts.filter(alert => !alert.is_read).length
  const readCount = alerts.length - unreadCount
  const criticalUnreadCount = alerts.filter(alert => !alert.is_read && alert.alert_type === 'CRITICAL').length
  const filtered = useMemo(() => {
    return filterAlertRows(alerts, { type: typeFilter, read: readFilter, module: moduleFilter, query })
  }, [alerts, moduleFilter, query, readFilter, typeFilter])

  const resetFilters = useCallback(() => {
    setQuery('')
    setTypeFilter('all')
    setModuleFilter('all')
    setReadFilter('all')
  }, [])

  const hasActiveFilters = typeFilter !== 'all' || moduleFilter !== 'all' || readFilter !== 'all' || query.trim().length > 0

  const handleToggleRead = useCallback(async (id: string, next: boolean) => {
    setBusyId(id)
    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_read: next }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el aviso.'))
      setAlerts(previous => previous.map(alert => alert.id === id ? { ...alert, is_read: next } : alert))
    } catch (caught) {
      toast.error('No se pudo actualizar el aviso', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setBusyId(null)
    }
  }, [toast])

  const handleDelete = useCallback(async (id: string) => {
    setBusyId(id)
    try {
      const response = await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 204) {
        const json = await response.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el aviso.'))
      }
      setAlerts(previous => previous.filter(alert => alert.id !== id))
      toast.success('Aviso eliminado', undefined, { persist: false })
    } catch (caught) {
      toast.error('No se pudo eliminar el aviso', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setBusyId(null)
    }
  }, [toast])

  const handleMarkAllRead = useCallback(async () => {
    const unread = alerts.filter(alert => !alert.is_read)
    if (!unread.length) return
    setBulkBusy(true)
    const result = await markAlertsReadIndividually(unread, async id => {
      try {
        const response = await fetch(`/api/alerts/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_read: true }),
        })
        const json = await response.json().catch(() => null)
        return response.ok && json?.ok === true
      } catch {
        return false
      }
    })
    if (result.confirmedIds.length) {
      const confirmed = new Set(result.confirmedIds)
      setAlerts(previous => previous.map(alert => confirmed.has(alert.id) ? { ...alert, is_read: true } : alert))
    }
    if (result.failedIds.length) {
      toast.error('Lectura parcial', `${result.confirmedIds.length} confirmado(s) · ${result.failedIds.length} pendiente(s). Puedes reintentar los que siguen sin leerse.`)
    } else {
      toast.success(`${result.confirmedIds.length} aviso(s) marcado(s) como leídos`, undefined, { persist: false })
    }
    setBulkBusy(false)
  }, [alerts, toast])

  const handleDeleteRead = useCallback(async () => {
    setBulkBusy(true)
    try {
      const response = await fetch('/api/alerts', { method: 'DELETE' })
      if (!response.ok && response.status !== 204) {
        const json = await response.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudieron eliminar los avisos leídos.'))
      }
      setAlerts(previous => previous.filter(alert => !alert.is_read))
      setDeleteReadConfirmOpen(false)
      toast.success(`${readCount} aviso(s) leído(s) eliminado(s)`, undefined, { persist: false })
    } catch (caught) {
      toast.error('No se pudieron eliminar los avisos', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
    } finally {
      setBulkBusy(false)
    }
  }, [readCount, toast])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/alerts/generate', { method: 'POST' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudieron actualizar los avisos.'))
      const { created, skipped } = json.data as { created: number; skipped: number }
      toast.success('Avisos actualizados', `${created} nuevo(s) · ${skipped} ya existente(s)`, { persist: false })
      await loadAlerts()
    } catch (caught) {
      toast.error('No se pudieron actualizar los avisos', caught instanceof Error ? caught.message : 'Inténtalo nuevamente.')
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

  const rowsGridClass = styles.alertGrid
  const originModuleOptions = [
    { value: 'all', label: 'Todos los módulos' },
    { value: 'credits', label: moduleLabel('credits') },
    { value: 'budgets', label: moduleLabel('budgets') },
    { value: 'receivables', label: moduleLabel('receivables') },
    { value: 'payables', label: moduleLabel('payables') },
    { value: 'recurring', label: moduleLabel('recurring') },
    { value: 'alerts', label: moduleLabel('alerts') },
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

  return (
    <>
      <PageLayout className={`max-w-none !gap-0 ${movementStyles.v3ModuleContent} ${styles.page}`}>
        <div className={movementStyles.pageOverview} data-testid="alerts-page-overview">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 data-ft-route-heading="" tabIndex={-1} className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">Avisos</h1>
              <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">Revisa vencimientos, recordatorios y avisos relacionados con tus finanzas.</p>
            </div>
            <div className={styles.headerActions}>
              <Button type="button" onClick={() => void handleRefresh()} variant="secondary" size="sm" loading={refreshing} className={styles.headerSecondaryAction} testId="alerts-refresh-button">
                Actualizar
              </Button>
              <CreateModuleButton onClick={() => { resetManualAlertForm(); setShowCreateModal(true) }} label="Nuevo aviso" className={movementStyles.v3ModulePrimaryAction} testId="alerts-create-button" />
            </div>
          </header>
          <section className={movementStyles.summary} aria-label="Resumen de avisos">
            <div className={movementStyles.summaryItem}>
              <p>No leídos</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>{loading && alerts.length === 0 ? '—' : unreadCount}</div>
              <span className={movementStyles.summaryDetail}>Pendientes de revisión</span>
            </div>
            <div className={movementStyles.summaryItem}>
              <p>Críticos no leídos</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>{loading && alerts.length === 0 ? '—' : criticalUnreadCount}</div>
              <span className={movementStyles.summaryDetail}>Según severidad registrada</span>
            </div>
            <div className={`${movementStyles.summaryItem} ${movementStyles.summaryQualitative}`}>
              <p>Leídos</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>{loading && alerts.length === 0 ? '—' : readCount}</div>
              <span className={movementStyles.summaryDetail}>Leer un aviso no cambia el estado financiero relacionado</span>
            </div>
          </section>
        </div>

        <nav className={`${movementStyles.tabs} ${styles.statusTabs}`} aria-label="Estado de avisos" data-testid="alerts-status-tabs">
          {([
            ['unread', 'No leídos', unreadCount],
            ['read', 'Leídos', readCount],
            ['all', 'Todos', alerts.length],
          ] as const).map(([value, label, count]) => (
            <button key={value} type="button" aria-pressed={readFilter === value} onClick={() => setReadFilter(value)} className={styles.statusTab} data-active={readFilter === value}>
              {label}<span className={styles.tabCount}>{count}</span>
            </button>
          ))}
        </nav>

        <div className={`${movementStyles.controls} ${movementStyles.portfolioFilterBar} ${styles.filterToolbar}`} data-testid="alerts-filter-toolbar">
          <div className={`${movementStyles.controlsMain} ${styles.filterToolbarMain}`}>
            <div className={`${movementStyles.searchControl} ${styles.searchControl}`}>
              <DataSearchField value={query} onChange={setQuery} placeholder="Buscar por título, detalle o módulo" aria-label="Buscar avisos" data-testid="alerts-search" className={styles.searchInput} />
            </div>
            <AlertFilters typeFilter={typeFilter} moduleFilter={moduleFilter} onTypeChange={setTypeFilter} onModuleChange={setModuleFilter} originModuleOptions={originModuleOptions} />
          </div>
          <div className={`${movementStyles.controlsActions} ${styles.bulkActions}`}>
            <Button type="button" variant="secondary" size="sm" disabled={bulkBusy || unreadCount === 0} onClick={() => void handleMarkAllRead()} testId="alerts-mark-all-read-button">Marcar todos como leídos</Button>
            <Button type="button" variant="danger" size="sm" disabled={bulkBusy || readCount === 0} onClick={() => setDeleteReadConfirmOpen(true)} testId="alerts-delete-read-button">Eliminar leídos</Button>
          </div>
        </div>

        {error ? <DataErrorBanner message={error} onRetry={() => void loadAlerts()} /> : null}

        {error && alerts.length === 0 ? null : <section className={styles.register} aria-labelledby="alerts-register-title" data-testid="alerts-register">
          <div className={styles.registerHeader}>
            <div className="min-w-0">
              <h2 id="alerts-register-title">Avisos financieros</h2>
              <p>{loading && alerts.length === 0 ? 'Cargando avisos…' : `${filtered.length} de ${alerts.length} aviso(s)`}</p>
            </div>
            {hasActiveFilters ? <Button type="button" onClick={resetFilters} variant="ghost" size="sm">Limpiar filtros</Button> : null}
          </div>

          {loading && alerts.length === 0 ? (
            <div className={styles.loadingRows} aria-label="Cargando avisos" aria-busy="true">
              {[0, 1, 2, 3].map(index => <div className={styles.loadingRow} key={index} aria-hidden="true"><span /><span /><span /></div>)}
            </div>
          ) : error && alerts.length === 0 ? null : filtered.length === 0 ? (
            <EmptyState compact title={hasActiveFilters ? 'No hay avisos con estos filtros.' : 'No hay avisos en esta vista.'} description={hasActiveFilters ? 'Prueba otra búsqueda, severidad o módulo de origen.' : 'Los avisos generados o guardados manualmente aparecerán aquí.'} action={hasActiveFilters ? <Button type="button" onClick={resetFilters} variant="secondary" size="md">Limpiar filtros</Button> : null} />
          ) : (
            <>
              <div className={`${styles.tableHeading} ${rowsGridClass}`} aria-hidden="true">
                <span>Severidad</span><span>Aviso</span><span>Origen</span><span>Fecha</span><span>Estado</span><span className="text-right">Acciones</span>
              </div>
              <div className={styles.rows}>
                {filtered.map(alert => {
                  const actions: AnchoredAction[] = [{
                    id: 'delete', label: 'Eliminar aviso', destructive: true, disabled: busyId === alert.id || bulkBusy,
                    onSelect: () => void handleDelete(alert.id),
                  }]
                  return <AlertCard key={alert.id} {...alert} dateLabel={formatAlertDate(alert.created_at)} href={isValidAlertHref(alert.href) ? alert.href : null} busy={busyId === alert.id || bulkBusy} actions={actions} onToggleRead={(id, next) => void handleToggleRead(id, next)} />
                })}
              </div>
            </>
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
          El aviso se guarda manualmente. El canal y el umbral, si se completan, quedan como metadatos de referencia; no activan reglas ni envíos automáticos.
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
    </>
  )
}
