// =============================================================================
// components/management/AssetTypesManager.tsx
// PRD v3 — Módulo 10: Administración > Tipo de Activo
//
// Campos:
//   - Nombre de tipo de activo (obligatorio)
//   - Por defecto: Tecnología, Vehículo, Inmueble, Otro
//
// Acciones por registro: Editar, Eliminar (restricción), Desactivar/Activar
// =============================================================================

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/lib/toast/toast'
import { FormActions, FormField, FormSection, OptionalSection } from '@/components/forms/primitives'
import { FinancialIcon } from '@/components/ui/FinancialIcon'
import { ColorSwatchPicker, IconGridPicker } from '@/components/ui/VisualPickers'
import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS } from '@/lib/constants/visual-options'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import {
  ConfirmDialog,
  DataSearchField,
  StatusBadge,
} from '@/components/finance'
import {
  CatalogCell,
  CatalogEmptyState,
  CatalogIdentity,
  CatalogRow,
  CatalogTable,
} from '@/components/management/catalog'
import {
  createAssetTypeAction,
  deleteAssetTypeAction,
  listAssetTypesAction,
  updateAssetTypeAction,
} from '@/app/actions/admin.actions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type AssetTypeItem = {
  id: string
  user_id: string | null
  name: string
  icon: string
  color: string
  is_system: boolean
  is_active: boolean
}

type AssetTypeForm = {
  name: string
  icon: string
  color: string
  is_active: boolean
}

type StatusFilter = 'all' | 'active' | 'inactive'

const EMPTY_FORM: AssetTypeForm = {
  name: '',
  icon: 'package',
  color: '#6366f1',
  is_active: true,
}

function isSystemAssetType(item: AssetTypeItem): boolean {
  return item.is_system || item.user_id === null
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function AssetTypesManager() {
  const { toast } = useToast()
  const [items, setItems] = useState<AssetTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AssetTypeForm>(EMPTY_FORM)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AssetTypeItem | null>(null)

  // ─── DATA ─────────────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listAssetTypesAction()
    if (!result.ok) {
      setError(result.error.message)
      setLoading(false)
      return
    }
    setItems(result.data as AssetTypeItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  // ─── COMPUTED ─────────────────────────────────────────────────────────────

  const activeCount = useMemo(() => items.filter(i => i.is_active).length, [items])
  const customCount = useMemo(() => items.filter(item => !isSystemAssetType(item)).length, [items])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (statusFilter === 'active' && !item.is_active) return false
      if (statusFilter === 'inactive' && item.is_active) return false
      if (!q) return true
      return item.name.toLowerCase().includes(q)
    })
  }, [items, query, statusFilter])

  // ─── MODAL ────────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }, [])

  const openCreateModal = useCallback(() => {
    resetForm()
    setModalOpen(true)
  }, [resetForm])

  const closeModal = useCallback(() => {
    if (saving) return
    setModalOpen(false)
    resetForm()
  }, [resetForm, saving])

  const startEdit = useCallback((item: AssetTypeItem) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      icon: item.icon,
      color: item.color,
      is_active: item.is_active,
    })
    setModalOpen(true)
  }, [])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload = {
      name: form.name.trim(),
      icon: form.icon.trim() || 'package',
      color: form.color.trim() || '#6366f1',
      is_active: form.is_active,
    }

    if (payload.name.length < 2) {
      const msg = 'El nombre debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo guardar el tipo de activo', msg)
      return
    }

    setSaving(true)
    setError(null)

    const result = editingId
      ? await updateAssetTypeAction(editingId, payload)
      : await createAssetTypeAction(payload)

    if (!result.ok) {
      setSaving(false)
      setError(result.error.message)
      toast.error('No se pudo guardar el tipo de activo', result.error.message)
      return
    }

    await loadItems()
    closeModal()
    setSaving(false)
    toast.success(
      editingId ? 'Tipo de activo actualizado' : 'Tipo de activo creado',
      `${payload.name} disponible para registrar activos.`,
      { persist: false },
    )
  }, [closeModal, editingId, form, loadItems, toast])

  // ─── ROW ACTIONS ──────────────────────────────────────────────────────────

  const toggleStatus = useCallback(async (item: AssetTypeItem) => {
    if (saving || loading || rowActionId) return
    setRowActionId(item.id)
    setError(null)

    const result = await updateAssetTypeAction(item.id, { is_active: !item.is_active })
    if (!result.ok) {
      setRowActionId(null)
      setError(result.error.message)
      toast.error('Error', result.error.message)
      return
    }

    await loadItems()
    setRowActionId(null)
    toast.success(item.is_active ? 'Tipo desactivado' : 'Tipo reactivado', undefined, { persist: false })
  }, [loadItems, loading, rowActionId, saving, toast])

  const removeItem = useCallback(async (item: AssetTypeItem) => {
    if (saving || loading || rowActionId) return
    setRowActionId(item.id)
    setError(null)

    const result = await deleteAssetTypeAction(item.id)
    if (!result.ok) {
      setRowActionId(null)
      setError(result.error.message)
      toast.error('No se pudo eliminar', result.error.message)
      return
    }

    await loadItems()
    setRowActionId(null)
    setPendingDelete(null)
    toast.success('Tipo de activo eliminado', undefined, { persist: false })
  }, [loadItems, loading, rowActionId, saving, toast])

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <CatalogTable
        title="Catálogo de tipos de activo"
        description="Clasificación base para registrar bienes, patrimonio y posiciones personales."
        count={filteredItems.length}
        summary={(
          <>
            <StatusBadge tone="success">{activeCount} activos</StatusBadge>
            <StatusBadge tone="info">{customCount} personalizados</StatusBadge>
            <StatusBadge tone="muted">{items.length - customCount} del sistema</StatusBadge>
          </>
        )}
        primaryAction={(
          <CreateModuleButton onClick={openCreateModal} label="Nuevo tipo" />
        )}
        search={(
          <DataSearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar tipo de activo"
            className="filters-search"
          />
        )}
        filters={(
          <AppSelect
            value={statusFilter}
            onChange={value => setStatusFilter(value as StatusFilter)}
            className="filters-control sm:w-[164px]"
            compact
            searchable={false}
            options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'active', label: 'Activos' },
              { value: 'inactive', label: 'Inactivos' },
            ]}
          />
        )}
        error={error}
        onRetry={() => {
          void loadItems()
        }}
        loading={loading}
        empty={filteredItems.length === 0}
        loadingState={(
          <div className="divide-y divide-[var(--c-border)]">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.7fr)_170px_170px_auto] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-[var(--c-surface-2)]" />
                    <div className="h-3 w-24 animate-pulse rounded bg-[var(--c-surface-2)]" />
                  </div>
                </div>
                <div className="h-7 w-24 animate-pulse rounded-md bg-[var(--c-surface-2)]" />
                <div className="h-7 w-24 animate-pulse rounded-md bg-[var(--c-surface-2)]" />
                <div className="flex gap-2 md:justify-end">
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                </div>
              </div>
            ))}
          </div>
        )}
        emptyState={(
          <CatalogEmptyState
            title="No hay tipos con este criterio."
            description={query.trim().length > 0
              ? 'Prueba otra búsqueda o cambia el estado para revisar el catálogo completo.'
              : 'Crea un tipo nuevo para clasificar mejor tus activos financieros o patrimoniales.'}
            action={(
              <Button type="button" onClick={openCreateModal} variant="secondary" size="md">
                Nuevo tipo
              </Button>
            )}
          />
        )}
        columns={[
          { label: 'Tipo' },
          { label: 'Origen' },
          { label: 'Estado' },
          { label: 'Acciones', align: 'right' },
        ]}
        gridClassName="md:grid-cols-[minmax(0,1.7fr)_170px_170px_auto] md:items-center"
      >
        {filteredItems.map(item => (
          <CatalogRow
            key={item.id}
            gridClassName="md:grid-cols-[minmax(0,1.7fr)_170px_170px_auto] md:items-center"
            accentColor={item.color}
            muted={!item.is_active}
          >
            <CatalogCell label="Tipo">
              <CatalogIdentity
                icon={(
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--c-border)]"
                    style={{ backgroundColor: `${item.color}16`, color: item.color }}
                  >
                    <FinancialIcon name={item.icon} size={17} />
                  </span>
                )}
                title={item.name}
              />
            </CatalogCell>

            <CatalogCell label="Origen">
              <StatusBadge tone={item.is_system ? 'muted' : 'info'}>
                {item.is_system ? 'Sistema' : 'Personalizado'}
              </StatusBadge>
            </CatalogCell>

            <CatalogCell label="Estado">
              <StatusBadge tone={item.is_active ? 'success' : 'danger'}>
                {item.is_active ? 'Activo' : 'Inactivo'}
              </StatusBadge>
            </CatalogCell>

            <CatalogCell label="Acciones" align="right">
              <div className="flex items-center gap-1.5 md:justify-end">
                <ActionIconButton
                  onClick={() => startEdit(item)}
                  disabled={Boolean(rowActionId)}
                  icon="edit"
                  label={isSystemAssetType(item) ? 'Personalizar tipo' : 'Editar tipo'}
                />
                <ActionIconButton
                  onClick={() => void toggleStatus(item)}
                  disabled={Boolean(rowActionId)}
                  icon={item.is_active ? 'deactivate' : 'reactivate'}
                  label={item.is_active ? 'Desactivar' : 'Activar'}
                  variant={item.is_active ? 'danger' : 'success'}
                />
                <ActionIconButton
                  onClick={() => setPendingDelete(item)}
                  disabled={Boolean(rowActionId)}
                  icon="delete"
                  label="Eliminar tipo"
                  variant="danger"
                />
              </div>
            </CatalogCell>
          </CatalogRow>
        ))}
      </CatalogTable>

      {/* Create/Edit Modal */}
      <RecordModal
        open={modalOpen}
        onClose={closeModal}
        eyebrow="Administración"
        title={editingId ? 'Editar tipo de activo' : 'Nuevo tipo de activo'}
        subtitle="Los tipos clasifican tus activos: Tecnología, Vehículo, Inmueble, etc."
        widthClassName="w-[calc(100vw-32px)] max-w-[440px]"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
              <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
            </div>
          ) : null}

          <FormSection
            title="Datos base"
            description="Usa un nombre claro para reconocer este tipo de activo en registros y filtros."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre">
              <input
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                required
                className="field-base ft-form-input w-full"
                placeholder="Ej: Equipo tecnológico"
              />
            </FormField>
          </FormSection>

          <OptionalSection title="Apariencia" summary={['Icono', 'Color']}>
            <div className="space-y-4">
              <FormField label="Icono" optional>
                <IconGridPicker
                  value={form.icon}
                  onChange={icon => setForm(prev => ({ ...prev, icon }))}
                  options={CATEGORY_ICON_OPTIONS}
                  wrapperTestId="asset-types-icon-options"
                  optionTestIdPrefix="asset-types-icon"
                />
              </FormField>

              <FormField label="Color" optional>
                <ColorSwatchPicker
                  value={form.color}
                  onChange={color => setForm(prev => ({ ...prev, color }))}
                  palette={CATEGORY_COLOR_OPTIONS}
                  wrapperTestId="asset-types-color-options"
                  swatchTestIdPrefix="asset-types-color"
                  customInputTestId="asset-types-color-picker"
                />
              </FormField>
            </div>
          </OptionalSection>

          <FormSection
            title="Estado"
            description="Puedes dejar el tipo activo para nuevos registros o archivarlo sin perder historial."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <label className="flex items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={event => setForm(prev => ({ ...prev, is_active: event.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-[var(--c-border)] text-[var(--c-primary)] focus:ring-[var(--c-primary-soft)]"
              />
              <span className="space-y-1">
                <span className="block text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
                  Tipo activo
                </span>
                <span className="block text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  Si lo desactivas, dejará de aparecer como opción para nuevos activos.
                </span>
              </span>
            </label>
          </FormSection>

          <RecordModalFooter>
            <FormActions
              secondaryAction={(
                <Button type="button" variant="secondary" size="lg" onClick={closeModal} disabled={saving}>
                  Cancelar
                </Button>
              )}
              primaryAction={(
                <Button type="submit" variant="primary" size="lg" loading={saving}>
                  {editingId ? 'Guardar cambios' : 'Crear tipo'}
                </Button>
              )}
            />
          </RecordModalFooter>
        </form>
      </RecordModal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar tipo de activo"
        message={pendingDelete ? (
          <>
            {isSystemAssetType(pendingDelete) ? (
              <>
                <span className="font-semibold text-[var(--c-text)]">{pendingDelete.name}</span>
                {' '}es un tipo base del sistema. Si quieres sacarlo de circulación, primero desactívalo o personalízalo.
              </>
            ) : (
              <>
                Se eliminará <span className="font-semibold text-[var(--c-text)]">{pendingDelete.name}</span>.
                {' '}Si tiene activos asociados, la operación será bloqueada.
              </>
            )}
          </>
        ) : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void removeItem(pendingDelete)
        }}
        loading={Boolean(rowActionId && pendingDelete && rowActionId === pendingDelete.id)}
        danger
        confirmLabel="Eliminar"
      />
    </div>
  )
}
