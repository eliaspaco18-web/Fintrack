// =============================================================================
// components/management/CategoriesManager.tsx
// PRD v3 — Módulo 10: Administración > Categoría
//
// Campos:
//   - Nombre de Categoría (obligatorio)
//   - Tipo de Categoría: Ingreso / Egreso (obligatorio)
//   - Color (catálogo, default si no selecciona)
//   - Icono (catálogo, permite subir imagen, default si no selecciona)
//
// Acciones por registro: Editar, Eliminar (restricción), Desactivar/Activar
// =============================================================================

'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/lib/toast/toast'
import { FormActions, FormField, FormSection, OptionalSection } from '@/components/forms/primitives'
import { FinancialIcon } from '@/components/ui/FinancialIcon'
import { IconImageUpload } from '@/components/ui/IconImageUpload'
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
import { getApiErrorMessage } from '@/lib/api/error-message'
import { createClient } from '@/lib/supabase.client'
import {
  ATTACHMENT_IMAGE_MIME_TYPES,
  getAttachmentUrl,
  uploadAttachment,
} from '@/lib/utils/file-upload'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type CategoryScope = 'INCOME' | 'EXPENSE'

type CategoryItem = {
  id: string
  name: string
  scope: CategoryScope
  icon: string
  color: string
  sort_order: number
  is_system: boolean
  is_active?: boolean
  user_id: string | null
  system_key: string | null
}

type CategoryForm = {
  name: string
  scope: CategoryScope
  icon: string
  color: string
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  scope: 'EXPENSE',
  icon: 'tag',
  color: '#6b7280',
}

const SCOPE_LABELS: Record<string, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Egreso',
}

const SCOPE_TONES: Record<string, 'success' | 'danger'> = {
  INCOME: 'success',
  EXPENSE: 'danger',
}

const CATEGORY_SCOPE_OPTIONS: Array<{ value: CategoryScope; label: string; detail: string }> = [
  { value: 'INCOME', label: 'Ingresos', detail: 'Disponible solo para entradas.' },
  { value: 'EXPENSE', label: 'Egresos', detail: 'Disponible solo para salidas.' },
]

function isUploadedIcon(value: string): boolean {
  return value.includes('/')
}

function normalizeCategoryScope(scope: string): CategoryScope {
  return scope === 'INCOME' ? 'INCOME' : 'EXPENSE'
}

function isProtectedCategory(category: CategoryItem): boolean {
  return category.is_system || category.user_id === null
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function CategoriesManager() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [iconSignedUrls, setIconSignedUrls] = useState<Record<string, string>>({})
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<'all' | CategoryScope>('all')
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CategoryItem | null>(null)

  // ─── DATA LOADING ─────────────────────────────────────────────────────────

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/categories?include_system=true', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las categorías'))
      }
      const loaded = ((json.data as CategoryItem[]) ?? []).map(category => ({
        ...category,
        scope: normalizeCategoryScope(category.scope),
      }))
      setCategories(loaded)
      const icons = await Promise.all(
        loaded.map(async category => {
          if (!isUploadedIcon(category.icon)) return [category.id, ''] as const
          const signed = await getAttachmentUrl(category.icon, 3600)
          return [category.id, signed ?? ''] as const
        })
      )
      setIconSignedUrls(Object.fromEntries(icons.filter(([, value]) => value.length > 0)))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las categorías')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  // ─── COMPUTED ─────────────────────────────────────────────────────────────

  const userCategories = useMemo(() => categories.filter(category => !isProtectedCategory(category)), [categories])
  const systemCount = categories.length - userCategories.length
  const incomeCount = useMemo(
    () => userCategories.filter(c => c.scope === 'INCOME').length,
    [userCategories]
  )
  const expenseCount = useMemo(
    () => userCategories.filter(c => c.scope === 'EXPENSE').length,
    [userCategories]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return categories.filter(category => {
      if (scopeFilter !== 'all' && category.scope !== scopeFilter) return false
      if (!q) return true
      return category.name.toLowerCase().includes(q)
    })
  }, [categories, query, scopeFilter])

  // ─── MODAL & FORM ─────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setIconFile(null)
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

  const startEdit = useCallback((category: CategoryItem) => {
    if (isProtectedCategory(category)) return
    setEditingId(category.id)
    setForm({
      name: category.name,
      scope: category.scope,
      icon: category.icon,
      color: category.color,
    })
    setModalOpen(true)
  }, [])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      const msg = 'El nombre debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo guardar la categoría', msg)
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      name: trimmedName,
      scope: form.scope,
      icon: form.icon.trim() || 'tag',
      color: form.color.trim() || '#6b7280',
    }

    try {
      if (iconFile) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No se pudo autenticar al usuario para subir el icono.')
        const upload = await uploadAttachment(user.id, 'categories', editingId ?? crypto.randomUUID(), iconFile)
        payload.icon = upload.path
      }

      const endpoint = editingId ? `/api/categories/${editingId}` : '/api/categories'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar la categoría'))
      }

      await loadCategories()
      closeModal()
      toast.success(
        editingId ? 'Categoría actualizada' : 'Categoría creada',
        `${payload.name} disponible para transacciones.`,
        { persist: false },
      )
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo guardar la categoría'
      setError(message)
      toast.error('No se pudo guardar la categoría', message)
    } finally {
      setSaving(false)
    }
  }, [closeModal, editingId, form, iconFile, loadCategories, supabase, toast])

  // ─── ROW ACTIONS ──────────────────────────────────────────────────────────

  const removeCategory = useCallback(async (category: CategoryItem) => {
    if (isProtectedCategory(category) || rowActionId || saving || loading) return
    setRowActionId(category.id)
    setError(null)
    try {
      const res = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json()
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar la categoría'))
      }
      await loadCategories()
      setPendingDelete(null)
      toast.success('Categoría eliminada', undefined, { persist: false })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo eliminar la categoría'
      setError(message)
      toast.error('No se pudo eliminar la categoría', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadCategories, loading, rowActionId, saving, toast])

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <CatalogTable
        title="Catálogo de categorías"
        description="Estructura de clasificación para ingresos, egresos y lectura financiera transversal."
        count={filtered.length}
        summary={(
          <>
            <StatusBadge tone="success">{incomeCount} para ingreso</StatusBadge>
            <StatusBadge tone="danger">{expenseCount} para egreso</StatusBadge>
            <StatusBadge tone="info">{userCategories.length} personalizadas</StatusBadge>
            {systemCount > 0 ? <StatusBadge tone="muted">{systemCount} del sistema</StatusBadge> : null}
          </>
        )}
        primaryAction={(
          <CreateModuleButton onClick={openCreateModal} label="Nueva categoría" />
        )}
        search={(
          <DataSearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar categoría"
            className="filters-search"
          />
        )}
        filters={(
          <AppSelect
            value={scopeFilter}
            onChange={value => setScopeFilter(value as 'all' | CategoryScope)}
            className="filters-control sm:w-[168px]"
            compact
            searchable={false}
            options={[
              { value: 'all', label: 'Todos los alcances' },
              { value: 'INCOME', label: 'Ingreso' },
              { value: 'EXPENSE', label: 'Egreso' },
            ]}
          />
        )}
        error={error}
        onRetry={() => {
          void loadCategories()
        }}
        loading={loading}
        empty={filtered.length === 0}
        loadingState={(
          <div className="divide-y divide-[var(--c-border)]">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.7fr)_160px_170px_auto] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-[var(--c-surface-2)]" />
                    <div className="h-3 w-20 animate-pulse rounded bg-[var(--c-surface-2)]" />
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
            title="No hay categorías con este criterio."
            description={query.trim().length > 0
              ? 'Prueba otra búsqueda o cambia el alcance para revisar el catálogo completo.'
              : 'Crea una categoría nueva para afinar el orden financiero de tus movimientos.'}
            action={(
              <Button type="button" onClick={openCreateModal} variant="secondary" size="md">
                Nueva categoría
              </Button>
            )}
          />
        )}
        columns={[
          { label: 'Categoría' },
          { label: 'Alcance' },
          { label: 'Origen' },
          { label: 'Acciones', align: 'right' },
        ]}
        gridClassName="md:grid-cols-[minmax(0,1.7fr)_160px_170px_auto] md:items-center"
      >
        {filtered.map(category => (
          <CatalogRow
            key={category.id}
            gridClassName="md:grid-cols-[minmax(0,1.7fr)_160px_170px_auto] md:items-center"
            accentColor={category.color}
          >
            <CatalogCell label="Categoría">
              <CatalogIdentity
                icon={(
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--c-border)]"
                    style={{ backgroundColor: `${category.color}16`, color: category.color }}
                  >
                    {iconSignedUrls[category.id] ? (
                      <Image
                        src={iconSignedUrls[category.id]!}
                        alt={category.name}
                        width={32}
                        height={32}
                        unoptimized
                        className="h-9 w-9 rounded-md object-contain"
                      />
                    ) : (
                      <FinancialIcon name={category.icon} size={17} />
                    )}
                  </span>
                )}
                title={category.name}
              />
            </CatalogCell>

            <CatalogCell label="Alcance">
              <StatusBadge tone={SCOPE_TONES[category.scope] ?? 'muted'}>
                {SCOPE_LABELS[category.scope] ?? category.scope}
              </StatusBadge>
            </CatalogCell>

            <CatalogCell label="Origen">
              <StatusBadge tone={category.is_system ? 'muted' : 'info'}>
                {category.is_system ? 'Sistema' : 'Personalizada'}
              </StatusBadge>
            </CatalogCell>

            <CatalogCell label="Acciones" align="right">
              {!isProtectedCategory(category) ? (
                <div className="flex items-center gap-1.5 md:justify-end">
                  <ActionIconButton
                    onClick={() => startEdit(category)}
                    disabled={Boolean(rowActionId)}
                    icon="edit"
                    label="Editar categoría"
                  />
                  <ActionIconButton
                    onClick={() => setPendingDelete(category)}
                    disabled={Boolean(rowActionId)}
                    icon="delete"
                    label="Eliminar categoría"
                    variant="danger"
                  />
                </div>
              ) : (
                <div className="md:text-right">
                  <StatusBadge tone="muted">Protegida</StatusBadge>
                </div>
              )}
            </CatalogCell>
          </CatalogRow>
        ))}
      </CatalogTable>

      {/* Create/Edit Modal */}
      <RecordModal
        open={modalOpen}
        onClose={closeModal}
        eyebrow="Administración"
        title={editingId ? 'Editar categoría' : 'Nueva categoría'}
        subtitle="Las categorías organizan tus transacciones de ingreso y egreso."
        widthClassName="w-[calc(100vw-32px)] max-w-[520px]"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
              <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
            </div>
          ) : null}

          <FormSection
            title="Datos base"
            description="Primero define el nombre y dónde estará disponible la categoría dentro de tu flujo financiero."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre">
              <input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="field-base ft-form-input w-full"
                placeholder="Ej: Publicidad"
                required
              />
            </FormField>

            <FormField
              label="Uso"
              description="Define si la categoría aplica a ingresos o egresos para mantener el registro consistente con el PRD."
            >
              <div
                role="radiogroup"
                aria-label="Uso de la categoría"
                className="grid gap-2 sm:grid-cols-3"
              >
                {CATEGORY_SCOPE_OPTIONS.map(option => {
                  const active = form.scope === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setForm(prev => ({ ...prev, scope: option.value }))}
                      className={[
                        'ui-pressable rounded-[var(--ft-form-radius)] border px-3.5 py-3 text-left transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
                        active
                          ? 'border-[var(--c-primary)] bg-[var(--c-primary-soft)] text-[var(--c-text)]'
                          : 'border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] text-[var(--c-text-muted)] hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text)]',
                      ].join(' ')}
                    >
                      <span className="block text-[13px] font-semibold tracking-[-0.01em]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-[11px] leading-[1.4] text-current/75">
                        {option.detail}
                      </span>
                    </button>
                  )
                })}
              </div>
            </FormField>
          </FormSection>

          <OptionalSection
            title="Más opciones"
            summary={[
              'Color',
              'Icono',
              editingId && isUploadedIcon(form.icon) ? 'Icono personalizado' : '',
            ]}
          >
            <div className="space-y-4">
              <FormField label="Color" optional>
                <ColorSwatchPicker
                  value={form.color}
                  onChange={color => setForm(prev => ({ ...prev, color }))}
                  palette={CATEGORY_COLOR_OPTIONS}
                  wrapperTestId="categories-color-options"
                  swatchTestIdPrefix="categories-color"
                  customInputTestId="categories-color-input"
                />
              </FormField>

              <FormField label="Icono" optional>
                <IconGridPicker
                  value={form.icon}
                  onChange={icon => setForm(prev => ({ ...prev, icon }))}
                  options={CATEGORY_ICON_OPTIONS}
                  wrapperTestId="categories-icon-options"
                  optionTestIdPrefix="categories-icon"
                />
              </FormField>

              <IconImageUpload
                value={iconFile}
                existingUrl={editingId && isUploadedIcon(form.icon) ? (iconSignedUrls[editingId] ?? null) : null}
                onChange={setIconFile}
                onRemoveExisting={() => setForm(prev => ({ ...prev, icon: 'tag' }))}
                label="Icono personalizado (opcional)"
                allowedMimeTypes={ATTACHMENT_IMAGE_MIME_TYPES}
                accept=".jpg,.jpeg,.png,.webp,.gif"
                acceptedTypesDescription="JPG, PNG, WEBP o GIF — Máx 10MB"
              />
            </div>
          </OptionalSection>

          <RecordModalFooter>
            <FormActions
              secondaryAction={(
                <Button type="button" variant="secondary" size="lg" onClick={closeModal} disabled={saving}>
                  Cancelar
                </Button>
              )}
              primaryAction={(
                <Button type="submit" variant="primary" size="lg" loading={saving}>
                  {editingId ? 'Guardar cambios' : 'Crear categoría'}
                </Button>
              )}
            />
          </RecordModalFooter>
        </form>
      </RecordModal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar categoría"
        message={pendingDelete ? (
          <>
            Se eliminará <span className="font-semibold text-[var(--c-text)]">{pendingDelete.name}</span>.
            {' '}Si tiene transacciones relacionadas, la operación será bloqueada.
          </>
        ) : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void removeCategory(pendingDelete)
        }}
        loading={Boolean(rowActionId && pendingDelete && rowActionId === pendingDelete.id)}
        danger
        confirmLabel="Eliminar"
      />
    </div>
  )
}
