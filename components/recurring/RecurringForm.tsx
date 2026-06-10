'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { StatusBadge } from '@/components/finance'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import { Button } from '@/components/ui/Button'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { RecordModalFooter } from '@/components/ui/RecordModal'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { useToast } from '@/lib/toast/toast'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'

export interface RecurringRow {
  id: string
  name: string
  type: string
  sub_type: string | null
  source_account_id: string | null
  destination_account_id: string | null
  category_id: string | null
  amount: number
  currency: string
  description: string | null
  payment_method: string | null
  recipient: string | null
  sender: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  source_account?: { id: string; name: string; currency: string; type: string } | null
  destination_account?: { id: string; name: string; currency: string; type: string } | null
  category?: { id: string; name: string; color: string; icon: string } | null
}

type AccountOption = {
  id: string
  name: string
  type: string
  currency: string
  is_active: boolean
}

type CategoryOption = {
  id: string
  name: string
}

interface RecurringFormProps {
  recurring: RecurringRow
  onSuccess: (updated: RecurringRow) => void
  onCancel: () => void
}

interface RecurringCreateFormProps {
  onSuccess: (createdName: string) => void
  onCancel: () => void
}

type RecurringTemplateType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'RECEIVABLE' | 'PAYABLE'

export const TYPE_LABELS: Record<string, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Egreso',
  TRANSFER: 'Transferencia',
  RECEIVABLE: 'Por cobrar',
  PAYABLE: 'Por pagar',
}

const TEMPLATE_TYPE_OPTIONS: Array<{ value: RecurringTemplateType; label: string }> = [
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Egreso' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'RECEIVABLE', label: 'Por cobrar' },
  { value: 'PAYABLE', label: 'Por pagar' },
]

export function recurringTypeTone(type: string): 'success' | 'danger' | 'warning' | 'info' {
  if (type === 'INCOME') return 'success'
  if (type === 'EXPENSE') return 'danger'
  if (type === 'TRANSFER') return 'info'
  return 'warning'
}

export function recurringTypeIcon(type: string) {
  switch (type) {
    case 'INCOME':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 15 5-5 4 4 5-7" />
          <path d="M14 7h5v5" />
        </svg>
      )
    case 'EXPENSE':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="m19 9-5 5-4-4-5 7" />
          <path d="M10 17H5v-5" />
        </svg>
      )
    case 'TRANSFER':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3l4 4-4 4" />
          <path d="M3 7h18" />
          <path d="m7 21-4-4 4-4" />
          <path d="M21 17H3" />
        </svg>
      )
    case 'RECEIVABLE':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18" />
          <path d="m13 5 7 7-7 7" />
          <path d="M7 7h1" />
          <path d="M7 12h1" />
          <path d="M7 17h1" />
        </svg>
      )
    case 'PAYABLE':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12H3" />
          <path d="m11 19-7-7 7-7" />
          <path d="M16 7h1" />
          <path d="M16 12h1" />
          <path d="M16 17h1" />
        </svg>
      )
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      )
  }
}

function normalizeCurrency(currency: string): 'PEN' | 'USD' {
  return currency === 'USD' ? 'USD' : 'PEN'
}

function formatRecurringAmount(amount: number, currency: string) {
  return formatCurrency(amount, normalizeCurrency(currency))
}

function recurringAccountSummary(recurring: RecurringRow) {
  if (recurring.type === 'TRANSFER') {
    if (recurring.source_account?.name && recurring.destination_account?.name) {
      return `${recurring.source_account.name} -> ${recurring.destination_account.name}`
    }

    return recurring.source_account?.name ?? recurring.destination_account?.name ?? 'Sin cuenta vinculada'
  }

  return recurring.source_account?.name ?? recurring.destination_account?.name ?? 'Sin cuenta vinculada'
}

function templatePlaceholder(type: RecurringTemplateType) {
  switch (type) {
    case 'INCOME':
      return 'Ej: Cobro recurrente mantenimiento'
    case 'EXPENSE':
      return 'Ej: Pago mensual internet'
    case 'TRANSFER':
      return 'Ej: Fondeo semanal caja chica'
    case 'RECEIVABLE':
      return 'Ej: Prestamo recurrente a equipo'
    case 'PAYABLE':
      return 'Ej: Cuota recurrente proveedor'
    default:
      return 'Nombre de la plantilla'
  }
}

function templateCounterpartyLabel(type: RecurringTemplateType) {
  if (type === 'RECEIVABLE') return 'Contraparte'
  if (type === 'PAYABLE') return 'Contraparte'
  return ''
}

function templateCounterpartyHint(type: RecurringTemplateType) {
  if (type === 'RECEIVABLE') return 'Ej: Persona o entidad que recibe el desembolso'
  if (type === 'PAYABLE') return 'Ej: Persona o entidad asociada a la obligacion'
  return ''
}

export function RecurringForm({ recurring, onSuccess, onCancel }: RecurringFormProps) {
  const { toast } = useToast()

  const [name, setName] = useState(recurring.name)
  const [description, setDescription] = useState(recurring.description ?? '')
  const [notes, setNotes] = useState(recurring.notes ?? '')
  const [isActive, setIsActive] = useState(recurring.is_active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tone = recurringTypeTone(recurring.type)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/recurring/${recurring.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          notes: notes.trim() || null,
          is_active: isActive,
        }),
      })

      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar la plantilla'))
      }

      toast.success('Plantilla actualizada', undefined, { persist: false })
      onSuccess(json.data as RecurringRow)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar la plantilla.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form id="recurring-edit-form" onSubmit={event => void handleSubmit(event)} className="space-y-[var(--ft-form-section-gap)]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(360px,1.04fr)]">
          <FormSection
            title="Contexto readonly"
            description="Tipo, monto, cuenta y categoria se muestran como referencia fija para no alterar la estructura original de la plantilla."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <div className="flex items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border ${
                tone === 'success'
                  ? 'border-[var(--c-success)]/15 bg-[var(--c-success-soft)] text-[var(--c-success)]'
                  : tone === 'danger'
                    ? 'border-[var(--c-danger)]/15 bg-[var(--c-danger-soft)] text-[var(--c-danger)]'
                    : tone === 'warning'
                      ? 'border-[var(--c-warning)]/15 bg-[var(--c-warning-soft)] text-[var(--c-warning)]'
                      : 'border-[var(--c-info)]/15 bg-[var(--c-info-soft)] text-[var(--c-info)]'
              }`}>
                {recurringTypeIcon(recurring.type)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={tone} dot={false}>
                    {TYPE_LABELS[recurring.type] ?? recurring.type}
                  </StatusBadge>
                  <StatusBadge tone={isActive ? 'success' : 'muted'}>
                    {isActive ? 'Activa' : 'Inactiva'}
                  </StatusBadge>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--c-text-faint)]">Monto</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--c-text)]">
                      {formatRecurringAmount(recurring.amount, recurring.currency)}
                    </p>
                  </div>
                  <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--c-text-faint)]">Cuenta</p>
                    <p className="mt-1 text-[12px] leading-[1.45] text-[var(--c-text-muted)]">
                      {recurringAccountSummary(recurring)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--c-text-faint)]">Categoria</p>
                    <p className="mt-1 text-[12px] leading-[1.45] text-[var(--c-text-muted)]">
                      {recurring.category?.name ?? 'Sin categoria vinculada'}
                    </p>
                  </div>
                  <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--c-text-faint)]">Estado</p>
                    <p className="mt-1 text-[12px] leading-[1.45] text-[var(--c-text-muted)]">
                      {isActive ? 'Disponible para reutilizar' : 'Pausada sin borrar historial'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Edicion"
            description="Ajusta la metadata visible y el estado operativo de la plantilla."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre">
              <input
                id="recurring-name"
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                maxLength={150}
                placeholder="Ej: Pago mensual de internet"
                autoFocus
                className="field-base ft-form-input w-full"
              />
            </FormField>

            <FormField label="Descripcion" optional>
              <input
                id="recurring-description"
                type="text"
                value={description}
                onChange={event => setDescription(event.target.value)}
                maxLength={300}
                placeholder="Contexto corto para reconocer la plantilla mas rapido"
                className="field-base ft-form-input w-full"
              />
            </FormField>

            <FormField label="Notas" optional>
              <textarea
                id="recurring-notes"
                value={notes}
                onChange={event => setNotes(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Observaciones para el equipo o recordatorios al momento de reutilizarla"
                className="field-base ft-form-textarea w-full resize-none"
              />
            </FormField>

            <label className="flex items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={event => setIsActive(event.target.checked)}
                className="mt-1"
              />
              <span className="block">
                <span className="block text-sm font-medium text-[var(--c-text)]">Estado</span>
                <span className="block text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  Puedes activarla o pausarla desde aqui sin tocar las transacciones ya generadas.
                </span>
              </span>
            </label>
          </FormSection>
        </div>

        {error ? (
          <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
            <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
          </div>
        ) : null}
      </form>

      <RecordModalFooter>
        <FormActions
          secondaryAction={(
            <Button
              type="button"
              onClick={onCancel}
              variant="secondary"
              size="lg"
              className="text-[var(--c-text-muted)] hover:text-[var(--c-text)]"
            >
              Cancelar
            </Button>
          )}
          primaryAction={(
            <Button type="submit" form="recurring-edit-form" variant="primary" size="lg" loading={saving}>
              Guardar cambios
            </Button>
          )}
        />
      </RecordModalFooter>
    </>
  )
}

export function RecurringCreateForm({ onSuccess, onCancel }: RecurringCreateFormProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    type: 'EXPENSE' as RecurringTemplateType,
    source_account_id: '',
    destination_account_id: '',
    category_id: '',
    amount: '',
    description: '',
    notes: '',
    counterparty: '',
    is_active: true,
  })

  useEffect(() => {
    const load = async () => {
      setLoadingData(true)

      try {
        const [accountsRes, categoriesRes] = await Promise.all([
          fetch('/api/accounts', { cache: 'no-store' }),
          fetch('/api/categories', { cache: 'no-store' }),
        ])
        const [accountsJson, categoriesJson] = await Promise.all([
          accountsRes.json().catch(() => null),
          categoriesRes.json().catch(() => null),
        ])

        if (accountsJson?.ok) {
          const nextAccounts = ((accountsJson.data as AccountOption[]) ?? []).filter(account => account.is_active)
          setAccounts(nextAccounts)
          if (nextAccounts.length > 0) {
            setForm(previous => ({
              ...previous,
              source_account_id: previous.source_account_id || nextAccounts[0]?.id || '',
              destination_account_id: previous.destination_account_id || nextAccounts[1]?.id || '',
            }))
          }
        }

        if (categoriesJson?.ok) {
          setCategories((categoriesJson.data as CategoryOption[]) ?? [])
        }
      } catch {
        setError('No se pudieron cargar las opciones del formulario.')
      } finally {
        setLoadingData(false)
      }
    }

    void load()
  }, [])

  const selectedSourceAccount = useMemo(
    () => accounts.find(account => account.id === form.source_account_id) ?? null,
    [accounts, form.source_account_id],
  )

  const selectedDestinationAccount = useMemo(
    () => accounts.find(account => account.id === form.destination_account_id) ?? null,
    [accounts, form.destination_account_id],
  )

  const amountValue = roundToDecimals(parseNumericInput(form.amount, 0), 2)
  const showDestinationAccount = form.type === 'TRANSFER'
  const showCategory = form.type === 'INCOME' || form.type === 'EXPENSE'
  const showCounterparty = form.type === 'RECEIVABLE' || form.type === 'PAYABLE'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (saving) return

    const name = form.name.trim()
    if (!name) {
      setError('El nombre es obligatorio.')
      return
    }

    if (!form.source_account_id) {
      setError('Selecciona una cuenta principal.')
      return
    }

    if (showDestinationAccount && !form.destination_account_id) {
      setError('Selecciona una cuenta destino para la transferencia.')
      return
    }

    if (showDestinationAccount && form.destination_account_id === form.source_account_id) {
      setError('La cuenta origen y destino no pueden ser la misma.')
      return
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('El monto debe ser mayor a 0.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: form.type,
          source_account_id: form.source_account_id,
          destination_account_id: showDestinationAccount ? form.destination_account_id : null,
          category_id: showCategory ? form.category_id || null : null,
          amount: amountValue,
          currency: selectedSourceAccount?.currency ?? 'PEN',
          description: form.description.trim() || null,
          notes: form.notes.trim() || null,
          recipient: form.type === 'RECEIVABLE' ? form.counterparty.trim() || null : null,
          sender: form.type === 'PAYABLE' ? form.counterparty.trim() || null : null,
          is_active: form.is_active,
        }),
      })

      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo crear la plantilla recurrente'))
      }

      onSuccess(name)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo crear la plantilla recurrente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form id="recurring-create-form" onSubmit={event => void handleSubmit(event)} className="space-y-[var(--ft-form-section-gap)]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,0.96fr)_minmax(320px,0.88fr)]">
          <FormSection
            title="Tipo y cuenta"
            description="Define la familia operativa, la cuenta principal y la contraparte condicional sin bajar a otra pantalla."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Tipo">
              <AppSelect
                value={form.type}
                onChange={value => setForm(previous => ({ ...previous, type: value as RecurringTemplateType }))}
                searchable={false}
                options={TEMPLATE_TYPE_OPTIONS}
              />
            </FormField>

            <FormField label="Cuenta principal">
              {loadingData ? (
                <div className="field-base ft-form-input flex w-full items-center text-[var(--ft-form-muted)]">
                  Cargando cuentas...
                </div>
              ) : (
                <AppSelect
                  value={form.source_account_id}
                  onChange={value => setForm(previous => ({ ...previous, source_account_id: value }))}
                  options={accounts.length === 0
                    ? [{ value: '', label: 'Sin cuentas disponibles', disabled: true }]
                    : accounts.map(account => ({
                      value: account.id,
                      label: `${account.name} · ${account.currency}`,
                    }))}
                  searchPlaceholder="Buscar cuenta..."
                />
              )}
            </FormField>

            {showDestinationAccount ? (
              <FormField label="Cuenta destino">
                <AppSelect
                  value={form.destination_account_id}
                  onChange={value => setForm(previous => ({ ...previous, destination_account_id: value }))}
                  options={accounts.length === 0
                    ? [{ value: '', label: 'Sin cuentas disponibles', disabled: true }]
                    : accounts.map(account => ({
                      value: account.id,
                      label: `${account.name} · ${account.currency}`,
                    }))}
                  searchPlaceholder="Buscar cuenta destino..."
                />
              </FormField>
            ) : null}

            {showCategory ? (
              <FormField label="Categoria" optional optionalLabel="General si no eliges una">
                <AppSelect
                  value={form.category_id}
                  onChange={value => setForm(previous => ({ ...previous, category_id: value }))}
                  options={[
                    { value: '', label: 'Sin categoria' },
                    ...categories.map(category => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                  searchPlaceholder="Buscar categoria..."
                />
              </FormField>
            ) : null}

            {showCounterparty ? (
              <FormField
                label={templateCounterpartyLabel(form.type)}
                optional
              >
                <input
                  value={form.counterparty}
                  onChange={event => setForm(previous => ({ ...previous, counterparty: event.target.value }))}
                  className="field-base ft-form-input w-full"
                  placeholder={templateCounterpartyHint(form.type)}
                />
              </FormField>
            ) : null}
          </FormSection>

          <FormSection
            title="Importe"
            description="Agrupa nombre, monto, moneda contextual y descripcion para mantener la lectura financiera de un vistazo."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre">
              <input
                value={form.name}
                onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))}
                className="field-base ft-form-input w-full"
                placeholder={templatePlaceholder(form.type)}
                required
              />
            </FormField>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <FormField label="Monto">
                <NumericInput
                  step="0.01"
                  decimals={2}
                  min={0}
                  value={form.amount}
                  onValueChange={value => setForm(previous => ({ ...previous, amount: value }))}
                  className="field-base ft-form-amount-input w-full px-3.5 py-3 text-base font-semibold"
                  placeholder="0.00"
                  required
                />
              </FormField>

              <FormField
                label="Moneda"
                description="Se hereda de la cuenta principal."
              >
                <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                  <p className="text-sm font-semibold text-[var(--c-text)]">
                    {selectedSourceAccount?.currency ?? 'PEN'}
                  </p>
                  <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                    {selectedSourceAccount?.name ?? 'Selecciona una cuenta'}
                  </p>
                </div>
              </FormField>
            </div>

            <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Lectura del importe</p>
              <p className="mt-1 text-[14px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                {amountValue > 0 && selectedSourceAccount
                  ? formatRecurringAmount(amountValue, selectedSourceAccount.currency)
                  : 'Ingresa el monto de la plantilla'}
              </p>
              {showDestinationAccount && selectedDestinationAccount ? (
                <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  Destino: {selectedDestinationAccount.name}
                </p>
              ) : null}
            </div>

            <FormField label="Descripcion">
              <input
                value={form.description}
                onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))}
                className="field-base ft-form-input w-full"
                placeholder="Contexto corto para reconocer cuando usar esta plantilla"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Programacion"
            description="El layout P5 reserva esta zona. El modelo actual no persiste cronograma explicito, por eso se muestra el estado inicial y el alcance real de la plantilla."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <div className="grid gap-3">
              <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Frecuencia</p>
                <p className="mt-1 text-sm font-medium text-[var(--c-text)]">No persiste en el modelo actual</p>
                <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  La plantilla queda disponible para reutilizacion manual desde el flujo operativo.
                </p>
              </div>

              <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Proxima fecha</p>
                <p className="mt-1 text-sm font-medium text-[var(--c-text)]">No definida por backend</p>
                <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  La siguiente ejecucion no se programa en esta version sin cambiar logica o consultas.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={event => setForm(previous => ({ ...previous, is_active: event.target.checked }))}
                  className="mt-1"
                />
                <span className="block">
                  <span className="block text-sm font-medium text-[var(--c-text)]">Estado inicial</span>
                  <span className="block text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                    La plantilla se crea lista para usarse o pausada visualmente desde este modulo.
                  </span>
                </span>
              </label>
            </div>
          </FormSection>
        </div>

        <FormSection
          title="Notas"
          description="Franja compacta inferior para contexto adicional de la plantilla."
          columns="1"
          className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
        >
          <FormField label="Notas" optional>
            <textarea
              rows={3}
              value={form.notes}
              onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))}
              className="field-base ft-form-textarea w-full resize-none"
              placeholder="Reglas internas, aclaraciones o contexto de uso"
            />
          </FormField>
        </FormSection>

        {error ? (
          <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
            <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
          </div>
        ) : null}
      </form>

      <RecordModalFooter>
        <FormActions
          secondaryAction={(
            <Button
              type="button"
              onClick={onCancel}
              disabled={saving}
              variant="secondary"
              size="lg"
            >
              Cancelar
            </Button>
          )}
          primaryAction={(
            <Button
              type="submit"
              form="recurring-create-form"
              disabled={saving || loadingData || !form.source_account_id}
              loading={saving}
              variant="primary"
              size="lg"
            >
              Crear recurrente
            </Button>
          )}
        />
      </RecordModalFooter>
    </>
  )
}
