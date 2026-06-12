// =============================================================================
// lib/schemas/transaction.schemas.ts
// Zod schemas — validación de entrada en el borde de la aplicación.
// Son la fuente de verdad de los contratos HTTP/Action.
// Los tipos de servicio (transaction.service.types.ts) derivan de estos.
// =============================================================================

import { z } from 'zod'
import { hasAtMostDecimals } from '@/lib/utils/numeric-input'

// ─── PRIMITIVOS COMPARTIDOS ───────────────────────────────────────────────────

const zCurrency = z.enum(['PEN', 'USD'])
const zDate     = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
const zUUID     = z.string().uuid('UUID inválido')
const zAmount   = z
  .number({ invalid_type_error: 'El monto debe ser un número' })
  .positive('El monto debe ser mayor a cero')
  .refine(v => hasAtMostDecimals(v, 2), 'Máximo 2 decimales')
  .refine(v => v <= 100_000_000, 'Monto excede el límite permitido')

// ─── MÓDULOS DERIVADOS ────────────────────────────────────────────────────────

export const zAssetModule = z.object({
  name:              z.string().trim().min(1).max(150),
  asset_type:        z.enum(['REAL_ESTATE', 'VEHICLE', 'EQUIPMENT', 'INVESTMENT', 'OTHER']),
  asset_type_id:     zUUID.optional(),
  purchase_value:    zAmount.optional(),
  current_value:     zAmount.optional(),
  purchase_date:     zDate.optional(),
  depreciation_rate: z.number().min(0).max(1).optional(),
  serial_number:     z.string().max(100).optional(),
  location:          z.string().max(200).optional(),
  notes:             z.string().max(500).optional(),
})

export const zCreditModule = z.object({
  credit_type:   z.enum(['CREDIT_CARD', 'LINE_OF_CREDIT']),
  name:          z.string().trim().min(1).max(100),
  credit_limit:  zAmount,
  interest_rate: z.number().min(0).max(999.9999),
  closing_day:   z.number().int().min(1).max(31).optional(),
  payment_day:   z.number().int().min(1).max(31).optional(),
  notes:         z.string().max(500).optional(),
})

export const zLoanModule = z.object({
  creditor_name:      z.string().trim().min(1).max(150),
  principal_amount:   zAmount.optional(),
  interest_rate:      z.number().min(0).max(999.9999),
  total_installments: z.number().int().min(1).max(600),
  start_date:         zDate.optional(),
  end_date:           zDate,
  notes:              z.string().max(500).optional(),
  generate_schedule:  z.boolean().default(false),
})

export const zReceivableModule = z.object({
  debtor_id:   zUUID.optional(),
  debtor_name: z.string().trim().min(1).max(150),
  due_date:    zDate.optional(),
  concept:     z.string().max(300).optional(),
  notes:       z.string().max(500).optional(),
})

export const zPayableModule = z.object({
  creditor_id:   zUUID.optional(),
  creditor_name: z.string().trim().min(1).max(150),
  due_date:      zDate.optional(),
  concept:       z.string().max(300).optional(),
  notes:         z.string().max(500).optional(),
})

// ─── TRANSACCIÓN BASE ─────────────────────────────────────────────────────────

const zTransactionBase = z.object({
  source_account_id: zUUID,
  amount:            zAmount,
  currency:          zCurrency,
  payment_method:    z.enum(['DEBIT', 'CREDIT']).optional(),
  credit_card_id:    zUUID.optional(),
  credit_operation:  z.enum(['CONSUMPTION', 'PAYMENT']).optional(),
  exchange_rate:     z.number().positive().optional(),
  description:       z.string().trim().max(255).optional(),
  transaction_date:  zDate,
  category_id:       zUUID.optional(),
  notes:             z.string().max(1000).optional(),
  is_recurring:      z.boolean().default(false),
  recurring_name:    z.string().trim().min(1, 'El nombre de la recurrente es obligatorio').max(150).optional(),
})

// ─── SCHEMAS POR TIPO (unión discriminada) ────────────────────────────────────

export const zCreateIncomeSchema = zTransactionBase.extend({
  type:    z.literal('INCOME'),
  payable: zPayableModule.optional(),
  sender:  z.string().max(150).trim().optional(),
})

export const zCreateExpenseSchema = zTransactionBase
  .extend({
    type:       z.literal('EXPENSE'),
    asset:      zAssetModule.optional(),
    credit:     zCreditModule.optional(),
    loan:       zLoanModule.optional(),
    receivable: zReceivableModule.optional(),
    // Fase B — vincular egreso con presupuesto activo
    budget_id: zUUID.optional(),
    // Fase periodos — imputación exacta al periodo presupuestal
    budget_period_id: zUUID.optional(),
    // PRD v3 — campos adicionales
    recipient: z.string().max(150).trim().optional(),
  })

export const zCreateTransferSchema = zTransactionBase.extend({
  type:                    z.literal('TRANSFER'),
  destination_account_id:  zUUID,
})

/** Schema principal — discrimina por `type` */
export const zCreateTransactionSchema = z
  .discriminatedUnion('type', [
    zCreateIncomeSchema,
    zCreateExpenseSchema,
    zCreateTransferSchema,
  ])
  .superRefine((d, ctx) => {
    if ((d.type === 'INCOME' || d.type === 'EXPENSE') && !d.category_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category_id'],
        message: 'La categoría es obligatoria',
      })
    }

    if ((d.type === 'INCOME' || d.type === 'EXPENSE') && (!d.description || d.description.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['description'],
        message: 'La descripción es obligatoria',
      })
    }

    if (d.is_recurring && (!d.recurring_name || d.recurring_name.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurring_name'],
        message: 'Debes indicar un nombre para guardar la recurrente',
      })
    }

    if (d.type === 'EXPENSE' && d.asset && d.credit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['asset'],
        message: 'Una transacción no puede generar activo y crédito simultáneamente',
      })
    }

    if (d.type === 'EXPENSE' && d.payment_method === 'CREDIT' && !d.credit_card_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['credit_card_id'],
        message: 'Selecciona una tarjeta de crédito para este egreso',
      })
    }

    if (d.type === 'EXPENSE' && d.credit_operation === 'PAYMENT' && !d.credit_card_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['credit_card_id'],
        message: 'Selecciona la tarjeta para registrar su pago',
      })
    }

    if (
      d.type === 'TRANSFER' &&
      d.source_account_id === d.destination_account_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destination_account_id'],
        message: 'La cuenta origen y destino no pueden ser la misma',
      })
    }
  })

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export const zUpdateTransactionSchema = z.object({
  description:      z.string().trim().min(1).max(255).optional(),
  category_id:      zUUID.nullable().optional(),
  notes:            z.string().max(1000).nullable().optional(),
  is_recurring:     z.boolean().optional(),
  transaction_date: zDate.optional(),
}).refine(
  d => Object.values(d).some(v => v !== undefined),
  { message: 'Debe incluir al menos un campo para actualizar' }
)

// ─── FILTERS (GET /transactions) ─────────────────────────────────────────────

export const zTransactionFiltersSchema = z.object({
  type:           z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  account_id:     zUUID.optional(),
  category_id:    zUUID.optional(),
  currency:       zCurrency.optional(),
  date_from:      zDate.optional(),
  date_to:        zDate.optional(),
  search:         z.string().max(100).optional(),
  sort_by:        z.enum(['transaction_date', 'amount', 'created_at']).optional(),
  sort_dir:       z.enum(['asc', 'desc']).optional(),
  page:           z.coerce.number().int().min(1).default(1),
  per_page:       z.coerce.number().int().min(1).max(100).default(20),
}).refine(
  d => !d.date_from || !d.date_to || d.date_from <= d.date_to,
  { message: 'date_from debe ser anterior o igual a date_to', path: ['date_from'] }
)

// ─── TIPOS INFERIDOS ──────────────────────────────────────────────────────────

export type CreateTransactionRequest = z.infer<typeof zCreateTransactionSchema>
export type UpdateTransactionRequest = z.infer<typeof zUpdateTransactionSchema>
export type TransactionFiltersRequest = z.infer<typeof zTransactionFiltersSchema>
