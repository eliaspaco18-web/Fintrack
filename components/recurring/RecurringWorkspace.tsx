'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { useToast } from '@/lib/toast/toast'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { RecordModal } from '@/components/ui/RecordModal'
import { ViewToggle, type ViewMode } from '@/components/ui/ViewToggle'
import {
  AmountCell,
  ConfirmDialog,
  ControlsBar,
  DataErrorBanner,
  DataSearchField,
  DataTable,
  EmptyState,
  FilterBar,
  RegisterModule,
  StatCard,
  StatGrid,
  StatusBadge,
} from '@/components/finance'
import {
  RecurringCreateForm,
  RecurringForm,
  type RecurringRow,
  recurringTypeIcon,
  recurringTypeTone,
  TYPE_LABELS,
} from './RecurringForm'

type TypeFilter = 'all' | 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'RECEIVABLE' | 'PAYABLE'

const TYPE_FILTER_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'Todos los flujos' },
  { value: 'INCOME', label: 'Ingresos' },
  { value: 'EXPENSE', label: 'Egresos' },
  { value: 'TRANSFER', label: 'Transferencias' },
  { value: 'RECEIVABLE', label: 'Por cobrar' },
  { value: 'PAYABLE', label: 'Por pagar' },
]

function normalizeCurrency(currency: string): 'PEN' | 'USD' {
  return currency === 'USD' ? 'USD' : 'PEN'
}

function formatRecurringAmount(amount: number, currency: string) {
  return formatCurrency(amount, normalizeCurrency(currency))
}

function recurringAccountLabel(row: RecurringRow) {
  if (row.type === 'TRANSFER') {
    if (row.source_account?.name && row.destination_account?.name) {
      return `${row.source_account.name} -> ${row.destination_account.name}`
    }

    return row.source_account?.name ?? row.destination_account?.name ?? 'Transferencia sin cuentas completas'
  }

  return row.source_account?.name ?? row.destination_account?.name ?? 'Sin cuenta vinculada'
}

function recurringAccountMeta(row: RecurringRow) {
  if (row.type === 'TRANSFER') {
    if (row.destination_account?.currency && row.destination_account.currency !== row.currency) {
      return `${row.currency} -> ${row.destination_account.currency}`
    }

    return row.currency
  }

  const counterpart = row.recipient ?? row.sender
  return counterpart?.trim() || row.category?.name || row.currency
}

function recurringDescription(row: RecurringRow) {
  return row.description?.trim() || row.notes?.trim() || 'Plantilla lista para reutilizar en el registro de movimientos.'
}

function recurringCreatedAt(row: RecurringRow) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(row.created_at))
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

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [portfolioId, setPortfolioId] = useState('')

  const [editTarget, setEditTarget] = useState<RecurringRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecurringRow | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
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
    clearQuery()
  }, [clearQuery])

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
      if (row.source_account?.id) {
        seen.set(row.source_account.id, row.source_account.name)
      }
    })

    return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }))
  }, [rows])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows.filter(row => {
      if (typeFilter !== 'all' && row.type !== typeFilter) return false
      if (portfolioId && row.source_account_id !== portfolioId) return false
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
  }, [portfolioId, rows, search, typeFilter])

  const incomingCount = useMemo(
    () => rows.filter(row => row.type === 'INCOME' || row.type === 'RECEIVABLE').length,
    [rows],
  )

  const outgoingCount = useMemo(
    () => rows.filter(row => row.type === 'EXPENSE' || row.type === 'PAYABLE').length,
    [rows],
  )

  const transferCount = useMemo(
    () => rows.filter(row => row.type === 'TRANSFER').length,
    [rows],
  )

  const connectedAccounts = useMemo(() => {
    const accountIds = new Set<string>()

    rows.forEach(row => {
      if (row.source_account?.id) accountIds.add(row.source_account.id)
      if (row.destination_account?.id) accountIds.add(row.destination_account.id)
    })

    return accountIds.size
  }, [rows])

  const handleUse = useCallback((row: RecurringRow) => {
    const params = new URLSearchParams({
      from_recurring: row.id,
      type: row.type,
    })

    router.push(`/transactions/new?${params.toString()}`)
  }, [router])

  const handleEditSuccess = useCallback((updated: RecurringRow) => {
    setRows(previous =>
      previous.map(row => (row.id === updated.id ? { ...row, ...updated } : row)),
    )
    setEditTarget(null)
  }, [])

  const handleCreateSuccess = useCallback(async (createdName: string) => {
    toast.success('Plantilla creada', createdName, { persist: false })
    setIsCreateOpen(false)
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
  }, [])

  const hasFilters = search.length > 0 || typeFilter !== 'all' || portfolioId.length > 0

  return (
    <>
      <RegisterModule
        eyebrow="Plantillas operativas"
        title="Recurrentes"
        description="Centraliza las plantillas guardadas para volver a registrar movimientos frecuentes sin romper el contexto financiero del libro."
        headerMode="content"
        actions={(
          <CreateModuleButton
            href="/recurring?new=template"
            label="Nuevo recurrente"
          />
        )}
        stats={(
          <StatGrid>
            <StatCard
              label="Plantillas activas"
              value={String(rows.length)}
              detail={connectedAccounts > 0 ? `${connectedAccounts} cuentas` : 'Sin cuentas'}
              caption="Base reusable para pagos, cobros y movimientos internos."
            />
            <StatCard
              label="Entradas esperadas"
              value={String(incomingCount)}
              detail={incomingCount === 0 ? 'Sin ingresos' : 'Ingresos y cobros'}
              caption="Plantillas destinadas a entradas de efectivo o recuperaciones pendientes."
            />
            <StatCard
              label="Salidas programadas"
              value={String(outgoingCount)}
              detail={outgoingCount === 0 ? 'Sin egresos' : 'Pagos y obligaciones'}
              caption="Compromisos operativos listos para reutilizar cuando toque ejecutarlos."
            />
            <StatCard
              label="Transferencias internas"
              value={String(transferCount)}
              detail={transferCount === 0 ? 'Sin traslados' : 'Fondos entre cuentas'}
              caption="Plantillas para mover liquidez entre portafolios o monedas."
            />
          </StatGrid>
        )}
        controls={(
          <ControlsBar
            search={(
              <DataSearchField
                value={search}
                onChange={setSearch}
                placeholder="Buscar plantilla, cuenta o categoria"
              />
            )}
            filters={(
              <FilterBar>
                <AppSelect
                  value={typeFilter}
                  onChange={value => setTypeFilter(value as TypeFilter)}
                  compact
                  searchable={false}
                  className="w-[210px]"
                  options={TYPE_FILTER_OPTIONS}
                />
                <AppSelect
                  value={portfolioId}
                  onChange={setPortfolioId}
                  compact
                  className="w-[220px]"
                  options={[
                    { value: '', label: 'Todas las cuentas' },
                    ...portfolioOptions,
                  ]}
                  searchPlaceholder="Buscar cuenta..."
                />
              </FilterBar>
            )}
            viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} id="recurring-view-toggle" />}
            actions={(
              <StatusBadge tone="muted" dot={false}>
                {filtered.length} plantilla{filtered.length === 1 ? '' : 's'}
              </StatusBadge>
            )}
          />
        )}
      >
        {error ? <DataErrorBanner message={error} onRetry={loadRows} /> : null}

        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map(item => (
              <div
                key={item}
                className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4"
              >
                <div className="flex animate-pulse items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded-full bg-[var(--c-surface-2)]" />
                    <div className="h-5 w-56 rounded-full bg-[var(--c-surface-2)]" />
                  </div>
                  <div className="h-10 w-32 rounded-full bg-[var(--c-surface-2)]" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={hasFilters
              ? 'No encontramos plantillas para esos filtros.'
              : 'Todavia no tienes recurrentes guardadas.'}
            description={hasFilters
              ? 'Ajusta el tipo, la cuenta o la busqueda para volver a ver las plantillas disponibles.'
              : 'Crea una transaccion nueva y marca la opcion de guardarla como recurrente para construir tu biblioteca operativa.'}
            action={hasFilters
              ? {
                  label: 'Limpiar filtros',
                  onClick: clearFilters,
                }
              : {
                  label: 'Nueva transacción',
                  href: '/transactions/new',
                }}
          />
        ) : viewMode === 'list' ? (
          <DataTable className="overflow-hidden">
            <div className="hidden border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 md:grid md:grid-cols-[minmax(0,1.45fr)_minmax(0,1.1fr)_minmax(180px,0.8fr)_auto] md:items-center md:gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Plantilla</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Flujo y cuenta</p>
              <p className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Monto</p>
              <p className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Acciones</p>
            </div>

            <div className="divide-y divide-[var(--c-border)]">
              {filtered.map(row => (
                <RecurringListRow
                  key={row.id}
                  row={row}
                  busy={busyId === row.id}
                  onUse={handleUse}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </DataTable>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(row => (
              <RecurringCard
                key={row.id}
                row={row}
                busy={busyId === row.id}
                onUse={handleUse}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </RegisterModule>

      <RecordModal
        open={isCreateOpen}
        onClose={closeCreateModal}
        eyebrow="Recurrentes"
        title="Nueva recurrencia"
        subtitle="Crea una plantilla operativa standalone manteniendo el cuerpo P5 en zonas paralelas y sin alterar la logica actual."
        widthClassName="w-[calc(100vw-32px)] max-w-[1080px]"
      >
        <RecurringCreateForm
          onSuccess={handleCreateSuccess}
          onCancel={closeCreateModal}
        />
      </RecordModal>

      <RecordModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        eyebrow="Recurrentes"
        title="Editar plantilla recurrente"
        subtitle="Ajusta el nombre operativo, la descripcion o las notas sin tocar la estructura original del movimiento."
        widthClassName="w-[calc(100vw-32px)] max-w-[860px]"
      >
        {editTarget ? (
          <RecurringForm
            recurring={editTarget}
            onSuccess={handleEditSuccess}
            onCancel={() => setEditTarget(null)}
          />
        ) : null}
      </RecordModal>

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
  const tone = recurringTypeTone(row.type)

  return (
    <article
      className={`px-4 py-4 transition-[background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--c-surface-2)] ${
        busy ? 'pointer-events-none opacity-50' : ''
      }`.trim()}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1.1fr)_minmax(180px,0.8fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border ${
              tone === 'success'
                ? 'border-[var(--c-success)]/15 bg-[var(--c-success-soft)] text-[var(--c-success)]'
                : tone === 'danger'
                  ? 'border-[var(--c-danger)]/15 bg-[var(--c-danger-soft)] text-[var(--c-danger)]'
                  : tone === 'warning'
                    ? 'border-[var(--c-warning)]/15 bg-[var(--c-warning-soft)] text-[var(--c-warning)]'
                    : 'border-[var(--c-info)]/15 bg-[var(--c-info-soft)] text-[var(--c-info)]'
            }`}>
              {recurringTypeIcon(row.type)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                {row.name}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--c-text-muted)]">
                {recurringDescription(row)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone={row.is_active ? 'success' : 'muted'}>
                  {row.is_active ? 'Activa' : 'Inactiva'}
                </StatusBadge>
                <StatusBadge tone={tone} dot={false}>
                  {TYPE_LABELS[row.type] ?? row.type}
                </StatusBadge>
                {row.category?.name ? (
                  <StatusBadge tone="muted" dot={false}>
                    {row.category.name}
                  </StatusBadge>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--c-text)]">
            {recurringAccountLabel(row)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
            {recurringAccountMeta(row)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--c-text-faint)]">
            Creada el {recurringCreatedAt(row)}
          </p>
        </div>

        <AmountCell
          label="Monto"
          value={formatRecurringAmount(row.amount, row.currency)}
          meta={normalizeCurrency(row.currency)}
          tone={tone === 'warning' ? 'warning' : tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'info'}
          className="md:justify-self-end"
        />

        <div className="flex shrink-0 items-center gap-2 md:justify-self-end">
          <Button
            type="button"
            onClick={() => onUse(row)}
            variant="success"
            size="sm"
            leadingIcon={useIcon()}
            className="shrink-0"
          >
            Usar
          </Button>
          <ActionIconButton
            icon="edit"
            label="Editar plantilla"
            disabled={busy}
            onClick={() => onEdit(row)}
          />
          <ActionIconButton
            icon="delete"
            label="Eliminar plantilla"
            variant="danger"
            disabled={busy}
            onClick={() => onDelete(row)}
          />
        </div>
      </div>
    </article>
  )
}

function RecurringCard({
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
  const tone = recurringTypeTone(row.type)

  return (
    <article className={busy ? 'pointer-events-none opacity-50' : ''}>
      <div className="rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1">
        <div className="rounded-[12px] bg-[var(--c-surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border ${
                tone === 'success'
                  ? 'border-[var(--c-success)]/15 bg-[var(--c-success-soft)] text-[var(--c-success)]'
                  : tone === 'danger'
                    ? 'border-[var(--c-danger)]/15 bg-[var(--c-danger-soft)] text-[var(--c-danger)]'
                    : tone === 'warning'
                      ? 'border-[var(--c-warning)]/15 bg-[var(--c-warning-soft)] text-[var(--c-warning)]'
                      : 'border-[var(--c-info)]/15 bg-[var(--c-info-soft)] text-[var(--c-info)]'
              }`}>
                {recurringTypeIcon(row.type)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                  {row.name}
                </p>
                <p className="mt-1 truncate text-[12px] text-[var(--c-text-muted)]">
                  {recurringAccountLabel(row)}
                </p>
              </div>
            </div>
            <StatusBadge tone={row.is_active ? 'success' : 'muted'}>
              {row.is_active ? 'Activa' : 'Inactiva'}
            </StatusBadge>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone} dot={false}>
              {TYPE_LABELS[row.type] ?? row.type}
            </StatusBadge>
            {row.category?.name ? (
              <StatusBadge tone="muted" dot={false}>
                {row.category.name}
              </StatusBadge>
            ) : null}
          </div>

          <div className="mt-5">
            <AmountCell
              label="Monto listo para usar"
              value={formatRecurringAmount(row.amount, row.currency)}
              meta={recurringAccountMeta(row)}
              align="left"
              tone={tone === 'warning' ? 'warning' : tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'info'}
            />
          </div>

          <p className="mt-4 text-[12px] leading-6 text-[var(--c-text-muted)]">
            {recurringDescription(row)}
          </p>

          <div className="mt-4 border-t border-[var(--c-border)] pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-[var(--c-text-faint)]">
                Creada el {recurringCreatedAt(row)}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  onClick={() => onUse(row)}
                  variant="success"
                  size="sm"
                  leadingIcon={useIcon()}
                >
                  Usar
                </Button>
                <ActionIconButton
                  icon="edit"
                  label="Editar plantilla"
                  disabled={busy}
                  onClick={() => onEdit(row)}
                />
                <ActionIconButton
                  icon="delete"
                  label="Eliminar plantilla"
                  variant="danger"
                  disabled={busy}
                  onClick={() => onDelete(row)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
