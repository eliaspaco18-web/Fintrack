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
  ActionState,
  CategoryOption,
  FormSelectOption,
  TransactionFormOptions,
  TransactionFormValues,
} from '@/lib/contracts/ui.contracts'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type { CreateTransactionResult }
  from '@/modules/transactions/transaction.service.types'
import type { TransactionWithRelations } from '@/types/database.types'
import { buildPayload, useFormOrchestrator } from './form.orchestrator'
import { updateTransactionAction }     from '@/app/actions/transaction.actions'
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
import { CategoryKeys, getModuleTrigger } from '@/lib/constants/category-keys'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { hasAtMostDecimals, parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { Button } from '@/components/ui/Button'
import { FormActions, OptionalSection } from '@/components/forms/primitives'
import { RecordModalFooter } from '@/components/ui/RecordModal'
import type { OperationType } from '@/components/transactions/OperationTypeSelector'
import {
  NestedAccountCreateModal,
  NestedCategoryCreateModal,
} from './NestedRecordCreationModals'
import { StatusBadge } from '@/components/finance'

interface AttachmentUploadResult {
  path: string
  file_name: string
  file_size: number
  content_type: string
  signed_url: string | null
}

const ATTACHMENT_ACCEPT =
  'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt'

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

const FIXED_CATEGORY_BY_OPERATION: Partial<Record<OperationType, string>> = {
  receivable_issue: CategoryKeys.EXPENSE_RECEIVABLE_ISSUE,
  receivable_collect: CategoryKeys.INCOME_RECEIVABLE_COLLECTION,
  payable_issue: CategoryKeys.INCOME_PAYABLE_ISSUE,
  payable_pay: CategoryKeys.EXPENSE_PAYABLE_PAYMENT,
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
  /** PRD: ocultar el selector de tipo cuando ya se eligió desde OperationTypeSelector */
  hideTypeSelector?: boolean
  /** PRD: tipo de operación elegido (para condicionar campos según PRD v3) */
  operationType?: OperationType
  /** Permite cerrar el modal desde la barra de acciones del formulario */
  onCancel?: () => void
  /** Reutiliza el layout de creación para editar campos permitidos */
  mode?: 'create' | 'edit'
  /** ID requerido cuando mode = edit */
  transactionId?: string
  /** Callback tras actualizar en modo edición */
  onEditSuccess?: (transaction: TransactionWithRelations) => void
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export function TransactionForm({
  options,
  onSuccess,
  showSuccessSummary = true,
  initialValues,
  className = '',
  hideTypeSelector = false,
  operationType,
  onCancel,
  mode = 'create',
  transactionId,
  onEditSuccess,
}: TransactionFormProps) {
  const router = useRouter()
  const { exchangeRate: liveExchangeRate } = useCurrency()
  const { toast } = useToast()
  const isEditMode = mode === 'edit'
  const initialEditCurrency = initialValues?.currency === 'USD' ? 'USD' : 'PEN'
  const initialEditExchangeRate = (
    isEditMode
    && initialEditCurrency === 'USD'
    && typeof initialValues?.exchange_rate === 'number'
    && Number.isFinite(initialValues.exchange_rate)
    && initialValues.exchange_rate > 0
  )
    ? Number(initialValues.exchange_rate)
    : null
  const initialEditDate = isEditMode && typeof initialValues?.transaction_date === 'string'
    ? initialValues.transaction_date
    : null
  const [currentLiveRate, setCurrentLiveRate] = useState<number>(() => {
    if (initialEditExchangeRate) return initialEditExchangeRate
    return Number.isFinite(liveExchangeRate) && liveExchangeRate > 0 ? liveExchangeRate : 3.7
  })
  const [currentRateEffectiveDate, setCurrentRateEffectiveDate] = useState<string | null>(initialEditDate)
  const [refreshingLiveRate, setRefreshingLiveRate] = useState(false)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [lastAttachmentTxId, setLastAttachmentTxId] = useState<string | null>(null)
  const [lastUploadedAttachment, setLastUploadedAttachment] = useState<AttachmentUploadResult | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const userEditedExchangeRateRef = useRef(false)
  const lastAutoExchangeRateRef = useRef<number | null>(null)
  const isCompactLayout = className.includes('tx-modal-form')
  const [attachmentSectionOpen, setAttachmentSectionOpen] = useState(!isCompactLayout)
  const [inlineAccountModalOpen, setInlineAccountModalOpen] = useState(false)
  const [inlineCategoryModalOpen, setInlineCategoryModalOpen] = useState(false)
  const [inlineCategoryScope, setInlineCategoryScope] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const [advancedSectionOpen, setAdvancedSectionOpen] = useState(false)
  const [formOptions, setFormOptions] = useState<TransactionFormOptions>(options)
  const lastAutoUploadTxId = useRef<string | null>(null)
  const [editSubmitState, setEditSubmitState] =
    useState<ActionState<unknown>>({ status: 'idle' })

  useEffect(() => {
    setFormOptions(options)
  }, [options])

  useEffect(() => {
    setAttachmentSectionOpen(!isCompactLayout)
  }, [isCompactLayout])

  const {
    form,
    sections,
    submitState,
    categoryOptions,
    submit,
    resetForm,
    setType,
  } = useFormOrchestrator(formOptions, onSuccess, initialValues, operationType)

  const { register, watch, setValue, formState: { errors } } = form
  const activeSubmitState = isEditMode ? editSubmitState : submitState

  const type        = watch('type')
  const currency    = watch('currency')
  const paymentMethod = watch('payment_method') ?? 'DEBIT'
  const selectedCreditCardId = watch('credit_card_id')
  const creditOperation = watch('credit_operation')
  const amount      = watch('amount')
  const sourceAccountId = watch('source_account_id')
  const categoryId  = watch('category_id')
  const assetTypeId = watch('asset_type_id')
  const budgetId    = watch('budget_id')
  const createsAsset = watch('creates_asset')
  const createsReceivable = watch('creates_receivable')
  const createsPayable = watch('creates_payable')
  const settlementReceivableId = watch('settlement_receivable_id')
  const settlementPayableId = watch('settlement_payable_id')
  const exchangeRateInput = watch('exchange_rate')
  const transactionDate = watch('transaction_date')
  const destinationAccountId = watch('destination_account_id')
  const accentColor = TYPE_CONFIG[type].accentColor
  const safeLiveRate = Number.isFinite(currentLiveRate) && currentLiveRate > 0
    ? currentLiveRate
    : 3.7
  const manualRate = typeof exchangeRateInput === 'number'
    ? exchangeRateInput
    : Number(exchangeRateInput)
  const hasManualRate = Number.isFinite(manualRate) && manualRate > 0
  const appliedRate = currency === 'USD'
    ? (hasManualRate ? manualRate : safeLiveRate)
    : safeLiveRate
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)
  const hasAmount = Number.isFinite(numericAmount) && numericAmount > 0
  const equivalentPen = hasAmount
    ? (currency === 'USD' ? numericAmount * appliedRate : numericAmount)
    : 0
  const equivalentUsd = hasAmount
    ? (currency === 'PEN' ? numericAmount / appliedRate : numericAmount)
    : 0
  const rateDateLabel = currentRateEffectiveDate
    ? `fecha ${currentRateEffectiveDate}`
    : 'fecha seleccionada'

  useEffect(() => {
    if (transactionDate) return
    if (!Number.isFinite(liveExchangeRate) || liveExchangeRate <= 0) return
    setCurrentLiveRate(liveExchangeRate)
  }, [liveExchangeRate, transactionDate])

  // ── Fetch presupuestos activos para el selector de Egreso ────────────────
  type BudgetOption = { value: string; label: string; categoryId: string | null }
  const [activeBudgets, setActiveBudgets] = useState<BudgetOption[]>([])
  const [budgetsLoading, setBudgetsLoading] = useState(false)

  useEffect(() => {
    if (type !== 'EXPENSE' || operationType !== 'expense') {
      setActiveBudgets([])
      setBudgetsLoading(false)
      return
    }
    let cancelled = false
    setBudgetsLoading(true)
    const params = new URLSearchParams({ is_active: 'true' })
    if (categoryId) params.set('category_id', categoryId)
    if (transactionDate) params.set('transaction_date', transactionDate)
    fetch(`/api/budgets?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (cancelled || !json?.ok || !Array.isArray(json.data)) return
        setActiveBudgets(
          (json.data as Array<{ id: string; name: string; category_id: string | null; period_type: string }>).map(b => ({
            value: b.id,
            label: b.name,
            categoryId: b.category_id,
          }))
        )
      })
      .finally(() => {
        if (!cancelled) setBudgetsLoading(false)
      })
      .catch(() => { /* silencioso */ })
    return () => { cancelled = true }
  }, [categoryId, operationType, transactionDate, type])

  // Presupuestos filtrados por categoría seleccionada (o todos si no hay cat.)
  const filteredBudgets = useMemo(() => {
    if (!categoryId) return activeBudgets
    return activeBudgets.filter(b => !b.categoryId || b.categoryId === categoryId)
  }, [activeBudgets, categoryId])

  // Resetear budget_id si el presupuesto seleccionado ya no aparece
  useEffect(() => {
    if (!budgetId) return
    if (!filteredBudgets.some(b => b.value === budgetId)) {
      setValue('budget_id', undefined, { shouldDirty: false })
    }
  }, [filteredBudgets, budgetId, setValue])

  const sourceAccountOption = useMemo(
    () => formOptions.accounts.find(account => account.value === sourceAccountId) ?? null,
    [formOptions.accounts, sourceAccountId]
  )
  const destinationAccountOption = useMemo(
    () => formOptions.accounts.find(account => account.value === destinationAccountId) ?? null,
    [destinationAccountId, formOptions.accounts]
  )
  const selectedAssetTypeOption = useMemo(
    () => formOptions.assetTypes.find(assetType => assetType.value === assetTypeId) ?? null,
    [assetTypeId, formOptions.assetTypes]
  )
  const sourceAccountCurrency =
    typeof sourceAccountOption?.meta?.currency === 'string' ? sourceAccountOption.meta.currency : currency
  const destinationAccountCurrency =
    typeof destinationAccountOption?.meta?.currency === 'string' ? destinationAccountOption.meta.currency : currency
  const sourceAccountBalance =
    typeof sourceAccountOption?.meta?.balance === 'number'
      ? sourceAccountOption.meta.balance
      : typeof sourceAccountOption?.meta?.balance === 'string'
        ? Number(sourceAccountOption.meta.balance)
        : null
  const autoTransferDescription = useMemo(() => {
    if (type !== 'TRANSFER') return ''
    if (!sourceAccountOption || !destinationAccountOption) return ''
    return `Transferencia de ${sourceAccountOption.label} / ${sourceAccountOption.meta?.currency ?? currency} a ${destinationAccountOption.label} / ${destinationAccountOption.meta?.currency ?? currency}`
      .slice(0, 255)
  }, [currency, destinationAccountOption, sourceAccountOption, type])
  const shouldLockCurrencyToSourceAccount = !(type === 'EXPENSE' && paymentMethod === 'CREDIT')

  useEffect(() => {
    if (isEditMode) return
    if (type !== 'TRANSFER' || !autoTransferDescription) return

    setValue('description', autoTransferDescription, {
      shouldDirty: false,
      shouldValidate: true,
    })
  }, [autoTransferDescription, form, isEditMode, setValue, type])

  useEffect(() => {
    if (isEditMode) return
    if (!shouldLockCurrencyToSourceAccount) return
    if (!sourceAccountOption?.meta?.currency) return

    const nextCurrency = sourceAccountOption.meta.currency
    if ((currency as string | undefined) === nextCurrency) return

    setValue('currency', nextCurrency as 'PEN' | 'USD', {
      shouldDirty: false,
      shouldValidate: true,
    })
  }, [currency, isEditMode, setValue, shouldLockCurrencyToSourceAccount, sourceAccountOption])

  // ── PRD: forzar tipo de transacción según operationType prop ────────────────
  // Esto garantiza que el form siempre refleja el tipo correcto,
  // independientemente del FORM_DEFAULTS o timing de initialValues.
  useEffect(() => {
    if (!operationType) return
    const typeMap: Record<typeof operationType, TransactionFormValues['type']> = {
      income:             'INCOME',
      expense:            'EXPENSE',
      transfer:           'TRANSFER',
      asset_purchase:     'EXPENSE',
      receivable_issue:   'EXPENSE',
      receivable_collect: 'INCOME',
      payable_issue:      'INCOME',
      payable_pay:        'EXPENSE',
    }
    const targetType = typeMap[operationType]
    if (targetType && form.getValues('type') !== targetType) {
      setType(targetType)
    }
  // Solo al montar — operationType no cambia durante la vida del componente
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isEditMode) return
    if (!operationType) return

    setValue('creates_asset', operationType === 'asset_purchase', {
      shouldDirty: false,
      shouldValidate: false,
    })
    setValue('creates_receivable', operationType === 'receivable_issue', {
      shouldDirty: false,
      shouldValidate: false,
    })
    setValue('creates_payable', operationType === 'payable_issue', {
      shouldDirty: false,
      shouldValidate: false,
    })
  // Solo al montar — operationType no cambia durante la vida del componente
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isEditMode) return
    if (!initialEditExchangeRate) return

    setCurrentLiveRate(initialEditExchangeRate)
    setCurrentRateEffectiveDate(initialEditDate)
    lastAutoExchangeRateRef.current = initialEditExchangeRate
    userEditedExchangeRateRef.current = false
  }, [initialEditDate, initialEditExchangeRate, isEditMode])

  useEffect(() => {
    let active = true

    const refreshRate = async () => {
      if (
        isEditMode
        && initialEditExchangeRate
        && initialEditDate
        && transactionDate === initialEditDate
      ) {
        setCurrentLiveRate(initialEditExchangeRate)
        setCurrentRateEffectiveDate(initialEditDate)
        return
      }

      setRefreshingLiveRate(true)
      try {
        const params = new URLSearchParams({ mode: 'accounting', ensure: '1' })
        if (transactionDate) params.set('date', transactionDate)

        const res = await fetch(`/api/exchange-rate?${params.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!active || !res.ok || !json?.ok) return

        const incomingRate = Number(json.data?.rate)
        if (!Number.isFinite(incomingRate) || incomingRate <= 0) return

        setCurrentLiveRate(incomingRate)
        setCurrentRateEffectiveDate(
          typeof json.data?.effective_date === 'string'
            ? json.data.effective_date
            : transactionDate || null
        )
      } finally {
        if (active) setRefreshingLiveRate(false)
      }
    }

    void refreshRate()
    return () => { active = false }
  }, [initialEditDate, initialEditExchangeRate, isEditMode, transactionDate])

  useEffect(() => {
    if (currency !== 'USD') return
    if (
      isEditMode
      && initialEditExchangeRate
      && initialEditDate
      && transactionDate === initialEditDate
    ) {
      return
    }
    const roundedRate = Math.round(safeLiveRate * 1000) / 1000
    const lastAutoRate = lastAutoExchangeRateRef.current
    const shouldReplaceRate =
      !hasManualRate ||
      !userEditedExchangeRateRef.current ||
      (lastAutoRate !== null && Math.abs(manualRate - lastAutoRate) < 0.0005)

    if (!shouldReplaceRate) return

    lastAutoExchangeRateRef.current = roundedRate
    userEditedExchangeRateRef.current = false
    setValue('exchange_rate', roundedRate, { shouldValidate: true })
  }, [currency, hasManualRate, initialEditDate, initialEditExchangeRate, isEditMode, manualRate, safeLiveRate, setValue, transactionDate])

  // ── Acciones del summary de éxito ────────────────────────────────────────

  const handleNewAfterSuccess = useCallback(() => {
    setAttachmentFile(null)
    setAttachmentError(null)
    setLastAttachmentTxId(null)
    setLastUploadedAttachment(null)
    lastAutoUploadTxId.current = null
    lastAutoExchangeRateRef.current = null
    userEditedExchangeRateRef.current = false
    resetForm()
  }, [resetForm])

  const handleViewAfterSuccess = useCallback(() => {
    router.push('/transactions')
  }, [router])

  const editSubmit = form.handleSubmit(async values => {
    if (!transactionId) {
      setEditSubmitState({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'No se encontró el movimiento a editar.' },
      })
      return
    }

    if (lockSettlementEdit) {
      setEditSubmitState({
        status: 'error',
        error: {
          code: 'BUSINESS_RULE',
          message: 'Este cobro o pago aún no admite edición completa.',
          detail: 'Primero necesitamos persistir la distribución exacta del cobro o pago para recalcular saldos sin riesgo.',
        },
      })
      return
    }

    setEditSubmitState({ status: 'loading' })
    try {
      const payload = buildPayload(values, sections, formOptions)
      const result = await updateTransactionAction(transactionId, payload)

      if (result.ok) {
        setEditSubmitState({ status: 'success', data: result.data })
        onEditSuccess?.(result.data as TransactionWithRelations)
        return
      }

      const formError = result.error
      setEditSubmitState({ status: 'error', error: formError })
      const fieldErrors = 'fields' in formError ? formError.fields : undefined
      if (fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, msgs]) => {
          form.setError(field as keyof TransactionFormValues, {
            type: 'server',
            message: Array.isArray(msgs) ? msgs[0] : String(msgs),
          })
        })
      }
    } catch {
      setEditSubmitState({
        status: 'error',
        error: { code: 'UNEXPECTED', message: 'Error inesperado. Intenta de nuevo.' },
      })
    }
  })

  const handleFormSubmit = isEditMode ? editSubmit : submit

  // ── Filtrar cuentas destino (excluir cuenta origen) ──────────────────────

  const destinationAccounts = formOptions.accounts.filter(a => a.value !== sourceAccountId)
  const creditCardOptions = useMemo(
    () => formOptions.creditCards ?? [],
    [formOptions.creditCards]
  )
  const creditorOptions = useMemo(
    () => formOptions.creditors ?? [],
    [formOptions.creditors]
  )
  const debtorOptions = useMemo(
    () => formOptions.debtors ?? [],
    [formOptions.debtors]
  )
  const pendingReceivableOptions = useMemo(
    () => formOptions.pendingReceivables ?? [],
    [formOptions.pendingReceivables]
  )
  const pendingPayableOptions = useMemo(
    () => formOptions.pendingPayables ?? [],
    [formOptions.pendingPayables]
  )
  const selectedSettlementReceivable = useMemo(
    () => pendingReceivableOptions.find(option => option.value === settlementReceivableId) ?? null,
    [pendingReceivableOptions, settlementReceivableId]
  )
  const selectedSettlementPayable = useMemo(
    () => pendingPayableOptions.find(option => option.value === settlementPayableId) ?? null,
    [pendingPayableOptions, settlementPayableId]
  )
  const selectedSettlementKind = String(selectedSettlementReceivable?.meta?.kind ?? 'receivable')
  const selectedSettlementLinesCount = Number(selectedSettlementReceivable?.meta?.lines_count ?? 1)
  const selectedSettlementCurrency = (
    selectedSettlementReceivable?.meta?.currency ??
    selectedSettlementPayable?.meta?.currency ??
    null
  ) as 'PEN' | 'USD' | null
  const selectedSettlementPendingAmount = Number(
    selectedSettlementReceivable?.meta?.pending_amount ??
    selectedSettlementPayable?.meta?.pending_amount ??
    0
  )
  const selectedSettlementConcept = String(
    selectedSettlementReceivable?.meta?.concept ??
    selectedSettlementPayable?.meta?.concept ??
    ''
  )
  const selectedSettlementCounterparty = String(
    selectedSettlementReceivable?.meta?.debtor_name ??
    selectedSettlementPayable?.meta?.creditor_name ??
    ''
  )
  const filteredSourceAccounts = useMemo(() => {
    const currencyFilteredAccounts = selectedSettlementCurrency
      ? formOptions.accounts.filter(account => account.meta?.currency === selectedSettlementCurrency)
      : formOptions.accounts

    if (operationType === 'receivable_collect') return currencyFilteredAccounts
    if (operationType === 'payable_pay' && paymentMethod === 'CREDIT') return currencyFilteredAccounts
    if (type !== 'EXPENSE' || paymentMethod === 'CREDIT') return currencyFilteredAccounts

    const debitEligibleTypes = new Set([
      'CHECKING',
      'SAVINGS',
      'CASH',
      'INVESTMENT',
      'STOCKS',
      'ETF',
      'CRYPTO',
    ])

    return currencyFilteredAccounts.filter(account => {
      const accountType = typeof account.meta?.type === 'string' ? account.meta.type : ''
      return debitEligibleTypes.has(accountType)
    })
  }, [formOptions.accounts, operationType, paymentMethod, selectedSettlementCurrency, type])
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

  useEffect(() => {
    if (isEditMode) return
    if (!operationType) return

    const fixedCategorySystemKey = FIXED_CATEGORY_BY_OPERATION[operationType]
    if (!fixedCategorySystemKey) return

    const fixedCategory = visibleCategoryOptions.find(category => (
      category.system_key === fixedCategorySystemKey
    ))

    if (!fixedCategory) return

    if (
      categoryId === fixedCategory.value &&
      form.getValues('category_system_key') === fixedCategory.system_key
    ) {
      return
    }

    setValue('category_id', fixedCategory.value, {
      shouldDirty: false,
      shouldValidate: false,
    })
    setValue('category_system_key', fixedCategory.system_key ?? null, {
      shouldDirty: false,
      shouldValidate: false,
    })
  }, [categoryId, form, isEditMode, operationType, setValue, visibleCategoryOptions])

  const autoModule = getModuleTrigger(selectedCategory?.system_key)
  const activeExpenseModule = useMemo<'asset' | 'receivable' | null>(() => {
    if (createsAsset) return 'asset'
    if (createsReceivable) return 'receivable'
    if (autoModule === 'asset' || autoModule === 'receivable') return autoModule
    return null
  }, [autoModule, createsAsset, createsReceivable])
  const activeIncomeModule = useMemo<'payable' | null>(() => {
    if (autoModule === 'payable') return 'payable'
    return createsPayable ? 'payable' : null
  }, [autoModule, createsPayable])
  const isExpenseCreditPayment = type === 'EXPENSE' && paymentMethod === 'CREDIT'
  const selectedCreditCardOption = useMemo(
    () => creditCardOptions.find(option => option.value === selectedCreditCardId) ?? null,
    [creditCardOptions, selectedCreditCardId]
  )
  const hasAccounts = formOptions.accounts.length > 0
  const hasFilteredSourceAccounts = filteredSourceAccounts.length > 0
  const hasCreditCards = creditCardOptions.length > 0
  const hasCreditors = creditorOptions.length > 0
  const hasDebtors = debtorOptions.length > 0
  const hasPendingReceivables = pendingReceivableOptions.length > 0
  const hasPendingPayables = pendingPayableOptions.length > 0
  const hasVisibleCategories = visibleCategoryOptions.length > 0
  const showDerivedSections =
    !isEditMode && (
      (sections.assetModule && operationType !== 'asset_purchase') ||
      (sections.receivableModule && operationType !== 'receivable_issue') ||
      (sections.payableModule && operationType !== 'payable_issue')
    )
  const layoutMode = useMemo<
    OperationType
  >(() => {
    if (operationType) return operationType
    if (type === 'TRANSFER') return 'transfer'
    if (type === 'INCOME') return createsPayable ? 'payable_issue' : 'income'
    if (createsAsset) return 'asset_purchase'
    if (createsReceivable) return 'receivable_issue'
    return 'expense'
  }, [createsAsset, createsPayable, createsReceivable, operationType, type])
  const lockSettlementEdit = isEditMode && (
    operationType === 'receivable_collect'
    || operationType === 'payable_pay'
  )
  const usesProgressiveOptionalSection =
    layoutMode === 'income' ||
    layoutMode === 'expense' ||
    layoutMode === 'transfer' ||
    layoutMode === 'asset_purchase' ||
    layoutMode === 'receivable_collect' ||
    layoutMode === 'payable_pay'
  const optionalSummary = useMemo(() => {
    switch (layoutMode) {
      case 'income':
        return ['Remitente', 'Notas', 'Recurrencia', 'Comprobante']
      case 'expense':
        return ['Destinatario', 'Presupuesto', 'Notas', 'Recurrencia', 'Comprobante']
      case 'asset_purchase':
        return ['Proveedor', 'Notas', 'Comprobante']
      case 'receivable_collect':
        return ['Notas', 'Comprobante']
      case 'payable_pay':
        return ['Notas', 'Comprobante']
      case 'transfer':
        return ['Notas', 'Comprobante']
      default:
        return []
    }
  }, [layoutMode])
  const hasOptionalSectionError = Boolean(
    errors.sender?.message ||
    errors.recipient?.message ||
    errors.budget_id?.message ||
    errors.notes?.message ||
    errors.recurring_name?.message
  )
  const sourceAccountLabel = useMemo(() => {
    switch (layoutMode) {
      case 'income':
      case 'receivable_collect':
        return 'Cuenta destino'
      case 'expense':
      case 'asset_purchase':
      case 'payable_pay':
        return 'Cuenta origen'
      default:
        return sections.sourceAccountLabel
    }
  }, [layoutMode, sections.sourceAccountLabel])
  const descriptionPlaceholder = useMemo(() => {
    switch (layoutMode) {
      case 'income':
        return 'Ej: Pago de cliente ACME'
      case 'expense':
        return 'Ej: Alquiler enero'
      case 'transfer':
        return 'Ej: Transferencia a cuenta de ahorros'
      case 'asset_purchase':
        return 'Ej: Compra de equipo para operaciones'
      case 'payable_issue':
        return 'Ej: Servicio de internet mayo'
      case 'payable_pay':
        return 'Ej: Pago de servicio pendiente'
      case 'receivable_issue':
        return 'Ej: Factura F001-184 pendiente'
      case 'receivable_collect':
        return 'Ej: Cobro de factura pendiente'
      default:
        return '¿En qué o con quién?'
    }
  }, [layoutMode])

  useEffect(() => {
    if (!isEditMode || type !== 'EXPENSE') return

    if (paymentMethod === 'CREDIT' && !selectedCreditCardId && sourceAccountId) {
      const linkedCard = creditCardOptions.find(option => option.meta?.account_id === sourceAccountId)
      if (linkedCard) {
        setValue('credit_card_id', linkedCard.value, {
          shouldDirty: false,
          shouldValidate: false,
        })
      }
    }

    if (paymentMethod !== 'CREDIT' && destinationAccountId && !creditOperation) {
      const paymentCard = creditCardOptions.find(option => option.meta?.account_id === destinationAccountId)
      if (paymentCard) {
        setValue('credit_operation', 'PAYMENT', {
          shouldDirty: false,
          shouldValidate: false,
        })
        setValue('credit_card_id', paymentCard.value, {
          shouldDirty: false,
          shouldValidate: false,
        })
      }
    }
  }, [
    creditCardOptions,
    creditOperation,
    destinationAccountId,
    isEditMode,
    paymentMethod,
    selectedCreditCardId,
    setValue,
    sourceAccountId,
    type,
  ])

  useEffect(() => {
    if (operationType !== 'receivable_collect') return

    if (!selectedSettlementReceivable) {
      setValue('amount', '' as TransactionFormValues['amount'], {
        shouldDirty: false,
        shouldValidate: false,
      })
      setValue('description', '', {
        shouldDirty: false,
        shouldValidate: false,
      })
      setValue('sender', undefined, {
        shouldDirty: false,
        shouldValidate: false,
      })
      return
    }

    if (selectedSettlementCurrency) {
      setValue('currency', selectedSettlementCurrency, { shouldDirty: false, shouldValidate: true })
    }
    if (Number.isFinite(selectedSettlementPendingAmount) && selectedSettlementPendingAmount > 0) {
      setValue('amount', roundToDecimals(selectedSettlementPendingAmount, 2), {
        shouldDirty: false,
        shouldValidate: true,
      })
    }
    setValue(
      'description',
      (
        selectedSettlementKind === 'debtor_total'
          ? `Cobro general a ${selectedSettlementCounterparty}`
          : `Cobro de ${selectedSettlementConcept || 'cuenta por cobrar'} - ${selectedSettlementCounterparty}`
      ).slice(0, 255),
      { shouldDirty: false, shouldValidate: true }
    )
    setValue('sender', selectedSettlementCounterparty, { shouldDirty: false, shouldValidate: false })
  }, [
    operationType,
    selectedSettlementConcept,
    selectedSettlementCounterparty,
    selectedSettlementCurrency,
    selectedSettlementKind,
    selectedSettlementPendingAmount,
    selectedSettlementReceivable,
    setValue,
  ])

  useEffect(() => {
    if (operationType !== 'payable_pay' || !selectedSettlementPayable) return
    if (selectedSettlementCurrency) {
      setValue('currency', selectedSettlementCurrency, { shouldDirty: false, shouldValidate: true })
    }
    if (Number.isFinite(selectedSettlementPendingAmount) && selectedSettlementPendingAmount > 0) {
      setValue('amount', roundToDecimals(selectedSettlementPendingAmount, 2), {
        shouldDirty: false,
        shouldValidate: true,
      })
    }
    setValue(
      'description',
      `Pago de ${selectedSettlementConcept || 'cuenta por pagar'} - ${selectedSettlementCounterparty}`.slice(0, 255),
      { shouldDirty: false, shouldValidate: true }
    )
    setValue('recipient', selectedSettlementCounterparty, { shouldDirty: false, shouldValidate: false })
  }, [
    operationType,
    selectedSettlementConcept,
    selectedSettlementCounterparty,
    selectedSettlementCurrency,
    selectedSettlementPayable,
    selectedSettlementPendingAmount,
    setValue,
  ])

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
    if (!sourceAccountId || paymentMethod === 'CREDIT') return
    if (filteredSourceAccounts.some(account => account.value === sourceAccountId)) return

    setValue('source_account_id', '' as TransactionFormValues['source_account_id'], {
      shouldDirty: true,
      shouldValidate: true,
    })
  }, [filteredSourceAccounts, paymentMethod, setValue, sourceAccountId])

  useEffect(() => {
    if (!isExpenseCreditPayment) return
    if (!selectedCreditCardOption) return

    const linkedAccountId = selectedCreditCardOption.meta?.account_id
    if (typeof linkedAccountId === 'string' && linkedAccountId.length > 0) {
      setValue('source_account_id', linkedAccountId, { shouldDirty: true, shouldValidate: true })
      setValue('credit_operation', 'CONSUMPTION', { shouldDirty: true, shouldValidate: false })
    }
  }, [isExpenseCreditPayment, selectedCreditCardOption, setValue])

  const setExpenseModule = useCallback((module: 'asset' | 'receivable' | null) => {
    setValue('creates_asset', module === 'asset', { shouldDirty: true, shouldValidate: false })
    setValue('creates_receivable', module === 'receivable', { shouldDirty: true, shouldValidate: false })
  }, [setValue])

  const setIncomeModule = useCallback((module: 'payable' | null) => {
    setValue('creates_payable', module === 'payable', { shouldDirty: true, shouldValidate: false })
  }, [setValue])

  const handleInlineAccountCreated = useCallback((accountOption: FormSelectOption) => {
    setFormOptions(prev => {
      const alreadyExists = prev.accounts.some(account => account.value === accountOption.value)
      const merged = alreadyExists
        ? prev.accounts.map(account => (account.value === accountOption.value ? accountOption : account))
        : [...prev.accounts, accountOption]

      return {
        ...prev,
        accounts: [...merged].sort((a, b) => a.label.localeCompare(b.label, 'es')),
      }
    })

    setValue('source_account_id', accountOption.value, { shouldDirty: true, shouldValidate: true })
    setInlineAccountModalOpen(false)
  }, [setValue])

  const handleInlineCategoryCreated = useCallback((
    categoryOption: CategoryOption,
    scope: 'INCOME' | 'EXPENSE',
  ) => {
    setFormOptions(prev => {
      const upsertCategoryList = (list: CategoryOption[]) => {
        const alreadyExists = list.some(category => category.value === categoryOption.value)
        const merged = alreadyExists
          ? list.map(category => (category.value === categoryOption.value ? categoryOption : category))
          : [...list, categoryOption]

        return [...merged].sort((a, b) => a.label.localeCompare(b.label, 'es'))
      }

      return {
        ...prev,
        categories: {
          income: scope === 'INCOME'
            ? upsertCategoryList(prev.categories.income)
            : prev.categories.income,
          expense: scope === 'EXPENSE'
            ? upsertCategoryList(prev.categories.expense)
            : prev.categories.expense,
        },
      }
    })

    if (type !== 'TRANSFER') {
      setValue('category_id', categoryOption.value, { shouldDirty: true, shouldValidate: true })
      setValue('category_system_key', categoryOption.system_key ?? null, { shouldDirty: true, shouldValidate: false })
    }
    setInlineCategoryModalOpen(false)
  }, [setValue, type])

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
    if (isEditMode) return
    if (!attachmentFile && !attachmentUploading && !attachmentError && !lastUploadedAttachment) return
    setAttachmentSectionOpen(true)
  }, [attachmentError, attachmentFile, attachmentUploading, isEditMode, lastUploadedAttachment])

  useEffect(() => {
    if (!usesProgressiveOptionalSection) return
    if (
      hasOptionalSectionError ||
      (!isEditMode && Boolean(attachmentFile)) ||
      (!isEditMode && Boolean(attachmentError)) ||
      Boolean(lastUploadedAttachment) ||
      Boolean(watch('is_recurring'))
    ) {
      setAdvancedSectionOpen(true)
    }
  }, [
    attachmentError,
    attachmentFile,
    hasOptionalSectionError,
    isEditMode,
    lastUploadedAttachment,
    usesProgressiveOptionalSection,
    watch,
  ])

  useEffect(() => {
    const formElement = formRef.current
    const modalBody = formElement?.closest<HTMLElement>('[data-record-modal-body="true"]')
    if (!formElement || !modalBody) return

    const syncOverflow = () => {
      const isDesktop = window.matchMedia('(min-width: 860px)').matches
      const isShortViewport = window.innerHeight < 720
      const shouldForceAuto = !usesProgressiveOptionalSection || advancedSectionOpen || !isDesktop || isShortViewport

      if (shouldForceAuto) {
        modalBody.style.overflowY = ''
        return
      }

      const fitsWithoutScroll = formElement.scrollHeight <= modalBody.clientHeight
      modalBody.style.overflowY = fitsWithoutScroll ? 'hidden' : ''
    }

    syncOverflow()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncOverflow)
      : null

    resizeObserver?.observe(formElement)
    resizeObserver?.observe(modalBody)
    window.addEventListener('resize', syncOverflow)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', syncOverflow)
      modalBody.style.overflowY = ''
    }
  }, [advancedSectionOpen, usesProgressiveOptionalSection])

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

  const amountCurrencyField = (
    <div className={isCompactLayout ? 'grid grid-cols-[1fr_auto] gap-2' : 'grid grid-cols-[1fr_auto] gap-3'}>
      <FieldWrapper
        label={layoutMode === 'asset_purchase' ? 'Valor de compra' : 'Monto'}
        required
        error={errors.amount?.message}
      >
        <AmountInput
          currency={currency as 'PEN' | 'USD'}
          error={errors.amount?.message}
          data-testid="transaction-amount-input"
          disabled={lockSettlementEdit}
          {...register('amount', {
            required: 'El monto es requerido',
            setValueAs: value => {
              const parsed = parseNumericInput(value, Number.NaN)
              if (!Number.isFinite(parsed)) return undefined
              return roundToDecimals(parsed, 2)
            },
            validate: {
              positive: v => Number(v) > 0 || 'El monto debe ser mayor a cero',
              twoDecimals: v => {
                const n = Number(v)
                return hasAtMostDecimals(n, 2) || 'Máximo 2 decimales'
              },
              pendingLimit: v => {
                if (operationType !== 'receivable_collect' && operationType !== 'payable_pay') return true
                if (operationType === 'receivable_collect' && !settlementReceivableId) return true
                if (operationType === 'payable_pay' && !settlementPayableId) return true
                const n = Number(v)
                return n <= selectedSettlementPendingAmount || 'El monto no puede superar el saldo pendiente'
              },
            },
          })}
        />
      </FieldWrapper>

      <FieldWrapper
        label="Moneda"
        hint={isExpenseCreditPayment
          ? 'Puedes registrar consumos de tarjeta en soles o dólares.'
          : 'Se sincroniza con el portafolio seleccionado.'}
      >
        <Select
          {...register('currency')}
          compact
          data-testid="transaction-currency-select"
          className="w-[120px]"
          disabled={lockSettlementEdit || !isExpenseCreditPayment}
        >
          <option value="PEN">PEN (S/)</option>
          <option value="USD">USD ($)</option>
        </Select>
      </FieldWrapper>
    </div>
  )

  const exchangeRateField = (
    <div
      className={`
        overflow-hidden transition-all duration-300 ease-out
        ${sections.exchangeRate ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}
      `}
    >
      <FieldWrapper
        label="Tipo de cambio"
        hint={`1 USD = ${formatNumber(safeLiveRate, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} PEN (${refreshingLiveRate ? 'actualizando…' : rateDateLabel})`}
        required
        error={errors.exchange_rate?.message}
      >
        <Input
          type="number"
          step="0.001"
          placeholder="3.750"
          error={errors.exchange_rate?.message}
          data-testid="transaction-exchange-rate-input"
          disabled={lockSettlementEdit}
          {...register('exchange_rate', {
            onChange: () => {
              userEditedExchangeRateRef.current = true
            },
            setValueAs: value => {
              const parsed = parseNumericInput(value, Number.NaN)
              if (!Number.isFinite(parsed)) return undefined
              return roundToDecimals(parsed, 3)
            },
            validate: v =>
              currency !== 'USD' ||
              (!!v && Number(v) > 0) ||
              'El tipo de cambio es requerido para USD',
          })}
        />
      </FieldWrapper>
    </div>
  )

  const equivalenceField = isCompactLayout ? (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--c-text-muted)]">
        Equiv.
      </span>
      {hasAmount ? (
        <div className="flex items-center gap-3 text-[11px]">
          <span className="tabular-nums text-[var(--c-primary)] font-semibold">
            {formatCurrency(equivalentPen, 'PEN')}
          </span>
          <span className="tabular-nums text-cyan-300 font-semibold">
            {formatCurrency(equivalentUsd, 'USD')}
          </span>
        </div>
      ) : (
        <span className="text-[10px] text-[var(--c-text-faint)]">
          Ingresa monto
        </span>
      )}
      <span className="text-[9px] text-[var(--c-text-faint)] tabular-nums">
        TC {formatNumber(appliedRate, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
      </span>
    </div>
  ) : (
    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
          Equivalente estimado
        </p>
        <span className="text-[10px] text-[var(--c-text-faint)] tabular-nums">
          TC {formatNumber(appliedRate, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} PEN {refreshingLiveRate ? '· actualizando…' : ''}
        </span>
      </div>
      {!hasAmount ? (
        <p className="mt-1.5 text-[11px] text-[var(--c-text-muted)]">
          Ingresa un monto para ver su equivalente en soles y dólares.
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)]">En soles</p>
            <p className="mt-1 text-[15px] font-bold tabular-nums text-[var(--c-primary)]">
              {formatCurrency(equivalentPen, 'PEN')}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)]">En dólares</p>
            <p className="mt-1 text-[15px] font-bold tabular-nums text-cyan-300">
              {formatCurrency(equivalentUsd, 'USD')}
            </p>
          </div>
        </div>
      )}
    </div>
  )

  const paymentMethodField = type === 'EXPENSE' && operationType !== 'transfer' && operationType !== 'asset_purchase' && operationType !== 'payable_issue' && operationType !== 'receivable_issue' && operationType !== 'receivable_collect' ? (
    <div className={`rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] ${isCompactLayout ? 'px-3 py-2' : 'px-3.5 py-3'}`}>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
        Forma de pago
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={lockSettlementEdit}
          onClick={() => {
            setValue('payment_method', 'DEBIT', { shouldDirty: true, shouldValidate: false })
            setValue('credit_card_id', undefined, { shouldDirty: true, shouldValidate: false })
            setValue('credit_operation', undefined, { shouldDirty: true, shouldValidate: false })
          }}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            !isExpenseCreditPayment
              ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]'
              : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
          }`}
        >
          Débito
        </button>
        <button
          type="button"
          disabled={lockSettlementEdit}
          onClick={() => {
            setValue('payment_method', 'CREDIT', { shouldDirty: true, shouldValidate: false })
            setValue('credit_operation', 'CONSUMPTION', { shouldDirty: true, shouldValidate: false })
          }}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            isExpenseCreditPayment
              ? 'border-sky-400/35 bg-sky-500/15 text-sky-300'
              : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
          }`}
        >
          Crédito
        </button>
      </div>
      {!isCompactLayout && (
        isExpenseCreditPayment ? (
          <p className="mt-2 text-[11px] text-sky-200/80">
            El egreso se cargará a la tarjeta seleccionada en el módulo Créditos.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-[var(--c-text-muted)]">
            Usa esta opción para pagos al contado o pagos de tarjeta desde una cuenta bancaria.
          </p>
        )
      )}
    </div>
  ) : null

  const transferAccountsField = operationType === 'transfer' ? (
    <div className="grid grid-cols-1 gap-3 min-[860px]:grid-cols-2">
      <FieldWrapper
        label="Cuenta origen"
        required
        error={errors.source_account_id?.message}
      >
        <Select
          placeholder="Cuenta origen…"
          error={errors.source_account_id?.message}
          data-testid="transaction-source-account-select"
          disabled={lockSettlementEdit}
          {...register('source_account_id', { required: 'La cuenta origen es requerida' })}
        >
          {formOptions.accounts.map(a => (
            <option key={a.value} value={a.value}>
              {a.label}{a.meta?.currency ? ` · ${a.meta.currency}` : ''}
            </option>
          ))}
        </Select>
        {!hasAccounts && (
          <div className="mt-2">
            <InlineFeedback type="warning" message="No tienes cuentas activas." detail="Crea una en Portafolio." />
          </div>
        )}
      </FieldWrapper>
      <FieldWrapper
        label="Cuenta destino"
        required
        error={(errors as Record<string, { message?: string }>).destination_account_id?.message}
      >
        <Select
          placeholder="Cuenta destino…"
          error={(errors as Record<string, { message?: string }>).destination_account_id?.message}
          data-testid="transaction-destination-account-select"
          disabled={lockSettlementEdit}
          {...register('destination_account_id', {
            required: 'La cuenta destino es requerida',
            validate: v => v !== sourceAccountId || 'No puede ser la misma cuenta',
          })}
        >
          {destinationAccounts.map(a => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </Select>
      </FieldWrapper>
    </div>
  ) : null

  const accountField = operationType !== 'transfer' ? (
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
            disabled={lockSettlementEdit}
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
                message="No tienes tarjetas activas."
                detail="Registra tu tarjeta en Créditos; FinTrack creará la cuenta técnica automáticamente."
              />
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <Link
              href="/credits"
              className="text-[11px] font-semibold text-sky-300/90 transition-colors hover:text-sky-200"
            >
              + Nueva tarjeta
            </Link>
            <span className="text-[10px] text-[var(--c-text-muted)]">
              Origen: tarjeta seleccionada
            </span>
          </div>
        </FieldWrapper>
      ) : (
        <FieldWrapper
          label={sourceAccountLabel}
          required
          error={errors.source_account_id?.message}
        >
          <Select
            placeholder="Seleccionar cuenta…"
            error={errors.source_account_id?.message}
            data-testid="transaction-source-account-select"
            disabled={lockSettlementEdit}
            {...register('source_account_id', { required: 'La cuenta es requerida' })}
          >
            {filteredSourceAccounts.map(a => (
              <option key={a.value} value={a.value}>
                {a.label}
                {a.meta?.currency ? ` · ${a.meta.currency}` : ''}
              </option>
            ))}
          </Select>
          {!hasFilteredSourceAccounts && (
            <div className="mt-2">
              <InlineFeedback
                type="warning"
                message="No tienes portafolios compatibles para esta operación."
                detail="Crea o activa un portafolio apto en Portafolio y vuelve para seleccionarlo."
              />
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              disabled={lockSettlementEdit}
              onClick={() => setInlineAccountModalOpen(true)}
              className="text-[11px] font-semibold text-[var(--c-primary)]/85 transition-colors hover:text-[var(--c-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Crear cuenta
            </button>
          </div>
          {type === 'EXPENSE' && hasCreditCards && operationType !== 'asset_purchase' && operationType !== 'payable_issue' && operationType !== 'receivable_issue' && operationType !== 'receivable_collect' && (
            <div className="mt-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] p-2.5">
              <button
                type="button"
                disabled={lockSettlementEdit}
                onClick={() => {
                  const nextIsPayment = creditOperation !== 'PAYMENT'
                  setValue('credit_operation', nextIsPayment ? 'PAYMENT' : undefined, { shouldDirty: true, shouldValidate: false })
                  if (!nextIsPayment) {
                    setValue('credit_card_id', undefined, { shouldDirty: true, shouldValidate: false })
                  }
                }}
                className="text-[11px] font-semibold text-[var(--c-text)] transition-colors hover:text-[var(--c-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creditOperation === 'PAYMENT' ? 'Quitar' : 'Marcar'} como pago de tarjeta
              </button>
              <p className="mt-1 text-[10px] text-[var(--c-text-muted)]">
                Si marcas esta opción, el pago reducirá la deuda usada de la tarjeta elegida.
              </p>
              {creditOperation === 'PAYMENT' && (
                <div className="mt-2">
                  <Select
                    placeholder="Seleccionar tarjeta a pagar…"
                    value={selectedCreditCardId ?? ''}
                    disabled={lockSettlementEdit}
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
            disabled={lockSettlementEdit}
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
  ) : null

  const transferSummaryField = layoutMode === 'transfer' ? (
    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
            Resumen de transferencia
          </p>
          <p className="mt-1 text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
            {sourceAccountOption?.label ?? 'Cuenta origen'} {'->'} {destinationAccountOption?.label ?? 'Cuenta destino'}
          </p>
        </div>
        <div className="text-right text-[11px] text-[var(--c-text-muted)]">
          <p>{sourceAccountCurrency} {'->'} {destinationAccountCurrency}</p>
          <p className="tabular-nums">
            {sourceAccountBalance !== null && Number.isFinite(sourceAccountBalance)
              ? `Saldo disponible ${formatCurrency(sourceAccountBalance, sourceAccountCurrency as 'PEN' | 'USD')}`
              : 'Selecciona ambas cuentas'}
          </p>
        </div>
      </div>
    </div>
  ) : null

  const categoryField = operationType !== 'transfer' && type !== 'TRANSFER' && operationType !== 'asset_purchase' && operationType !== 'payable_issue' && operationType !== 'payable_pay' && operationType !== 'receivable_issue' && operationType !== 'receivable_collect' ? (
    <FieldWrapper
      label="Categoría"
      required
      error={errors.category_id?.message}
      className=""
    >
      <Select
        placeholder="Sin categoría"
        data-testid="transaction-category-select"
        {...register('category_id', {
          required: 'La categoría es requerida',
          validate: value => !!value || 'La categoría es requerida',
        })}
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
            detail="Crea la categoría en Administración y vuelve para seleccionarla."
          />
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setInlineCategoryScope(type === 'INCOME' ? 'INCOME' : 'EXPENSE')
            setInlineCategoryModalOpen(true)
          }}
          className="text-[11px] font-semibold text-[var(--c-primary)]/85 transition-colors hover:text-[var(--c-primary)]"
        >
          + Crear categoría
        </button>
      </div>

      {type === 'EXPENSE' && !hideTypeSelector && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
            Relacionar egreso con
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: null, label: 'Ningún módulo' },
              { value: 'asset', label: 'Activo' },
              { value: 'receivable', label: 'Por cobrar' },
            ].map(option => {
              const active = activeExpenseModule === option.value
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setExpenseModule(option.value as 'asset' | 'receivable' | null)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]'
                      : 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {autoModule && (autoModule === 'asset' || autoModule === 'receivable') && (
            <p className="text-[10px] text-[var(--c-text-faint)]">
              Esta categoría activa automáticamente el módulo <strong className="text-[var(--c-text-muted)]">
                {autoModule === 'asset' ? 'Activo' : 'Por cobrar'}
              </strong>.
            </p>
          )}
        </div>
      )}

      {type === 'INCOME' && !hideTypeSelector && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
            Relacionar ingreso con
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: null, label: 'Ningún módulo' },
              { value: 'payable', label: 'Por pagar' },
            ].map(option => {
              const active = activeIncomeModule === option.value
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setIncomeModule(option.value as 'payable' | null)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]'
                      : 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {autoModule === 'payable' && (
            <p className="text-[10px] text-[var(--c-text-faint)]">
              Esta categoría activa automáticamente el módulo <strong className="text-[var(--c-text-muted)]">Por pagar</strong>.
            </p>
          )}
        </div>
      )}

      {!isEditMode && sections.assetModule && (
        <div className="mt-2">
          <ModuleTriggerHint
            moduleName="Módulo de activo activado"
            description="Completa los datos del activo al final del formulario"
            color="#8b5cf6"
          />
        </div>
      )}
      {!isEditMode && sections.receivableModule && (
        <div className="mt-2">
          <ModuleTriggerHint
            moduleName="Cuenta por cobrar"
            description="Indica quién te debe este dinero"
            color="#06b6d4"
          />
        </div>
      )}
      {!isEditMode && sections.payableModule && (
        <div className="mt-2">
          <ModuleTriggerHint
            moduleName="Cuenta por pagar"
            description="Indica a quién le debes este dinero"
            color="#f97316"
          />
        </div>
      )}
    </FieldWrapper>
  ) : null

  const assetPurchaseField = operationType === 'asset_purchase' ? (
    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
            Activo
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
            Define primero el activo y usa el mismo monto de la transacción como valor de compra.
          </p>
        </div>
        <StatusBadge tone="primary" dot={false}>
          Mismo monto
        </StatusBadge>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <input
          type="hidden"
          {...register('asset_type_id', { required: 'Selecciona el tipo de activo' })}
        />
        <input
          type="hidden"
          {...register('asset_type', { required: 'Selecciona el tipo de activo' })}
        />
        <FieldWrapper
          label="Nombre del activo"
          required
          error={errors.asset_name?.message}
        >
          <Input
            type="text"
            placeholder="Ej: MacBook Pro 14"
            error={errors.asset_name?.message}
            data-testid="transaction-asset-name-input"
            {...register('asset_name', {
              required: 'Ingresa el nombre del activo',
            })}
          />
        </FieldWrapper>

        <FieldWrapper
          label="Tipo de activo"
          required
          error={errors.asset_type_id?.message || errors.asset_type?.message}
        >
          <Select
            value={assetTypeId ?? ''}
            onChange={event => {
              const nextId = event.target.value
              const nextOption = formOptions.assetTypes.find(option => option.value === nextId) ?? null
              const legacyType =
                typeof nextOption?.meta?.legacyType === 'string'
                  ? nextOption.meta.legacyType
                  : 'OTHER'

              setValue('asset_type_id', nextId || undefined, {
                shouldDirty: true,
                shouldValidate: true,
              })
              setValue('asset_type', legacyType as TransactionFormValues['asset_type'], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }}
            error={errors.asset_type_id?.message || errors.asset_type?.message}
            data-testid="transaction-asset-type-select"
          >
            <option value="">Seleccionar tipo...</option>
            {formOptions.assetTypes.map(assetType => (
              <option key={assetType.value} value={assetType.value}>
                {assetType.label}
              </option>
            ))}
          </Select>
        </FieldWrapper>
      </div>

      {selectedAssetTypeOption ? (
        <div className="mt-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
            Tipo seleccionado
          </p>
          <p className="mt-1 text-[13px] font-medium text-[var(--c-text)]">
            {selectedAssetTypeOption.label}
          </p>
        </div>
      ) : null}

      <div className="mt-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
          Valor del activo
        </p>
        <p className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--c-text)]">
          {hasAmount ? formatCurrency(numericAmount, currency as 'PEN' | 'USD') : 'Ingresa el monto para fijar el valor'}
        </p>
      </div>
    </div>
  ) : null

  const dateDescriptionField = (
    <div className="grid grid-cols-1 gap-3">
      <FieldWrapper label="Fecha" required error={errors.transaction_date?.message}>
        <Input
          type="date"
          className="w-full"
          error={errors.transaction_date?.message}
          data-testid="transaction-date-input"
          {...register('transaction_date', { required: 'La fecha es requerida' })}
        />
      </FieldWrapper>

      <FieldWrapper
        label="Descripción"
        optional={layoutMode === 'transfer'}
        required={layoutMode !== 'transfer'}
        hint={layoutMode === 'transfer' && !isEditMode ? 'Se completa automáticamente según las cuentas elegidas.' : undefined}
        error={errors.description?.message}
      >
        <Input
          type="text"
          placeholder={descriptionPlaceholder}
          error={errors.description?.message}
          data-testid="transaction-description-input"
          readOnly={layoutMode === 'transfer' && !isEditMode}
          {...register('description', {
            maxLength: { value: 255, message: 'Máximo 255 caracteres' },
            validate: v =>
              type === 'TRANSFER' || v.trim().length > 0 || 'La descripción no puede estar vacía',
          })}
        />
      </FieldWrapper>
    </div>
  )

  const progressiveOptionalField = usesProgressiveOptionalSection ? (
    <OptionalSection
      title="Mas opciones"
      summary={optionalSummary}
      open={advancedSectionOpen}
      onOpenChange={setAdvancedSectionOpen}
      hasError={hasOptionalSectionError || Boolean(attachmentError)}
    >
      {layoutMode === 'income' && (
        <FieldWrapper label="Remitente" optional>
        <Input
          type="text"
          placeholder="Ej: ACME SAC"
          data-testid="transaction-sender-input"
          disabled={lockSettlementEdit}
          {...register('sender')}
        />
        </FieldWrapper>
      )}

      {layoutMode === 'expense' && (
        <>
          <FieldWrapper label="Destinatario" optional>
            <Input
              type="text"
              placeholder="Ej: Inmobiliaria Norte"
              data-testid="transaction-recipient-input"
              disabled={lockSettlementEdit}
              {...register('recipient')}
            />
          </FieldWrapper>

          <FieldWrapper
            label="Presupuesto"
            optional
            hint={
              categoryId
                ? 'Solo se muestran presupuestos compatibles con la categoría y fecha.'
                : 'Selecciona una categoría para ver presupuestos compatibles.'
            }
          >
            <Select
              placeholder="Sin presupuesto"
              data-testid="transaction-budget-select"
              disabled={lockSettlementEdit || !categoryId || budgetsLoading || filteredBudgets.length === 0}
              {...register('budget_id')}
            >
              <option value="">Sin presupuesto</option>
              {filteredBudgets.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </Select>
            {budgetsLoading && (
              <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
                Buscando presupuestos compatibles…
              </p>
            )}
            {!budgetsLoading && !categoryId && (
              <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
                Elige primero una categoría para filtrar presupuestos estrictamente.
              </p>
            )}
            {!budgetsLoading && categoryId && filteredBudgets.length === 0 && (
              <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
                No hay presupuestos activos para esta categoría en la fecha seleccionada.
              </p>
            )}
          </FieldWrapper>
        </>
      )}

      {layoutMode === 'asset_purchase' && (
        <FieldWrapper label="Proveedor" optional>
          <Input
            type="text"
            placeholder="Ej: iShop Peru"
            data-testid="transaction-recipient-input"
            disabled={lockSettlementEdit}
            {...register('recipient')}
          />
        </FieldWrapper>
      )}

      <FieldWrapper label="Notas" optional>
        <Textarea
          rows={2}
          placeholder={
            layoutMode === 'income'
              ? 'Ej: Factura F001-238'
              : layoutMode === 'expense'
                ? 'Observaciones adicionales…'
                : 'Observaciones de la transferencia…'
          }
          data-testid="transaction-notes-input"
          {...register('notes')}
        />
      </FieldWrapper>

      {layoutMode !== 'transfer' && layoutMode !== 'asset_purchase' && (
        <div className="space-y-2 pt-0.5">
          <CheckboxToggle
            label="Transacción recurrente"
            description="Guarda esta configuración como plantilla reutilizable."
            checked={!!watch('is_recurring')}
            disabled={lockSettlementEdit}
            onChange={v => setValue('is_recurring', v)}
          />
          {watch('is_recurring') && (
            <FieldWrapper
              label="Nombre de la recurrente"
              required
              error={errors.recurring_name?.message}
              hint="Será el nombre visible dentro del módulo de recurrentes."
            >
              <Input
                type="text"
                placeholder={
                  layoutMode === 'income'
                    ? 'Ej. Ingreso recurrente por cliente'
                    : 'Ej. Pago mensual de internet'
                }
                data-testid="transaction-recurring-name-input"
                error={errors.recurring_name?.message}
                {...register('recurring_name', {
                  maxLength: { value: 150, message: 'Máximo 150 caracteres' },
                  validate: value =>
                    !watch('is_recurring') || (value ?? '').trim().length > 0 || 'Ingresa un nombre para la plantilla recurrente',
                })}
              />
            </FieldWrapper>
          )}
        </div>
      )}

      {!isEditMode && (
      <FieldWrapper label="Comprobante" optional>
        {!attachmentSectionOpen ? (
          <button
            type="button"
            onClick={() => setAttachmentSectionOpen(true)}
            className="w-full rounded-xl border border-dashed border-[var(--c-border-hover)] bg-[var(--c-surface-2)] px-3.5 py-3 text-left text-[11px] font-semibold text-[var(--c-text-muted)] transition-colors hover:border-[color:var(--c-primary)] hover:text-[var(--c-text)]"
          >
            + Adjuntar comprobante
          </button>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--c-border-hover)] bg-[var(--c-surface-2)] px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--c-text-muted)] transition-colors hover:border-[var(--c-border-hover)] hover:text-[var(--c-text)]">
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
                  className="rounded-lg border border-[var(--c-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--c-text-muted)] transition-colors hover:border-[var(--c-border-hover)] hover:text-[var(--c-text)]"
                >
                  Quitar
                </button>
              )}
            </div>

            <p className="mt-2 text-[11px] text-[var(--c-text-muted)]">
              {attachmentFile
                ? `Seleccionado: ${attachmentFile.name}`
                : 'Puedes adjuntar imagen, PDF o documento como constancia.'}
            </p>
            <p className="mt-1 text-[10px] text-[var(--c-text-faint)]">
              El archivo se subira automaticamente despues de registrar la transaccion.
            </p>

            {attachmentUploading && (
              <p className="mt-2 text-[11px] text-blue-300/85">Subiendo comprobante...</p>
            )}
            {lastUploadedAttachment && !attachmentUploading && !attachmentError && (
              <p className="mt-2 text-[11px] text-[var(--c-primary)]/85">
                Archivo asociado: {lastUploadedAttachment.file_name}
                {lastUploadedAttachment.signed_url ? (
                  <>
                    {' · '}
                    <a
                      href={lastUploadedAttachment.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-[var(--c-primary)]"
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
                    className="rounded-md border border-red-400/30 px-2 py-1 text-[10px] font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                  >
                    Reintentar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </FieldWrapper>
      )}
    </OptionalSection>
  ) : null

  const payableIssueField = operationType === 'payable_issue' ? (
    <FieldWrapper
      label="Acreedor"
      required
      error={errors.payable_creditor_id?.message}
      hint="Usa el mismo catálogo de acreedores del módulo Por Pagar."
    >
      <Select
        data-testid="transaction-payable-creditor-select"
        error={errors.payable_creditor_id?.message}
        {...register('payable_creditor_id', {
          required: 'Selecciona el acreedor',
        })}
      >
        <option value="">Seleccionar acreedor...</option>
        {creditorOptions.map(creditor => (
          <option key={creditor.value} value={creditor.value}>
            {creditor.label}
          </option>
        ))}
      </Select>
      {!hasCreditors && (
        <div className="mt-2">
          <InlineFeedback
            type="warning"
            message="No tienes acreedores activos disponibles."
            detail="Registra el acreedor en el módulo Por Pagar y vuelve a intentarlo."
          />
        </div>
      )}
    </FieldWrapper>
  ) : null

  const receivableIssueField = operationType === 'receivable_issue' ? (
    <FieldWrapper
      label="Deudor"
      required
      error={errors.receivable_debtor_id?.message}
      hint="Usa el mismo catálogo de deudores del módulo Por Cobrar."
    >
      <Select
        data-testid="transaction-receivable-debtor-select"
        error={errors.receivable_debtor_id?.message}
        {...register('receivable_debtor_id', {
          required: 'Selecciona el deudor',
        })}
      >
        <option value="">Seleccionar deudor...</option>
        {debtorOptions.map(debtor => (
          <option key={debtor.value} value={debtor.value}>
            {debtor.label}
          </option>
        ))}
      </Select>
      {!hasDebtors && (
        <div className="mt-2">
          <InlineFeedback
            type="warning"
            message="No tienes deudores activos disponibles."
            detail="Registra el deudor en el módulo Por Cobrar y vuelve a intentarlo."
          />
        </div>
      )}
    </FieldWrapper>
  ) : null

  const receivableCollectField = operationType === 'receivable_collect' ? (
    <div className="space-y-3">
      <FieldWrapper
        label="Cuenta por cobrar o saldo del deudor"
        required
        error={errors.settlement_receivable_id?.message}
        hint="Elige `Cobro general` para aplicar el pago al saldo total del deudor, o `Cuenta puntual` si quieres cobrar una sola deuda."
      >
        <Select
          data-testid="transaction-settlement-receivable-select"
          error={errors.settlement_receivable_id?.message}
          {...register('settlement_receivable_id', {
            required: 'Selecciona una cuenta puntual o un cobro general',
          })}
        >
          <option value="">Seleccionar cobro...</option>
          {pendingReceivableOptions.map(receivable => (
            <option key={receivable.value} value={receivable.value}>
              {receivable.label}
            </option>
          ))}
        </Select>
        {!hasPendingReceivables && (
          <div className="mt-2">
            <InlineFeedback
              type="info"
              message="No tienes cuentas por cobrar pendientes."
              detail="Primero registra una cuenta por cobrar para poder aplicar un cobro."
            />
          </div>
        )}
      </FieldWrapper>

      {selectedSettlementReceivable && (
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3.5 py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
            Saldo a cobrar
          </p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--c-primary)]">
            {formatCurrency(selectedSettlementPendingAmount, selectedSettlementCurrency ?? 'PEN')}
          </p>
          <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
            {selectedSettlementCounterparty}{selectedSettlementConcept ? ` · ${selectedSettlementConcept}` : ''}
          </p>
          {selectedSettlementKind === 'debtor_total' && selectedSettlementLinesCount > 1 ? (
            <p className="mt-1 text-[10px] text-[var(--c-text-faint)]">
              El cobro se aplicará automáticamente a {selectedSettlementLinesCount} cuentas abiertas, empezando por las más antiguas.
            </p>
          ) : null}
        </div>
      )}
    </div>
  ) : null

  const payablePayField = operationType === 'payable_pay' ? (
    <div className="space-y-3">
      <FieldWrapper
        label="Cuenta por pagar"
        required
        error={errors.settlement_payable_id?.message}
        hint="Elige la obligación pendiente que estás pagando."
      >
        <Select
          data-testid="transaction-settlement-payable-select"
          error={errors.settlement_payable_id?.message}
          {...register('settlement_payable_id', {
            required: 'Selecciona la cuenta por pagar',
          })}
        >
          <option value="">Seleccionar cuenta pendiente...</option>
          {pendingPayableOptions.map(payable => (
            <option key={payable.value} value={payable.value}>
              {payable.label}
            </option>
          ))}
        </Select>
        {!hasPendingPayables && (
          <div className="mt-2">
            <InlineFeedback
              type="info"
              message="No tienes cuentas por pagar pendientes."
              detail="Primero registra una cuenta por pagar para poder aplicar un pago."
            />
          </div>
        )}
      </FieldWrapper>

      {selectedSettlementPayable && (
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3.5 py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
            Saldo a pagar
          </p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-red-300">
            {formatCurrency(selectedSettlementPendingAmount, selectedSettlementCurrency ?? 'PEN')}
          </p>
          <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
            {selectedSettlementCounterparty}{selectedSettlementConcept ? ` · ${selectedSettlementConcept}` : ''}
          </p>
        </div>
      )}
    </div>
  ) : null

  const inlineOptionalField = !usesProgressiveOptionalSection ? (
    isCompactLayout ? (
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <FieldWrapper label="Notas" hint="Opcional">
            <Input
              type="text"
              placeholder="Observaciones…"
              data-testid="transaction-notes-input"
              {...register('notes')}
            />
          </FieldWrapper>
          {operationType !== 'asset_purchase' && !isEditMode && (
            <div className="pb-0.5">
              <CheckboxToggle
                label="Recurrente"
                checked={!!watch('is_recurring')}
                onChange={v => setValue('is_recurring', v)}
              />
            </div>
          )}
        </div>

        {operationType !== 'asset_purchase' && watch('is_recurring') && (
          <FieldWrapper
            label="Nombre de la recurrente"
            required
            error={errors.recurring_name?.message}
            hint="Este nombre se usará en tu biblioteca de plantillas."
          >
            <Input
              type="text"
              placeholder="Ej. Pago mensual de internet"
              data-testid="transaction-recurring-name-input"
              error={errors.recurring_name?.message}
              {...register('recurring_name', {
                maxLength: { value: 150, message: 'Máximo 150 caracteres' },
                validate: value =>
                  !watch('is_recurring') || (value ?? '').trim().length > 0 || 'Ingresa un nombre para la plantilla recurrente',
              })}
            />
          </FieldWrapper>
        )}

        {!isEditMode && (
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-2.5 py-1 text-[10px] font-semibold text-[var(--c-text-muted)] transition-colors hover:border-[var(--c-border-hover)] hover:text-[var(--c-text)]">
            📎 Comprobante
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
            <>
              <span className="max-w-[200px] truncate text-[10px] text-[var(--c-text-muted)]">
                {attachmentFile.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttachmentFile(null)
                  setAttachmentError(null)
                  setLastAttachmentTxId(null)
                  setLastUploadedAttachment(null)
                  lastAutoUploadTxId.current = null
                }}
                className="text-[10px] font-semibold text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </>
          )}
          {attachmentUploading && (
            <span className="text-[10px] text-blue-300/85">Subiendo…</span>
          )}
          {lastUploadedAttachment && !attachmentUploading && !attachmentError && (
            <span className="text-[10px] text-[var(--c-primary)]/85">
              ✓ {lastUploadedAttachment.file_name}
            </span>
          )}
          {attachmentError && (
            <span className="text-[10px] text-red-400">{attachmentError}</span>
          )}
        </div>
        )}
      </div>
    ) : (
      <div className="pt-1">
        <div className="space-y-2.5 pt-1">
          <FieldWrapper label="Notas" hint="Opcional">
            <Textarea
              rows={2}
              placeholder="Observaciones adicionales…"
              data-testid="transaction-notes-input"
              {...register('notes')}
            />
          </FieldWrapper>

          {!isEditMode && (
          <FieldWrapper label="Comprobante" hint="Opcional">
            {!attachmentSectionOpen ? (
              <button
                type="button"
                onClick={() => setAttachmentSectionOpen(true)}
                className="w-full rounded-xl border border-dashed border-[var(--c-border-hover)] bg-[var(--c-surface-2)] px-3.5 py-3 text-left text-[11px] font-semibold text-[var(--c-text-muted)] transition-colors hover:border-[color:var(--c-primary)] hover:text-[var(--c-text)]"
              >
                + Adjuntar comprobante
              </button>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--c-border-hover)] bg-[var(--c-surface-2)] px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--c-text-muted)] transition-colors hover:border-[var(--c-border-hover)] hover:text-[var(--c-text)]">
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
                      className="rounded-lg border border-[var(--c-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--c-text-muted)] transition-colors hover:border-[var(--c-border-hover)] hover:text-[var(--c-text)]"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                <p className="mt-2 text-[11px] text-[var(--c-text-muted)]">
                  {attachmentFile
                    ? `Seleccionado: ${attachmentFile.name}`
                    : 'Puedes adjuntar imagen, PDF o documento como constancia.'}
                </p>
                <p className="mt-1 text-[10px] text-[var(--c-text-faint)]">
                  El archivo se subira automaticamente despues de registrar la transaccion.
                </p>

                {attachmentUploading && (
                  <p className="mt-2 text-[11px] text-blue-300/85">Subiendo comprobante...</p>
                )}
                {lastUploadedAttachment && !attachmentUploading && !attachmentError && (
                  <p className="mt-2 text-[11px] text-[var(--c-primary)]/85">
                    Archivo asociado: {lastUploadedAttachment.file_name}
                    {lastUploadedAttachment.signed_url ? (
                      <>
                        {' · '}
                        <a
                          href={lastUploadedAttachment.signed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-[var(--c-primary)]"
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
                        className="rounded-md border border-red-400/30 px-2 py-1 text-[10px] font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                      >
                        Reintentar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </FieldWrapper>
          )}

          {operationType !== 'asset_purchase' && !isEditMode && (
            <div className="space-y-2 pt-0.5">
              <CheckboxToggle
                label="Transacción recurrente"
                description="Guarda esta configuración como plantilla reutilizable."
                checked={!!watch('is_recurring')}
                onChange={v => setValue('is_recurring', v)}
              />
              {watch('is_recurring') && (
                <FieldWrapper
                  label="Nombre de la recurrente"
                  required
                  error={errors.recurring_name?.message}
                  hint="Será el nombre visible dentro del módulo de recurrentes."
                >
                  <Input
                    type="text"
                    placeholder="Ej. Transferencia a fondo de emergencia"
                    data-testid="transaction-recurring-name-input"
                    error={errors.recurring_name?.message}
                    {...register('recurring_name', {
                      maxLength: { value: 150, message: 'Máximo 150 caracteres' },
                      validate: value =>
                        !watch('is_recurring') || (value ?? '').trim().length > 0 || 'Ingresa un nombre para la plantilla recurrente',
                    })}
                  />
                </FieldWrapper>
              )}
            </div>
          )}
        </div>
      </div>
    )
  ) : null

  const primaryContextZone = (
    <>
      {layoutMode === 'expense' ? paymentMethodField : null}
      {layoutMode === 'payable_issue' ? payableIssueField : null}
      {layoutMode === 'payable_pay' ? payablePayField : null}
      {layoutMode === 'receivable_issue' ? receivableIssueField : null}
      {layoutMode === 'receivable_collect' ? receivableCollectField : null}
      {layoutMode === 'asset_purchase' ? assetPurchaseField : null}
      {layoutMode === 'transfer' ? transferAccountsField : accountField}
      {layoutMode === 'transfer' ? transferSummaryField : null}
      {layoutMode === 'income' || layoutMode === 'expense' ? categoryField : null}
    </>
  )

  const secondaryRecordZone = (
    <>
      {amountCurrencyField}
      {exchangeRateField}
      {equivalenceField}
      {dateDescriptionField}
    </>
  )

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleFormSubmit}
        noValidate
        data-testid="transaction-form"
        className={`${isCompactLayout ? 'space-y-2.5' : 'space-y-5'} ${className}`}
      >
        {!hideTypeSelector && (
          <div data-testid="transaction-type-selector">
            <TypeSelector
              value={type}
              onChange={setType}
              disabled={activeSubmitState.status === 'loading'}
              compact={isCompactLayout}
            />
          </div>
        )}

        {isEditMode && (
          <InlineFeedback
            type={lockSettlementEdit ? 'warning' : 'info'}
            message={lockSettlementEdit ? 'Edición protegida' : 'Edición completa'}
            detail={lockSettlementEdit
              ? 'Los cobros y pagos aplicados sobre cuentas por cobrar o por pagar aún conservan edición restringida para no desalinear saldos distribuidos.'
              : 'Esta ventana usa la misma lógica del alta: puedes ajustar cuenta, monto, moneda, tipo de cambio, fecha y datos descriptivos.'}
          />
        )}

        <div className="grid grid-cols-1 gap-4 min-[860px]:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)] min-[860px]:items-start min-[860px]:gap-5">
          <div className="space-y-4">
            {primaryContextZone}
          </div>

          <div className="space-y-4">
            {secondaryRecordZone}
          </div>

          {progressiveOptionalField ? (
            <div className="min-[860px]:col-span-2">
              {progressiveOptionalField}
            </div>
          ) : null}

          {inlineOptionalField ? (
            <div className="min-[860px]:col-span-2">
              {inlineOptionalField}
            </div>
          ) : null}
        </div>

      {/* ── 7. MÓDULOS DERIVADOS ─────────────────────────────────────────── */}
      {showDerivedSections && (
        <SectionDivider title="Módulos relacionados" accent={accentColor}/>
      )}

      {/* Activo */}
      {sections.assetModule && operationType !== 'asset_purchase' && (
        <AssetSection form={form} assetTypes={formOptions.assetTypes}/>
      )}

      {/* Cuenta por cobrar */}
      {sections.receivableModule && operationType !== 'receivable_issue' && (
        <ReceivableSection form={form} debtors={debtorOptions}/>
      )}

      {/* Cuenta por pagar */}
      {sections.payableModule && operationType !== 'payable_issue' && (
        <PayableSection form={form} creditors={creditorOptions}/>
      )}

      {/* ── 8. ERROR GLOBAL ──────────────────────────────────────────────── */}
      {activeSubmitState.status === 'error' && (
        <InlineFeedback
          type="error"
          message={activeSubmitState.error.message ?? activeSubmitState.error.root ?? 'Error inesperado'}
          detail={activeSubmitState.error.detail}
        />
      )}

      {/* ── 9. SUBMIT ────────────────────────────────────────────────────── */}
      <RecordModalFooter>
        <FormActions
          secondaryAction={onCancel ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={onCancel}
              disabled={activeSubmitState.status === 'loading'}
            >
              Cancelar
            </Button>
          ) : undefined}
          primaryAction={(
            <SubmitButton
              type={type}
              state={activeSubmitState}
              operationType={operationType}
              disabled={activeSubmitState.status === 'loading'}
              fullWidth={false}
              className="min-w-[190px]"
              labels={isEditMode ? {
                idle: 'Guardar cambios',
                loading: 'Guardando...',
                success: 'Cambios guardados',
              } : undefined}
            />
          )}
        />
      </RecordModalFooter>
      </form>

      <NestedAccountCreateModal
        open={inlineAccountModalOpen}
        onClose={() => setInlineAccountModalOpen(false)}
        onCreated={handleInlineAccountCreated}
        preferredCurrency={currency}
      />

      <NestedCategoryCreateModal
        open={inlineCategoryModalOpen}
        onClose={() => setInlineCategoryModalOpen(false)}
        onCreated={handleInlineCategoryCreated}
        initialScope={inlineCategoryScope}
      />

    </>
  )
}
