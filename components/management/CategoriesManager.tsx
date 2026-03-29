'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/lib/toast/toast'
import { FocusTrap } from '@/components/ui/accessibility'
import { FinancialIcon } from '@/components/ui/FinancialIcon'
import { ColorSwatchPicker, IconGridPicker } from '@/components/ui/VisualPickers'
import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS } from '@/lib/constants/visual-options'

type CategoryScope = 'INCOME' | 'EXPENSE' | 'BOTH'

type CategoryItem = {
  id: string
  name: string
  scope: CategoryScope
  icon: string
  color: string
  sort_order: number
  is_system: boolean
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

const SCOPE_LABELS: Record<CategoryScope, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Egreso',
  BOTH: 'Ambos',
}

interface ApiErrorShape {
  ok: false
  error: { message?: string }
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'ok' in payload &&
    (payload as ApiErrorShape).ok === false &&
    (payload as ApiErrorShape).error?.message
  ) {
    return (payload as ApiErrorShape).error.message ?? fallback
  }
  return fallback
}

export function CategoriesManager() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showSystemCategories, setShowSystemCategories] = useState(false)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<CategoryItem | null>(null)

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/categories?include_system=true', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las categorías'))
      }
      setCategories(json.data as CategoryItem[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las categorías')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }, [])

  const userCategories = useMemo(
    () => categories.filter(category => !category.is_system),
    [categories]
  )
  const visibleCategories = useMemo(
    () => showSystemCategories ? categories : userCategories,
    [categories, showSystemCategories, userCategories]
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return visibleCategories
    return visibleCategories.filter(category =>
      category.name.toLowerCase().includes(q) ||
      category.scope.toLowerCase().includes(q)
    )
  }, [query, visibleCategories])
  const systemCount = categories.length - userCategories.length
  const incomeCount = useMemo(
    () => userCategories.filter(category => category.scope === 'INCOME' || category.scope === 'BOTH').length,
    [userCategories]
  )
  const expenseCount = useMemo(
    () => userCategories.filter(category => category.scope === 'EXPENSE' || category.scope === 'BOTH').length,
    [userCategories]
  )

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
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
      resetForm()
      await loadCategories()
      toast.success(editingId ? 'Categoría actualizada' : 'Categoría creada')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo guardar la categoría'
      setError(message)
      toast.error('No se pudo guardar la categoría', message)
    } finally {
      setSaving(false)
    }
  }, [editingId, form, loadCategories, resetForm, toast])

  const startEdit = useCallback((category: CategoryItem) => {
    if (category.is_system) return
    setEditingId(category.id)
    setForm({
      name: category.name,
      scope: category.scope,
      icon: category.icon,
      color: category.color,
    })
  }, [])

  const openDeleteCategoryModal = useCallback((category: CategoryItem) => {
    if (category.is_system) return
    if (saving || loading || rowActionId !== null) return
    setPendingDeleteCategory(category)
  }, [loading, rowActionId, saving])

  const closeDeleteCategoryModal = useCallback(() => {
    if (rowActionId !== null) return
    setPendingDeleteCategory(null)
  }, [rowActionId])

  const removeCategory = useCallback(async (category: CategoryItem) => {
    if (category.is_system) return
    setRowActionId(category.id)
    setError(null)
    try {
      const res = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json()
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar la categoría'))
      }
      await loadCategories()
      toast.success('Categoría eliminada')
      setPendingDeleteCategory(null)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo eliminar la categoría'
      setError(message)
      toast.error('No se pudo eliminar la categoría', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadCategories, toast])

  const buildTransactionHref = useCallback((category: CategoryItem) => {
    const params = new URLSearchParams({ category_id: category.id })
    if (category.scope === 'INCOME' || category.scope === 'EXPENSE') {
      params.set('type', category.scope)
    }
    return `/transactions/new?${params.toString()}`
  }, [])

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--color-text-muted)]">Resumen de categorías</p>
            <p className="text-sm text-[var(--color-text)] mt-1">
              {incomeCount} para ingreso · {expenseCount} para egreso · {userCategories.length} personalizadas
              {systemCount > 0 ? ` · ${systemCount} sugeridas del sistema` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/transactions/new"
              className="inline-flex items-center rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-[var(--color-on-accent)] hover:bg-emerald-400 transition-colors"
            >
              + Nueva transacción
            </Link>
            <Link
              href="/portfolio"
              className="inline-flex items-center rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
            >
              Ir a Portafolio
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text)]">
              {editingId ? 'Editar categoría' : 'Nueva categoría'}
            </h2>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Crea y administra categorías de ingreso y egreso para usarlas en transacciones.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          data-testid="categories-form"
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Nombre *</span>
            <input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
              data-testid="categories-name-input"
              className="field-base"
              placeholder="Ej. Alimentación"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Tipo</span>
            <select
              value={form.scope}
              onChange={e => setForm(prev => ({ ...prev, scope: e.target.value as CategoryScope }))}
              data-testid="categories-scope-select"
              className="field-base"
            >
              <option value="INCOME">Ingreso</option>
              <option value="EXPENSE">Egreso</option>
              <option value="BOTH">Ambos</option>
            </select>
          </label>

          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Icono</span>
            <IconGridPicker
              value={form.icon}
              onChange={icon => setForm(prev => ({ ...prev, icon }))}
              options={CATEGORY_ICON_OPTIONS}
              wrapperTestId="categories-icon-input"
              optionTestIdPrefix="categories-icon-option"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Color</span>
            <ColorSwatchPicker
              value={form.color}
              onChange={color => setForm(prev => ({ ...prev, color }))}
              palette={CATEGORY_COLOR_OPTIONS}
              wrapperTestId="categories-color-options"
              swatchTestIdPrefix="categories-color"
              customInputTestId="categories-color-input"
            />
          </div>

          {error && (
            <p className="md:col-span-2 text-[12px] text-red-400">{error}</p>
          )}

          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              data-testid="categories-submit-button"
              className="btn-primary"
            >
              {saving ? 'Guardando...' : (editingId ? 'Guardar cambios' : 'Crear categoría')}
            </button>
            <button
              type="button"
              onClick={loadCategories}
              disabled={loading || saving}
              data-testid="categories-reload-button"
              className="btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Recargar
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
          <h2 className="text-sm font-bold text-[var(--color-text)]">
            {showSystemCategories
              ? `Categorías (${userCategories.length} propias / ${categories.length} total)`
              : `Categorías propias (${userCategories.length})`}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {systemCount > 0 && (
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] text-[var(--color-text-muted)]">
                <input
                  type="checkbox"
                  checked={showSystemCategories}
                  onChange={e => setShowSystemCategories(e.target.checked)}
                  data-testid="categories-show-system-toggle"
                />
                Mostrar sugeridas del sistema
              </label>
            )}
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar categoría..."
              className="field-base max-w-[220px]"
            />
          </div>
        </div>

        {error && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2">
            <p className="text-[12px] text-red-200/90">{error}</p>
            <button
              type="button"
              onClick={loadCategories}
              className="rounded-md border border-red-300/35 px-2 py-1 text-[10px] font-semibold text-red-100/90 hover:bg-red-500/20 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Cargando categorías...</p>
        ) : filtered.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text-muted)]">
              {query.trim()
                ? 'No hay categorías que coincidan con la búsqueda.'
                : showSystemCategories
                  ? 'No hay categorías disponibles.'
                  : 'Aún no tienes categorías personalizadas.'}
            </p>
            {!query.trim() && !showSystemCategories && systemCount > 0 && (
              <button
                type="button"
                onClick={() => setShowSystemCategories(true)}
                className="text-[12px] text-emerald-400/80 hover:text-emerald-300 transition-colors"
              >
                Ver categorías sugeridas del sistema
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(category => (
              <div
                key={category.id}
                data-testid={`categories-row-${category.id}`}
                className={`rounded-xl border px-4 py-3 ${
                  category.is_system
                    ? 'border-[color:var(--color-border)] bg-[var(--color-surface)]'
                    : 'border-[color:var(--color-border-hover)] bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                      <span className="inline-flex items-center gap-2">
                        <FinancialIcon name={category.icon} size={13}/>
                        {category.name}
                      </span>
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {SCOPE_LABELS[category.scope]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {category.is_system ? (
                      <>
                        <Link
                          href={buildTransactionHref(category)}
                          className="text-[12px] text-emerald-400/75 hover:text-emerald-300 transition-colors"
                        >
                          Usar
                        </Link>
                        <span className="text-[11px] text-[var(--color-text-muted)] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)]">
                          Sistema
                        </span>
                      </>
                    ) : (
                      <>
                        <Link
                          href={buildTransactionHref(category)}
                          className="text-[12px] text-emerald-400/75 hover:text-emerald-300 transition-colors"
                        >
                          Usar
                        </Link>
                        <button
                          onClick={() => startEdit(category)}
                          disabled={saving || loading || rowActionId !== null}
                          data-testid={`categories-edit-${category.id}`}
                          className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => openDeleteCategoryModal(category)}
                          disabled={saving || loading || rowActionId !== null}
                          data-testid={`categories-delete-${category.id}`}
                          className="text-[12px] text-red-400/70 hover:text-red-400 transition-colors"
                        >
                          {rowActionId === category.id ? 'Procesando…' : 'Eliminar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingDeleteCategory && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[color:var(--color-overlay)] px-4"
          onClick={closeDeleteCategoryModal}
          data-testid="categories-delete-modal"
        >
          <FocusTrap active={Boolean(pendingDeleteCategory)} onEscape={closeDeleteCategoryModal}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="categories-delete-title"
              onClick={event => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-modal-bg)] p-5 shadow-2xl shadow-[color:var(--color-shadow)]"
            >
              <h3 id="categories-delete-title" className="text-sm font-bold text-[var(--color-text)]">
                Eliminar categoría
              </h3>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                ¿Eliminar la categoría <span className="font-semibold text-[var(--color-text)]">{pendingDeleteCategory.name}</span>?
              </p>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteCategoryModal}
                  disabled={rowActionId !== null}
                  data-testid="categories-delete-cancel-button"
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void removeCategory(pendingDeleteCategory)}
                  disabled={rowActionId !== null}
                  data-testid="categories-delete-confirm-button"
                  className="rounded-lg border border-red-400/40 bg-red-500/20 px-3 py-1.5 text-[12px] font-bold text-red-200 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {rowActionId === pendingDeleteCategory.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  )
}
