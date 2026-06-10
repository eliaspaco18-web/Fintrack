// =============================================================================
// components/management/BankEntitiesManager.tsx
// PRD v3 — Módulo 10: Administración > Entidad Bancaria
//
// Campos:
//   - Nombre de Entidad Bancaria (obligatorio)
//   - Nombre Corto
//   - País (lista desplegable de países, obligatorio)
//   - Color (catálogo de colores, default si no selecciona)
//   - Icono (catálogo de iconos, permite subir imagen, default si no selecciona)
//
// Acciones por registro: Editar, Eliminar (restricción), Desactivar/Activar
// =============================================================================

'use client'

import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/lib/toast/toast'
import { FormActions, FormField, FormSection, OptionalSection } from '@/components/forms/primitives'
import { FinancialIcon } from '@/components/ui/FinancialIcon'
import { CountrySelect } from '@/components/ui/CountrySelect'
import { FileUpload } from '@/components/ui/FileUpload'
import { ColorSwatchPicker, IconGridPicker } from '@/components/ui/VisualPickers'
import { ACCOUNT_COLOR_OPTIONS, ACCOUNT_ICON_OPTIONS } from '@/lib/constants/visual-options'
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

type BankEntityItem = {
  id: string
  name: string
  short_name: string | null
  code: string | null
  country: string
  color: string
  icon: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type BankForm = {
  name: string
  short_name: string
  code: string
  country: string
  color: string
  icon: string
  is_active: boolean
}

const EMPTY_FORM: BankForm = {
  name: '',
  short_name: '',
  code: '',
  country: 'PE',
  color: '#0ea5e9',
  icon: 'bank',
  is_active: true,
}

type StatusFilter = 'all' | 'active' | 'inactive'

function isUploadedIcon(value: string): boolean {
  return value.includes('/')
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function BankEntitiesManager() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [entities, setEntities] = useState<BankEntityItem[]>([])
  const [iconSignedUrls, setIconSignedUrls] = useState<Record<string, string>>({})
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [form, setForm] = useState<BankForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BankEntityItem | null>(null)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const handledQueryOpenRef = useRef(false)
  const openFromHeroQuery = searchParams.get('new') === 'bank'

  // ─── DATA LOADING ─────────────────────────────────────────────────────────

  const loadEntities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bank-entities?include_inactive=true', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las entidades bancarias'))
      }
      const loaded = json.data as BankEntityItem[]
      setEntities(loaded)
      const icons = await Promise.all(
        loaded.map(async entity => {
          if (!isUploadedIcon(entity.icon)) return [entity.id, ''] as const
          const signed = await getAttachmentUrl(entity.icon, 3600)
          return [entity.id, signed ?? ''] as const
        })
      )
      setIconSignedUrls(Object.fromEntries(icons.filter(([, value]) => value.length > 0)))
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudieron cargar las entidades bancarias'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEntities()
  }, [loadEntities])

  // ─── COMPUTED ─────────────────────────────────────────────────────────────

  const activeCount = useMemo(() => entities.filter(e => e.is_active).length, [entities])
  const inactiveCount = entities.length - activeCount

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entities.filter(entity => {
      if (statusFilter === 'active' && !entity.is_active) return false
      if (statusFilter === 'inactive' && entity.is_active) return false
      if (!q) return true
      return (
        entity.name.toLowerCase().includes(q) ||
        (entity.short_name ?? '').toLowerCase().includes(q) ||
        (entity.code ?? '').toLowerCase().includes(q)
      )
    })
  }, [entities, query, statusFilter])

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

  const clearCreateQueryParam = useCallback(() => {
    if (searchParams.get('new') !== 'bank') return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    const nextUrl = params.toString().length > 0 ? `${pathname}?${params.toString()}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  const closeModal = useCallback(() => {
    if (saving) return
    setModalOpen(false)
    resetForm()
    clearCreateQueryParam()
  }, [clearCreateQueryParam, resetForm, saving])

  // Auto-open modal from URL query
  useEffect(() => {
    if (openFromHeroQuery) {
      if (handledQueryOpenRef.current) return
      handledQueryOpenRef.current = true
      openCreateModal()
      return
    }
    handledQueryOpenRef.current = false
  }, [openCreateModal, openFromHeroQuery])

  const startEdit = useCallback((entity: BankEntityItem) => {
    setEditingId(entity.id)
    setForm({
      name: entity.name,
      short_name: entity.short_name ?? '',
      code: entity.code ?? '',
      country: entity.country,
      color: entity.color,
      icon: entity.icon,
      is_active: entity.is_active,
    })
    setModalOpen(true)
  }, [])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      const msg = 'El nombre debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo guardar la entidad bancaria', msg)
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      name: trimmedName,
      short_name: form.short_name.trim() || null,
      code: form.code.trim() || null,
      country: (form.country.trim() || 'PE').toUpperCase(),
      color: form.color.trim() || '#0ea5e9',
      icon: form.icon.trim() || 'bank',
      is_active: form.is_active,
    }

    try {
      if (iconFile) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No se pudo autenticar al usuario para subir el icono.')
        const upload = await uploadAttachment(user.id, 'bank-entities', editingId ?? crypto.randomUUID(), iconFile)
        payload.icon = upload.path
      }

      const endpoint = editingId ? `/api/bank-entities/${editingId}` : '/api/bank-entities'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar la entidad bancaria'))
      }

      await loadEntities()
      closeModal()
      toast.success(
        editingId ? 'Entidad bancaria actualizada' : 'Entidad bancaria creada',
        `${payload.name} disponible en Portafolio.`,
        { persist: false },
      )
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo guardar la entidad bancaria'
      setError(message)
      toast.error('No se pudo guardar la entidad bancaria', message)
    } finally {
      setSaving(false)
    }
  }, [closeModal, editingId, form, iconFile, loadEntities, supabase, toast])

  // ─── ROW ACTIONS ──────────────────────────────────────────────────────────

  const toggleStatus = useCallback(async (entity: BankEntityItem, nextStatus: boolean) => {
    if (rowActionId || saving || loading) return
    setRowActionId(entity.id)
    setError(null)
    try {
      const res = await fetch(`/api/bank-entities/${entity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextStatus }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el estado'))
      }
      await loadEntities()
      toast.success(nextStatus ? 'Entidad reactivada' : 'Entidad desactivada', undefined, { persist: false })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Error al actualizar'
      setError(message)
      toast.error('Error', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadEntities, loading, rowActionId, saving, toast])

  const removeEntity = useCallback(async (entity: BankEntityItem) => {
    if (rowActionId || saving || loading) return
    setRowActionId(entity.id)
    setError(null)
    try {
      const res = await fetch(`/api/bank-entities/${entity.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json()
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar la entidad bancaria'))
      }
      await loadEntities()
      setPendingDelete(null)
      toast.success('Entidad bancaria eliminada', undefined, { persist: false })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Error al eliminar'
      setError(message)
      toast.error('No se pudo eliminar', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadEntities, loading, rowActionId, saving, toast])

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <CatalogTable
        title="Catálogo de entidades bancarias"
        description="Instituciones financieras disponibles para portafolio, créditos y trazabilidad de cuentas."
        count={filtered.length}
        summary={(
          <>
            <StatusBadge tone="success">{activeCount} activas</StatusBadge>
            <StatusBadge tone="muted">{entities.length} registradas</StatusBadge>
            {inactiveCount > 0 ? <StatusBadge tone="warning">{inactiveCount} inactivas</StatusBadge> : null}
          </>
        )}
        primaryAction={(
          <CreateModuleButton onClick={openCreateModal} label="Nueva entidad" testId="bank-entities-create-button" />
        )}
        search={(
          <DataSearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar entidad, alias o código"
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
              { value: 'active', label: 'Activas' },
              { value: 'inactive', label: 'Inactivas' },
            ]}
          />
        )}
        error={error}
        onRetry={() => {
          void loadEntities()
        }}
        loading={loading}
        empty={filtered.length === 0}
        loadingState={(
          <div className="divide-y divide-[var(--c-border)]">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.65fr)_220px_170px_auto] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-44 animate-pulse rounded bg-[var(--c-surface-2)]" />
                    <div className="h-3 w-28 animate-pulse rounded bg-[var(--c-surface-2)]" />
                  </div>
                </div>
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--c-surface-2)]" />
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
            title="No hay entidades con este filtro."
            description={query.trim().length > 0
              ? 'Prueba otra búsqueda o revisa el estado seleccionado para ver más resultados.'
              : 'Registra tu primera entidad para conectar portafolios y productos financieros al banco correcto.'}
            action={(
              <Button type="button" onClick={openCreateModal} variant="secondary" size="md">
                Nueva entidad
              </Button>
            )}
          />
        )}
        columns={[
          { label: 'Entidad' },
          { label: 'Cobertura' },
          { label: 'Estado' },
          { label: 'Acciones', align: 'right' },
        ]}
        gridClassName="md:grid-cols-[minmax(0,1.65fr)_220px_170px_auto] md:items-center"
      >
        {filtered.map(entity => (
          <CatalogRow
            key={entity.id}
            gridClassName="md:grid-cols-[minmax(0,1.65fr)_220px_170px_auto] md:items-center"
            accentColor={entity.color}
            muted={!entity.is_active}
          >
            <CatalogCell label="Entidad">
              <CatalogIdentity
                icon={(
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--c-border)]"
                    style={{ backgroundColor: `${entity.color}16`, color: entity.color }}
                  >
                    {iconSignedUrls[entity.id] ? (
                      <Image
                        src={iconSignedUrls[entity.id]!}
                        alt={entity.name}
                        width={20}
                        height={20}
                        unoptimized
                        className="h-5 w-5 rounded-sm object-cover"
                      />
                    ) : (
                      <FinancialIcon name={entity.icon} size={17} />
                    )}
                  </span>
                )}
                title={entity.name}
                subtitle={entity.short_name ?? undefined}
                meta={entity.code ? <StatusBadge tone="muted">{entity.code}</StatusBadge> : null}
              />
            </CatalogCell>

            <CatalogCell label="Cobertura">
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-[var(--c-text)]">{entity.country}</p>
                <p className="text-[11px] text-[var(--c-text-muted)]">
                  {entity.short_name ? `${entity.short_name} · ` : ''}{entity.code ?? 'Sin código'}
                </p>
              </div>
            </CatalogCell>

            <CatalogCell label="Estado">
              <StatusBadge tone={entity.is_active ? 'success' : 'danger'}>
                {entity.is_active ? 'Activa' : 'Inactiva'}
              </StatusBadge>
            </CatalogCell>

            <CatalogCell label="Acciones" align="right">
              <div className="flex items-center gap-1.5 md:justify-end">
                <ActionIconButton
                  onClick={() => startEdit(entity)}
                  disabled={Boolean(rowActionId)}
                  icon="edit"
                  label="Editar entidad"
                />
                <ActionIconButton
                  onClick={() => void toggleStatus(entity, !entity.is_active)}
                  disabled={Boolean(rowActionId)}
                  icon={entity.is_active ? 'deactivate' : 'reactivate'}
                  label={entity.is_active ? 'Desactivar' : 'Activar'}
                  variant={entity.is_active ? 'danger' : 'success'}
                />
                <ActionIconButton
                  onClick={() => setPendingDelete(entity)}
                  disabled={Boolean(rowActionId)}
                  icon="delete"
                  label="Eliminar entidad"
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
        title={editingId ? 'Editar entidad bancaria' : 'Nueva entidad bancaria'}
        subtitle="Las entidades aparecen como opción de banco en Portafolio."
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
            description="Registra la institución con el nombre que luego verás al crear portafolios, créditos y otros productos."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre del banco">
              <input
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                className="field-base ft-form-input w-full"
                placeholder="Ej: Banco de Credito del Peru"
                data-testid="bank-entities-name-input"
                required
              />
            </FormField>

            <FormField label="Nombre corto" optional>
              <input
                value={form.short_name}
                onChange={event => setForm(prev => ({ ...prev, short_name: event.target.value }))}
                className="field-base ft-form-input w-full"
                placeholder="Ej: BCP"
              />
            </FormField>

            <FormField label="País">
              <CountrySelect
                value={form.country}
                onChange={country => setForm(prev => ({ ...prev, country }))}
                required
                id="bank-entities-country-input"
                className="field-base ft-form-input w-full"
              />
            </FormField>

            <FormField
              label="Código"
              optional
              description="Úsalo solo si esta entidad necesita un alias operativo o un identificador interno."
            >
              <input
                value={form.code}
                onChange={event => setForm(prev => ({ ...prev, code: event.target.value }))}
                className="field-base ft-form-input w-full"
                placeholder="Ej: BCP-PE"
                data-testid="bank-entities-code-input"
              />
            </FormField>
          </FormSection>

          <OptionalSection
            title="Apariencia"
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
                  palette={ACCOUNT_COLOR_OPTIONS}
                  wrapperTestId="bank-entities-color-options"
                  swatchTestIdPrefix="bank-entities-color"
                  customInputTestId="bank-entities-color-picker"
                />
              </FormField>

              <FormField label="Icono" optional>
                <IconGridPicker
                  value={form.icon}
                  onChange={icon => setForm(prev => ({ ...prev, icon }))}
                  options={ACCOUNT_ICON_OPTIONS}
                  wrapperTestId="bank-entities-icon-options"
                  optionTestIdPrefix="bank-entities-icon"
                />
              </FormField>

              <FileUpload
                value={iconFile}
                existingUrl={editingId && isUploadedIcon(form.icon) ? (iconSignedUrls[editingId] ?? null) : null}
                onChange={setIconFile}
                onRemoveExisting={() => setForm(prev => ({ ...prev, icon: 'bank' }))}
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
                  {editingId ? 'Guardar cambios' : 'Crear entidad'}
                </Button>
              )}
            />
          </RecordModalFooter>
        </form>
      </RecordModal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar entidad bancaria"
        message={pendingDelete ? (
          <>
            Se eliminará <span className="font-semibold text-[var(--c-text)]">{pendingDelete.name}</span>.
            {' '}Si está vinculada a portafolios o movimientos, la operación será bloqueada.
          </>
        ) : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void removeEntity(pendingDelete)
        }}
        loading={Boolean(rowActionId && pendingDelete && rowActionId === pendingDelete.id)}
        danger
        confirmLabel="Eliminar"
      />
    </div>
  )
}
