'use client'

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { StatusBadge } from '@/components/finance'
import { FormField, FormSection } from '@/components/forms/primitives'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { NumericInput } from '@/components/ui/NumericInput'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { useToast } from '@/lib/toast/toast'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { getRecurringOperation } from '@/modules/recurring/recurring-presentation'

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
  onDirtyChange: (dirty: boolean) => void
  onBusyChange: (busy: boolean) => void
}

interface RecurringCreateFormProps {
  onSuccess: (createdName: string) => void
  onDirtyChange: (dirty: boolean) => void
  onBusyChange: (busy: boolean) => void
  onReadyChange: (ready: boolean) => void
}

type RecurringTemplateType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'RECEIVABLE' | 'PAYABLE'

export const TYPE_LABELS: Record<string, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Egreso',
  TRANSFER: 'Transferencia',
  RECEIVABLE: 'Prestar dinero',
  PAYABLE: 'Recibir préstamo',
}

const TEMPLATE_TYPE_OPTIONS: Array<{ value: RecurringTemplateType; label: string }> = [
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Egreso' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'RECEIVABLE', label: 'Prestar dinero' },
  { value: 'PAYABLE', label: 'Recibir préstamo' },
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

function formatRecurringAmount(amount: number, currency: string) {
  if (currency === 'PEN' || currency === 'USD') return formatCurrency(amount, currency)
  return `${currency || 'Moneda no verificable'} ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`
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

export function RecurringForm({ recurring, onSuccess, onDirtyChange, onBusyChange }: RecurringFormProps) {
  const { toast } = useToast()

  const [name, setName] = useState(recurring.name)
  const [description, setDescription] = useState(recurring.description ?? '')
  const [notes, setNotes] = useState(recurring.notes ?? '')
  const [isActive, setIsActive] = useState(recurring.is_active)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = name !== recurring.name || description !== (recurring.description ?? '')
    || notes !== (recurring.notes ?? '') || isActive !== recurring.is_active

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  useEffect(() => onBusyChange(saving), [onBusyChange, saving])

  const operation = getRecurringOperation(recurring)
  const tone = recurringTypeTone(operation)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return

    if (!name.trim() || name.trim().length > 150 || description.trim().length > 255) {
      setError('Revisa el nombre y la descripción: el nombre es obligatorio (máximo 150 caracteres) y la descripción admite 255.')
      return
    }

    savingRef.current = true
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
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <form id="recurring-edit-form" onSubmit={event => void handleSubmit(event)} className="space-y-4">
      <FormSection title="Datos de la plantilla" className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 sm:col-span-2">
            <StatusBadge tone={tone} dot={false}>{TYPE_LABELS[operation] ?? 'Tipo no clasificado'}</StatusBadge>
            <StatusBadge tone={isActive ? 'success' : 'muted'}>{isActive ? 'Disponible' : 'Inactiva'}</StatusBadge>
          </div>
          <FormField label="Nombre">
            <input id="recurring-name" type="text" value={name} onChange={event => setName(event.target.value)} maxLength={150} placeholder="Nombre de la plantilla" autoFocus className="field-base ft-form-input w-full" />
          </FormField>
          <FormField label="Estado">
            <AppSelect value={isActive ? 'active' : 'inactive'} onChange={value => setIsActive(value === 'active')} searchable={false} options={[{ value: 'active', label: 'Disponible' }, { value: 'inactive', label: 'Inactiva' }]} />
          </FormField>
          <FormField label="Descripción" optional>
            <input id="recurring-description" type="text" value={description} onChange={event => setDescription(event.target.value)} maxLength={255} placeholder="Contexto para reconocerla" className="field-base ft-form-input w-full" />
          </FormField>
          <FormField label="Notas" optional>
            <input id="recurring-notes" type="text" value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} placeholder="Detalle opcional" className="field-base ft-form-input w-full" />
          </FormField>
        </div>
      </FormSection>

      <section className="grid gap-3 rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-4 sm:grid-cols-2" aria-label="Datos financieros de solo lectura">
        <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-[var(--ft-text-muted)] sm:col-span-2">Referencia financiera · no editable</p>
        <p className="text-[12px] text-[var(--ft-text-muted)]">Operación <strong className="font-semibold text-[var(--ft-text-strong)]">{TYPE_LABELS[operation] ?? 'Tipo no clasificado'}</strong></p>
        <p className="text-[12px] text-[var(--ft-text-muted)]">Importe <strong className="font-semibold tabular-nums text-[var(--ft-text-strong)]">{formatRecurringAmount(recurring.amount, recurring.currency)}</strong></p>
        <p className="text-[12px] text-[var(--ft-text-muted)] sm:col-span-2">Cuenta <strong className="font-semibold text-[var(--ft-text-strong)]">{recurringAccountSummary(recurring)}</strong></p>
      </section>

      {error ? <p role="alert" className="text-[12px] font-medium text-[var(--ft-danger)]">{error}</p> : null}
    </form>
  )
}

export function RecurringCreateForm({ onSuccess, onDirtyChange, onBusyChange, onReadyChange }: RecurringCreateFormProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null)

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
  })

  const dirty = form.type !== 'EXPENSE' || Boolean(
    form.name.trim() || form.source_account_id || form.destination_account_id || form.category_id
    || form.amount || form.description.trim() || form.notes.trim() || form.counterparty.trim(),
  )
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  useEffect(() => onBusyChange(saving), [onBusyChange, saving])
  useEffect(() => onReadyChange(!loadingData && accounts.length > 0), [accounts.length, loadingData, onReadyChange])

  const loadOptions = async () => {
    setLoadingData(true)
    setError(null)
    setCategoryWarning(null)

    try {
      const [accountsResult, categoriesResult] = await Promise.allSettled([
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
      ])
      if (accountsResult.status === 'rejected') throw accountsResult.reason
      const accountsRes = accountsResult.value
      const accountsJson = await accountsRes.json().catch(() => null)

      if (!accountsRes.ok || !accountsJson?.ok) throw new Error(getApiErrorMessage(accountsJson, 'No se pudieron cargar las cuentas.'))
      const nextAccounts = ((accountsJson.data as AccountOption[]) ?? []).filter(account => account.is_active)
      setAccounts(nextAccounts)

      if (categoriesResult.status === 'fulfilled') {
        const categoriesJson = await categoriesResult.value.json().catch(() => null)
        if (categoriesResult.value.ok && categoriesJson?.ok) {
          setCategories((categoriesJson.data as CategoryOption[]) ?? [])
        } else {
          setCategories([])
          setCategoryWarning(getApiErrorMessage(categoriesJson, 'Las categorías no están disponibles; puedes continuar sin asignar una.'))
        }
      } else {
        setCategories([])
        setCategoryWarning('Las categorías no están disponibles; puedes continuar sin asignar una.')
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las opciones del formulario.')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    void loadOptions()
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

    if (savingRef.current) return

    const name = form.name.trim()
    if (!name || name.length > 150 || form.description.trim().length > 255) {
      setError('El nombre es obligatorio (máximo 150 caracteres) y la descripción admite hasta 255.')
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

    savingRef.current = true
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
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <form id="recurring-create-form" onSubmit={event => void handleSubmit(event)} className="tx-modal-form !space-y-2.5" data-testid="recurring-create-form">
      <FormSection title="Identificación" className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Nombre">
            <input value={form.name} onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))} className="field-base ft-form-input w-full" placeholder={templatePlaceholder(form.type)} maxLength={150} required />
          </FormField>
          <FormField label="Tipo de operación">
            <AppSelect value={form.type} onChange={value => setForm(previous => ({ ...previous, type: value as RecurringTemplateType, category_id: '' }))} searchable={false} options={TEMPLATE_TYPE_OPTIONS} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Descripción" optional>
              <input value={form.description} onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))} className="field-base ft-form-input w-full" placeholder="Contexto breve para reconocerla" maxLength={255} />
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Datos de la operación" className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Cuenta de origen">
            {loadingData ? <div className="field-base ft-form-input flex w-full items-center text-[var(--ft-text-muted)]">Cargando cuentas…</div> : (
              <AppSelect
                value={form.source_account_id}
                onChange={value => setForm(previous => ({ ...previous, source_account_id: value }))}
                options={accounts.length ? accounts.map(account => ({ value: account.id, label: `${account.name} · ${account.currency}` })) : [{ value: '', label: 'Sin cuentas activas disponibles', disabled: true }]}
                searchPlaceholder="Buscar cuenta…"
              />
            )}
          </FormField>

          <div className="grid grid-cols-[minmax(0,1fr)_100px] items-end gap-3">
            <FormField label="Importe">
              <NumericInput value={form.amount} onValueChange={value => setForm(previous => ({ ...previous, amount: value }))} step="0.01" decimals={2} min={0} className="field-base ft-form-input w-full" placeholder="0.00" required />
            </FormField>
            <FormField label="Moneda">
              <div className="field-base ft-form-input flex w-full items-center justify-center bg-[var(--ft-surface-muted)] font-semibold tabular-nums" aria-live="polite">{selectedSourceAccount?.currency ?? '—'}</div>
            </FormField>
          </div>

          {showDestinationAccount ? (
            <FormField label="Cuenta de destino">
              <AppSelect value={form.destination_account_id} onChange={value => setForm(previous => ({ ...previous, destination_account_id: value }))} options={accounts.map(account => ({ value: account.id, label: `${account.name} · ${account.currency}` }))} searchPlaceholder="Buscar cuenta destino…" />
            </FormField>
          ) : null}

          {showCategory ? (
            <FormField label="Categoría" optional>
              <AppSelect value={form.category_id} onChange={value => setForm(previous => ({ ...previous, category_id: value }))} options={[{ value: '', label: 'Sin categoría' }, ...categories.map(category => ({ value: category.id, label: category.name }))]} searchPlaceholder="Buscar categoría…" />
            </FormField>
          ) : null}

          {showCounterparty ? (
            <FormField label={templateCounterpartyLabel(form.type)} optional>
              <input value={form.counterparty} onChange={event => setForm(previous => ({ ...previous, counterparty: event.target.value }))} className="field-base ft-form-input w-full" placeholder={templateCounterpartyHint(form.type)} maxLength={150} />
            </FormField>
          ) : null}

          {selectedDestinationAccount ? <p className="text-[12px] text-[var(--ft-text-muted)] sm:col-span-2">Destino: <strong className="font-semibold text-[var(--ft-text-strong)]">{selectedDestinationAccount.name}</strong></p> : null}
        </div>
      </FormSection>

      <FormSection title="Información adicional" className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] p-4 sm:p-5">
        <FormField label="Notas" optional>
          <textarea rows={2} value={form.notes} onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))} className="field-base ft-form-textarea w-full resize-y" placeholder="Información opcional para cuando la reutilices" maxLength={500} />
        </FormField>
      </FormSection>

      {categoryWarning && showCategory ? <p role="status" className="text-[12px] text-[var(--ft-text-muted)]">{categoryWarning}</p> : null}
      <p className="rounded-control bg-[var(--ft-surface-muted)] px-3 py-2.5 text-[12px] leading-5 text-[var(--ft-text-muted)]" role="note">La plantilla queda disponible para usar manualmente. No programa ni registra movimientos por sí sola.</p>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-[var(--ft-danger-border)] bg-[var(--ft-danger-soft)] px-3 py-2.5">
          <p role="alert" className="text-[12px] font-medium text-[var(--ft-danger)]">{error}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadOptions()} disabled={loadingData}>
            {loadingData ? 'Cargando…' : 'Reintentar'}
          </Button>
        </div>
      ) : !loadingData && accounts.length === 0 ? (
        <p role="status" className="text-[12px] text-[var(--ft-text-muted)]">No hay cuentas activas disponibles. Activa o crea una cuenta antes de guardar una plantilla.</p>
      ) : null}
    </form>
  )
}
