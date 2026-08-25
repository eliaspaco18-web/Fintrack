import { z, type RefinementCtx } from 'zod'

export const USD_CREDIT_EXCHANGE_RATE_ERROR =
  'Para créditos en USD ingresa un tipo de cambio USD/PEN válido entre 0.01 y 100.'

const MIN_USD_PEN_EXCHANGE_RATE = 0.01
const MAX_USD_PEN_EXCHANGE_RATE = 100

export const zCreditSubmissionCurrency = z.enum(['PEN', 'USD'])

export const zCreditExchangeRate = z.number({
  required_error: USD_CREDIT_EXCHANGE_RATE_ERROR,
  invalid_type_error: USD_CREDIT_EXCHANGE_RATE_ERROR,
}).refine(
  value => Number.isFinite(value)
    && value >= MIN_USD_PEN_EXCHANGE_RATE
    && value <= MAX_USD_PEN_EXCHANGE_RATE,
  USD_CREDIT_EXCHANGE_RATE_ERROR,
)

export const bankCreditExchangeRateFields = {
  currency: zCreditSubmissionCurrency.default('PEN'),
  exchange_rate: zCreditExchangeRate.optional(),
}

type BankCreditExchangeRateFields = {
  currency: z.infer<typeof zCreditSubmissionCurrency>
  exchange_rate?: number
}

export function addUsdCreditExchangeRateIssue(
  data: BankCreditExchangeRateFields,
  ctx: RefinementCtx,
): void {
  if (data.currency !== 'USD' || data.exchange_rate !== undefined) return

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['exchange_rate'],
    message: USD_CREDIT_EXCHANGE_RATE_ERROR,
  })
}

export const zBankCreditExchangeRateSubmission = z
  .object(bankCreditExchangeRateFields)
  .superRefine(addUsdCreditExchangeRateIssue)

type CreditExchangeRateResolution =
  | { ok: true; exchangeRate: number | undefined }
  | { ok: false; message: string }

const STRICT_DECIMAL_INPUT = /^(?:\d+(?:\.\d+)?|\.\d+)$/

export function resolveCreditExchangeRateInput(
  currency: string,
  rawValue: unknown,
): CreditExchangeRateResolution {
  if (currency !== 'USD') {
    return { ok: true, exchangeRate: undefined }
  }

  let value: number

  if (typeof rawValue === 'number') {
    value = rawValue
  } else if (typeof rawValue === 'string') {
    const normalized = rawValue.trim()
    if (!STRICT_DECIMAL_INPUT.test(normalized)) {
      return { ok: false, message: USD_CREDIT_EXCHANGE_RATE_ERROR }
    }
    value = Number(normalized)
  } else {
    return { ok: false, message: USD_CREDIT_EXCHANGE_RATE_ERROR }
  }

  if (
    !Number.isFinite(value)
    || value < MIN_USD_PEN_EXCHANGE_RATE
    || value > MAX_USD_PEN_EXCHANGE_RATE
  ) {
    return { ok: false, message: USD_CREDIT_EXCHANGE_RATE_ERROR }
  }

  return { ok: true, exchangeRate: value }
}
