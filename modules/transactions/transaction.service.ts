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

    // ── PASO 1: Validaciones de negocio (sin IO) ────────────────────────────
    const validationResult = validateCreateTransactionInput(input)
    if (!validationResult.ok) return validationResult

    // ── PASO 2: Verificar cuenta origen ─────────────────────────────────────
    const sourceAccountResult = await this.fetchAndValidateAccount(
      input.source_account_id,
      userId
    )
    if (!sourceAccountResult.ok) return sourceAccountResult
    const sourceAccount = sourceAccountResult.data

    const sourceAccountBusinessValidation = validateSourceAccountAgainstTransaction(input, sourceAccount)
    if (!sourceAccountBusinessValidation.ok) return sourceAccountBusinessValidation

    const expenseInput = input.type === 'EXPENSE'
      ? (input as CreateExpenseInput)
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

        if (selectedCreditCard.account_id !== input.source_account_id) {
          return Errors.validation(
            'La cuenta de salida no coincide con la tarjeta seleccionada',
            'Vuelve a seleccionar la tarjeta de crédito en el formulario'
          )
        }
      }
    }

    // ── PASO 3: Verificar cuenta destino (solo TRANSFER) ────────────────────
    let destinationAccount: Account | null = null
    if (input.type === 'TRANSFER') {
      const destResult = await this.fetchAndValidateAccount(
        input.destination_account_id,
        userId
      )
      if (!destResult.ok) return destResult

      const destValidation = validateDestinationAccount(
        input.source_account_id,
        destResult.data
      )
      if (!destValidation.ok) return destValidation

      destinationAccount = destResult.data
    }

    const preparedInput = this.prepareCreateInput(
      input,
      sourceAccount,
      destinationAccount
    )

    if (preparedInput.type === 'EXPENSE') {
      const budgetValidation = await this.validateExpenseBudget(userId, preparedInput)
      if (!budgetValidation.ok) return budgetValidation
    }

    // ── PASO 4: Verificar saldo para EXPENSE y TRANSFER ─────────────────────
    if ((preparedInput.type === 'EXPENSE' && !usesCreditCardAsSource) || preparedInput.type === 'TRANSFER') {
      const balanceResult = validateSufficientBalance(
        sourceAccount,
        preparedInput.amount,
        false   // no permitir saldo negativo por defecto
      )
      if (!balanceResult.ok) return balanceResult
    }

    let creditAdjusted: { id: string; op: 'CONSUMPTION' | 'PAYMENT'; amount: number } | null = null
    if (expenseInput?.credit_card_id && selectedCreditCard) {
      const op: 'CONSUMPTION' | 'PAYMENT' = usesCreditCardAsSource
        ? 'CONSUMPTION'
        : expenseInput.credit_operation === 'PAYMENT'
          ? 'PAYMENT'
          : 'CONSUMPTION'

      const adjustResult = op === 'CONSUMPTION'
        ? await this.creditRepo.incrementUsedAmount(selectedCreditCard.id, preparedInput.amount)
        : await this.creditRepo.decrementUsedAmount(selectedCreditCard.id, preparedInput.amount)

      if (!adjustResult.ok) return adjustResult
      creditAdjusted = { id: selectedCreditCard.id, op, amount: preparedInput.amount }
    }

    // ── PASO 5: Construir payload atómico ────────────────────────────────────
    const payload = this.buildAtomicPayload(userId, preparedInput)
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
          await this.creditRepo.decrementUsedAmount(creditAdjusted.id, creditAdjusted.amount)
        } else {
          await this.creditRepo.incrementUsedAmount(creditAdjusted.id, creditAdjusted.amount)
        }
      }
      return rpcResult
    }

    const ids = rpcResult.data

    // ── PASO 7: Cargar registros creados y retornar ───────────────────────────
    return this.loadCreatedRecords(ids)
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  UPDATE — solo campos no críticos                                       ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  /**
   * Actualiza únicamente campos descriptivos de una transacción.
   *
   * DISEÑO DELIBERADO: monto, cuentas y tipo son inmutables post-creación.
   * Cambiar el monto requiere delete + create para mantener el historial de
   * saldos íntegro (los triggers de balance no hacen diff parcial de montos).
   * Esta restricción se comunica explícitamente en la UI.
   */
  async updateTransaction(
    userId: string,
    input:  UpdateTransactionInput
  ): Promise<Result<Transaction>> {
    // Verificar que la transacción pertenece al usuario
    const existing = await this.txRepo.findByIdForUser(input.id, userId)
    if (!existing.ok) return existing

    // Construir solo los campos permitidos
    const updateData: Record<string, unknown> = {}
    if (input.description !== undefined)     updateData.description     = input.description.trim()
    if (input.category_id !== undefined)     updateData.category_id     = input.category_id
    if (input.notes       !== undefined)     updateData.notes           = input.notes
    if (input.is_recurring !== undefined)    updateData.is_recurring    = input.is_recurring
    if (input.transaction_date !== undefined) {
      // Permitir corrección de fecha dentro del mismo mes
      const existingMonth = existing.data.transaction_date.slice(0, 7)
      const newMonth      = input.transaction_date.slice(0, 7)

      if (existingMonth !== newMonth) {
        return Errors.businessRule(
          'No se puede cambiar la fecha a un mes diferente',
          'Para mover una transacción a otro mes, elimínala y regístrala de nuevo'
        )
      }
      updateData.transaction_date = input.transaction_date
    }

    if (Object.keys(updateData).length === 0) {
      return Errors.validation('No hay campos válidos para actualizar')
    }

    return this.txRepo.update(input.id, updateData)
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  DELETE — con limpieza de módulos derivados                             ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  /**
   * Elimina una transacción y desvincula sus módulos derivados.
   *
   * Los módulos derivados (activos, créditos, etc.) NO se eliminan
   * automáticamente — se desvinculan (transaction_id → NULL) para preservar
   * el historial financiero. La excepción son installments, que sí se eliminan
   * si el préstamo asociado no tiene cuotas pagadas.
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

    // Verificar si tiene cuotas pagadas (no se puede eliminar el préstamo padre)
    if (!options.force) {
      const hasLockedModules = await this.checkLockedModules(transactionId)
      if (hasLockedModules) {
        return Errors.businessRule(
          'Esta transacción tiene cuotas pagadas o cobros registrados',
          'Usa force: true para forzar la eliminación, o cancela los registros relacionados primero'
        )
      }
    }

    // Desvincular activo si existe
    const assetResult = await this.assetRepo.findByTransactionId(transactionId)
    if (assetResult.ok && assetResult.data) {
      await this.assetRepo.update(assetResult.data.id, { transaction_id: null })
      unlinked.push('asset')
    }

    // Desvincular otros módulos — usamos queries directas para no crear repos extra
    const tables: Array<'credits' | 'loans' | 'accounts_receivable' | 'accounts_payable'> = [
      'credits', 'loans', 'accounts_receivable', 'accounts_payable'
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

    const base: AtomicTransactionPayload = {
      p_user_id:                userId,
      p_source_account_id:      input.source_account_id,
      p_destination_account_id: input.type === 'TRANSFER' ? input.destination_account_id : null,
      p_category_id:            input.category_id ?? null,
      p_budget_id:              expBudgetId,
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

    return ok({
      transaction_id: data.id,
      asset_id: null,
      credit_id: null,
      loan_id: null,
      receivable_id: null,
      payable_id: null,
      installments_generated: 0,
    })
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
   * o "cobrado" que impedirían una eliminación limpia.
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

      // Cobros registrados en cuentas por cobrar
      const { data: collectedReceivables } = await this.db
        .from('accounts_receivable')
        .select('id')
        .eq('transaction_id', transactionId)
        .in('status', ['COLLECTED', 'PARTIAL'])
        .limit(1)

      if (collectedReceivables && collectedReceivables.length > 0) return true

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

  private resolveTransferDescription(
    input: CreateTransferInput,
    sourceAccount: Account,
    destinationAccount: Account | null,
  ): string {
    const manual = input.description?.trim()
    if (manual) return manual

    const destinationName = destinationAccount?.name ?? 'Cuenta destino'
    const destinationCurrency = destinationAccount?.currency ?? input.currency
    const raw = `Transferencia de ${sourceAccount.name} / ${sourceAccount.currency} a ${destinationName} / ${destinationCurrency}`
    return raw.slice(0, 255)
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
