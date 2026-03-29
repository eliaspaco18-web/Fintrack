'use client'

// =============================================================================
// components/forms/TransactionForm/index.tsx
// Componente raíz del formulario. Orquesta secciones y flujo de envío.
//
// USO:
//   <TransactionForm
//     options={formOptions}        // cuentas y categorías (del servidor)
//     onSuccess={(result) => {}}   // callback opcional tras creación
//   />
//
// El componente es un Client Component porque necesita react-hook-form.
// Los datos del servidor (options) se pasan como props desde el Server Component.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter }                  from 'next/navigation'
import type {
  CategoryOption,
  FormSelectOption,
  TransactionFormOptions,
  TransactionFormValues,
} from '@/lib/contracts/ui.contracts'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type { CreateTransactionResult }
  from '@/modules/transactions/transaction.service.types'
import type { AccountType, CurrencyCode } from '@/types/database.types'
import { useFormOrchestrator }        from './form.orchestrator'
import { useCurrency } from '@/lib/hooks/useDashboard'
import { TypeSelector, TYPE_CONFIG }  from './TypeSelector'
import {
  FieldWrapper,
  AmountInput,
  Input,
  Select,
  Textarea,
  CheckboxToggle,
  SectionDivider,
  InlineFeedback,
}                                     from './FormFields'
import {
  AssetSection,
  ReceivableSection,
  PayableSection,
  ModuleTriggerHint,
}                                     from './sections/ModuleSections'
import { SubmitButton, SuccessSummary } from './SubmitButton'
import { useToast } from '@/lib/toast/toast'
import { FocusTrap } from '@/components/ui/accessibility'
import { ColorSwatchPicker, IconGridPicker } from '@/components/ui/VisualPickers'
import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS } from '@/lib/constants/visual-options'
import { getModuleTrigger } from '@/lib/constants/category-keys'

type QuickCreateTarget = 'account' | 'category'
type CategoryScope = 'INCOME' | 'EXPENSE' | 'BOTH'

type AccountCreateDraft = {
  name: string
  institution: string
  type: AccountType
  currency: CurrencyCode
  initial_balance: string
}

type CategoryCreateDraft = {
  name: string
  scope: CategoryScope
  icon: string
  color: string
}

type AccountApiRow = {
  id: string
  name: string
  type: AccountType
  currency: CurrencyCode
  balance: number
  icon: string | null
  color: string | null
}

type CategoryApiRow = {
  id: string
  name: string
  scope: CategoryScope
  icon: string | null
  color: string | null
  system_key: string | null
}

interface ApiErrorShape {
  ok: false
  error?: { message?: string }
}

interface AttachmentUploadResult {
  path: string
  file_name: string
  file_size: number
  content_type: string
  signed_url: string | null
}

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'CHECKING', label: 'Cuenta corriente' },
  { value: 'SAVINGS', label: 'Cuenta ahorros' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'INVESTMENT', label: 'Inversión' },
  { value: 'CREDIT_CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otra' },
]

const EMPTY_ACCOUNT_DRAFT: AccountCreateDraft = {
  name: '',
  institution: '',
  type: 'CHECKING',
  currency: 'PEN',
  initial_balance: '0',
}

const EMPTY_CATEGORY_DRAFT: CategoryCreateDraft = {
  name: '',
  scope: 'EXPENSE',
  icon: 'tag',
  color: '#6b7280',
}

const ATTACHMENT_ACCEPT =
  'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt'

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'ok' in payload &&
    (payload as ApiErrorShape).ok === false &&
    (payload as ApiErrorShape).error?.message
  ) {
    return (payload as ApiErrorShape).error?.message ?? fallback
  }

  return fallback
}

function sortSelectOptionsByLabel<T extends { label: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

function upsertCategoryOption(list: CategoryOption[], next: CategoryOption): CategoryOption[] {
  return sortSelectOptionsByLabel([
    ...list.filter(item => item.value !== next.value),
    next,
  ])
}

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
  if (!clean) return 'Sin nombre'

  const prefixPattern = new RegExp(`^(${CATEGORY_ICON_PREFIXES.join('|')})\\s+`, 'i')
  const withoutPrefix = clean.replace(prefixPattern, '')
  const normalized = withoutPrefix.replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : clean
}

// ─── PROPS ────────────────────────────────────────────────────────────────────

interface TransactionFormProps {
  options:       TransactionFormOptions
  onSuccess?:    (result: CreateTransactionResult) => void
  /** Si se pasa, muestra el summary de éxito en lugar de resetear el form */
  showSuccessSummary?: boolean
  /** Permite prefijar tipo/cuenta/categoría desde otras pantallas */
  initialValues?: Partial<TransactionFormValues>
  /** Clases extra para el wrapper externo */
  className?:    string
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export function TransactionForm({
  options,
  onSuccess,
  showSuccessSummary = true,
  initialValues,
  className = '',
}: TransactionFormProps) {
  const router = useRouter()
  const { exchangeRate: liveExchangeRate } = useCurrency()
  const { toast } = useToast()
  const [currentLiveRate, setCurrentLiveRate] = useState<number>(() => {
    return Number.isFinite(liveExchangeRate) && liveExchangeRate > 0 ? liveExchangeRate : 3.7
  })
  const [refreshingLiveRate, setRefreshingLiveRate] = useState(false)
  const [formOptions, setFormOptions] = useState<TransactionFormOptions>(options)
  const [quickCreateTarget, setQuickCreateTarget] = useState<QuickCreateTarget | null>(null)
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null)
  const [quickCreateSaving, setQuickCreateSaving] = useState(false)
  const [accountDraft, setAccountDraft] = useState<AccountCreateDraft>(EMPTY_ACCOUNT_DRAFT)
  const [categoryDraft, setCategoryDraft] = useState<CategoryCreateDraft>(EMPTY_CATEGORY_DRAFT)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [lastAttachmentTxId, setLastAttachmentTxId] = useState<string | null>(null)
  const [lastUploadedAttachment, setLastUploadedAttachment] = useState<AttachmentUploadResult | null>(null)
  const lastAutoUploadTxId = useRef<string | null>(null)

  useEffect(() => {
    setFormOptions(options)
  }, [options])

  const {
    form,
    sections,
    submitState,
    categoryOptions,
    submit,
    resetForm,
    setType,
  } = useFormOrchestrator(formOptions, onSuccess, initialValues)

  const { register, watch, setValue, formState: { errors } } = form

  const type        = watch('type')
  const currency    = watch('currency')
  const paymentMethod = watch('payment_method') ?? 'DEBIT'
  const selectedCreditCardId = watch('credit_card_id')
  const creditOperation = watch('credit_operation')
  const amount      = watch('amount')
  const categoryId  = watch('category_id')
  const createsAsset = watch('creates_asset')
  const createsReceivable = watch('creates_receivable')
  const createsPayable = watch('creates_payable')
  const exchangeRateInput = watch('exchange_rate')
  const accentColor = TYPE_CONFIG[type].accentColor
  const safeLiveRate = Number.isFinite(currentLiveRate) && currentLiveRate > 0
    ? currentLiveRate
    : 3.7
  const manualRate = typeof exchangeRateInput === 'number'
    ? exchangeRateInput
    : Number(exchangeRateInput)
  const hasManualRate = Number.isFinite(manualRate) && manualRate > 0
  const appliedRate = hasManualRate ? manualRate : safeLiveRate
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)
  const hasAmount = Number.isFinite(numericAmount) && numericAmount > 0
  const equivalentPen = hasAmount
    ? (currency === 'USD' ? numericAmount * appliedRate : numericAmount)
    : 0
  const equivalentUsd = hasAmount
    ? (currency === 'PEN' ? numericAmount / appliedRate : numericAmount)
    : 0

  useEffect(() => {
    if (!Number.isFinite(liveExchangeRate) || liveExchangeRate <= 0) return
    setCurrentLiveRate(liveExchangeRate)
  }, [liveExchangeRate])

  useEffect(() => {
    let active = true

    const refreshRate = async () => {
      setRefreshingLiveRate(true)
      try {
        const res = await fetch('/api/exchange-rate?refresh=1', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!active || !res.ok || !json?.ok) return

        const incomingRate = Number(json.data?.rate)
        if (!Number.isFinite(incomingRate) || incomingRate <= 0) return

        setCurrentLiveRate(incomingRate)
      } finally {
        if (active) setRefreshingLiveRate(false)
      }
    }

    void refreshRate()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (currency !== 'USD') return
    if (hasManualRate) return
    setValue('exchange_rate', Math.round(safeLiveRate * 1000) / 1000, { shouldValidate: true })
  }, [currency, hasManualRate, safeLiveRate, setValue])

  // ── Acciones del summary de éxito ────────────────────────────────────────

  const handleNewAfterSuccess = useCallback(() => {
    setAttachmentFile(null)
    setAttachmentError(null)
    setLastAttachmentTxId(null)
    setLastUploadedAttachment(null)
    lastAutoUploadTxId.current = null
    resetForm()
  }, [resetForm])

  const handleViewAfterSuccess = useCallback(() => {
    router.push('/transactions')
  }, [router])

  // ── Filtrar cuentas destino (excluir cuenta origen) ──────────────────────

  const sourceAccountId     = watch('source_account_id')
  const destinationAccounts = formOptions.accounts.filter(a => a.value !== sourceAccountId)

  const visibleCategoryOptions = useMemo(
    () =>
      (type === 'INCOME' ? categoryOptions.income : categoryOptions.expense).map(category => ({
        ...category,
        label: normalizeCategoryLabel(category.label),
      })),
    [type, categoryOptions.income, categoryOptions.expense]
  )
  const selectedCategory = useMemo(
    () => visibleCategoryOptions.find(category => category.value === categoryId) ?? null,
    [categoryId, visibleCategoryOptions]
  )
  const autoModule = getModuleTrigger(selectedCategory?.system_key)
  const activeExpenseModule = useMemo<'asset' | 'payable' | null>(() => {
    if (createsAsset) return 'asset'
    if (createsPayable) return 'payable'
    if (autoModule === 'asset' || autoModule === 'payable') return autoModule
    return null
  }, [autoModule, createsAsset, createsPayable])
  const activeIncomeModule = useMemo<'receivable' | null>(() => {
    if (autoModule === 'receivable') return 'receivable'
    return createsReceivable ? 'receivable' : null
  }, [autoModule, createsReceivable])
  const isExpenseCreditPayment = type === 'EXPENSE' && paymentMethod === 'CREDIT'
  const creditCardOptions = useMemo(
    () => formOptions.creditCards ?? [],
    [formOptions.creditCards]
  )
  const selectedCreditCardOption = useMemo(
    () => creditCardOptions.find(option => option.value === selectedCreditCardId) ?? null,
    [creditCardOptions, selectedCreditCardId]
  )
  const hasAccounts = formOptions.accounts.length > 0
  const hasCreditCards = creditCardOptions.length > 0
  const hasVisibleCategories = visibleCategoryOptions.length > 0
  const categoryScopeHint = type === 'INCOME' ? 'INCOME' : 'EXPENSE'

  useEffect(() => {
    if (type === 'EXPENSE') {
      if (!paymentMethod) {
        setValue('payment_method', 'DEBIT', { shouldDirty: false, shouldValidate: false })
      }
      return
    }
    setValue('payment_method', 'DEBIT', { shouldDirty: false, shouldValidate: false })
    setValue('credit_card_id', undefined, { shouldDirty: false, shouldValidate: false })
    setValue('credit_operation', undefined, { shouldDirty: false, shouldValidate: false })
  }, [paymentMethod, setValue, type])

  useEffect(() => {
    if (!isExpenseCreditPayment) return
    if (!selectedCreditCardOption) return

    const linkedAccountId = selectedCreditCardOption.meta?.account_id
    if (typeof linkedAccountId === 'string' && linkedAccountId.length > 0) {
      setValue('source_account_id', linkedAccountId, { shouldDirty: true, shouldValidate: true })
      setValue('credit_operation', 'CONSUMPTION', { shouldDirty: true, shouldValidate: false })
    }
  }, [isExpenseCreditPayment, selectedCreditCardOption, setValue])

  const setExpenseModule = useCallback((module: 'asset' | 'payable' | null) => {
    setValue('creates_asset', module === 'asset', { shouldDirty: true, shouldValidate: false })
    setValue('creates_payable', module === 'payable', { shouldDirty: true, shouldValidate: false })
  }, [setValue])

  const setIncomeModule = useCallback((module: 'receivable' | null) => {
    setValue('creates_receivable', module === 'receivable', { shouldDirty: true, shouldValidate: false })
  }, [setValue])

  const closeQuickCreate = useCallback(() => {
    setQuickCreateTarget(null)
    setQuickCreateError(null)
    setQuickCreateSaving(false)
  }, [])

  const openAccountQuickCreate = useCallback(() => {
    if (submitState.status === 'loading') return
    setQuickCreateError(null)
    setAccountDraft(prev => ({ ...EMPTY_ACCOUNT_DRAFT, currency: prev.currency }))
    setQuickCreateTarget('account')
  }, [submitState.status])

  const openCategoryQuickCreate = useCallback(() => {
    if (submitState.status === 'loading') return
    setQuickCreateError(null)
    setCategoryDraft(prev => ({
      ...prev,
      name: '',
      scope: type === 'TRANSFER' ? 'EXPENSE' : categoryScopeHint,
      icon: prev.icon || 'tag',
      color: prev.color || '#6b7280',
    }))
    setQuickCreateTarget('category')
  }, [categoryScopeHint, submitState.status, type])

  const submitQuickAccount = useCallback(async () => {
    if (quickCreateSaving) return

    const trimmedName = accountDraft.name.trim()
    if (trimmedName.length < 2) {
      setQuickCreateError('El nombre de la cuenta debe tener al menos 2 caracteres.')
      return
    }
    const parsedInitialBalance = Number(accountDraft.initial_balance || '0')
    if (!Number.isFinite(parsedInitialBalance)) {
      setQuickCreateError('El saldo inicial debe ser un número válido.')
      return
    }

    setQuickCreateSaving(true)
    setQuickCreateError(null)

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          institution: accountDraft.institution.trim() || null,
          type: accountDraft.type,
          currency: accountDraft.currency,
          initial_balance: parsedInitialBalance,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo crear la cuenta'))
      }

      const created = json.data as AccountApiRow
      const nextOption: FormSelectOption = {
        value: created.id,
        label: created.name,
        icon: created.icon ?? 'wallet',
        color: created.color ?? '#10b981',
        meta: {
          currency: created.currency,
          balance: created.balance,
          type: created.type,
        },
      }

      setFormOptions(prev => ({
        ...prev,
        accounts: sortSelectOptionsByLabel([
          ...prev.accounts.filter(account => account.value !== nextOption.value),
          nextOption,
        ]),
      }))
      setValue('source_account_id', nextOption.value, { shouldDirty: true, shouldValidate: true })
      setAccountDraft(EMPTY_ACCOUNT_DRAFT)
      closeQuickCreate()
      toast.success('Cuenta creada', 'Ya está disponible para esta transacción.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo crear la cuenta'
      setQuickCreateError(
        message
      )
      toast.error('No se pudo crear la cuenta', message)
      setQuickCreateSaving(false)
    }
  }, [accountDraft, closeQuickCreate, quickCreateSaving, setValue, toast])

  const submitQuickCategory = useCallback(async () => {
    if (quickCreateSaving) return

    const trimmedName = categoryDraft.name.trim()
    if (trimmedName.length < 2) {
      setQuickCreateError('El nombre de la categoría debe tener al menos 2 caracteres.')
      return
    }

    setQuickCreateSaving(true)
    setQuickCreateError(null)

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          scope: categoryDraft.scope,
          icon: categoryDraft.icon.trim() || 'tag',
          color: categoryDraft.color.trim() || '#6b7280',
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo crear la categoría'))
      }

      const created = json.data as CategoryApiRow
      const nextOption: CategoryOption = {
        value: created.id,
        label: normalizeCategoryLabel(created.name),
        icon: created.icon ?? 'tag',
        color: created.color ?? '#6b7280',
        system_key: created.system_key ?? null,
      }

      setFormOptions(prev => {
        const includeIncome = created.scope === 'INCOME' || created.scope === 'BOTH'
        const includeExpense = created.scope === 'EXPENSE' || created.scope === 'BOTH'

        return {
          ...prev,
          categories: {
            income: includeIncome
              ? upsertCategoryOption(prev.categories.income, nextOption)
              : prev.categories.income,
            expense: includeExpense
              ? upsertCategoryOption(prev.categories.expense, nextOption)
              : prev.categories.expense,
          },
        }
      })

      if (
        type !== 'TRANSFER' &&
        (
          (type === 'INCOME' && (created.scope === 'INCOME' || created.scope === 'BOTH')) ||
          (type === 'EXPENSE' && (created.scope === 'EXPENSE' || created.scope === 'BOTH'))
        )
      ) {
        setValue('category_id', nextOption.value, { shouldDirty: true, shouldValidate: true })
        setValue('category_system_key', nextOption.system_key ?? null, { shouldDirty: true })
      }

      setCategoryDraft(prev => ({ ...prev, name: '', scope: categoryScopeHint }))
      closeQuickCreate()
      toast.success('Categoría creada', 'Ya está disponible para esta transacción.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo crear la categoría'
      setQuickCreateError(
        message
      )
      toast.error('No se pudo crear la categoría', message)
      setQuickCreateSaving(false)
    }
  }, [categoryDraft, categoryScopeHint, closeQuickCreate, quickCreateSaving, setValue, toast, type])

  const submitCurrentQuickCreate = useCallback(async () => {
    if (quickCreateTarget === 'account') {
      await submitQuickAccount()
      return
    }
    await submitQuickCategory()
  }, [quickCreateTarget, submitQuickAccount, submitQuickCategory])

  const uploadAttachment = useCallback(async (
    transactionId: string,
    file: File | null
  ) => {
    if (!file) return

    setAttachmentUploading(true)
    setAttachmentError(null)

    try {
      const payload = new FormData()
      payload.append('file', file)

      const response = await fetch(`/api/transactions/${transactionId}/attachment`, {
        method: 'POST',
        body: payload,
      })

      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo subir el comprobante'))
      }

      const result = json.data as AttachmentUploadResult
      setAttachmentFile(null)
      setAttachmentError(null)
      setLastAttachmentTxId(transactionId)
      setLastUploadedAttachment(result)
      toast.success('Comprobante subido', `${result.file_name} fue asociado a la transaccion.`)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo subir el comprobante'
      setAttachmentError(message)
      setLastAttachmentTxId(transactionId)
      toast.error('No se pudo subir el comprobante', message)
    } finally {
      setAttachmentUploading(false)
    }
  }, [toast])

  const retryAttachmentUpload = useCallback(() => {
    if (!lastAttachmentTxId || !attachmentFile || attachmentUploading) return
    void uploadAttachment(lastAttachmentTxId, attachmentFile)
  }, [attachmentFile, attachmentUploading, lastAttachmentTxId, uploadAttachment])

  useEffect(() => {
    if (submitState.status !== 'success') return
    if (!attachmentFile) return

    const txId = submitState.data.transaction.id
    if (lastAutoUploadTxId.current === txId) return
    lastAutoUploadTxId.current = txId

    void uploadAttachment(txId, attachmentFile)
  }, [attachmentFile, submitState, uploadAttachment])

  useEffect(() => {
    if (!quickCreateTarget) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !quickCreateSaving) {
        event.preventDefault()
        closeQuickCreate()
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void submitCurrentQuickCreate()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeQuickCreate, quickCreateSaving, quickCreateTarget, submitCurrentQuickCreate])

  // ── Si hay éxito y showSuccessSummary, mostrar summary en lugar del form ──

  if (showSuccessSummary && submitState.status === 'success') {
    return (
      <div className={className}>
        <SuccessSummary
          result={submitState.data}
          onNew={handleNewAfterSuccess}
          onView={handleViewAfterSuccess}
        />
      </div>
    )
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <>
      <form
        onSubmit={submit}
        noValidate
        data-testid="transaction-form"
        className={`space-y-5 ${className}`}
      >
      {/* ── 1. SELECTOR DE TIPO ──────────────────────────────────────────── */}
      <div data-testid="transaction-type-selector">
        <TypeSelector
          value={type}
          onChange={setType}
          disabled={submitState.status === 'loading'}
        />
      </div>

      {/* ── 2. MONTO + MONEDA ────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <FieldWrapper
          label="Monto"
          required
          error={errors.amount?.message}
        >
          <AmountInput
            currency={currency}
            error={errors.amount?.message}
            data-testid="transaction-amount-input"
            {...register('amount', {
              required:     'El monto es requerido',
              valueAsNumber: true,
              validate: {
                positive:   v => Number(v) > 0 || 'El monto debe ser mayor a cero',
                twoDecimals: v => {
                  const n = Number(v)
                  return Math.round(n * 100) === n * 100 || 'Máximo 2 decimales'
                },
              },
            })}
          />
        </FieldWrapper>

        <FieldWrapper label="Moneda">
          <Select
            {...register('currency')}
            data-testid="transaction-currency-select"
            className="min-w-[90px]"
          >
            <option value="PEN">PEN (S/)</option>
            <option value="USD">USD ($)</option>
          </Select>
        </FieldWrapper>
      </div>

      {/* Tipo de cambio — slide in cuando moneda = USD */}
      <div className={`
        overflow-hidden transition-all duration-300 ease-out
        ${sections.exchangeRate ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}
      `}>
        <FieldWrapper
          label="Tipo de cambio"
          hint={`1 USD = ${formatNumber(safeLiveRate, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} PEN (${refreshingLiveRate ? 'actualizando…' : 'actual'})`}
          required
          error={errors.exchange_rate?.message}
        >
          <Input
            type="number"
            step="0.001"
            placeholder="3.750"
            error={errors.exchange_rate?.message}
            data-testid="transaction-exchange-rate-input"
            {...register('exchange_rate', {
              valueAsNumber: true,
              validate: v =>
                currency !== 'USD' ||
                (!!v && Number(v) > 0) ||
                'El tipo de cambio es requerido para USD',
            })}
          />
        </FieldWrapper>
      </div>

      {/* Equivalencia en vivo PEN/USD */}
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Equivalente estimado
          </p>
          <span className="text-[10px] text-[var(--color-text-faint)] tabular-nums">
            TC {formatNumber(appliedRate, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} PEN {refreshingLiveRate ? '· actualizando…' : ''}
          </span>
        </div>
        {!hasAmount ? (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
            Ingresa un monto para ver su equivalente en soles y dólares.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">En soles</p>
              <p className="text-[15px] font-bold tabular-nums text-emerald-400 mt-1">
                {formatCurrency(equivalentPen, 'PEN')}
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">En dólares</p>
              <p className="text-[15px] font-bold tabular-nums text-cyan-300 mt-1">
                {formatCurrency(equivalentUsd, 'USD')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. CUENTAS ───────────────────────────────────────────────────── */}
      {type === 'EXPENSE' && (
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Forma de pago del egreso
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setValue('payment_method', 'DEBIT', { shouldDirty: true, shouldValidate: false })
                setValue('credit_card_id', undefined, { shouldDirty: true, shouldValidate: false })
                setValue('credit_operation', undefined, { shouldDirty: true, shouldValidate: false })
              }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                !isExpenseCreditPayment
                  ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300'
                  : 'border-[color:var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              Débito / contado
            </button>
            <button
              type="button"
              onClick={() => {
                setValue('payment_method', 'CREDIT', { shouldDirty: true, shouldValidate: false })
                setValue('credit_operation', 'CONSUMPTION', { shouldDirty: true, shouldValidate: false })
              }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                isExpenseCreditPayment
                  ? 'border-sky-400/35 bg-sky-500/15 text-sky-300'
                  : 'border-[color:var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              Crédito (tarjeta)
            </button>
          </div>
          {isExpenseCreditPayment ? (
            <p className="mt-2 text-[11px] text-sky-200/80">
              El egreso se cargará a la tarjeta seleccionada en el módulo Créditos.
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
              Usa esta opción para pagos al contado o pagos de tarjeta desde una cuenta bancaria.
            </p>
          )}
        </div>
      )}

      <div className={`grid gap-3 ${sections.destinationAccount ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {isExpenseCreditPayment ? (
          <FieldWrapper
            label="Tarjeta de crédito"
            required
            error={errors.credit_card_id?.message || errors.source_account_id?.message}
          >
            <Select
              placeholder="Seleccionar tarjeta…"
              error={errors.credit_card_id?.message || errors.source_account_id?.message}
              data-testid="transaction-credit-card-select"
              value={selectedCreditCardId ?? ''}
              onChange={event => {
                const nextId = event.target.value
                setValue('credit_card_id', nextId || undefined, { shouldDirty: true, shouldValidate: true })
                const selected = creditCardOptions.find(option => option.value === nextId)
                const linkedAccountId = selected?.meta?.account_id
                if (typeof linkedAccountId === 'string') {
                  setValue('source_account_id', linkedAccountId, { shouldDirty: true, shouldValidate: true })
                }
              }}
            >
              {creditCardOptions.map(card => (
                <option key={card.value} value={card.value}>
                  {card.label}
                </option>
              ))}
            </Select>
            {!hasCreditCards && (
              <div className="mt-2">
                <InlineFeedback
                  type="warning"
                  message="No tienes tarjetas activas con cuenta vinculada."
                  detail="Registra tu tarjeta en Créditos y asígnale una cuenta de tarjeta."
                />
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <Link
                href="/credits"
                className="text-[11px] font-semibold text-sky-300/90 hover:text-sky-200 transition-colors"
              >
                + Registrar tarjeta en Créditos
              </Link>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                Origen: cuenta vinculada de la tarjeta
              </span>
            </div>
          </FieldWrapper>
        ) : (
          <FieldWrapper
            label={sections.sourceAccountLabel}
            required
            error={errors.source_account_id?.message}
          >
            <Select
              placeholder="Seleccionar cuenta…"
              error={errors.source_account_id?.message}
              data-testid="transaction-source-account-select"
              {...register('source_account_id', { required: 'La cuenta es requerida' })}
            >
              {formOptions.accounts.map(a => (
                <option key={a.value} value={a.value}>
                  {a.label}
                  {a.meta?.currency ? ` · ${a.meta.currency}` : ''}
                </option>
              ))}
            </Select>
            {!hasAccounts && (
              <div className="mt-2">
                <InlineFeedback
                  type="warning"
                  message="No tienes cuentas activas aún."
                  detail="Crea una cuenta rápida o configúrala en Portafolio."
                />
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={openAccountQuickCreate}
                disabled={submitState.status === 'loading' || quickCreateSaving}
                data-testid="transaction-open-quick-account"
                className="text-[11px] font-semibold text-emerald-300/85 hover:text-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Crear cuenta rápida
              </button>
              <span className="text-[10px] text-[var(--color-text-muted)]">Se guardará en Portafolio</span>
            </div>
            {type === 'EXPENSE' && hasCreditCards && (
              <div className="mt-3 rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface)] p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const nextIsPayment = creditOperation !== 'PAYMENT'
                    setValue('credit_operation', nextIsPayment ? 'PAYMENT' : undefined, { shouldDirty: true, shouldValidate: false })
                    if (!nextIsPayment) {
                      setValue('credit_card_id', undefined, { shouldDirty: true, shouldValidate: false })
                    }
                  }}
                  className="text-[11px] font-semibold text-[var(--color-text)] hover:text-emerald-300 transition-colors"
                >
                  {creditOperation === 'PAYMENT' ? 'Quitar' : 'Marcar'} como pago de tarjeta
                </button>
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  Si marcas esta opción, el pago reducirá la deuda usada de la tarjeta elegida.
                </p>
                {creditOperation === 'PAYMENT' && (
                  <div className="mt-2">
                    <Select
                      placeholder="Seleccionar tarjeta a pagar…"
                      value={selectedCreditCardId ?? ''}
                      onChange={event => {
                        const nextId = event.target.value
                        setValue('credit_card_id', nextId || undefined, { shouldDirty: true, shouldValidate: true })
                      }}
                    >
                      {creditCardOptions.map(card => (
                        <option key={card.value} value={card.value}>
                          {card.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            )}
          </FieldWrapper>
        )}

        {/* Cuenta destino (TRANSFER) */}
        <div className={`
          overflow-hidden transition-all duration-300 ease-out
          ${sections.destinationAccount ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 w-0'}
        `}>
          <FieldWrapper
            label="Cuenta destino"
            required
            error={(errors as Record<string, { message?: string }>).destination_account_id?.message}
          >
            <Select
              placeholder="Seleccionar…"
              error={(errors as Record<string, { message?: string }>).destination_account_id?.message}
              data-testid="transaction-destination-account-select"
              {...register('destination_account_id', {
                required: type === 'TRANSFER' ? 'La cuenta destino es requerida' : false,
                validate: v =>
                  type !== 'TRANSFER' ||
                  v !== sourceAccountId ||
                  'No puede ser la misma cuenta',
              })}
            >
              {destinationAccounts.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </Select>
          </FieldWrapper>
        </div>
      </div>

      {/* ── 4. CATEGORÍA (no en TRANSFER) ───────────────────────────────── */}
      {type !== 'TRANSFER' && (
        <FieldWrapper label="Categoría" error={errors.category_id?.message}>
          <Select
            placeholder="Sin categoría"
            data-testid="transaction-category-select"
            {...register('category_id')}
            onChange={e => {
              const val = e.target.value
              setValue('category_id', val)
              const allCats = [...categoryOptions.income, ...categoryOptions.expense]
              const selected = allCats.find(c => c.value === val)
              setValue('category_system_key', selected?.system_key ?? null)
            }}
          >
            {visibleCategoryOptions.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          {!hasVisibleCategories && (
            <div className="mt-2">
              <InlineFeedback
                type="info"
                message="No tienes categorías disponibles para este tipo."
                detail="Puedes crear una categoría rápida y usarla al instante."
              />
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={openCategoryQuickCreate}
              disabled={submitState.status === 'loading' || quickCreateSaving}
              data-testid="transaction-open-quick-category"
              className="text-[11px] font-semibold text-emerald-300/85 hover:text-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Crear categoría rápida
            </button>
            <span className="text-[10px] text-[var(--color-text-muted)]">Se guardará en Administración</span>
          </div>

          {type === 'EXPENSE' && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Relacionar egreso con
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: null, label: 'Ningún módulo' },
                  { value: 'asset', label: 'Activo' },
                  { value: 'payable', label: 'Por pagar' },
                ].map(option => {
                  const active = activeExpenseModule === option.value
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setExpenseModule(option.value as 'asset' | 'payable' | null)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        active
                          ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300'
                          : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {autoModule && (autoModule === 'asset' || autoModule === 'payable') && (
                <p className="text-[10px] text-[var(--color-text-faint)]">
                  Esta categoría activa automáticamente el módulo <strong className="text-[var(--color-text-muted)]">
                    {autoModule === 'asset' ? 'Activo' : 'Por pagar'}
                  </strong>.
                </p>
              )}
            </div>
          )}

          {type === 'INCOME' && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Relacionar ingreso con
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: null, label: 'Ningún módulo' },
                  { value: 'receivable', label: 'Por cobrar' },
                ].map(option => {
                  const active = activeIncomeModule === option.value
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setIncomeModule(option.value as 'receivable' | null)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        active
                          ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300'
                          : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {autoModule === 'receivable' && (
                <p className="text-[10px] text-[var(--color-text-faint)]">
                  Esta categoría activa automáticamente el módulo <strong className="text-[var(--color-text-muted)]">Por cobrar</strong>.
                </p>
              )}
            </div>
          )}

          {/* Hint cuando se selecciona categoría que activa módulo */}
          {sections.assetModule && (
            <div className="mt-2">
              <ModuleTriggerHint
                moduleName="Módulo de activo activado"
                description="Completa los datos del activo al final del formulario"
                color="#8b5cf6"
              />
            </div>
          )}
          {sections.receivableModule && (
            <div className="mt-2">
              <ModuleTriggerHint
                moduleName="Cuenta por cobrar"
                description="Indica quién te debe este dinero"
                color="#06b6d4"
              />
            </div>
          )}
          {sections.payableModule && (
            <div className="mt-2">
              <ModuleTriggerHint
                moduleName="Cuenta por pagar"
                description="Indica a quién le debes este dinero"
                color="#f97316"
              />
            </div>
          )}
        </FieldWrapper>
      )}

      {/* ── 5. DESCRIPCIÓN + FECHA ───────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <FieldWrapper
          label="Descripción"
          required
          error={errors.description?.message}
        >
          <Input
            type="text"
            placeholder="¿En qué o con quién?"
            error={errors.description?.message}
            data-testid="transaction-description-input"
            {...register('description', {
              required: 'La descripción es requerida',
              maxLength: { value: 255, message: 'Máximo 255 caracteres' },
              validate: v => v.trim().length > 0 || 'La descripción no puede estar vacía',
            })}
          />
        </FieldWrapper>

        <FieldWrapper label="Fecha" required error={errors.transaction_date?.message}>
          <Input
            type="date"
            className="min-w-[130px]"
            error={errors.transaction_date?.message}
            data-testid="transaction-date-input"
            {...register('transaction_date', { required: 'La fecha es requerida' })}
          />
        </FieldWrapper>
      </div>

      {/* ── 6. NOTAS ─────────────────────────────────────────────────────── */}
      <FieldWrapper label="Notas" hint="Opcional">
        <Textarea
          rows={2}
          placeholder="Observaciones adicionales…"
          data-testid="transaction-notes-input"
          {...register('notes')}
        />
      </FieldWrapper>

      <FieldWrapper label="Comprobante" hint="Opcional">
        <div className="rounded-xl border border-dashed border-[color:var(--color-border-hover)] bg-[var(--color-surface-2)] px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors">
              Subir archivo
              <input
                type="file"
                accept={ATTACHMENT_ACCEPT}
                data-testid="transaction-attachment-input"
                className="sr-only"
                onChange={event => {
                  const nextFile = event.target.files?.[0] ?? null
                  setAttachmentFile(nextFile)
                  setAttachmentError(null)
                  setLastAttachmentTxId(null)
                  setLastUploadedAttachment(null)
                  lastAutoUploadTxId.current = null
                }}
              />
            </label>
            {attachmentFile && (
              <button
                type="button"
                onClick={() => {
                  setAttachmentFile(null)
                  setAttachmentError(null)
                  setLastAttachmentTxId(null)
                  setLastUploadedAttachment(null)
                  lastAutoUploadTxId.current = null
                }}
                className="rounded-lg border border-[color:var(--color-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
              >
                Quitar
              </button>
            )}
          </div>

          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            {attachmentFile
              ? `Seleccionado: ${attachmentFile.name}`
              : 'Puedes adjuntar imagen, PDF o documento como constancia.'}
          </p>
          <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
            El archivo se subira automaticamente despues de registrar la transaccion.
          </p>

          {attachmentUploading && (
            <p className="mt-2 text-[11px] text-blue-300/85">Subiendo comprobante...</p>
          )}
          {lastUploadedAttachment && !attachmentUploading && !attachmentError && (
            <p className="mt-2 text-[11px] text-emerald-300/85">
              Archivo asociado: {lastUploadedAttachment.file_name}
              {lastUploadedAttachment.signed_url ? (
                <>
                  {' · '}
                  <a
                    href={lastUploadedAttachment.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-emerald-200"
                  >
                    Ver
                  </a>
                </>
              ) : null}
            </p>
          )}
          {attachmentError && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-red-400">{attachmentError}</p>
              {attachmentFile && lastAttachmentTxId && (
                <button
                  type="button"
                  onClick={retryAttachmentUpload}
                  disabled={attachmentUploading}
                  className="rounded-md border border-red-400/30 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/15 transition-colors disabled:opacity-50"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}
        </div>
      </FieldWrapper>

      {/* ── 7. MÓDULOS DERIVADOS ─────────────────────────────────────────── */}
      {(sections.assetModule || sections.receivableModule || sections.payableModule) && (
        <SectionDivider title="Módulos relacionados" accent={accentColor}/>
      )}

      {/* Activo */}
      {sections.assetModule && <AssetSection form={form}/>}

      {/* Cuenta por cobrar */}
      {sections.receivableModule && <ReceivableSection form={form}/>}

      {/* Cuenta por pagar */}
      {sections.payableModule && <PayableSection form={form}/>}

      {/* ── 8. RECURRENTE ────────────────────────────────────────────────── */}
      <div className="pt-1">
        <CheckboxToggle
          label="Transacción recurrente"
          description="Marcar si este ingreso o gasto se repite periódicamente"
          checked={!!watch('is_recurring')}
          onChange={v => setValue('is_recurring', v)}
        />
      </div>

      {/* ── 9. ERROR GLOBAL ──────────────────────────────────────────────── */}
      {submitState.status === 'error' && (
        <InlineFeedback
          type="error"
          message={submitState.error.message ?? submitState.error.root ?? 'Error inesperado'}
          detail={submitState.error.detail}
        />
      )}

      {/* ── 10. SUBMIT ───────────────────────────────────────────────────── */}
        <SubmitButton
          type={type}
          state={submitState}
          disabled={submitState.status === 'loading'}
        />
      </form>

      {quickCreateTarget && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[color:var(--color-overlay)] px-4"
          onClick={() => {
            if (!quickCreateSaving) closeQuickCreate()
          }}
          data-testid="quick-create-overlay"
        >
          <FocusTrap
            active={Boolean(quickCreateTarget)}
            onEscape={() => {
              if (!quickCreateSaving) closeQuickCreate()
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-create-title"
              onClick={event => event.stopPropagation()}
              data-testid={
                quickCreateTarget === 'account'
                  ? 'quick-account-modal'
                  : 'quick-category-modal'
              }
              className="w-full max-w-md rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-modal-bg)] p-5 shadow-2xl shadow-[color:var(--color-shadow)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="quick-create-title" className="text-sm font-bold text-[var(--color-text)]">
                    {quickCreateTarget === 'account' ? 'Crear cuenta rápida' : 'Crear categoría rápida'}
                  </h3>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    {quickCreateTarget === 'account'
                      ? 'Se agregará al Portafolio y quedará seleccionada.'
                      : 'Se agregará a Administración y quedará disponible al instante.'}
                  </p>
                </div>
                <Link
                  href={quickCreateTarget === 'account' ? '/portfolio' : '/admin'}
                  className="text-[11px] font-semibold text-emerald-300/80 hover:text-emerald-200 transition-colors"
                >
                  {quickCreateTarget === 'account' ? 'Ir a Portafolio' : 'Ir a Administración'}
                </Link>
              </div>

              {quickCreateTarget === 'account' ? (
                <div className="mt-4 space-y-3">
                  <label className="space-y-1.5 block">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Nombre *</span>
                    <Input
                      value={accountDraft.name}
                      onChange={e => setAccountDraft(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej. BCP Sueldo"
                      data-testid="quick-account-name-input"
                    />
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Banco / Institución</span>
                    <Input
                      value={accountDraft.institution}
                      onChange={e => setAccountDraft(prev => ({ ...prev, institution: e.target.value }))}
                      placeholder="Ej. BCP"
                      data-testid="quick-account-institution-input"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1.5 block">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Tipo</span>
                      <Select
                        value={accountDraft.type}
                        onChange={e => setAccountDraft(prev => ({ ...prev, type: e.target.value as AccountType }))}
                        data-testid="quick-account-type-select"
                      >
                        {ACCOUNT_TYPE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </label>

                    <label className="space-y-1.5 block">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Moneda</span>
                      <Select
                        value={accountDraft.currency}
                        onChange={e => setAccountDraft(prev => ({ ...prev, currency: e.target.value as CurrencyCode }))}
                        data-testid="quick-account-currency-select"
                      >
                        <option value="PEN">PEN</option>
                        <option value="USD">USD</option>
                      </Select>
                    </label>
                  </div>

                  <label className="space-y-1.5 block">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Saldo inicial</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={accountDraft.initial_balance}
                      onChange={e => setAccountDraft(prev => ({ ...prev, initial_balance: e.target.value }))}
                      data-testid="quick-account-balance-input"
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <label className="space-y-1.5 block">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Nombre *</span>
                    <Input
                      value={categoryDraft.name}
                      onChange={e => setCategoryDraft(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej. Alimentación"
                      data-testid="quick-category-name-input"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1.5 block">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Tipo</span>
                      <Select
                        value={categoryDraft.scope}
                        onChange={e => setCategoryDraft(prev => ({ ...prev, scope: e.target.value as CategoryScope }))}
                        data-testid="quick-category-scope-select"
                      >
                        <option value="INCOME">Ingreso</option>
                        <option value="EXPENSE">Egreso</option>
                        <option value="BOTH">Ambos</option>
                      </Select>
                    </label>
                  </div>

                  <div className="space-y-1.5 block">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Icono</span>
                    <IconGridPicker
                      value={categoryDraft.icon}
                      onChange={icon => setCategoryDraft(prev => ({ ...prev, icon }))}
                      options={CATEGORY_ICON_OPTIONS}
                      wrapperTestId="quick-category-icon-input"
                      optionTestIdPrefix="quick-category-icon-option"
                    />
                  </div>

                  <div className="space-y-1.5 block">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Color</span>
                    <ColorSwatchPicker
                      value={categoryDraft.color}
                      onChange={color => setCategoryDraft(prev => ({ ...prev, color }))}
                      palette={CATEGORY_COLOR_OPTIONS}
                      wrapperTestId="quick-category-color-options"
                      swatchTestIdPrefix="quick-category-color"
                      customInputTestId="quick-category-color-input"
                    />
                  </div>
                </div>
              )}

              {quickCreateError && (
                <p className="mt-3 text-[12px] text-red-400">{quickCreateError}</p>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <span className="mr-auto text-[10px] text-[var(--color-text-muted)]">
                  `Ctrl/Cmd + Enter` para guardar · `Esc` para cerrar
                </span>
                <button
                  type="button"
                  onClick={closeQuickCreate}
                  disabled={quickCreateSaving}
                  data-testid="quick-create-cancel"
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void submitCurrentQuickCreate()}
                  disabled={quickCreateSaving}
                  data-testid="quick-create-save"
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-bold text-[var(--color-on-accent)] hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  {quickCreateSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </>
  )
}
