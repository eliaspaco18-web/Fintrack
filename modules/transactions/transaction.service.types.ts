// =============================================================================
// modules/transactions/transaction.service.types.ts
// Tipos de la capa de servicio — contratos de entrada y salida del
// TransactionService. Son distintos de los tipos de BD para mantener
// la capa de servicio desacoplada del schema.
// =============================================================================

import type {
  TransactionType,
  CurrencyCode,
  AssetType,
  CreditType,
  Transaction,
  TransactionWithRelations,
  Asset,
  Credit,
  Loan,
  AccountReceivable,
  AccountPayable,
} from '@/types/database.types'

// ─── INPUTS ───────────────────────────────────────────────────────────────────

/**
 * Payload base compartido por los tres tipos de transacción.
 */
interface BaseTransactionInput {
  source_account_id: string
  amount:            number
  currency:          CurrencyCode
  payment_method?:   'DEBIT' | 'CREDIT'
  credit_card_id?:   string
  credit_operation?: 'CONSUMPTION' | 'PAYMENT'
  exchange_rate?:    number   // obligatorio si currency = 'USD'
  description:       string
  transaction_date:  string   // 'YYYY-MM-DD'
  category_id?:      string
  notes?:            string
  is_recurring?:     boolean
}

// ── INCOME ────────────────────────────────────────────────────────────────────

export interface CreateIncomeInput extends BaseTransactionInput {
  type: 'INCOME'
  /** Si se pasa, registra la cuenta por cobrar asociada */
  receivable?: CreateReceivableModuleInput
}

// ── EXPENSE ───────────────────────────────────────────────────────────────────

export interface CreateExpenseInput extends BaseTransactionInput {
  type: 'EXPENSE'
  /** Si se pasa, crea el activo asociado al gasto */
  asset?:    CreateAssetModuleInput
  /** Si se pasa, registra el crédito / préstamo asociado */
  credit?:   CreateCreditModuleInput
  loan?:     CreateLoanModuleInput
  /** Si se pasa, registra la cuenta por pagar */
  payable?:  CreatePayableModuleInput
}

// ── TRANSFER ──────────────────────────────────────────────────────────────────

export interface CreateTransferInput extends BaseTransactionInput {
  type:                    'TRANSFER'
  destination_account_id:  string
}

/** Unión discriminada — el tipo de la transacción determina los campos extra */
export type CreateTransactionInput =
  | CreateIncomeInput
  | CreateExpenseInput
  | CreateTransferInput

// ── MÓDULOS DERIVADOS (inputs) ────────────────────────────────────────────────

export interface CreateAssetModuleInput {
  name:              string
  asset_type:        AssetType
  purchase_value?:   number
  current_value?:    number   // si omitido = purchase_value
  purchase_date?:    string   // si omitido = transaction_date
  depreciation_rate?: number
  serial_number?:    string
  location?:         string
  notes?:            string
}

export interface CreateCreditModuleInput {
  credit_type:   CreditType
  name:          string
  credit_limit:  number
  interest_rate: number
  closing_day?:  number
  payment_day?:  number
  notes?:        string
}

export interface CreateLoanModuleInput {
  creditor_name:      string
  principal_amount?:  number
  interest_rate:      number
  total_installments: number
  start_date?:        string   // si omitido = transaction_date
  end_date:           string
  notes?:             string
  /** Si se pasa, genera el cronograma de cuotas automáticamente */
  generate_schedule?: boolean
}

export interface CreateReceivableModuleInput {
  debtor_name:  string
  due_date?:    string
  concept?:     string
  notes?:       string
}

export interface CreatePayableModuleInput {
  creditor_name: string
  due_date?:     string
  concept?:      string
  notes?:        string
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

/** Solo se permiten actualizar campos no críticos. */
export interface UpdateTransactionInput {
  id:               string
  description?:     string
  category_id?:     string | null
  notes?:           string | null
  is_recurring?:    boolean
  transaction_date?: string
  /**
   * Cambios de monto y cuentas no se permiten vía update para preservar
   * la integridad del historial. Se debe eliminar y recrear.
   */
}

// ─── OUTPUTS ──────────────────────────────────────────────────────────────────

/**
 * Resultado de createTransaction — incluye la transacción y todos los
 * registros derivados que se crearon en la misma operación atómica.
 */
export interface CreateTransactionResult {
  transaction:  Transaction
  asset?:       Asset
  credit?:      Credit
  loan?:        Loan
  receivable?:  AccountReceivable
  payable?:     AccountPayable
  /** Cuotas generadas si se solicitó generate_schedule = true */
  installments_generated?: number
}

// ─── FILTROS PARA LISTADOS ────────────────────────────────────────────────────

export interface TransactionFilters {
  type?:              TransactionType | TransactionType[]
  account_id?:        string
  category_id?:       string
  currency?:          CurrencyCode
  date_from?:         string   // 'YYYY-MM-DD'
  date_to?:           string
  affects_reports?:   boolean
  search?:            string   // búsqueda en description
  sort_by?:           'transaction_date' | 'amount' | 'created_at'
  sort_dir?:          'asc' | 'desc'
  page?:              number   // default 1
  per_page?:          number   // default 20, max 100
}

export interface PaginatedTransactions {
  data:       TransactionWithRelations[]
  total:      number
  page:       number
  per_page:   number
  has_more:   boolean
}

// ─── PAYLOAD PARA LA FUNCIÓN ATÓMICA DE POSTGRES ─────────────────────────────

/**
 * Shape del JSON que se envía a fn_create_transaction_atomic().
 * Tipado interno — no se expone fuera del servicio.
 */
export interface AtomicTransactionPayload {
  p_user_id:                  string
  p_source_account_id:        string
  p_destination_account_id:   string | null
  p_category_id:              string | null
  p_type:                     TransactionType
  p_amount:                   number
  p_currency:                 CurrencyCode
  p_exchange_rate:            number
  p_description:              string
  p_transaction_date:         string
  p_notes:                    string | null
  p_is_recurring:             boolean
  // Módulos derivados (null si no aplica)
  p_asset:                    Omit<CreateAssetModuleInput, 'current_value' | 'purchase_date'> & {
    current_value: number
    purchase_date: string
  } | null
  p_credit:                   CreateCreditModuleInput | null
  p_loan:                     (Omit<CreateLoanModuleInput, 'start_date'> & {
    start_date: string
    generate_schedule: boolean
  }) | null
  p_receivable:               CreateReceivableModuleInput | null
  p_payable:                  CreatePayableModuleInput | null
}

/**
 * Shape del resultado que devuelve fn_create_transaction_atomic().
 */
export interface AtomicTransactionResult {
  transaction_id:         string
  asset_id:               string | null
  credit_id:              string | null
  loan_id:                string | null
  receivable_id:          string | null
  payable_id:             string | null
  installments_generated: number
}
