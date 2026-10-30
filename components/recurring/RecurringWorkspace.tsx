'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { useToast } from '@/lib/toast/toast'
import { AnchoredActionMenu } from '@/components/ui/AnchoredActionMenu'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { RecordModal } from '@/components/ui/RecordModal'
import {
  ConfirmDialog,
  DataErrorBanner,
  DataSearchField,
  DataTable,
  EmptyState,
  StatusBadge,
  PageLayout,
} from '@/components/finance'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'
import {
  RecurringCreateForm,
  RecurringForm,
  type RecurringRow,
  recurringTypeTone,
  TYPE_LABELS,
} from './RecurringForm'
import styles from './RecurringWorkspace.module.css'
import { getRecurringOperation, matchesRecurringTab, recurringUseHref, summarizeRecurringRows } from '@/modules/recurring/recurring-presentation'

type TypeFilter = 'all' | 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'RECEIVABLE' | 'PAYABLE' | 'UNKNOWN'
type TabFilter = 'all' | 'incoming' | 'outgoing' | 'transfer' | 'other'
type StatusFilter = 'all' | 'active' | 'inactive'

const TYPE_FILTER_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'INCOME', label: 'Ingresos' },
  { value: 'EXPENSE', label: 'Egresos' },
  { value: 'TRANSFER', label: 'Transferencias' },
  { value: 'RECEIVABLE', label: 'Prestar dinero' },
  { value: 'PAYABLE', label: 'Recibir préstamo' },
  { value: 'UNKNOWN', label: 'Otro tipo no clasificado' },
]

function formatRecurringAmount(amount: number, currency: string) {
  if (currency === 'PEN' || currency === 'USD') return formatCurrency(amount, currency)
  return `${currency || 'Moneda no verificable'} ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`
}

function recurringAccountLabel(row: RecurringRow) {
  if (getRecurringOperation(row) === 'TRANSFER') {
    if (row.source_account?.name && row.destination_account?.name) {
      return `${row.source_account.name} -> ${row.destination_account.name}`
    }

    return row.source_account?.name ?? row.destination_account?.name ?? 'Transferencia sin cuentas completas'
  }

  return row.source_account?.name ?? row.destination_account?.name ?? 'Sin cuenta vinculada'
}

function recurringAccountMeta(row: RecurringRow) {
  if (getRecurringOperation(row) === 'TRANSFER') {
    if (row.destination_account?.currency && row.destination_account.currency !== row.currency) {
      return `${row.currency} -> ${row.destination_account.currency}`
    }

    return row.currency
  }

  const counterpart = row.recipient ?? row.sender
  return counterpart?.trim() || row.category?.name || row.currency
}

function recurringDescription(row: RecurringRow) {
  return row.description?.trim() || row.notes?.trim() || 'Sin descripción'
}

function useIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function typeToneFor(row: RecurringRow) {
  const operation = getRecurringOperation(row)
  return operation === 'UNKNOWN' ? 'muted' : recurringTypeTone(operation)
}

function toNextUrl(pathname: string, params: URLSearchParams): string {
  const qs = params.toString()
  return qs.length > 0 ? `${pathname}?${qs}` : pathname
}

export function RecurringWorkspace() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [rows, setRows] = useState<RecurringRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [portfolioId, setPortfolioId] = useState('')
  const [tabFilter, setTabFilter] = useState<TabFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [editTarget, setEditTarget] = useState<RecurringRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecurringRow | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createDirty, setCreateDirty] = useState(false)
  const [editDirty, setEditDirty] = useState(false)
  const [discardTarget, setDiscardTarget] = useState<'create' | 'edit' | null>(null)
  const [createBusy, setCreateBusy] = useState(false)
  const [editBusy, setEditBusy] = useState(false)
  const [formReady, setFormReady] = useState(false)
  const handledCreateRef = useRef(false)

  const openFromQuery = searchParams.get('new') === 'template'

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetchWithTimeout('/api/recurring', { cache: 'no-store' })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las recurrentes'))
      }

      setRows((json.data as RecurringRow[]) ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el modulo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const clearQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [pathname, router, searchParams])

  const openCreateModal = useCallback(() => {
    setIsCreateOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('new', 'template')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [pathname, router, searchParams])

  const closeCreateModal = useCallback(() => {
    setIsCreateOpen(false)
    setCreateDirty(false)
    setDiscardTarget(null)
    clearQuery()
  }, [clearQuery])

  const requestCloseCreate = useCallback(() => {
    if (createBusy) return
    if (createDirty) setDiscardTarget('create')
    else closeCreateModal()
  }, [closeCreateModal, createBusy, createDirty])

  const requestCloseEdit = useCallback(() => {
    if (editBusy) return
    if (editDirty) setDiscardTarget('edit')
    else {
      setEditTarget(null)
      setEditDirty(false)
    }
  }, [editBusy, editDirty])

  const openEdit = useCallback((row: RecurringRow) => {
    setEditDirty(false)
    setEditTarget(row)
  }, [])

  const confirmDiscard = useCallback(() => {
    if (discardTarget === 'create') closeCreateModal()
    if (discardTarget === 'edit') {
      setEditTarget(null)
      setEditDirty(false)
    }
    setDiscardTarget(null)
  }, [closeCreateModal, discardTarget])

  useEffect(() => {
    if (openFromQuery) {
      if (handledCreateRef.current) return
      handledCreateRef.current = true
      setIsCreateOpen(true)
      return
    }

    handledCreateRef.current = false
  }, [openFromQuery])

  const portfolioOptions = useMemo(() => {
    const seen = new Map<string, string>()

    rows.forEach(row => {
      if (row.source_account?.id) seen.set(row.source_account.id, row.source_account.name)
      if (row.destination_account?.id) seen.set(row.destination_account.id, row.destination_account.name)
    })

    return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }))
  }, [rows])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows.filter(row => {
      const operation = getRecurringOperation(row)
      if (!matchesRecurringTab(operation, tabFilter)) return false
      if (typeFilter !== 'all' && operation !== typeFilter) return false
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false
      if (portfolioId && row.source_account_id !== portfolioId && row.destination_account_id !== portfolioId) return false
      if (!query) return true

      const haystack = [
        row.name,
        row.description,
        row.notes,
        row.category?.name,
        row.source_account?.name,
        row.destination_account?.name,
        row.recipient,
        row.sender,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [portfolioId, rows, search, statusFilter, tabFilter, typeFilter])

  const counts = useMemo(() => summarizeRecurringRows(rows), [rows])
  const unknownCount = counts.other

  const handleUse = useCallback((row: RecurringRow) => {
    const href = recurringUseHref(row)
    if (href) router.push(href)
  }, [router])

  const handleEditSuccess = useCallback((updated: RecurringRow) => {
    setRows(previous =>
      previous.map(row => (row.id === updated.id ? { ...row, ...updated } : row)),
    )
    setEditTarget(null)
    setEditDirty(false)
  }, [])

  const handleCreateSuccess = useCallback(async (createdName: string) => {
    toast.success('Plantilla creada', createdName, { persist: false })
    setIsCreateOpen(false)
    setCreateDirty(false)
    clearQuery()
    await loadRows()
  }, [clearQuery, loadRows, toast])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return

    setBusyId(deleteTarget.id)

    try {
      const res = await fetch(`/api/recurring/${deleteTarget.id}`, { method: 'DELETE' })

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar la recurrente'))
      }

      setRows(previous => previous.filter(row => row.id !== deleteTarget.id))
      toast.success(
        'Plantilla eliminada',
        'Las transacciones ya generadas permanecen intactas.',
        { persist: false },
      )
      setDeleteTarget(null)
    } catch (deleteError) {
      toast.error(
        'No se pudo eliminar',
        deleteError instanceof Error ? deleteError.message : 'Intentalo nuevamente.',
      )
    } finally {
      setBusyId(null)
    }
  }, [deleteTarget, toast])

  const clearFilters = useCallback(() => {
    setSearch('')
    setTypeFilter('all')
    setPortfolioId('')
    setStatusFilter('all')
    setTabFilter('all')
  }, [])

  const hasFilters = search.length > 0 || typeFilter !== 'all' || portfolioId.length > 0 || statusFilter !== 'all' || tabFilter !== 'all'
  const summaryReady = !loading && !error

  return (
    <>
      <PageLayout className={`max-w-none !gap-0 ${movementStyles.v3ModuleContent}`}>
        <div className={movementStyles.pageOverview} data-testid="recurring-page-overview">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 data-ft-route-heading="" tabIndex={-1} className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">Plantillas</h1>
              <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">Reutiliza un movimiento y revisa los datos antes de registrarlo.</p>
            </div>
            <CreateModuleButton
              onClick={openCreateModal}
              label="Crear plantilla"
              className={movementStyles.v3ModulePrimaryAction}
              testId="recurring-create-button"
            />
          </header>

          <section className={movementStyles.summary} aria-label="Resumen de plantillas" data-testid="recurring-summary">
            <div className={movementStyles.summaryItem}>
              <p>Plantillas disponibles</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>{summaryReady ? counts.active : '—'}</div>
              <span className={movementStyles.summaryDetail}>{summaryReady ? `${counts.inactive} inactivas` : error ? 'Resumen no disponible' : 'Cargando resumen'}</span>
            </div>
            <div className={movementStyles.summaryItem}>
              <p>Entradas y salidas</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>{summaryReady ? `${counts.incoming} / ${counts.outgoing}` : '—'}</div>
              <span className={movementStyles.summaryDetail}>Ingresos · préstamos recibidos / egresos · dinero prestado</span>
            </div>
            <div className={movementStyles.summaryItem}>
              <p>Transferencias y otros</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>{summaryReady ? `${counts.transfers + counts.other}` : '—'}</div>
              <span className={movementStyles.summaryDetail}>{summaryReady ? `${counts.transfers} transferencias · ${counts.other} sin clasificar` : error ? 'Resumen no disponible' : 'Cargando resumen'}</span>
            </div>
          </section>
        </div>

        <nav aria-label="Filtrar plantillas por operación" className={styles.tabs} data-testid="recurring-operation-tabs">
          <button type="button" className={styles.tab} data-active={tabFilter === 'all'} aria-pressed={tabFilter === 'all'} onClick={() => setTabFilter('all')}>Todas</button>
          <button type="button" className={styles.tab} data-active={tabFilter === 'incoming'} aria-pressed={tabFilter === 'incoming'} onClick={() => setTabFilter('incoming')}>Ingresos y préstamos recibidos</button>
          <button type="button" className={styles.tab} data-active={tabFilter === 'outgoing'} aria-pressed={tabFilter === 'outgoing'} onClick={() => setTabFilter('outgoing')}>Egresos y dinero prestado</button>
          <button type="button" className={styles.tab} data-active={tabFilter === 'transfer'} aria-pressed={tabFilter === 'transfer'} onClick={() => setTabFilter('transfer')}>Transferencias</button>
          {unknownCount > 0 ? <button type="button" className={styles.tab} data-active={tabFilter === 'other'} aria-pressed={tabFilter === 'other'} onClick={() => setTabFilter('other')}>Otras operaciones</button> : null}
        </nav>

        <div className={`${styles.toolbar} ${movementStyles.controls} ${movementStyles.portfolioFilterBar}`} data-testid="recurring-filter-toolbar">
          <div className={styles.toolbarMain}>
            <div className={styles.search}>
              <DataSearchField value={search} onChange={setSearch} placeholder="Buscar plantilla, descripción o cuenta" aria-label="Buscar plantillas" data-testid="recurring-search" />
            </div>
            <AppSelect
              value={typeFilter}
              onChange={value => setTypeFilter(value as TypeFilter)}
              compact
              matchTriggerWidth
              searchable={false}
              className={`filters-control ${styles.typeFilter}`}
              ariaLabel="Filtrar por tipo de operación"
              options={TYPE_FILTER_OPTIONS}
            />
            <AppSelect
              value={portfolioId}
              onChange={setPortfolioId}
              compact
              matchTriggerWidth
              searchable
              className={`filters-control ${styles.accountFilter}`}
              ariaLabel="Filtrar por cuenta"
              options={[{ value: '', label: 'Todas las cuentas' }, ...portfolioOptions]}
              searchPlaceholder="Buscar cuenta..."
            />
            <AppSelect
              value={statusFilter}
              onChange={value => setStatusFilter(value as StatusFilter)}
              compact
              matchTriggerWidth
              searchable={false}
              className={`filters-control ${styles.statusFilter}`}
              ariaLabel="Filtrar por estado"
              options={[{ value: 'all', label: 'Todos los estados' }, { value: 'active', label: 'Disponibles' }, { value: 'inactive', label: 'Inactivas' }]}
            />
          </div>
        </div>

        {error ? <DataErrorBanner message={error} onRetry={loadRows} /> : null}

        {loading ? (
          <div className={styles.table} aria-label="Cargando plantillas" data-testid="recurring-loading">
            {[0, 1, 2].map(item => <div className={styles.skeletonRow} key={item} aria-hidden="true">{[0, 1, 2, 3, 4].map(cell => <span key={cell} />)}</div>)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No encontramos plantillas para esos filtros.' : 'Todavía no tienes plantillas guardadas.'}
            description={hasFilters
              ? 'Ajusta la búsqueda o los filtros para volver a ver las plantillas.'
              : 'Guarda una operación frecuente como plantilla y revísala cada vez antes de registrarla. No se ejecutan movimientos automáticamente.'}
            action={hasFilters
              ? { label: 'Limpiar filtros', onClick: clearFilters }
              : { label: 'Crear plantilla', onClick: openCreateModal }}
          />
        ) : (
          <DataTable className={styles.table}>
            <div role="table" aria-label="Plantillas guardadas">
              <div className={styles.tableHeader} role="row">
                <span role="columnheader">Plantilla</span><span role="columnheader">Tipo / cuenta</span><span role="columnheader" className="text-right">Importe</span><span role="columnheader">Estado</span><span role="columnheader" className="text-right">Acciones</span>
              </div>
              <div role="rowgroup">
                {filtered.map(row => (
                  <RecurringListRow
                    key={row.id}
                    row={row}
                    busy={busyId === row.id}
                    onUse={handleUse}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </div>
          </DataTable>
        )}
      </PageLayout>

      <RecordModal
        open={isCreateOpen}
        testId="recurring-create-modal"
        onClose={requestCloseCreate}
        eyebrow="Plantillas"
        title="Crear plantilla"
        subtitle="Guarda los datos de referencia; revisarás y confirmarás cada movimiento al usarla."
        presentation="workbench"
        size="lg"
        overlayClassName={`z-modal ${movementStyles.formOverlay}`}
        focusTrapActive={discardTarget !== 'create'}
        preserveFocusOnResume
        footer={(
          <div className="flex w-full justify-end gap-3">
            <Button type="button" variant="secondary" onClick={requestCloseCreate} disabled={createBusy}>Cancelar</Button>
            <Button type="submit" form="recurring-create-form" variant="primary" loading={createBusy} disabled={createBusy || !formReady}>Crear plantilla</Button>
          </div>
        )}
      >
        <RecurringCreateForm
          onSuccess={handleCreateSuccess}
          onDirtyChange={setCreateDirty}
          onBusyChange={setCreateBusy}
          onReadyChange={setFormReady}
        />
      </RecordModal>

      <RecordModal
        open={Boolean(editTarget)}
        testId="recurring-edit-modal"
        onClose={requestCloseEdit}
        eyebrow="Plantillas"
        title="Editar plantilla"
        subtitle="Actualiza el nombre y el contexto; los datos financieros originales permanecen protegidos."
        presentation="workbench"
        size="lg"
        overlayClassName={`z-modal ${styles.editWorkbenchOverlay}`}
        focusTrapActive={discardTarget !== 'edit'}
        preserveFocusOnResume
        footer={(
          <div className="flex w-full justify-end gap-3">
            <Button type="button" variant="secondary" onClick={requestCloseEdit} disabled={editBusy}>Cancelar</Button>
            <Button type="submit" form="recurring-edit-form" variant="primary" loading={editBusy} disabled={editBusy}>Guardar cambios</Button>
          </div>
        )}
      >
        {editTarget ? (
          <RecurringForm
            recurring={editTarget}
            onSuccess={handleEditSuccess}
            onDirtyChange={setEditDirty}
            onBusyChange={setEditBusy}
          />
        ) : null}
      </RecordModal>

      <ConfirmDialog
        open={Boolean(discardTarget)}
        title="Descartar cambios"
        message="Hay cambios sin guardar en esta plantilla. ¿Quieres cerrar sin conservarlos?"
        onCancel={() => setDiscardTarget(null)}
        onConfirm={confirmDiscard}
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar plantilla recurrente"
        message={(
          <>
            Se eliminara <span className="font-semibold text-[var(--c-text)]">{deleteTarget?.name}</span>.
            Las transacciones ya registradas desde esta plantilla no se veran afectadas.
          </>
        )}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!busyId) setDeleteTarget(null)
        }}
        loading={deleteTarget ? busyId === deleteTarget.id : false}
        danger
        confirmLabel="Eliminar"
      />
    </>
  )
}

function RecurringListRow({
  row,
  busy,
  onUse,
  onEdit,
  onDelete,
}: {
  row: RecurringRow
  busy: boolean
  onUse: (row: RecurringRow) => void
  onEdit: (row: RecurringRow) => void
  onDelete: (row: RecurringRow) => void
}) {
  const operation = getRecurringOperation(row)
  const tone = typeToneFor(row)
  const knownOperation = operation !== 'UNKNOWN'
  const label = knownOperation ? TYPE_LABELS[operation] : 'Tipo no clasificado'

  return (
    <article
      className={styles.row}
      role="row"
      data-busy={busy ? 'true' : undefined}
      data-testid={`recurring-row-${row.id}`}
    >
      <div className={styles.identity} role="cell">
        <span className={styles.mobileLabel}>Plantilla</span>
        <p className={styles.identityName}>{row.name}</p>
        <p className={styles.identityDescription}>{recurringDescription(row)}</p>
      </div>

      <div className={styles.operation} role="cell">
        <span className={styles.mobileLabel}>Tipo / cuenta</span>
        <div className="flex min-w-0 items-center gap-2">
          <StatusBadge tone={tone} dot={false}>{label}</StatusBadge>
          {row.category?.name ? <span className="truncate text-[11px] text-[var(--ft-text-muted)]">{row.category.name}</span> : null}
        </div>
        <p className={styles.operationPrimary}>{recurringAccountLabel(row)}</p>
        <p className={styles.operationMeta}>{recurringAccountMeta(row)}</p>
      </div>

      <div className={styles.amount} role="cell">
        <span className={styles.mobileLabel}>Importe</span>
        <p className={styles.amountValue}>{formatRecurringAmount(row.amount, row.currency)}</p>
        <p className={styles.amountMeta}>{row.currency || 'Moneda no verificable'}</p>
      </div>

      <div className={styles.status} role="cell">
        <span className={styles.mobileLabel}>Estado</span>
        <StatusBadge tone={row.is_active ? 'success' : 'muted'}>{row.is_active ? 'Disponible' : 'Inactiva'}</StatusBadge>
      </div>

      <div className={styles.actions} role="cell">
        <Button
          type="button"
          onClick={() => onUse(row)}
          variant="primary"
          size="sm"
          leadingIcon={useIcon()}
          className={styles.useAction}
          disabled={busy || !row.is_active || !knownOperation}
          title={!knownOperation ? 'No se puede reutilizar un tipo de operación no reconocido' : !row.is_active ? 'Activa la plantilla para poder usarla' : undefined}
          testId={`recurring-use-${row.id}`}
        >
          Usar plantilla
        </Button>
        <AnchoredActionMenu
          label={`Más acciones de ${row.name}`}
          triggerContent={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>}
          className="h-8 w-8 rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]"
          disabled={busy}
          align="end"
          actions={[
            { id: 'edit', label: 'Editar plantilla', onSelect: () => onEdit(row) },
            { id: 'delete', label: 'Eliminar plantilla', destructive: true, onSelect: () => onDelete(row) },
          ]}
        />
      </div>
    </article>
  )
}
