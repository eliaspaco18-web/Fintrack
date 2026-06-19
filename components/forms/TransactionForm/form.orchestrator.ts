// =============================================================================
// components/forms/TransactionForm/form.orchestrator.ts
// Orquestador del formulario. Usa category.system_key para derivar secciones.
// =============================================================================

'use client'

import { useForm, useWatch }        from 'react-hook-form'
import { useState, useEffect,
         useMemo, useCallback,
         useRef }                   from 'react'
import { z }                        from 'zod'
import type {
  TransactionFormValues,
  TransactionFormOptions,
  ActionState,
  FormError,
  CategoryOption,
}                                   from '@/lib/contracts/ui.contracts'
import type { OperationType }       from '@/components/transactions/OperationTypeSelector'
import { getModuleTrigger }         from '@/lib/constants/category-keys'
import { zCreateTransactionSchema } from '@/lib/schemas/transaction.schemas'
import type { CreateTransactionResult }
  from '@/modules/transactions/transaction.service.types'
import {
  collectReceivableAction,
  createTransactionAction,
  payPayableAction,
}                                   from '@/app/actions/transaction.actions'

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

export const FORM_DEFAULTS: TransactionFormValues = {
  type:                'EXPENSE',
  source_account_id:   '',
  payment_method:      'DEBIT',
  amount:              '',
  currency:            'PEN',
  description:         '',
  transaction_date:    new Date().toISOString().split('T')[0] ?? '',
  is_recurring:        false,
  creates_asset:       false,
  creates_credit:      false,
  creates_loan:        false,
  loan_schedule:       true,
  creates_receivable:  false,
  creates_payable:     false,
  category_system_key: null,
}

// ─── SECCIONES ────────────────────────────────────────────────────────────────

export interface SectionVisibility {
  destinationAccount: boolean
  exchangeRate:       boolean
  assetModule:        boolean
  creditModule:       boolean
  loanModule:         boolean
  receivableModule:   boolean
  payableModule:      boolean
  hasActiveModule:    boolean
  sourceAccountLabel: string
}

export function deriveSections(
  type:              TransactionFormValues['type'],
  categorySystemKey: string | null | undefined,
  currency:          string,
  createsAsset:      boolean,
  createsReceivable: boolean,
  createsPayable:    boolean,
): SectionVisibility {
  const isTx      = type === 'TRANSFER'
  const isExpense = type === 'EXPENSE'
  const isIncome  = type === 'INCOME'
  const mod       = getModuleTrigger(categorySystemKey)
  const hasManualExpenseModule = createsAsset || createsReceivable

  const assetMod = isExpense && (
    hasManualExpenseModule
      ? createsAsset
      : mod === 'asset'
  )
  const creditMod = false
  const receivableMod = isExpense && (
    hasManualExpenseModule
      ? createsReceivable
      : mod === 'receivable'
  )
  const payableMod = isIncome && (createsPayable ? true : mod === 'payable')

  return {
    destinationAccount: isTx,
    exchangeRate:       currency === 'USD',
    assetModule:        assetMod,
    creditModule:       creditMod,
    loanModule:         false,
    receivableModule:   receivableMod,
    payableModule:      payableMod,
    hasActiveModule:    assetMod || receivableMod || payableMod,
    sourceAccountLabel:
      isIncome ? 'Cuenta receptora' : isTx ? 'Cuenta origen' : 'Cuenta',
  }
}

function findOptionLabel(options: Array<{ value: string; label: string }>, value: string | undefined): string | null {
  if (!value) return null
  const match = options.find(option => option.value === value)
  return match?.label ?? null
}

export function buildPayload(
  values:   TransactionFormValues,
  sections: SectionVisibility,
  options:  TransactionFormOptions,
): z.infer<typeof zCreateTransactionSchema> {
  const selectedDebtorName = findOptionLabel(options.debtors, values.receivable_debtor_id)
  const selectedCreditorName = findOptionLabel(options.creditors, values.payable_creditor_id)

  const base = {
    source_account_id: values.source_account_id,
    amount:            Number(values.amount),
    currency:          values.currency as 'PEN' | 'USD',
    payment_method:    values.type === 'EXPENSE' ? values.payment_method ?? 'DEBIT' : undefined,
    credit_card_id:    values.type === 'EXPENSE' ? values.credit_card_id || undefined : undefined,
    credit_operation:  values.type === 'EXPENSE' ? values.credit_operation || undefined : undefined,
    description:       values.description.trim(),
    transaction_date:  values.transaction_date,
    category_id:       values.category_id || undefined,
    notes:             values.notes?.trim() || undefined,
    is_recurring:      values.is_recurring,
    recurring_name:    values.recurring_name?.trim() || undefined,
    exchange_rate:     values.currency === 'USD' && values.exchange_rate
                         ? Number(values.exchange_rate) : undefined,
    sender:            values.sender?.trim() || undefined,
    recipient:         values.recipient?.trim() || undefined,
  }

  if (values.type === 'TRANSFER') {
    return { ...base, type: 'TRANSFER', destination_account_id: values.destination_account_id! }
  }

  if (values.type === 'INCOME') {
    return {
      ...base,
      type: 'INCOME',
      payable: sections.payableModule && selectedCreditorName ? {
        creditor_id: values.payable_creditor_id,
        creditor_name: selectedCreditorName,
        due_date: values.payable_due || undefined,
        concept: values.description.trim(),
      } : undefined,
    }
  }

  return {
    ...base,
    type: 'EXPENSE',
    budget_id: values.budget_id || undefined,
    asset: sections.assetModule ? {
      name: values.asset_name!,
      asset_type: values.asset_type ?? 'OTHER',
      asset_type_id: values.asset_type_id || undefined,
      purchase_value: Number(values.amount),
      serial_number: values.asset_serial || undefined,
      location: values.asset_location || undefined,
    } : undefined,
    credit: sections.creditModule ? {
      credit_type: values.credit_type ?? 'CREDIT_CARD',
      name: values.credit_name!,
      credit_limit: Number(values.credit_limit),
      interest_rate: Number(values.credit_rate ?? 0),
    } : undefined,
    loan: sections.loanModule ? {
      creditor_name: values.loan_creditor!,
      interest_rate: Number(values.loan_rate ?? 0),
      total_installments: Number(values.loan_installments),
      end_date: values.loan_end_date!,
      generate_schedule: values.loan_schedule,
    } : undefined,
    receivable: sections.receivableModule && selectedDebtorName ? {
      debtor_id: values.receivable_debtor_id,
      debtor_name: selectedDebtorName,
      due_date: values.receivable_due || undefined,
      concept: values.description.trim(),
    } : undefined,
  }
}

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────

export interface UseFormOrchestratorReturn {
  form:            ReturnType<typeof useForm<TransactionFormValues>>
  sections:        SectionVisibility
  submitState:     ActionState<CreateTransactionResult>
  categoryOptions: { income: CategoryOption[]; expense: CategoryOption[] }
  submit:          () => void
  resetForm:       () => void
  setType:         (t: TransactionFormValues['type']) => void
}

export function useFormOrchestrator(
  options:       TransactionFormOptions,
  onSuccess?:    (result: CreateTransactionResult) => void,
  initialValues?: Partial<TransactionFormValues>,
  operationType?: OperationType,
): UseFormOrchestratorReturn {
  const [submitState, setSubmitState] =
    useState<ActionState<CreateTransactionResult>>({ status: 'idle' })

  const form = useForm<TransactionFormValues>({
    defaultValues: { ...FORM_DEFAULTS, ...initialValues },
    mode:          'onBlur',
  })

  useEffect(() => {
    form.reset({ ...FORM_DEFAULTS, ...initialValues })
  }, [form, initialValues])

  const type              = useWatch({ control: form.control, name: 'type' })
  const currency          = useWatch({ control: form.control, name: 'currency' })
  const categorySystemKey = useWatch({ control: form.control, name: 'category_system_key' })
  const createsAsset      = useWatch({ control: form.control, name: 'creates_asset' })
  const createsReceivable = useWatch({ control: form.control, name: 'creates_receivable' })
  const createsPayable    = useWatch({ control: form.control, name: 'creates_payable' })

  const sections = useMemo(
    () => deriveSections(
      type,
      categorySystemKey,
      currency,
      !!createsAsset,
      !!createsReceivable,
      !!createsPayable
    ),
    [
      type,
      categorySystemKey,
      currency,
      createsAsset,
      createsReceivable,
      createsPayable,
    ]
  )

  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }

    form.setValue('creates_asset',       false)
    form.setValue('creates_credit',      false)
    form.setValue('creates_loan',        false)
    form.setValue('creates_receivable',  false)
    form.setValue('creates_payable',     false)
    form.setValue('category_id',         undefined)
    form.setValue('category_system_key', null)
  }, [type, form])

  const setType = useCallback((t: TransactionFormValues['type']) => {
    form.setValue('type', t, { shouldValidate: false })
    form.clearErrors()
  }, [form])

  const resetForm = useCallback(() => {
    form.reset({ ...FORM_DEFAULTS, ...initialValues })
    setSubmitState({ status: 'idle' })
  }, [form, initialValues])

  const submit = form.handleSubmit(async (values) => {
    setSubmitState({ status: 'loading' })
    try {
      const selectedReceivable = options.pendingReceivables.find(
        receivable => receivable.value === values.settlement_receivable_id
      )
      const selectedPayable = options.pendingPayables.find(
        payable => payable.value === values.settlement_payable_id
      )

      if (operationType === 'receivable_collect' && !selectedReceivable) {
        form.setError('settlement_receivable_id', {
          type: 'manual',
          message: 'Selecciona una cuenta puntual o un cobro general',
        })
        setSubmitState({
          status: 'error',
          error: { code: 'VALIDATION_ERROR', message: 'Selecciona una cuenta puntual o un cobro general.' },
        })
        return
      }

      if (operationType === 'payable_pay' && !selectedPayable) {
        form.setError('settlement_payable_id', {
          type: 'manual',
          message: 'Selecciona la cuenta por pagar',
        })
        setSubmitState({
          status: 'error',
          error: { code: 'VALIDATION_ERROR', message: 'Selecciona la cuenta por pagar.' },
        })
        return
      }

      const settlementBase = {
        source_account_id: values.source_account_id,
        amount: Number(values.amount),
        currency: values.currency as 'PEN' | 'USD',
        exchange_rate: values.currency === 'USD' && values.exchange_rate
          ? Number(values.exchange_rate)
          : undefined,
        description: values.description.trim(),
        transaction_date: values.transaction_date,
        notes: values.notes?.trim() || undefined,
      }

      const result =
        operationType === 'receivable_collect'
          ? await collectReceivableAction({
              ...settlementBase,
              id: values.settlement_receivable_id,
            })
          : operationType === 'payable_pay'
            ? await payPayableAction({
                ...settlementBase,
                id: values.settlement_payable_id,
              })
            : await createTransactionAction(buildPayload(values, sections, options))

      if (result.ok) {
        setSubmitState({ status: 'success', data: result.data })
        onSuccess?.(result.data)
        setTimeout(() => {
          setSubmitState({ status: 'idle' })
          form.reset({ ...FORM_DEFAULTS, ...initialValues })
        }, 3000)
      } else {
        setSubmitState({ status: 'error', error: result.error as FormError })
        const fieldErrors = (result.error as FormError).fields
        if (fieldErrors) {
          Object.entries(fieldErrors).forEach(([field, msgs]) => {
            form.setError(field as keyof TransactionFormValues, {
              type: 'server', message: msgs[0],
            })
          })
        }
      }
    } catch {
      setSubmitState({
        status: 'error',
        error: { code: 'UNEXPECTED', message: 'Error inesperado. Intenta de nuevo.' },
      })
    }
  })

  return {
    form,
    sections,
    submitState,
    categoryOptions: {
      income:  options.categories.income,
      expense: options.categories.expense,
    },
    submit,
    resetForm,
    setType,
  }
}
