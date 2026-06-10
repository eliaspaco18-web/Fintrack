'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AccountType, CurrencyCode } from '@/types/database.types'
import type { CategoryOption, FormSelectOption } from '@/lib/contracts/ui.contracts'
import { useToast } from '@/lib/toast/toast'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { NumericInput } from '@/components/ui/NumericInput'
import { RecordModal } from '@/components/ui/RecordModal'
import { ColorSwatchPicker, IconGridPicker } from '@/components/ui/VisualPickers'
import { FormActions, FormField, FormSection, OptionalSection } from '@/components/forms/primitives'
import {
  ACCOUNT_COLOR_OPTIONS,
  ACCOUNT_ICON_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
} from '@/lib/constants/visual-options'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'

type BankEntityRef = {
  id: string
  name: string
  short_name: string | null
}

type AccountCreationForm = {
  name: string
  institution: string
  bank_entity_id: string
  type: AccountType
  currency: CurrencyCode
  initial_balance: string
  color: string
  icon: string
  include_in_net_worth: boolean
  notes: string
}

type CategoryScope = 'INCOME' | 'EXPENSE'

type CategoryCreationForm = {
  name: string
  scope: CategoryScope
  icon: string
  color: string
}

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'CHECKING', label: 'Cuenta corriente' },
  { value: 'SAVINGS', label: 'Cuenta ahorros' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'INVESTMENT', label: 'Inversion' },
  { value: 'CREDIT_CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otra' },
]

const CATEGORY_ICON_PREFIXES = [
  'wallet',
  'bank',
  'card',
  'coins',
  'savings',
  'briefcase',
  'vault',
  'chart',
  'tag',
  'home',
  'car',
  'heart',
  'book-open',
  'film',
  'package',
  'credit-card',
  'file-minus',
  'minus-circle',
]

function normalizeCategoryLabel(raw: string): string {
  const clean = raw.trim()
  if (!clean) return 'Sin categoria'

  const prefixPattern = new RegExp(`^(${CATEGORY_ICON_PREFIXES.join('|')})\\s+`, 'i')
  const withoutPrefix = clean.replace(prefixPattern, '')
  const normalized = withoutPrefix.replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : clean
}

const EMPTY_ACCOUNT_FORM: AccountCreationForm = {
  name: '',
  institution: '',
  bank_entity_id: '',
  type: 'CHECKING',
  currency: 'PEN',
  initial_balance: '0.00',
  color: '#10b981',
  icon: 'wallet',
  include_in_net_worth: true,
  notes: '',
}

const EMPTY_CATEGORY_FORM: CategoryCreationForm = {
  name: '',
  scope: 'EXPENSE',
  icon: 'tag',
  color: '#6b7280',
}

interface NestedAccountCreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: (accountOption: FormSelectOption) => void
  preferredCurrency: CurrencyCode
}

export function NestedAccountCreateModal({
  open,
  onClose,
  onCreated,
  preferredCurrency,
}: NestedAccountCreateModalProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<AccountCreationForm>({
    ...EMPTY_ACCOUNT_FORM,
    currency: preferredCurrency,
  })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [banks, setBanks] = useState<BankEntityRef[]>([])
  const [banksLoading, setBanksLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm({
      ...EMPTY_ACCOUNT_FORM,
      currency: preferredCurrency,
    })
    setAdvancedOpen(false)
    setError(null)
  }, [open, preferredCurrency])

  useEffect(() => {
    if (!open) return
    let active = true

    const loadBanks = async () => {
      setBanksLoading(true)
      try {
        const res = await fetch('/api/bank-entities?include_inactive=false', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!active) return
        if (!res.ok || !json?.ok) {
          setBanks([])
          return
        }
        setBanks(json.data as BankEntityRef[])
      } finally {
        if (active) setBanksLoading(false)
      }
    }

    void loadBanks()
    return () => { active = false }
  }, [open])

  const handleSelectBank = useCallback((bankId: string) => {
    const selected = banks.find(bank => bank.id === bankId)
    setForm(prev => ({
      ...prev,
      bank_entity_id: bankId,
      institution: selected ? (selected.short_name ?? selected.name) : prev.institution,
    }))
  }, [banks])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      const msg = 'El nombre debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo crear el portafolio', msg)
      return
    }

    const parsedInitialBalance = roundToDecimals(parseNumericInput(form.initial_balance, Number.NaN), 2)
    if (!Number.isFinite(parsedInitialBalance)) {
      const msg = 'El saldo inicial no es valido.'
      setError(msg)
      toast.error('No se pudo crear el portafolio', msg)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          institution: form.institution.trim() || null,
          bank_entity_id: form.bank_entity_id || null,
          type: form.type,
          currency: form.currency,
          initial_balance: parsedInitialBalance,
          include_in_net_worth: form.include_in_net_worth,
          color: form.color.trim() || '#10b981',
          icon: form.icon.trim() || 'wallet',
          notes: form.notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo crear el portafolio'))
      }

      const account = json.data as {
        id: string
        name: string
        currency: CurrencyCode
        balance?: number
        type?: AccountType
        icon?: string
        color?: string
      }

      onCreated({
        value: account.id,
        label: account.name,
        icon: account.icon ?? form.icon,
        color: account.color ?? form.color,
        meta: {
          currency: account.currency,
          balance: Number(account.balance ?? parsedInitialBalance),
          type: account.type ?? form.type,
        },
      })

      toast.success('Portafolio creado', `${trimmedName} ya esta disponible en esta transaccion.`)
      onClose()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo crear el portafolio'
      setError(message)
      toast.error('No se pudo crear el portafolio', message)
    } finally {
      setSaving(false)
    }
  }, [form, onClose, onCreated, toast])

  return (
    <RecordModal
      open={open}
      onClose={() => {
        if (saving) return
        onClose()
      }}
      eyebrow="Portafolio"
      title="Nuevo portafolio"
      subtitle="Crea una cuenta sin salir del registro de transacciones."
      widthClassName="max-w-[min(96vw,520px)]"
      overlayClassName="z-[132]"
      footer={(
        <FormActions
          secondaryAction={(
            <Button type="button" variant="secondary" size="lg" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          )}
          primaryAction={(
            <Button
              type="submit"
              form="nested-account-create-form"
              variant="primary"
              size="lg"
              loading={saving}
            >
              Crear portafolio
            </Button>
          )}
        />
      )}
    >
      <form id="nested-account-create-form" onSubmit={handleSubmit} className="space-y-[var(--ft-form-section-gap)]">
        <FormSection columns="1">
          <FormField label="Nombre">
            <input
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
              required
              className="field-base ft-form-input"
              placeholder="Ej: BCP Sueldo"
            />
          </FormField>

          <FormField label="Tipo">
            <AppSelect
              value={form.type}
              onChange={value => setForm(prev => ({ ...prev, type: value as AccountType }))}
              options={ACCOUNT_TYPE_OPTIONS.map(option => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </FormField>

          <FormField label="Banco" optional>
            <AppSelect
              value={form.bank_entity_id}
              onChange={handleSelectBank}
              className="w-full"
              disabled={banksLoading}
              searchPlaceholder="Buscar banco..."
              options={[
                { value: '', label: 'Sin banco' },
                ...banks.map(bank => ({
                  value: bank.id,
                  label: bank.short_name ?? bank.name,
                })),
              ]}
            />
          </FormField>

          <FormField label="Moneda">
            <AppSelect
              value={form.currency}
              onChange={value => setForm(prev => ({ ...prev, currency: value as CurrencyCode }))}
              searchable={false}
              options={[
                { value: 'PEN', label: 'PEN' },
                { value: 'USD', label: 'USD' },
              ]}
            />
          </FormField>
        </FormSection>

        <OptionalSection
          title="Mas opciones"
          summary={['Saldo inicial', 'Apariencia', 'Notas']}
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
        >
          <FormField label="Saldo inicial" optional>
            <NumericInput
              step="0.01"
              decimals={2}
              value={form.initial_balance}
              onValueChange={value => setForm(prev => ({ ...prev, initial_balance: value }))}
              className="field-base ft-form-input"
            />
          </FormField>

          <div className="space-y-2">
            <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
              Apariencia
              <span className="ml-2 text-[12px] font-medium text-[var(--ft-form-muted)]">
                Opcional
              </span>
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--ft-form-muted)]">Color</p>
                <ColorSwatchPicker
                  value={form.color}
                  onChange={color => setForm(prev => ({ ...prev, color }))}
                  palette={ACCOUNT_COLOR_OPTIONS}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--ft-form-muted)]">Icono</p>
                <IconGridPicker
                  value={form.icon}
                  onChange={icon => setForm(prev => ({ ...prev, icon }))}
                  options={ACCOUNT_ICON_OPTIONS}
                />
              </div>
            </div>
          </div>

          <FormField label="Notas" optional>
            <textarea
              value={form.notes}
              onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
              className="field-base ft-form-textarea min-h-[72px]"
              placeholder="Ej: Cuenta para gastos operativos"
            />
          </FormField>

          <label className="flex items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-4 py-3 text-[13px] text-[var(--c-text)]">
            <input
              type="checkbox"
              checked={form.include_in_net_worth}
              onChange={event => setForm(prev => ({ ...prev, include_in_net_worth: event.target.checked }))}
              className="mt-0.5"
            />
            <span>
              <span className="block font-semibold tracking-[-0.01em]">Incluir en patrimonio neto</span>
              <span className="mt-1 block text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                Activa esta cuenta si debe sumar al patrimonio general.
              </span>
            </span>
          </label>
        </OptionalSection>

        {error ? <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p> : null}
      </form>
    </RecordModal>
  )
}

interface NestedCategoryCreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: (category: CategoryOption, scope: CategoryScope) => void
  initialScope: CategoryScope
}

export function NestedCategoryCreateModal({
  open,
  onClose,
  onCreated,
  initialScope,
}: NestedCategoryCreateModalProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<CategoryCreationForm>({
    ...EMPTY_CATEGORY_FORM,
    scope: initialScope,
  })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm({
      ...EMPTY_CATEGORY_FORM,
      scope: initialScope,
    })
    setAdvancedOpen(false)
    setError(null)
  }, [initialScope, open])

  const payloadScopeOptions = useMemo(() => ([
    { value: 'INCOME', label: 'Ingreso' },
    { value: 'EXPENSE', label: 'Egreso' },
  ] satisfies Array<{ value: CategoryScope; label: string }>), [])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      const msg = 'El nombre debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo crear la categoria', msg)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          scope: form.scope,
          icon: form.icon.trim() || 'tag',
          color: form.color.trim() || '#6b7280',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo crear la categoria'))
      }

      const category = json.data as {
        id: string
        name: string
        icon: string
        color: string
        scope: CategoryScope
        system_key: string | null
      }

      onCreated({
        value: category.id,
        label: normalizeCategoryLabel(category.name),
        icon: category.icon,
        color: category.color,
        system_key: category.system_key ?? null,
      }, category.scope)

      toast.success('Categoria creada', `${trimmedName} ya esta disponible en esta transaccion.`)
      onClose()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo crear la categoria'
      setError(message)
      toast.error('No se pudo crear la categoria', message)
    } finally {
      setSaving(false)
    }
  }, [form, onClose, onCreated, toast])

  return (
    <RecordModal
      open={open}
      onClose={() => {
        if (saving) return
        onClose()
      }}
      eyebrow="Categorias"
      title="Nueva categoria"
      subtitle="Crea la categoria y continua sin salir del registro."
      widthClassName="max-w-[min(96vw,440px)]"
      overlayClassName="z-[132]"
      footer={(
        <FormActions
          secondaryAction={(
            <Button type="button" variant="secondary" size="lg" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          )}
          primaryAction={(
            <Button
              type="submit"
              form="nested-category-create-form"
              variant="primary"
              size="lg"
              loading={saving}
            >
              Crear categoria
            </Button>
          )}
        />
      )}
    >
      <form id="nested-category-create-form" onSubmit={handleSubmit} className="space-y-[var(--ft-form-section-gap)]">
        <FormSection columns="1">
          <FormField label="Nombre">
            <input
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
              className="field-base ft-form-input"
              placeholder="Ej: Suscripciones"
              required
            />
          </FormField>

          <FormField label="Uso">
            <AppSelect
              value={form.scope}
              onChange={value => setForm(prev => ({ ...prev, scope: value as CategoryScope }))}
              searchable={false}
              options={payloadScopeOptions}
            />
          </FormField>
        </FormSection>

        <OptionalSection
          title="Apariencia"
          summary={['Icono', 'Color']}
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
        >
          <div className="space-y-1.5">
            <p className="text-[12px] text-[var(--ft-form-muted)]">Icono</p>
            <IconGridPicker
              value={form.icon}
              onChange={icon => setForm(prev => ({ ...prev, icon }))}
              options={CATEGORY_ICON_OPTIONS}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[12px] text-[var(--ft-form-muted)]">Color</p>
            <ColorSwatchPicker
              value={form.color}
              onChange={color => setForm(prev => ({ ...prev, color }))}
              palette={CATEGORY_COLOR_OPTIONS}
            />
          </div>
        </OptionalSection>

        {error ? <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p> : null}
      </form>
    </RecordModal>
  )
}
