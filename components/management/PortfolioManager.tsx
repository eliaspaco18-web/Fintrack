'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AccountType, CurrencyCode } from '@/types/database.types'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { useToast } from '@/lib/toast/toast'
import { FocusTrap } from '@/components/ui/accessibility'
import { FinancialIcon } from '@/components/ui/FinancialIcon'
import { ColorSwatchPicker, IconGridPicker } from '@/components/ui/VisualPickers'
import { ACCOUNT_COLOR_OPTIONS, ACCOUNT_ICON_OPTIONS } from '@/lib/constants/visual-options'

type AccountItem = {
  id: string
  name: string
  institution: string | null
  type: AccountType
  currency: CurrencyCode
  balance: number
  initial_balance: number
  color: string
  icon: string
  include_in_net_worth: boolean
  is_active: boolean
  notes: string | null
}

type AccountForm = {
  name: string
  institution: string
  type: AccountType
  currency: CurrencyCode
  initial_balance: string
  color: string
  icon: string
  include_in_net_worth: boolean
  notes: string
}

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'CHECKING', label: 'Cuenta corriente' },
  { value: 'SAVINGS', label: 'Cuenta ahorros' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'INVESTMENT', label: 'Inversión' },
  { value: 'CREDIT_CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otra' },
]

function getIconLabel(icon: string): string {
  return ACCOUNT_ICON_OPTIONS.find(option => option.value === icon)?.label ?? icon
}

const EMPTY_FORM: AccountForm = {
  name: '',
  institution: '',
  type: 'CHECKING',
  currency: 'PEN',
  initial_balance: '0',
  color: '#10b981',
  icon: 'wallet',
  include_in_net_worth: true,
  notes: '',
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

export function PortfolioManager() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [pendingDeactivateAccount, setPendingDeactivateAccount] = useState<AccountItem | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounts?include_inactive=true', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las cuentas'))
      }
      setAccounts(json.data as AccountItem[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las cuentas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }, [])

  const activeCount = useMemo(
    () => accounts.filter(account => account.is_active).length,
    [accounts]
  )
  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(account =>
      account.name.toLowerCase().includes(q) ||
      (account.institution ?? '').toLowerCase().includes(q) ||
      account.type.toLowerCase().includes(q)
    )
  }, [accounts, query])
  const totalBalancePen = useMemo(
    () => accounts.filter(account => account.is_active && account.currency === 'PEN')
      .reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  )

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      const msg = 'El nombre debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo guardar la cuenta', msg)
      return
    }

    const parsedInitialBalance = Number(form.initial_balance || '0')
    if (!editingId && !Number.isFinite(parsedInitialBalance)) {
      const msg = 'El saldo inicial debe ser un número válido.'
      setError(msg)
      toast.error('No se pudo guardar la cuenta', msg)
      return
    }

    setSaving(true)
    setError(null)

    const payload = editingId
      ? {
          name: trimmedName,
          institution: form.institution.trim() || null,
          type: form.type,
          currency: form.currency,
          color: form.color.trim() || '#10b981',
          icon: form.icon.trim() || 'wallet',
          include_in_net_worth: form.include_in_net_worth,
          notes: form.notes.trim() || null,
        }
      : {
          name: trimmedName,
          institution: form.institution.trim() || null,
          type: form.type,
          currency: form.currency,
          initial_balance: parsedInitialBalance,
          color: form.color.trim() || '#10b981',
          icon: form.icon.trim() || 'wallet',
          include_in_net_worth: form.include_in_net_worth,
          notes: form.notes.trim() || null,
        }

    try {
      const endpoint = editingId ? `/api/accounts/${editingId}` : '/api/accounts'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar la cuenta'))
      }
      resetForm()
      await loadAccounts()
      toast.success(editingId ? 'Cuenta actualizada' : 'Cuenta creada')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo guardar la cuenta'
      setError(message)
      toast.error('No se pudo guardar la cuenta', message)
    } finally {
      setSaving(false)
    }
  }, [editingId, form, loadAccounts, resetForm, toast])

  const startEdit = useCallback((account: AccountItem) => {
    setEditingId(account.id)
    setForm({
      name: account.name,
      institution: account.institution ?? '',
      type: account.type,
      currency: account.currency,
      initial_balance: String(account.initial_balance),
      color: account.color,
      icon: account.icon,
      include_in_net_worth: account.include_in_net_worth,
      notes: account.notes ?? '',
    })
  }, [])

  const openDeactivateModal = useCallback((account: AccountItem) => {
    if (!account.is_active || saving || loading || rowActionId !== null) return
    setPendingDeactivateAccount(account)
  }, [loading, rowActionId, saving])

  const closeDeactivateModal = useCallback(() => {
    if (rowActionId !== null) return
    setPendingDeactivateAccount(null)
  }, [rowActionId])

  const deactivate = useCallback(async (id: string) => {
    setRowActionId(id)
    setError(null)
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json()
        throw new Error(getApiErrorMessage(json, 'No se pudo desactivar la cuenta'))
      }
      await loadAccounts()
      toast.success('Cuenta desactivada')
      setPendingDeactivateAccount(null)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo desactivar la cuenta'
      setError(message)
      toast.error('No se pudo desactivar la cuenta', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadAccounts, toast])

  const reactivate = useCallback(async (id: string) => {
    setRowActionId(id)
    setError(null)
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo reactivar la cuenta'))
      }
      await loadAccounts()
      toast.success('Cuenta reactivada')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo reactivar la cuenta'
      setError(message)
      toast.error('No se pudo reactivar la cuenta', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadAccounts, toast])

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--color-text-muted)]">Resumen de portafolio</p>
            <p className="text-sm text-[var(--color-text)] mt-1">
              {activeCount} activa{activeCount === 1 ? '' : 's'} / {accounts.length} total · saldo PEN: {formatCurrency(totalBalancePen, 'PEN')}
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
              href="/admin"
              className="inline-flex items-center rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
            >
              Ir a Administración
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text)]">
              {editingId ? 'Editar cuenta' : 'Nueva cuenta / banco'}
            </h2>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Estas cuentas aparecerán en el campo Cuenta al registrar una transacción.
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
          data-testid="portfolio-form"
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Nombre *</span>
            <input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
              data-testid="portfolio-name-input"
              className="field-base"
              placeholder="Ej. BCP Sueldo"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Banco / Institución</span>
            <input
              value={form.institution}
              onChange={e => setForm(prev => ({ ...prev, institution: e.target.value }))}
              data-testid="portfolio-institution-input"
              className="field-base"
              placeholder="Ej. BCP"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Tipo</span>
            <select
              value={form.type}
              onChange={e => setForm(prev => ({ ...prev, type: e.target.value as AccountType }))}
              data-testid="portfolio-type-select"
              className="field-base"
            >
              {ACCOUNT_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Moneda</span>
            <select
              value={form.currency}
              onChange={e => setForm(prev => ({ ...prev, currency: e.target.value as CurrencyCode }))}
              data-testid="portfolio-currency-select"
              className="field-base"
            >
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Saldo inicial</span>
            <input
              type="number"
              step="0.01"
              value={form.initial_balance}
              disabled={!!editingId}
              onChange={e => setForm(prev => ({ ...prev, initial_balance: e.target.value }))}
              data-testid="portfolio-initial-balance-input"
              className="field-base disabled:opacity-60"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Color</span>
            <ColorSwatchPicker
              value={form.color}
              onChange={color => setForm(prev => ({ ...prev, color }))}
              palette={ACCOUNT_COLOR_OPTIONS}
              wrapperTestId="portfolio-color-options"
              swatchTestIdPrefix="portfolio-color"
              customInputTestId="portfolio-color-picker"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Icono</span>
            <IconGridPicker
              value={form.icon}
              onChange={icon => setForm(prev => ({ ...prev, icon }))}
              options={ACCOUNT_ICON_OPTIONS}
              wrapperTestId="portfolio-icon-input"
              optionTestIdPrefix="portfolio-icon-option"
            />
          </div>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Notas</span>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              className="field-base min-h-[84px]"
              placeholder="Opcional"
            />
          </label>

          <label className="md:col-span-2 flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={form.include_in_net_worth}
              onChange={e => setForm(prev => ({ ...prev, include_in_net_worth: e.target.checked }))}
            />
            Incluir en patrimonio neto
          </label>

          {error && (
            <p className="md:col-span-2 text-[12px] text-red-400">{error}</p>
          )}

          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} data-testid="portfolio-submit-button" className="btn-primary">
              {saving ? 'Guardando...' : (editingId ? 'Guardar cambios' : 'Crear cuenta')}
            </button>
            <button
              type="button"
              onClick={loadAccounts}
              disabled={loading || saving}
              data-testid="portfolio-reload-button"
              className="btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Recargar
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-sm font-bold text-[var(--color-text)]">Cuentas del portafolio</h2>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="field-base max-w-[220px]"
            placeholder="Buscar cuenta..."
          />
        </div>

        {error && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2">
            <p className="text-[12px] text-red-200/90">{error}</p>
            <button
              type="button"
              onClick={loadAccounts}
              className="rounded-md border border-red-300/35 px-2 py-1 text-[10px] font-semibold text-red-100/90 hover:bg-red-500/20 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Cargando cuentas...</p>
        ) : filteredAccounts.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {query.trim()
              ? 'No hay cuentas que coincidan con la búsqueda.'
              : 'Aún no tienes cuentas registradas.'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredAccounts.map(account => (
              <div
                key={account.id}
                data-testid={`portfolio-row-${account.id}`}
                className={`rounded-xl border px-4 py-3 ${
                  account.is_active
                    ? 'border-[color:var(--color-border-hover)] bg-[var(--color-surface-2)]'
                    : 'border-[color:var(--color-border)] bg-[var(--color-surface)] opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text)] truncate flex items-center gap-2">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: account.color }}
                      />
                      {account.name}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <FinancialIcon name={account.icon} size={12}/>
                        {getIconLabel(account.icon)}
                      </span>
                      {' · '}
                      {(account.institution ?? 'Sin banco')} · {account.type} · {account.currency}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                      Saldo: {formatCurrency(account.balance, account.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.is_active && (
                      <Link
                        href={`/transactions/new?source_account_id=${account.id}`}
                        className="text-[12px] text-emerald-400/75 hover:text-emerald-300 transition-colors"
                      >
                        Usar
                      </Link>
                    )}
                    <button
                      onClick={() => startEdit(account)}
                      disabled={saving || loading || rowActionId !== null}
                      data-testid={`portfolio-edit-${account.id}`}
                      className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                      Editar
                    </button>
                    {account.is_active ? (
                      <button
                        onClick={() => openDeactivateModal(account)}
                        disabled={saving || loading || rowActionId !== null}
                        data-testid={`portfolio-deactivate-${account.id}`}
                        className="text-[12px] text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        {rowActionId === account.id ? 'Procesando…' : 'Desactivar'}
                      </button>
                    ) : (
                      <button
                        onClick={() => void reactivate(account.id)}
                        disabled={saving || loading || rowActionId !== null}
                        data-testid={`portfolio-reactivate-${account.id}`}
                        className="text-[12px] text-emerald-400/75 hover:text-emerald-400 transition-colors"
                      >
                        {rowActionId === account.id ? 'Procesando…' : 'Reactivar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingDeactivateAccount && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[color:var(--color-overlay)] px-4"
          onClick={closeDeactivateModal}
          data-testid="portfolio-deactivate-modal"
        >
          <FocusTrap active={Boolean(pendingDeactivateAccount)} onEscape={closeDeactivateModal}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="portfolio-deactivate-title"
              onClick={event => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-modal-bg)] p-5 shadow-2xl shadow-[color:var(--color-shadow)]"
            >
              <h3 id="portfolio-deactivate-title" className="text-sm font-bold text-[var(--color-text)]">
                Desactivar cuenta
              </h3>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                La cuenta <span className="font-semibold text-[var(--color-text)]">{pendingDeactivateAccount.name}</span> dejará de
                aparecer para nuevas transacciones.
              </p>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeactivateModal}
                  disabled={rowActionId !== null}
                  data-testid="portfolio-deactivate-cancel-button"
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void deactivate(pendingDeactivateAccount.id)}
                  disabled={rowActionId !== null}
                  data-testid="portfolio-deactivate-confirm-button"
                  className="rounded-lg border border-red-400/40 bg-red-500/20 px-3 py-1.5 text-[12px] font-bold text-red-200 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {rowActionId === pendingDeactivateAccount.id ? 'Desactivando...' : 'Desactivar'}
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  )
}
