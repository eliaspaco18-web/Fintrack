// =============================================================================
// modules/transactions/transaction.service.ts
// Orquestador central del sistema. Todo flujo de dinero pasa por aquí.
//
// DECISIÓN SEMÁNTICA: source_account_id
// ──────────────────────────────────────
// Mantenemos source_account_id para los tres tipos de transacción.
// La semántica correcta es: "cuenta principal involucrada".
//   • INCOME   → cuenta que RECIBE el dinero (receptor primario)
//   • EXPENSE  → cuenta que EMITE el dinero (emisor primario)
//   • TRANSFER → cuenta que ENVÍA el dinero (origen del flujo)
//
// No renombramos a primary_account_id porque:
//   1. El schema ya está en producción — sin beneficio suficiente para migrar
//   2. Los triggers de saldo usan source/destination con lógica correcta
//   3. La asimetría semántica INCOME se resuelve con documentación, no con DDL
//
// Regla de uso: la UI siempre debe etiquetar el campo como
// "Cuenta" para INCOME y "Cuenta origen" para TRANSFER/EXPENSE.
// =============================================================================

import type { SupabaseClient }          from '@supabase/supabase-js'
import type { Database }                from '@/types/database.types'
import type {
  Transaction,
  Asset,
  Credit,
  Loan,
  AccountReceivable,
  AccountPayable,
  Account,
  BudgetPeriod,
}                                       from '@/types/database.types'
import type {
  CreateTransactionInput,
  CreateIncomeInput,
  CreateExpenseInput,
  CreateTransferInput,
  UpdateTransactionInput,
  CreateTransactionResult,
  AtomicTransactionPayload,
  AtomicTransactionResult,
  TransactionFilters,
  PaginatedTransactions,
}                                       from './transaction.service.types'
import { TransactionRepository }        from './transaction.repository'
import { AssetRepository }              from '@/modules/assets/asset.repository'
import { CreditRepository }             from '@/modules/credits/credit.repository'
import { LoanRepository }               from '@/modules/loans/loan.repository'
import { ReceivableRepository }         from '@/modules/receivables/receivable.repository'
import { PayableRepository }            from '@/modules/payables/payable.repository'
import {
  validateCreateTransactionInput,
  validateSourceAccount,
  validateSourceAccountAgainstTransaction,
  validateDestinationAccount,
  validateSufficientBalance,
}                                       from './transaction.validations'
import { type Result, Errors, ok }      from '@/modules/shared/result.types'
import { resolveAccountingUsdPenExchangeRate } from '@/lib/server/exchange-rate'
import { CategoryKeys } from '@/lib/constants/category-keys'
import {
  ATTACHMENT_DELETE_BLOCKED_MESSAGE,
  ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
  hasStoredAttachmentReference,
  hasTransactionAttachmentReference,
} from '@/modules/attachments/attachment-integrity'

type DbClient = SupabaseClient<Database>

type BudgetEligibilityRow = {
  id: string
  name: string
  category_id: string | null
  currency: 'PEN' | 'USD'
  period_type: BudgetPeriod
  start_date: string
  end_date: string | null
  is_active: boolean
}

type CreditAdjustment = {
  id: string
  op: 'CONSUMPTION' | 'PAYMENT'
  amount: number
  currency: 'PEN' | 'USD'
}

type TransferCreditContext = {
  adjustment: CreditAdjustment
  categorySystemKey: string
}

type EditableTransactionRecord = Transaction & {
  category?: { system_key?: string | null } | null
}

function parseBudgetISODate(date: string): Date {
  return new Date(`${date}T12:00:00Z`)
}

function toBudgetISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addBudgetDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function addBudgetPeriod(date: Date, period: BudgetPeriod): Date {
  const next = new Date(date)
  if (period === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }

  if (period === 'MONTHLY') {
    next.setUTCMonth(next.getUTCMonth() + 1)
    return next
  }

  if (period === 'QUARTERLY') {
    next.setUTCMonth(next.getUTCMonth() + 3)
    return next
  }

  next.setUTCFullYear(next.getUTCFullYear() + 1)
  return next
}

function resolveBudgetWindowAtDate(
  budget: BudgetEligibilityRow,
  anchorDate: string,
): { start: string; end: string } | null {
  const anchor = parseBudgetISODate(anchorDate)
  const budgetStart = parseBudgetISODate(budget.start_date)
  if (anchor.getTime() < budgetStart.getTime()) return null

  const budgetEnd = budget.end_date ? parseBudgetISODate(budget.end_date) : null
  if (budgetEnd && anchor.getTime() > budgetEnd.getTime()) return null

  let cycleStart = budgetStart
  let cycleNext = addBudgetPeriod(cycleStart, budget.period_type)

  while (cycleNext.getTime() <= anchor.getTime()) {
    cycleStart = cycleNext
    cycleNext = addBudgetPeriod(cycleStart, budget.period_type)
  }

  let cycleEnd = addBudgetDays(cycleNext, -1)
  if (budgetEnd && cycleEnd.getTime() > budgetEnd.getTime()) {
    cycleEnd = budgetEnd
  }

  if (anchor.getTime() < cycleStart.getTime() || anchor.getTime() > cycleEnd.getTime()) {
    return null
  }

  return {
    start: toBudgetISODate(cycleStart),
    end: toBudgetISODate(cycleEnd),
  }
}

export class TransactionService {
  private readonly txRepo:          TransactionRepository
  private readonly assetRepo:       AssetRepository
  private readonly creditRepo:      CreditRepository
  private readonly loanRepo:        LoanRepository
  private readonly receivableRepo:  ReceivableRepository
  private readonly payableRepo:     PayableRepository
  private readonly db:              DbClient

  constructor(db: DbClient) {
    this.db            = db
    this.txRepo         = new TransactionRepository(db)
    this.assetRepo      = new AssetRepository(db)
    this.creditRepo     = new CreditRepository(db)
    this.loanRepo       = new LoanRepository(db)
    this.receivableRepo = new ReceivableRepository(db)
    this.payableRepo    = new PayableRepository(db)
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  CREATE — orquestación atómica vía función PostgreSQL                  ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  /**
   * Crea una transacción y todos sus módulos derivados en una única operación
   * atómica. Si cualquier módulo derivado falla, Postgres revierte todo.
   *
   * Flujo:
   *   1. Validar input (sin IO)
   *   2. Verificar cuentas en BD
   *   3. Verificar saldo (para EXPENSE y TRANSFER)
   *   4. Construir payload para la función Postgres
   *   5. Llamar create_transaction_atomic() via RPC
   *   6. Cargar y retornar los registros creados
   */
  async createTransaction(
    userId: string,
    input:  CreateTransactionInput
  ): Promise<Result<CreateTransactionResult>> {
    const accountingInput = await this.resolveCreateInputExchangeRate(input)

    // ── PASO 1: Validaciones de negocio (sin IO) ────────────────────────────
    const validationResult = validateCreateTransactionInput(accountingInput)
    if (!validationResult.ok) return validationResult

    // ── PASO 2: Verificar cuenta origen ─────────────────────────────────────
    const sourceAccountResult = await this.fetchAndValidateAccount(
      accountingInput.source_account_id,
      userId
    )
    if (!sourceAccountResult.ok) return sourceAccountResult
    const sourceAccount = sourceAccountResult.data

    const sourceAccountBusinessValidation = validateSourceAccountAgainstTransaction(accountingInput, sourceAccount)
    if (!sourceAccountBusinessValidation.ok) return sourceAccountBusinessValidation

    const expenseInput = accountingInput.type === 'EXPENSE'
      ? (accountingInput as CreateExpenseInput)
      : null

    const usesCreditCardAsSource =
      !!expenseInput &&
      expenseInput.payment_method === 'CREDIT' &&
      !!expenseInput.credit_card_id

    let selectedCreditCard: Credit | null = null
    if (expenseInput?.credit_card_id) {
      const creditResult = await this.creditRepo.findByIdForUser(expenseInput.credit_card_id, userId)
      if (!creditResult.ok) return creditResult
      selectedCreditCard = creditResult.data

      if (selectedCreditCard.credit_type !== 'CREDIT_CARD') {
        return Errors.businessRule(
          'La operación seleccionada requiere una tarjeta de crédito',
          'Selecciona una tarjeta activa en el módulo Créditos'
        )
      }

      if (selectedCreditCard.status !== 'ACTIVE') {
        return Errors.businessRule(
          'La tarjeta seleccionada no está activa',
          'Activa la tarjeta o elige otra tarjeta'
        )
      }

      if (usesCreditCardAsSource) {
        if (!selectedCreditCard.account_id) {
          return Errors.businessRule(
            'La tarjeta no tiene cuenta asociada en Portafolio',
            'Edita la tarjeta y vincúlala a una cuenta tipo tarjeta'
          )
        }

        if (selectedCreditCard.account_id !== accountingInput.source_account_id) {
          return Errors.validation(
            'La cuenta de salida no coincide con la tarjeta seleccionada',
            'Vuelve a seleccionar la tarjeta de crédito en el formulario'
          )
        }
      }
    }

    // ── PASO 3: Verificar cuenta destino (solo TRANSFER) ────────────────────
    let destinationAccount: Account | null = null
    if (accountingInput.type === 'TRANSFER') {
      const destResult = await this.fetchAndValidateAccount(
        accountingInput.destination_account_id,
        userId
      )
      if (!destResult.ok) return destResult

      const destValidation = validateDestinationAccount(
        accountingInput.source_account_id,
        destResult.data
      )
      if (!destValidation.ok) return destValidation

      destinationAccount = destResult.data
    }

    const transferCreditContextResult = accountingInput.type === 'TRANSFER'
      ? await this.resolveTransferCreditContext(userId, accountingInput, sourceAccount, destinationAccount)
      : ok<TransferCreditContext | null>(null)
    if (!transferCreditContextResult.ok) return transferCreditContextResult
    const transferCreditContext = transferCreditContextResult.data
    const usesCreditCardTransferSource = transferCreditContext?.adjustment.op === 'CONSUMPTION'

    const preparedInput = this.prepareCreateInput(
      accountingInput,
      sourceAccount,
      destinationAccount
    )

    if (preparedInput.type === 'EXPENSE') {
      const budgetValidation = await this.validateExpenseBudget(userId, preparedInput)
      if (!budgetValidation.ok) return budgetValidation
    }

    const budgetPeriodId = preparedInput.type === 'EXPENSE'
      ? await this.resolveExpenseBudgetPeriodId(userId, preparedInput)
      : null

    // ── PASO 4: Verificar saldo para EXPENSE y TRANSFER ─────────────────────
    if (
      (preparedInput.type === 'EXPENSE' && !usesCreditCardAsSource) ||
      (preparedInput.type === 'TRANSFER' && !usesCreditCardTransferSource)
    ) {
      const balanceResult = validateSufficientBalance(
        sourceAccount,
        preparedInput.amount,
        false   // no permitir saldo negativo por defecto
      )
      if (!balanceResult.ok) return balanceResult
    }

    let creditAdjusted: { id: string; op: 'CONSUMPTION' | 'PAYMENT'; amount: number; currency: 'PEN' | 'USD' } | null = null
    if (expenseInput?.credit_card_id && selectedCreditCard) {
      const op: 'CONSUMPTION' | 'PAYMENT' = usesCreditCardAsSource
        ? 'CONSUMPTION'
        : expenseInput.credit_operation === 'PAYMENT'
          ? 'PAYMENT'
          : 'CONSUMPTION'
      const adjustmentAmount = Math.round(preparedInput.amount * 100) / 100
      const adjustmentCurrency = preparedInput.currency as 'PEN' | 'USD'

      const adjustResult = op === 'CONSUMPTION'
        ? await this.creditRepo.incrementUsedAmount(selectedCreditCard.id, adjustmentAmount, adjustmentCurrency)
        : await this.creditRepo.decrementUsedAmount(selectedCreditCard.id, adjustmentAmount, adjustmentCurrency)

      if (!adjustResult.ok) return adjustResult
      creditAdjusted = { id: selectedCreditCard.id, op, amount: adjustmentAmount, currency: adjustmentCurrency }
    } else if (transferCreditContext) {
      const adjustResult = await this.applyCreditAdjustment(transferCreditContext.adjustment)
      if (!adjustResult.ok) return adjustResult
      creditAdjusted = transferCreditContext.adjustment
    }

    // ── PASO 5: Construir payload atómico ────────────────────────────────────
    const payload = this.buildAtomicPayload(userId, preparedInput)
    payload.p_budget_period_id = budgetPeriodId
    if (transferCreditContext?.categorySystemKey) {
      payload.p_category_id =
        await this.resolveCategoryIdBySystemKey(userId, transferCreditContext.categorySystemKey)
        ?? payload.p_category_id
    }
    if (
      creditAdjusted?.op === 'PAYMENT' &&
      selectedCreditCard?.account_id &&
      preparedInput.type === 'EXPENSE'
    ) {
      // Permite identificar en reportes qué egresos fueron pago de tarjeta.
      payload.p_destination_account_id = selectedCreditCard.account_id
    }

    // ── PASO 6: Ejecutar función Postgres (atómica) ──────────────────────────
    const rpcResult = await this.callAtomicFunction(payload)
    if (!rpcResult.ok) {
      if (creditAdjusted) {
        if (creditAdjusted.op === 'CONSUMPTION') {
          await this.creditRepo.decrementUsedAmount(creditAdjusted.id, creditAdjusted.amount, creditAdjusted.currency)
        } else {
          await this.creditRepo.incrementUsedAmount(creditAdjusted.id, creditAdjusted.amount, creditAdjusted.currency)
        }
      }
      return rpcResult
    }

    const ids = rpcResult.data

    if (payload.p_budget_period_id) {
      await this.attachBudgetPeriodToTransaction(ids.transaction_id, payload.p_budget_period_id)
    }

    await this.syncCounterpartyLinks(ids, payload)

    // ── PASO 7: Cargar registros creados y retornar ───────────────────────────
    return this.loadCreatedRecords(ids)
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  UPDATE — edición funcional con la misma paridad del alta               ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  async updateTransaction(
    userId: string,
    input:  UpdateTransactionInput
  ): Promise<Result<Transaction>> {
    const existingResult = await this.txRepo.findByIdForUser(input.id, userId)
    if (!existingResult.ok) return existingResult
    const existingTx = existingResult.data as EditableTransactionRecord

    if (
      input.notes !== existingTx.notes
      && hasTransactionAttachmentReference(existingTx.notes)
    ) {
      return Errors.businessRule(ATTACHMENT_UPDATE_BLOCKED_MESSAGE)
    }

    const existingCategorySystemKey = typeof existingTx.category?.system_key === 'string'
      ? existingTx.category.system_key
      : null
    if (
      existingCategorySystemKey === CategoryKeys.INCOME_RECEIVABLE_COLLECTION
      || existingCategorySystemKey === CategoryKeys.EXPENSE_PAYABLE_PAYMENT
    ) {
      return Errors.businessRule(
        'Este movimiento aún no admite edición completa',
        'Los cobros y pagos aplicados a cuentas por cobrar o por pagar siguen teniendo edición protegida para no desalinear saldos distribuidos.'
      )
    }

    const accountingInput = await this.resolveCreateInputExchangeRate(input)
    const validationResult = validateCreateTransactionInput(accountingInput)
    if (!validationResult.ok) return validationResult

    const sourceAccountResult = await this.fetchAndValidateAccount(
      accountingInput.source_account_id,
      userId,
    )
    if (!sourceAccountResult.ok) return sourceAccountResult
    const sourceAccount = sourceAccountResult.data

    const sourceAccountBusinessValidation = validateSourceAccountAgainstTransaction(accountingInput, sourceAccount)
    if (!sourceAccountBusinessValidation.ok) return sourceAccountBusinessValidation

    const expenseInput = accountingInput.type === 'EXPENSE'
      ? accountingInput as CreateExpenseInput
      : null
    const usesCreditCardAsSource =
      !!expenseInput &&
      expenseInput.payment_method === 'CREDIT' &&
      !!expenseInput.credit_card_id

    let selectedCreditCard: Credit | null = null
    if (expenseInput?.credit_card_id) {
      const creditResult = await this.creditRepo.findByIdForUser(expenseInput.credit_card_id, userId)
      if (!creditResult.ok) return creditResult
      selectedCreditCard = creditResult.data

      if (selectedCreditCard.credit_type !== 'CREDIT_CARD') {
        return Errors.businessRule(
          'La operación seleccionada requiere una tarjeta de crédito',
          'Selecciona una tarjeta activa en el módulo Créditos'
        )
      }

      if (selectedCreditCard.status !== 'ACTIVE') {
        return Errors.businessRule(
          'La tarjeta seleccionada no está activa',
          'Activa la tarjeta o elige otra tarjeta'
        )
      }

      if (usesCreditCardAsSource) {
        if (!selectedCreditCard.account_id) {
          return Errors.businessRule(
            'La tarjeta no tiene cuenta asociada en Portafolio',
            'Edita la tarjeta y vincúlala a una cuenta tipo tarjeta'
          )
        }

        if (selectedCreditCard.account_id !== accountingInput.source_account_id) {
          return Errors.validation(
            'La cuenta de salida no coincide con la tarjeta seleccionada',
            'Vuelve a seleccionar la tarjeta de crédito en el formulario'
          )
        }
      }
    }

    let destinationAccount: Account | null = null
    let resolvedDestinationAccountId: string | null = existingTx.destination_account_id ?? null
    if (accountingInput.type === 'TRANSFER') {
      const destResult = await this.fetchAndValidateAccount(
        accountingInput.destination_account_id,
        userId,
      )
      if (!destResult.ok) return destResult

      const destValidation = validateDestinationAccount(
        accountingInput.source_account_id,
        destResult.data,
      )
      if (!destValidation.ok) return destValidation

      destinationAccount = destResult.data
      resolvedDestinationAccountId = accountingInput.destination_account_id
    } else if (
      expenseInput?.credit_operation === 'PAYMENT'
      && selectedCreditCard?.account_id
    ) {
      resolvedDestinationAccountId = selectedCreditCard.account_id
    } else {
      resolvedDestinationAccountId = null
    }

    const transferCreditContextResult = accountingInput.type === 'TRANSFER'
      ? await this.resolveTransferCreditContext(userId, accountingInput, sourceAccount, destinationAccount)
      : ok<TransferCreditContext | null>(null)
    if (!transferCreditContextResult.ok) return transferCreditContextResult
    const transferCreditContext = transferCreditContextResult.data
    const transferCategoryId = transferCreditContext?.categorySystemKey
      ? await this.resolveCategoryIdBySystemKey(userId, transferCreditContext.categorySystemKey)
      : null

    const preparedInput = this.prepareCreateInput(
      accountingInput,
      sourceAccount,
      destinationAccount,
    )

    const budgetPeriodId = preparedInput.type === 'EXPENSE'
      ? await this.resolveExpenseBudgetPeriodId(userId, preparedInput)
      : null

    const linkedAssetResult = await this.assetRepo.findByTransactionId(existingTx.id)
    if (!linkedAssetResult.ok) return linkedAssetResult
    const linkedReceivableResult = await this.db
      .from('accounts_receivable')
      .select('*')
      .eq('transaction_id', existingTx.id)
      .maybeSingle()
    if (linkedReceivableResult.error) {
      return Errors.database(linkedReceivableResult.error.message)
    }
    const linkedPayableResult = await this.db
      .from('accounts_payable')
      .select('*')
      .eq('transaction_id', existingTx.id)
      .maybeSingle()
    if (linkedPayableResult.error) {
      return Errors.database(linkedPayableResult.error.message)
    }

    const linkedAsset = linkedAssetResult.data
    const linkedReceivable = linkedReceivableResult.data
    const linkedPayable = linkedPayableResult.data

    if (linkedReceivable) {
      const nextDebtorId = preparedInput.type === 'EXPENSE' && preparedInput.receivable
        ? preparedInput.receivable.debtor_id ?? null
        : linkedReceivable.debtor_id
      if (Number(linkedReceivable.collected_amount) > 0) {
        if (preparedInput.currency !== linkedReceivable.currency) {
          return Errors.businessRule(
            'No puedes cambiar la moneda de una cuenta por cobrar con cobros registrados',
            'Mantén la misma moneda o corrige el movimiento desde el módulo Por Cobrar.'
          )
        }
        if ((nextDebtorId ?? null) !== (linkedReceivable.debtor_id ?? null)) {
          return Errors.businessRule(
            'No puedes cambiar el deudor de una cuenta con cobros registrados',
            'La cuenta ya tiene avance de recuperación y debe conservar su contraparte.'
          )
        }
        if (preparedInput.amount < Number(linkedReceivable.collected_amount)) {
          return Errors.businessRule(
            'El nuevo monto no puede ser menor al ya cobrado',
            `Cobrado actualmente: ${linkedReceivable.collected_amount} ${linkedReceivable.currency}`
          )
        }
      }
    }

    if (linkedPayable) {
      const nextCreditorId = preparedInput.type === 'INCOME' && preparedInput.payable
        ? preparedInput.payable.creditor_id ?? null
        : linkedPayable.creditor_id
      if (Number(linkedPayable.paid_amount) > 0) {
        if (preparedInput.currency !== linkedPayable.currency) {
          return Errors.businessRule(
            'No puedes cambiar la moneda de una cuenta por pagar con pagos registrados',
            'Mantén la misma moneda o corrige el movimiento desde el módulo Por Pagar.'
          )
        }
        if ((nextCreditorId ?? null) !== (linkedPayable.creditor_id ?? null)) {
          return Errors.businessRule(
            'No puedes cambiar el acreedor de una cuenta con pagos registrados',
            'La cuenta ya tiene avances de pago y debe conservar su contraparte.'
          )
        }
        if (preparedInput.amount < Number(linkedPayable.paid_amount)) {
          return Errors.businessRule(
            'El nuevo monto no puede ser menor al ya pagado',
            `Pagado actualmente: ${linkedPayable.paid_amount} ${linkedPayable.currency}`
          )
        }
      }
    }

    const rollbackTransactionData: Database['public']['Tables']['transactions']['Update'] = {
      source_account_id: existingTx.source_account_id,
      destination_account_id: existingTx.destination_account_id,
      category_id: existingTx.category_id,
      budget_id: existingTx.budget_id,
      budget_period_id: existingTx.budget_period_id,
      type: existingTx.type,
      amount: existingTx.amount,
      currency: existingTx.currency,
      exchange_rate: existingTx.exchange_rate,
      description: existingTx.description,
      transaction_date: existingTx.transaction_date,
      notes: existingTx.notes,
      is_recurring: existingTx.is_recurring,
      sender: existingTx.sender,
      recipient: existingTx.recipient,
      payment_method: existingTx.payment_method,
      debtor_id: existingTx.debtor_id,
      creditor_id: existingTx.creditor_id,
    }

    const nextDebtorId = preparedInput.type === 'EXPENSE' && preparedInput.receivable
      ? preparedInput.receivable.debtor_id ?? null
      : existingTx.debtor_id
    const nextCreditorId = preparedInput.type === 'INCOME' && preparedInput.payable
      ? preparedInput.payable.creditor_id ?? null
      : existingTx.creditor_id

    const transactionUpdate: Database['public']['Tables']['transactions']['Update'] = {
      source_account_id: preparedInput.source_account_id,
      destination_account_id: resolvedDestinationAccountId,
      category_id: transferCategoryId ?? preparedInput.category_id ?? null,
      budget_id: preparedInput.type === 'EXPENSE'
        ? (preparedInput as CreateExpenseInput).budget_id ?? null
        : null,
      budget_period_id: budgetPeriodId,
      type: preparedInput.type,
      amount: preparedInput.amount,
      currency: preparedInput.currency,
      exchange_rate: preparedInput.currency === 'USD'
        ? preparedInput.exchange_rate ?? existingTx.exchange_rate
        : 1,
      description: preparedInput.description?.trim() ?? '',
      transaction_date: preparedInput.transaction_date,
      notes: preparedInput.notes ?? null,
      is_recurring: preparedInput.is_recurring ?? false,
      sender: preparedInput.sender?.trim() || null,
      recipient: preparedInput.recipient?.trim() || null,
      payment_method: preparedInput.type === 'EXPENSE'
        ? preparedInput.payment_method ?? 'DEBIT'
        : null,
      debtor_id: nextDebtorId,
      creditor_id: nextCreditorId,
    }

    const previousCreditAdjustment = await this.resolveCreditAdjustmentForStoredTransaction(userId, existingTx)
    if (!previousCreditAdjustment.ok) return previousCreditAdjustment
    const reverseOldCredit = await this.reverseCreditAdjustment(previousCreditAdjustment.data)
    if (!reverseOldCredit.ok) return reverseOldCredit

    const restoreLinkedRows = async () => {
      if (linkedAsset) {
        await this.assetRepo.update(linkedAsset.id, {
          name: linkedAsset.name,
          asset_type: linkedAsset.asset_type,
          asset_type_id: linkedAsset.asset_type_id,
          serial_number: linkedAsset.serial_number,
          location: linkedAsset.location,
          purchase_value: linkedAsset.purchase_value,
          current_value: linkedAsset.current_value,
          purchase_date: linkedAsset.purchase_date,
          currency: linkedAsset.currency,
          recipient: linkedAsset.recipient,
        })
      }

      if (linkedReceivable) {
        await this.receivableRepo.update(linkedReceivable.id, {
          debtor_id: linkedReceivable.debtor_id,
          debtor_name: linkedReceivable.debtor_name,
          amount: linkedReceivable.amount,
          currency: linkedReceivable.currency,
          issue_date: linkedReceivable.issue_date,
          due_date: linkedReceivable.due_date,
          concept: linkedReceivable.concept,
          notes: linkedReceivable.notes,
          collected_amount: linkedReceivable.collected_amount,
          collected_date: linkedReceivable.collected_date,
          status: linkedReceivable.status,
        })
      }

      if (linkedPayable) {
        await this.payableRepo.update(linkedPayable.id, {
          creditor_id: linkedPayable.creditor_id,
          creditor_name: linkedPayable.creditor_name,
          amount: linkedPayable.amount,
          currency: linkedPayable.currency,
          issue_date: linkedPayable.issue_date,
          due_date: linkedPayable.due_date,
          concept: linkedPayable.concept,
          notes: linkedPayable.notes,
          paid_amount: linkedPayable.paid_amount,
          paid_date: linkedPayable.paid_date,
          status: linkedPayable.status,
        })
      }
    }

    const restoreCreditAndTransaction = async () => {
      await this.txRepo.update(existingTx.id, rollbackTransactionData)
      await restoreLinkedRows()
      await this.applyCreditAdjustment(previousCreditAdjustment.data)
    }

    const updateResult = await this.txRepo.update(existingTx.id, transactionUpdate)
    if (!updateResult.ok) {
      await this.applyCreditAdjustment(previousCreditAdjustment.data)
      return updateResult
    }

    try {
      if (linkedAsset && preparedInput.type === 'EXPENSE' && preparedInput.asset) {
        const nextCurrentValue = Number(linkedAsset.current_value) === Number(linkedAsset.purchase_value)
          ? preparedInput.amount
          : linkedAsset.current_value
        const assetUpdateResult = await this.assetRepo.update(linkedAsset.id, {
          name: preparedInput.asset.name,
          asset_type: preparedInput.asset.asset_type,
          asset_type_id: preparedInput.asset.asset_type_id ?? null,
          serial_number: preparedInput.asset.serial_number ?? null,
          location: preparedInput.asset.location ?? null,
          purchase_value: preparedInput.amount,
          current_value: nextCurrentValue,
          purchase_date: preparedInput.transaction_date,
          currency: preparedInput.currency,
          recipient: preparedInput.recipient?.trim() || null,
        })
        if (!assetUpdateResult.ok) {
          throw new Error(assetUpdateResult.error.detail ?? assetUpdateResult.error.message)
        }
      }

      if (linkedReceivable && preparedInput.type === 'EXPENSE' && preparedInput.receivable) {
        const collectedAmount = Number(linkedReceivable.collected_amount)
        const receivableStatus: Database['public']['Enums']['receivable_status'] =
          collectedAmount <= 0
            ? 'PENDING'
            : collectedAmount >= preparedInput.amount
              ? 'COLLECTED'
              : 'PARTIAL'
        const receivableUpdateResult = await this.receivableRepo.update(linkedReceivable.id, {
          debtor_id: preparedInput.receivable.debtor_id ?? null,
          debtor_name: preparedInput.receivable.debtor_name,
          amount: preparedInput.amount,
          currency: preparedInput.currency,
          issue_date: preparedInput.transaction_date,
          due_date: preparedInput.receivable.due_date ?? null,
          concept: preparedInput.receivable.concept ?? preparedInput.description,
          notes: preparedInput.receivable.notes ?? preparedInput.notes ?? null,
          status: receivableStatus,
          collected_date: receivableStatus === 'COLLECTED'
            ? linkedReceivable.collected_date ?? preparedInput.transaction_date
            : null,
        })
        if (!receivableUpdateResult.ok) {
          throw new Error(receivableUpdateResult.error.detail ?? receivableUpdateResult.error.message)
        }
      }

      if (linkedPayable && preparedInput.type === 'INCOME' && preparedInput.payable) {
        const paidAmount = Number(linkedPayable.paid_amount)
        const payableStatus: Database['public']['Enums']['payable_status'] =
          paidAmount <= 0
            ? 'PENDING'
            : paidAmount >= preparedInput.amount
              ? 'PAID'
              : 'PARTIAL'
        const payableUpdateResult = await this.payableRepo.update(linkedPayable.id, {
          creditor_id: preparedInput.payable.creditor_id ?? null,
          creditor_name: preparedInput.payable.creditor_name,
          amount: preparedInput.amount,
          currency: preparedInput.currency,
          issue_date: preparedInput.transaction_date,
          due_date: preparedInput.payable.due_date ?? null,
          concept: preparedInput.payable.concept ?? preparedInput.description,
          notes: preparedInput.payable.notes ?? preparedInput.notes ?? null,
          status: payableStatus,
          paid_date: payableStatus === 'PAID'
            ? linkedPayable.paid_date ?? preparedInput.transaction_date
            : null,
        })
        if (!payableUpdateResult.ok) {
          throw new Error(payableUpdateResult.error.detail ?? payableUpdateResult.error.message)
        }
      }

      const nextTransactionForCredit = {
        ...existingTx,
        ...updateResult.data,
        destination_account_id: resolvedDestinationAccountId,
      }
      const nextCreditAdjustment = await this.resolveCreditAdjustmentForStoredTransaction(userId, nextTransactionForCredit)
      if (!nextCreditAdjustment.ok) {
        throw new Error(nextCreditAdjustment.error.detail ?? nextCreditAdjustment.error.message)
      }

      const applyNewCredit = await this.applyCreditAdjustment(nextCreditAdjustment.data)
      if (!applyNewCredit.ok) {
        throw new Error(applyNewCredit.error.detail ?? applyNewCredit.error.message)
      }

      const freshResult = await this.txRepo.findByIdForUser(existingTx.id, userId)
      if (!freshResult.ok) return freshResult
      return ok(freshResult.data)
    } catch (error) {
      await restoreCreditAndTransaction()
      return Errors.database(error instanceof Error ? error.message : 'No se pudo actualizar la transacción')
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  DELETE — con limpieza de módulos derivados                             ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  /**
   * Elimina una transacción y desvincula sus módulos derivados.
   *
   * Los módulos derivados (activos, créditos, etc.) NO se eliminan
   * automáticamente — se desvinculan (transaction_id → NULL) para preservar
   * el historial financiero. La excepción son las cuentas por cobrar/pagar
   * originadas por esta transacción, que sí se eliminan junto al movimiento
   * padre para no dejar saldos huérfanos en sus módulos, y los installments,
   * que sí se eliminan si el préstamo asociado no tiene cuotas pagadas.
   *
   * El trigger fn_update_account_balance revierte el saldo automáticamente.
   */
  async deleteTransaction(
    userId:         string,
    transactionId:  string,
    options = { force: false }
  ): Promise<Result<{ deleted: true; modules_unlinked: string[] }>> {

    // Verificar propiedad
    const existing = await this.txRepo.findByIdForUser(transactionId, userId)
    if (!existing.ok) return existing

    const tx           = existing.data
    const unlinked: string[] = []

    if (
      hasStoredAttachmentReference(tx.attachment_url)
      || hasTransactionAttachmentReference(tx.notes)
    ) {
      return Errors.businessRule(ATTACHMENT_DELETE_BLOCKED_MESSAGE)
    }

    // Verificar si tiene cuotas pagadas (no se puede eliminar el préstamo padre)
    if (!options.force) {
      const hasLockedModules = await this.checkLockedModules(transactionId)
      if (hasLockedModules) {
        return Errors.businessRule(
          'Esta transacción tiene cuotas pagadas vinculadas',
          'Usa force: true para forzar la eliminación, o cancela los registros relacionados primero'
        )
      }
    }

    // Eliminar cuentas por cobrar / pagar creadas por esta transacción.
    // Si el usuario borra el movimiento origen desde Movimientos, el módulo
    // derivado no debe quedarse huérfano con transaction_id = null.
    const linkedReceivableResult = await this.db
      .from('accounts_receivable')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle()

    if (linkedReceivableResult.error) {
      return Errors.database(linkedReceivableResult.error.message)
    }

    if (linkedReceivableResult.data?.id) {
      const deleteReceivableResult = await this.receivableRepo.delete(linkedReceivableResult.data.id)
      if (!deleteReceivableResult.ok) return deleteReceivableResult
      unlinked.push('accounts_receivable')
    }

    const linkedPayableResult = await this.db
      .from('accounts_payable')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle()

    if (linkedPayableResult.error) {
      return Errors.database(linkedPayableResult.error.message)
    }

    if (linkedPayableResult.data?.id) {
      const deletePayableResult = await this.payableRepo.delete(linkedPayableResult.data.id)
      if (!deletePayableResult.ok) return deletePayableResult
      unlinked.push('accounts_payable')
    }

    if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER') {
      const accountFilters = [tx.source_account_id, tx.destination_account_id]
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .map(id => `account_id.eq.${id}`)

      const linkedCreditCardsQuery = this.db
        .from('credits')
        .select('id, account_id, credit_type')
        .eq('user_id', userId)
        .eq('credit_type', 'CREDIT_CARD')

      const { data: linkedCreditCards, error: linkedCreditCardsError } = accountFilters.length > 0
        ? await linkedCreditCardsQuery.or(accountFilters.join(','))
        : { data: [], error: null }

      if (linkedCreditCardsError) {
        return Errors.database(linkedCreditCardsError.message)
      }

      const txCurrency = tx.currency === 'USD' ? 'USD' : 'PEN'
      const txAmount = Math.round(Number(tx.amount ?? 0) * 100) / 100
      const consumptionCredit = (linkedCreditCards ?? []).find(credit => credit.account_id === tx.source_account_id)
      const paymentCredit = (linkedCreditCards ?? []).find(credit => credit.account_id === tx.destination_account_id)

      if (consumptionCredit?.id) {
        const reverseConsumption = await this.creditRepo.decrementUsedAmount(consumptionCredit.id, txAmount, txCurrency)
        if (!reverseConsumption.ok) return reverseConsumption
        unlinked.push('credit_card_consumption')
      } else if (paymentCredit?.id) {
        const reversePayment = await this.creditRepo.incrementUsedAmount(paymentCredit.id, txAmount, txCurrency)
        if (!reversePayment.ok) return reversePayment
        unlinked.push('credit_card_payment')
      }
    }

    // Desvincular activo si existe
    const assetResult = await this.assetRepo.findByTransactionId(transactionId)
    if (assetResult.ok && assetResult.data) {
      await this.assetRepo.update(assetResult.data.id, { transaction_id: null })
      unlinked.push('asset')
    }

    // Desvincular otros módulos — usamos queries directas para no crear repos extra
    const tables: Array<'credits' | 'loans'> = [
      'credits', 'loans'
    ]

    for (const table of tables) {
      const { data } = await this.db
        .from(table)
        .update({ transaction_id: null })
        .eq('transaction_id', transactionId)
        .select('id')

      if (data && data.length > 0) unlinked.push(table)
    }

    // Eliminar transacción (el trigger revierte el saldo de accounts)
    const deleteResult = await this.txRepo.delete(transactionId)
    if (!deleteResult.ok) return deleteResult

    return ok({ deleted: true, modules_unlinked: unlinked })
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  READ — listados y filtros                                              ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  async getTransactions(
    userId:  string,
    filters: TransactionFilters = {}
  ): Promise<Result<PaginatedTransactions>> {
    return this.txRepo.findMany(userId, filters)
  }

  async getTransactionById(
    userId: string,
    id:     string
  ): Promise<Result<import('@/types/database.types').TransactionWithRelations>> {
    return this.txRepo.findByIdForUser(id, userId)
  }

  async getRecentTransactions(
    userId: string,
    limit = 10
  ): Promise<Result<import('@/types/database.types').TransactionWithRelations[]>> {
    return this.txRepo.findRecent(userId, limit)
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  PRIVADOS — helpers internos                                            ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  private async resolveCreditAdjustmentForStoredTransaction(
    userId: string,
    transaction: Pick<Transaction, 'type' | 'payment_method' | 'source_account_id' | 'destination_account_id' | 'amount' | 'currency'>,
  ): Promise<Result<CreditAdjustment | null>> {
    if (transaction.type !== 'EXPENSE' && transaction.type !== 'TRANSFER') return ok(null)

    const accountFilters = [transaction.source_account_id, transaction.destination_account_id]
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .map(id => `account_id.eq.${id}`)

    if (accountFilters.length === 0) return ok(null)

    const linkedCreditCardsQuery = this.db
      .from('credits')
      .select('id, account_id, credit_type')
      .eq('user_id', userId)
      .eq('credit_type', 'CREDIT_CARD')

    const { data: linkedCreditCards, error } = await linkedCreditCardsQuery.or(accountFilters.join(','))
    if (error) return Errors.database(error.message)

    const txCurrency = transaction.currency === 'USD' ? 'USD' : 'PEN'
    const txAmount = Math.round(Number(transaction.amount ?? 0) * 100) / 100
    const consumptionCredit = (linkedCreditCards ?? []).find(credit => credit.account_id === transaction.source_account_id)
    const paymentCredit = (linkedCreditCards ?? []).find(credit => credit.account_id === transaction.destination_account_id)

    if (consumptionCredit?.id) {
      return ok({
        id: consumptionCredit.id,
        op: 'CONSUMPTION',
        amount: txAmount,
        currency: txCurrency,
      })
    }

    if (paymentCredit?.id) {
      return ok({
        id: paymentCredit.id,
        op: 'PAYMENT',
        amount: txAmount,
        currency: txCurrency,
      })
    }

    return ok(null)
  }

  private async reverseCreditAdjustment(
    adjustment: CreditAdjustment | null,
  ): Promise<Result<true>> {
    if (!adjustment) return ok(true)

    const result = adjustment.op === 'CONSUMPTION'
      ? await this.creditRepo.decrementUsedAmount(adjustment.id, adjustment.amount, adjustment.currency)
      : await this.creditRepo.incrementUsedAmount(adjustment.id, adjustment.amount, adjustment.currency)

    if (!result.ok) return result
    return ok(true)
  }

  private async applyCreditAdjustment(
    adjustment: CreditAdjustment | null,
  ): Promise<Result<true>> {
    if (!adjustment) return ok(true)

    const result = adjustment.op === 'CONSUMPTION'
      ? await this.creditRepo.incrementUsedAmount(adjustment.id, adjustment.amount, adjustment.currency)
      : await this.creditRepo.decrementUsedAmount(adjustment.id, adjustment.amount, adjustment.currency)

    if (!result.ok) return result
    return ok(true)
  }

  private async resolveTransferCreditContext(
    userId: string,
    input: CreateTransferInput,
    sourceAccount: Account,
    destinationAccount: Account | null,
  ): Promise<Result<TransferCreditContext | null>> {
    const sourceIsCreditCard = sourceAccount.type === 'CREDIT_CARD'
    const destinationIsCreditCard = destinationAccount?.type === 'CREDIT_CARD'

    if (!sourceIsCreditCard && !destinationIsCreditCard) return ok(null)

    if (sourceIsCreditCard && destinationIsCreditCard) {
      return Errors.businessRule(
        'No se puede transferir entre dos tarjetas de crédito',
        'Usa una cuenta de débito como destino para disposición o como origen para pago.'
      )
    }

    const creditAccountId = sourceIsCreditCard
      ? sourceAccount.id
      : destinationAccount?.id

    if (!creditAccountId) return ok(null)

    const { data: creditCard, error } = await this.db
      .from('credits')
      .select('id, status, account_id, credit_type')
      .eq('user_id', userId)
      .eq('account_id', creditAccountId)
      .eq('credit_type', 'CREDIT_CARD')
      .maybeSingle()

    if (error) return Errors.database(error.message)

    if (!creditCard?.id) {
      return Errors.businessRule(
        'La cuenta de tarjeta no tiene una línea de crédito activa vinculada',
        'Edita la tarjeta en Créditos y verifica que tenga una cuenta técnica asociada.'
      )
    }

    if (creditCard.status !== 'ACTIVE') {
      return Errors.businessRule(
        'La tarjeta seleccionada no está activa',
        'Activa la tarjeta o elige otra tarjeta.'
      )
    }

    const adjustmentAmount = Math.round(Number(input.amount ?? 0) * 100) / 100
    const adjustmentCurrency = input.currency === 'USD' ? 'USD' : 'PEN'

    return ok({
      adjustment: {
        id: creditCard.id,
        op: sourceIsCreditCard ? 'CONSUMPTION' : 'PAYMENT',
        amount: adjustmentAmount,
        currency: adjustmentCurrency,
      },
      categorySystemKey: sourceIsCreditCard
        ? CategoryKeys.EXPENSE_CREDIT_CARD_DISPOSITION
        : CategoryKeys.INCOME_CREDIT_CARD_PAYMENT,
    })
  }

  private async resolveCategoryIdBySystemKey(
    userId: string,
    systemKey: string,
  ): Promise<string | null> {
    const { data, error } = await this.db
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('system_key', systemKey)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) return null
    return data?.id ?? null
  }

  /**
   * Carga la cuenta y valida que pertenezca al usuario.
   */
  private async fetchAndValidateAccount(
    accountId: string,
    userId:    string
  ): Promise<Result<Account>> {
    const { data, error } = await this.db
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (error || !data) return Errors.notFound('Cuenta')

    const validation = validateSourceAccount(accountId, data)
    return validation
  }

  /**
   * Construye el payload para la función atómica de Postgres
   * a partir del input de la capa de servicio.
   */
  private buildAtomicPayload(
    userId: string,
    input:  CreateTransactionInput
  ): AtomicTransactionPayload {
    const expBudgetId = input.type === 'EXPENSE'
      ? (input as CreateExpenseInput).budget_id ?? null
      : null
    const expBudgetPeriodId = input.type === 'EXPENSE'
      ? (input as CreateExpenseInput).budget_period_id ?? null
      : null

    const base: AtomicTransactionPayload = {
      p_user_id:                userId,
      p_source_account_id:      input.source_account_id,
      p_destination_account_id: input.type === 'TRANSFER' ? input.destination_account_id : null,
      p_category_id:            input.category_id ?? null,
      p_budget_id:              expBudgetId,
      p_budget_period_id:       expBudgetPeriodId,
      p_type:                   input.type,
      p_amount:                 input.amount,
      p_currency:               input.currency,
      p_exchange_rate:          input.exchange_rate ?? 1.0,
      p_description:            input.description?.trim() ?? '',
      p_transaction_date:       input.transaction_date,
      p_notes:                  input.notes ?? null,
      p_is_recurring:           input.is_recurring ?? false,
      p_sender:                 input.sender?.trim() || null,
      p_recipient:              input.recipient?.trim() || null,
      p_asset:                  null,
      p_credit:                 null,
      p_loan:                   null,
      p_receivable:             null,
      p_payable:                null,
    }

    // ── INCOME ───────────────────────────────────────────────────────────────
    if (input.type === 'INCOME') {
      const inc = input as CreateIncomeInput
      if (inc.payable) {
        base.p_payable = {
          creditor_id:   inc.payable.creditor_id,
          creditor_name: inc.payable.creditor_name,
          due_date:      inc.payable.due_date,
          concept:       inc.payable.concept,
          notes:         inc.payable.notes,
        }
      }
    }

    // ── EXPENSE ──────────────────────────────────────────────────────────────
    if (input.type === 'EXPENSE') {
      const exp = input as CreateExpenseInput

      if (exp.asset) {
        base.p_asset = {
          name:              exp.asset.name,
          asset_type:        exp.asset.asset_type,
          purchase_value:    exp.asset.purchase_value ?? input.amount,
          current_value:     exp.asset.current_value ?? exp.asset.purchase_value ?? input.amount,
          purchase_date:     exp.asset.purchase_date ?? input.transaction_date,
          depreciation_rate: exp.asset.depreciation_rate ?? 0,
          serial_number:     exp.asset.serial_number,
          location:          exp.asset.location,
          notes:             exp.asset.notes,
        }
      }

      if (exp.credit) {
        base.p_credit = exp.credit
      }

      if (exp.loan) {
        base.p_loan = {
          creditor_name:      exp.loan.creditor_name,
          principal_amount:   exp.loan.principal_amount ?? input.amount,
          interest_rate:      exp.loan.interest_rate,
          total_installments: exp.loan.total_installments,
          start_date:         exp.loan.start_date ?? input.transaction_date,
          end_date:           exp.loan.end_date,
          notes:              exp.loan.notes,
          generate_schedule:  exp.loan.generate_schedule ?? false,
        }
      }

      if (exp.receivable) {
        base.p_receivable = {
          debtor_id:   exp.receivable.debtor_id,
          debtor_name: exp.receivable.debtor_name,
          due_date:    exp.receivable.due_date,
          concept:     exp.receivable.concept,
          notes:       exp.receivable.notes,
        }
      }
    }

    return base
  }

  /**
   * Llama a la función Postgres create_transaction_atomic vía RPC.
   */
  private async callAtomicFunction(
    payload: AtomicTransactionPayload
  ): Promise<Result<AtomicTransactionResult>> {
    try {
      const { data, error } = await (this.db.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>)(
        'create_transaction_atomic',
        {
          p_user_id:                payload.p_user_id,
          p_source_account_id:      payload.p_source_account_id,
          p_destination_account_id: payload.p_destination_account_id,
          p_category_id:            payload.p_category_id,
          p_budget_id:              payload.p_budget_id ?? null,
          p_type:                   payload.p_type,
          p_amount:                 payload.p_amount,
          p_currency:               payload.p_currency,
          p_exchange_rate:          payload.p_exchange_rate,
          p_description:            payload.p_description,
          p_transaction_date:       payload.p_transaction_date,
          p_notes:                  payload.p_notes,
          p_is_recurring:           payload.p_is_recurring,
          p_sender:                 payload.p_sender,
          p_recipient:              payload.p_recipient,
          p_asset:                  payload.p_asset      ? JSON.stringify(payload.p_asset)      : null,
          p_credit:                 payload.p_credit     ? JSON.stringify(payload.p_credit)     : null,
          p_loan:                   payload.p_loan       ? JSON.stringify(payload.p_loan)       : null,
          p_receivable:             payload.p_receivable ? JSON.stringify(payload.p_receivable) : null,
          p_payable:                payload.p_payable    ? JSON.stringify(payload.p_payable)    : null,
        }
      )

      if (error) {
        if (this.isMissingAtomicFunction(error.message)) {
          return this.createTransactionFallback(payload)
        }
        return Errors.atomicityFailure(
          error.message.replace('create_transaction_atomic failed: ', '')
        )
      }

      if (!data) {
        return Errors.atomicityFailure('La función atómica no devolvió un resultado')
      }

      return ok(data as unknown as AtomicTransactionResult)
    } catch (e) {
      if (e instanceof Error && this.isMissingAtomicFunction(e.message)) {
        return this.createTransactionFallback(payload)
      }
      return Errors.atomicityFailure(
        e instanceof Error ? e.message : 'Error inesperado en operación atómica'
      )
    }
  }

  private isMissingAtomicFunction(message: string): boolean {
    const lower = message.toLowerCase()
    return (
      lower.includes('could not find the function public.create_transaction_atomic') ||
      (lower.includes('create_transaction_atomic') && lower.includes('does not exist'))
    )
  }

  /**
   * Fallback operativo para entornos donde la función RPC aún no fue migrada.
   * Inserta la transacción principal para no bloquear el registro básico.
   */
  private async createTransactionFallback(
    payload: AtomicTransactionPayload
  ): Promise<Result<AtomicTransactionResult>> {
    const { data, error } = await this.db
      .from('transactions')
      .insert({
        user_id: payload.p_user_id,
        source_account_id: payload.p_source_account_id,
        destination_account_id: payload.p_destination_account_id,
        category_id: payload.p_category_id,
        budget_id: payload.p_budget_id ?? null,
        budget_period_id: payload.p_budget_period_id ?? null,
        type: payload.p_type,
        amount: payload.p_amount,
        amount_pen: payload.p_currency === 'USD'
          ? Math.round((payload.p_amount * payload.p_exchange_rate) * 100) / 100
          : payload.p_amount,
        currency: payload.p_currency,
        exchange_rate: payload.p_exchange_rate,
        description: payload.p_description,
        transaction_date: payload.p_transaction_date,
        notes: payload.p_notes,
        is_recurring: payload.p_is_recurring,
        sender: payload.p_sender,
        recipient: payload.p_recipient,
        creditor_id: payload.p_payable?.creditor_id ?? null,
        debtor_id: payload.p_receivable?.debtor_id ?? null,
      })
      .select('id')
      .single()

    if (error || !data) {
      return Errors.atomicityFailure(error?.message ?? 'No se pudo registrar la transacción')
    }

    const result: AtomicTransactionResult = {
      transaction_id: data.id,
      asset_id: null,
      credit_id: null,
      loan_id: null,
      receivable_id: null,
      payable_id: null,
      installments_generated: 0,
    }

    const rollbackTransaction = async () => {
      await this.db
        .from('transactions')
        .delete()
        .eq('id', data.id)
        .eq('user_id', payload.p_user_id)
    }

    if (payload.p_receivable) {
      const receivableResult = await this.receivableRepo.create({
        user_id: payload.p_user_id,
        transaction_id: data.id,
        debtor_id: payload.p_receivable.debtor_id ?? null,
        debtor_name: payload.p_receivable.debtor_name,
        amount: payload.p_amount,
        currency: payload.p_currency,
        issue_date: payload.p_transaction_date,
        due_date: payload.p_receivable.due_date ?? null,
        concept: payload.p_receivable.concept ?? null,
        notes: payload.p_receivable.notes ?? null,
        status: 'PENDING',
      })

      if (!receivableResult.ok) {
        await rollbackTransaction()
        return Errors.atomicityFailure(
          receivableResult.error.message || 'No se pudo registrar la cuenta por cobrar'
        )
      }

      result.receivable_id = receivableResult.data.id
    }

    if (payload.p_payable) {
      const payableResult = await this.payableRepo.create({
        user_id: payload.p_user_id,
        transaction_id: data.id,
        creditor_id: payload.p_payable.creditor_id ?? null,
        creditor_name: payload.p_payable.creditor_name,
        amount: payload.p_amount,
        currency: payload.p_currency,
        issue_date: payload.p_transaction_date,
        due_date: payload.p_payable.due_date ?? null,
        concept: payload.p_payable.concept ?? null,
        notes: payload.p_payable.notes ?? null,
        status: 'PENDING',
      })

      if (!payableResult.ok) {
        if (result.receivable_id) {
          await this.receivableRepo.delete(result.receivable_id)
        }
        await rollbackTransaction()
        return Errors.atomicityFailure(
          payableResult.error.message || 'No se pudo registrar la cuenta por pagar'
        )
      }

      result.payable_id = payableResult.data.id
    }

    return ok(result)
  }

  /**
   * Compatibilidad defensiva para entornos donde la función SQL aún no persiste
   * debtor_id / creditor_id en la transacción o en el módulo derivado.
   */
  private async syncCounterpartyLinks(
    ids: AtomicTransactionResult,
    payload: AtomicTransactionPayload,
  ): Promise<void> {
    try {
      const transactionPatch: Record<string, string> = {}

      if (payload.p_receivable?.debtor_id) {
        transactionPatch.debtor_id = payload.p_receivable.debtor_id

        if (ids.receivable_id) {
          await this.db
            .from('accounts_receivable')
            .update({ debtor_id: payload.p_receivable.debtor_id })
            .eq('id', ids.receivable_id)
            .eq('user_id', payload.p_user_id)
        }
      }

      if (payload.p_payable?.creditor_id) {
        transactionPatch.creditor_id = payload.p_payable.creditor_id

        if (ids.payable_id) {
          await this.db
            .from('accounts_payable')
            .update({ creditor_id: payload.p_payable.creditor_id })
            .eq('id', ids.payable_id)
            .eq('user_id', payload.p_user_id)
        }
      }

      if (Object.keys(transactionPatch).length > 0) {
        await this.db
          .from('transactions')
          .update(transactionPatch)
          .eq('id', ids.transaction_id)
          .eq('user_id', payload.p_user_id)
      }
    } catch {
      // No bloquea la creación principal; solo corrige vínculos en entornos legacy.
    }
  }

  /**
   * Carga todos los registros creados por la función atómica.
   * Se ejecuta FUERA de la función Postgres — es solo para retornar
   * los objetos completos al llamador.
   */
  private async loadCreatedRecords(
    ids: AtomicTransactionResult
  ): Promise<Result<CreateTransactionResult>> {
    // Transacción principal — obligatoria
    const txResult = await this.txRepo.findById(ids.transaction_id)
    if (!txResult.ok) return txResult

    const result: CreateTransactionResult = {
      transaction:           txResult.data,
      installments_generated: ids.installments_generated,
    }

    // Módulos derivados — opcionales, fallo silencioso en carga (ya están en BD)
    if (ids.asset_id) {
      const r = await this.assetRepo.findById(ids.asset_id)
      if (r.ok) result.asset = r.data
    }

    if (ids.credit_id) {
      const r = await this.creditRepo.findById(ids.credit_id)
      if (r.ok) result.credit = r.data
    }

    if (ids.loan_id) {
      const r = await this.loanRepo.findById(ids.loan_id)
      if (r.ok) result.loan = r.data
    }

    if (ids.receivable_id) {
      const r = await this.receivableRepo.findById(ids.receivable_id)
      if (r.ok) result.receivable = r.data
    }

    if (ids.payable_id) {
      const r = await this.payableRepo.findById(ids.payable_id)
      if (r.ok) result.payable = r.data
    }

    return ok(result)
  }

  /**
   * Verifica si una transacción tiene módulos derivados con estado "pagado"
   * que impedirían una eliminación limpia.
   *
   * Nota: no bloqueamos por cuentas por cobrar parciales/cobradas porque
   * los cobros generales se distribuyen sobre esos saldos sin una relación
   * directa por transacción hija. En esos casos priorizamos permitir el
   * borrado del movimiento original y desvincular el módulo derivado.
   */
  private async checkLockedModules(transactionId: string): Promise<boolean> {
    try {
      // Cuotas pagadas
      const { data: paidInstallments } = await this.db
        .from('installments')
        .select('id')
        .eq('transaction_id', transactionId)
        .eq('status', 'PAID')
        .limit(1)

      if (paidInstallments && paidInstallments.length > 0) return true

      return false
    } catch {
      return false  // En caso de error, permitir la eliminación
    }
  }

  private prepareCreateInput(
    input: CreateTransactionInput,
    sourceAccount: Account,
    destinationAccount: Account | null,
  ): CreateTransactionInput {
    const description = input.type === 'TRANSFER'
      ? this.resolveTransferDescription(input, sourceAccount, destinationAccount)
      : input.description?.trim()

    return {
      ...input,
      description,
      sender: input.sender?.trim() || undefined,
      recipient: input.recipient?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    }
  }

  private async resolveCreateInputExchangeRate(
    input: CreateTransactionInput,
  ): Promise<CreateTransactionInput> {
    if (input.currency !== 'USD') {
      return { ...input, exchange_rate: undefined }
    }

    const providedRate = Number(input.exchange_rate)
    if (Number.isFinite(providedRate) && providedRate > 0) {
      return {
        ...input,
        exchange_rate: Math.round(providedRate * 1_000_000) / 1_000_000,
      }
    }

    const snapshot = await resolveAccountingUsdPenExchangeRate({
      date: input.transaction_date,
      allowPrior: true,
      ensureForToday: true,
    })
    const rate = Number(snapshot.rate)

    if (!Number.isFinite(rate) || rate <= 0) {
      return input
    }

    return {
      ...input,
      exchange_rate: Math.round(rate * 1_000_000) / 1_000_000,
    }
  }

  private resolveTransferDescription(
    input: CreateTransferInput,
    sourceAccount: Account,
    destinationAccount: Account | null,
  ): string {
    const manual = input.description?.trim()
    if (manual) return manual

    const destinationName = destinationAccount?.name ?? 'Cuenta destino'
    const sourceIsCreditCard = sourceAccount.type === 'CREDIT_CARD'
    const destinationIsCreditCard = destinationAccount?.type === 'CREDIT_CARD'

    if (sourceIsCreditCard && !destinationIsCreditCard) {
      return `Disposición de TC ${sourceAccount.name} transferido a ${destinationName}`.slice(0, 255)
    }

    if (!sourceIsCreditCard && destinationIsCreditCard) {
      return `Pago de TC ${destinationName} con ${sourceAccount.name}`.slice(0, 255)
    }

    const destinationCurrency = destinationAccount?.currency ?? input.currency
    const raw = `Transferencia de ${sourceAccount.name} / ${sourceAccount.currency} a ${destinationName} / ${destinationCurrency}`
    return raw.slice(0, 255)
  }

  private async resolveExpenseBudgetPeriodId(
    userId: string,
    input: CreateExpenseInput,
  ): Promise<string | null> {
    if (input.budget_period_id) return input.budget_period_id
    if (!input.budget_id) return null

    try {
      const { data, error } = await this.db
        .from('budget_periods')
        .select(`
          id,
          budget:budget_series(user_id)
        `)
        .eq('legacy_budget_id', input.budget_id)
        .lte('period_start', input.transaction_date)
        .gte('period_end', input.transaction_date)
        .limit(1)
        .maybeSingle()

      if (error || !data) return null
      const budget = Array.isArray(data.budget) ? data.budget[0] : data.budget
      if (!budget || budget.user_id !== userId) return null

      return data.id
    } catch {
      return null
    }
  }

  private async attachBudgetPeriodToTransaction(
    transactionId: string,
    budgetPeriodId: string,
  ): Promise<void> {
    try {
      await this.db
        .from('transactions')
        .update({ budget_period_id: budgetPeriodId })
        .eq('id', transactionId)
    } catch {
      // Compatibilidad: si la columna aún no existe en un entorno, no bloquea el alta.
    }
  }

  private async validateExpenseBudget(
    userId: string,
    input: CreateExpenseInput,
  ): Promise<Result<true>> {
    if (!input.budget_id) return ok(true)

    if (!input.category_id) {
      return Errors.businessRule(
        'Debes seleccionar una categoría antes de asociar un presupuesto',
        'El presupuesto solo puede vincularse a un egreso con categoría definida'
      )
    }

    const { data, error } = await this.db
      .from('budgets')
      .select('id, name, category_id, currency, period_type, start_date, end_date, is_active')
      .eq('id', input.budget_id)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return Errors.notFound('Presupuesto')
    }

    const budget = data as BudgetEligibilityRow

    if (!budget.is_active) {
      return Errors.businessRule(
        'El presupuesto seleccionado está inactivo',
        `Activa "${budget.name}" o selecciona otro presupuesto`
      )
    }

    if (!budget.category_id || budget.category_id !== input.category_id) {
      return Errors.businessRule(
        'El presupuesto no corresponde a la categoría del egreso',
        `El egreso debe usar la misma categoría del presupuesto "${budget.name}"`
      )
    }

    const eligibleWindow = resolveBudgetWindowAtDate(budget, input.transaction_date)
    if (!eligibleWindow) {
      return Errors.businessRule(
        'El presupuesto no está vigente para la fecha seleccionada',
        `La fecha ${input.transaction_date} no cae dentro de un período activo de "${budget.name}"`
      )
    }

    return ok(true)
  }
}
