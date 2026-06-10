// =============================================================================
// modules/transactions/transaction.validations.ts
// Validaciones de negocio puras — sin efectos secundarios, sin IO.
// Se ejecutan ANTES de cualquier operación de base de datos.
// =============================================================================

import type { Account }                from '@/types/database.types'
import type { CreateTransactionInput } from './transaction.service.types'
import { type Result, Errors, ok }     from '@/modules/shared/result.types'
import { hasAtMostDecimals }           from '@/lib/utils/numeric-input'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const isValidDate = (d: string) => !isNaN(Date.parse(d))
const isFutureDate = (d: string) => new Date(d) > new Date()
const DEBIT_EXPENSE_ALLOWED_ACCOUNT_TYPES = new Set<Account['type']>([
  'CHECKING',
  'SAVINGS',
  'CASH',
  'INVESTMENT',
  'STOCKS',
  'ETF',
  'CRYPTO',
])

// ─── VALIDACIONES GENERALES ───────────────────────────────────────────────────

/**
 * Valida que el monto sea positivo y con máximo 2 decimales.
 */
function validateAmount(amount: number): Result<true> {
  if (amount <= 0)
    return Errors.validation('El monto debe ser mayor a cero')

  if (!hasAtMostDecimals(amount, 2))
    return Errors.validation('El monto no puede tener más de 2 decimales')

  if (amount > 100_000_000)
    return Errors.validation('El monto excede el límite permitido (100,000,000)')

  return ok(true)
}

/**
 * Valida la fecha de transacción — no puede ser más de 5 años en el pasado
 * ni más de 1 día en el futuro (para permitir ajuste de zona horaria).
 */
function validateTransactionDate(date: string): Result<true> {
  if (!isValidDate(date))
    return Errors.validation('Fecha de transacción inválida')

  const d         = new Date(date)
  const now       = new Date()
  const fiveYears = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
  const tomorrow  = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  if (d < fiveYears)
    return Errors.validation('La fecha no puede ser anterior a 5 años')

  if (d > tomorrow)
    return Errors.validation('La fecha no puede ser futura')

  return ok(true)
}

/**
 * Valida el tipo de cambio cuando la moneda es USD.
 */
function validateExchangeRate(currency: string, exchangeRate?: number): Result<true> {
  if (currency === 'USD') {
    if (!exchangeRate || exchangeRate <= 0)
      return Errors.validation('El tipo de cambio es obligatorio para transacciones en USD')

    if (exchangeRate < 0.01 || exchangeRate > 100)
      return Errors.validation('El tipo de cambio USD/PEN debe estar entre 0.01 y 100')
  }

  return ok(true)
}

/**
 * Valida la descripción.
 */
function validateDescription(description: string | undefined, required = true): Result<true> {
  const trimmed = description?.trim() ?? ''

  if (required && trimmed.length === 0)
    return Errors.validation('La descripción es obligatoria')

  if (trimmed.length > 255)
    return Errors.validation('La descripción no puede superar 255 caracteres')

  return ok(true)
}

// ─── VALIDACIONES POR TIPO ────────────────────────────────────────────────────

/**
 * Valida que la cuenta origen pertenezca al usuario y esté activa.
 */
export function validateSourceAccount(
  accountId: string,
  account: Account | null
): Result<Account> {
  if (!account)
    return Errors.notFound('Cuenta origen')

  if (account.id !== accountId)
    return Errors.unauthorized()

  if (!account.is_active)
    return Errors.businessRule('La cuenta origen está inactiva')

  return ok(account)
}

/**
 * Valida que la cuenta destino sea válida para una transferencia.
 */
export function validateDestinationAccount(
  sourceAccountId: string,
  destinationAccount: Account | null
): Result<Account> {
  if (!destinationAccount)
    return Errors.notFound('Cuenta destino')

  if (!destinationAccount.is_active)
    return Errors.businessRule('La cuenta destino está inactiva')

  if (destinationAccount.id === sourceAccountId)
    return Errors.businessRule('La cuenta origen y destino no pueden ser la misma')

  return ok(destinationAccount)
}

/**
 * Valida que el saldo de la cuenta sea suficiente para un EGRESO o TRANSFERENCIA.
 * NOTA: Esta validación es informativa — el trigger de BD actualiza el saldo
 * pero no bloquea saldos negativos (algunas cuentas corrientes lo permiten).
 * Si se quiere bloquear, se puede agregar un CHECK en la BD.
 */
export function validateSufficientBalance(
  account: Account,
  amount: number,
  allowNegative = false
): Result<true> {
  if (!allowNegative && account.balance < amount) {
    return Errors.businessRule(
      `Saldo insuficiente en "${account.name}"`,
      `Saldo disponible: ${account.balance} ${account.currency}, requerido: ${amount}`
    )
  }
  return ok(true)
}

export function validateSourceAccountAgainstTransaction(
  input: CreateTransactionInput,
  account: Account,
): Result<true> {
  if (input.currency !== account.currency) {
    return Errors.businessRule(
      'La moneda de la transacción no coincide con el portafolio seleccionado',
      `El portafolio "${account.name}" opera en ${account.currency}.`
    )
  }

  if (input.type === 'EXPENSE' && input.payment_method !== 'CREDIT') {
    if (!DEBIT_EXPENSE_ALLOWED_ACCOUNT_TYPES.has(account.type)) {
      return Errors.businessRule(
        'Ese portafolio no está habilitado para egresos por débito',
        'Usa una cuenta corriente, ahorros, efectivo o un portafolio transaccional compatible.'
      )
    }
  }

  if (input.type === 'EXPENSE' && input.payment_method === 'CREDIT' && account.type !== 'CREDIT_CARD') {
    return Errors.businessRule(
      'Los egresos con crédito deben usar un portafolio tipo tarjeta',
      'Selecciona una tarjeta de crédito activa.'
    )
  }

  return ok(true)
}

// ─── VALIDACIÓN PRINCIPAL ─────────────────────────────────────────────────────

/**
 * Valida el input completo antes de enviarlo al servicio.
 * Ejecutar siempre antes de llamar a createTransaction().
 */
export function validateCreateTransactionInput(
  input: CreateTransactionInput
): Result<true> {
  const amountResult = validateAmount(input.amount)
  if (!amountResult.ok) return amountResult

  const dateResult = validateTransactionDate(input.transaction_date)
  if (!dateResult.ok) return dateResult

  const rateResult = validateExchangeRate(input.currency, input.exchange_rate)
  if (!rateResult.ok) return rateResult

  const descResult = validateDescription(input.description, input.type !== 'TRANSFER')
  if (!descResult.ok) return descResult

  // Validaciones específicas por tipo
  if (input.type === 'TRANSFER') {
    if (!input.destination_account_id)
      return Errors.validation('Las transferencias requieren cuenta destino')

    if (input.destination_account_id === input.source_account_id)
      return Errors.businessRule('Cuenta origen y destino no pueden ser la misma')
  }

  if (input.type === 'EXPENSE') {
    if (input.credit_operation === 'PAYMENT' && !input.credit_card_id) {
      return Errors.validation('Debes seleccionar una tarjeta para registrar el pago de tarjeta')
    }

    // No se puede crear activo Y crédito en la misma transacción
    if (input.asset && input.credit)
      return Errors.businessRule(
        'Una transacción no puede generar un activo y un crédito simultáneamente'
      )

    // Validar módulo activo si existe
    if (input.asset) {
      if (!input.asset.name?.trim())
        return Errors.validation('El nombre del activo es obligatorio')

      if (input.asset.purchase_value !== undefined && input.asset.purchase_value !== input.amount) {
        // Advertencia — el purchase_value del activo debería coincidir con el monto
        // No es un error bloqueante, pero se registra
      }
    }

    // Validar módulo préstamo si existe
    if (input.loan) {
      if (input.loan.total_installments < 1)
        return Errors.validation('El número de cuotas debe ser al menos 1')

      if (!isValidDate(input.loan.end_date))
        return Errors.validation('La fecha de fin del préstamo es inválida')

      if (isFutureDate(input.loan.end_date) === false)
        return Errors.validation('La fecha de fin del préstamo debe ser futura')
    }
  }

  if (input.type === 'INCOME' && input.payable) {
    if (!input.payable.creditor_name?.trim())
      return Errors.validation('El nombre del acreedor es obligatorio')
  }

  if (input.type === 'EXPENSE' && input.receivable) {
    if (!input.receivable.debtor_name?.trim())
      return Errors.validation('El nombre del deudor es obligatorio')
  }

  return ok(true)
}
