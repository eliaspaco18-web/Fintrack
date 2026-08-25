import type { Credit } from '@/types/database.types'

export type CreditNativeCurrency = 'PEN' | 'USD'

export type CreditDetailLoanEvidence =
  | Readonly<{ status: 'NOT_APPLICABLE' }>
  | Readonly<{
      status: 'VERIFIED'
      currency: string
      principalAmount: number
    }>
  | Readonly<{ status: 'UNAVAILABLE' }>

export type CreditDetailProduct = 'CARD' | 'LOAN' | 'LINE' | 'UNAVAILABLE'

export type CreditDetailAvailability =
  | Readonly<{
      status: 'AVAILABLE'
      amount: number
      limit: number
      used: number
      utilizationPct: number
    }>
  | Readonly<{
      status: 'NOT_APPLICABLE' | 'UNAVAILABLE'
      amount: null
      limit: null
      used: null
      utilizationPct: null
    }>

export type CreditDetailPrimaryAmount = Readonly<{
  status: 'AVAILABLE' | 'UNAVAILABLE'
  amount: number | null
  label: 'capital original' | 'disponible' | 'monto disponible'
}>

export type CreditDetailPresentation = Readonly<{
  product: CreditDetailProduct
  productLabel: string
  currency: CreditNativeCurrency | null
  currencyLabel: string
  availability: CreditDetailAvailability
  primaryAmount: CreditDetailPrimaryAmount
  availabilityMessage: string | null
}>

export const CREDIT_AVAILABILITY_NOT_APPLICABLE_MESSAGE =
  'El monto disponible no aplica a este préstamo. Consulta el cronograma para revisar sus obligaciones.'

export const CREDIT_AVAILABILITY_UNAVAILABLE_MESSAGE =
  'No se pudo verificar el monto disponible con los datos actuales.'

export const CREDIT_CURRENCY_UNAVAILABLE_MESSAGE =
  'No se pudo verificar la moneda de este crédito.'

type CreditDetailSource = Pick<
  Credit,
  | 'credit_type'
  | 'currency'
  | 'credit_limit'
  | 'credit_limit_pen'
  | 'credit_limit_usd'
  | 'used_amount'
  | 'used_amount_pen'
  | 'used_amount_usd'
>

function asNativeCurrency(value: string): CreditNativeCurrency | null {
  if (value === 'PEN' || value === 'USD') return value
  return null
}

function asNonNegativeMoney(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function resolveNativeAmount(params: {
  currency: CreditNativeCurrency
  primaryCurrency: string
  primaryAmount: unknown
  penAmount: unknown
  usdAmount: unknown
}): number | null {
  const dedicatedAmount = asNonNegativeMoney(
    params.currency === 'PEN' ? params.penAmount : params.usdAmount,
  )
  const primaryAmount = params.primaryCurrency === params.currency
    ? asNonNegativeMoney(params.primaryAmount)
    : null

  // Existing credit records may predate the dual-currency columns. A positive
  // dedicated value is authoritative; otherwise the matching native value is
  // the established compatibility fallback used by the Credits register.
  if (dedicatedAmount !== null && dedicatedAmount > 0) return dedicatedAmount
  return primaryAmount ?? dedicatedAmount
}

function unavailableAvailability(
  status: 'NOT_APPLICABLE' | 'UNAVAILABLE',
): CreditDetailAvailability {
  return {
    status,
    amount: null,
    limit: null,
    used: null,
    utilizationPct: null,
  }
}

export function getCreditDetailPresentation(
  credit: CreditDetailSource,
  loanEvidence: CreditDetailLoanEvidence,
): CreditDetailPresentation {
  const creditCurrency = asNativeCurrency(credit.currency)
  const product: CreditDetailProduct = credit.credit_type === 'CREDIT_CARD'
    ? 'CARD'
    : loanEvidence.status === 'VERIFIED'
      ? 'LOAN'
      : loanEvidence.status === 'NOT_APPLICABLE'
        ? 'LINE'
        : 'UNAVAILABLE'
  const productLabel = {
    CARD: 'Tarjeta de crédito',
    LOAN: 'Préstamo bancario',
    LINE: 'Línea de crédito',
    UNAVAILABLE: 'Tipo no verificable',
  }[product]

  const loanCurrency = loanEvidence.status === 'VERIFIED'
    ? asNativeCurrency(loanEvidence.currency)
    : null
  const currency = product === 'LOAN'
    ? (creditCurrency && loanCurrency === creditCurrency ? creditCurrency : null)
    : creditCurrency
  const currencyLabel = currency ?? 'No verificable'

  if (product === 'LOAN') {
    const principalAmount = loanEvidence.status === 'VERIFIED'
      ? asNonNegativeMoney(loanEvidence.principalAmount)
      : null
    const primaryAmount = currency && principalAmount !== null && principalAmount > 0
      ? { status: 'AVAILABLE' as const, amount: principalAmount, label: 'capital original' as const }
      : { status: 'UNAVAILABLE' as const, amount: null, label: 'capital original' as const }

    return {
      product,
      productLabel,
      currency,
      currencyLabel,
      availability: unavailableAvailability('NOT_APPLICABLE'),
      primaryAmount,
      availabilityMessage: currency
        ? CREDIT_AVAILABILITY_NOT_APPLICABLE_MESSAGE
        : CREDIT_CURRENCY_UNAVAILABLE_MESSAGE,
    }
  }

  if (product === 'UNAVAILABLE' || !currency) {
    return {
      product,
      productLabel,
      currency,
      currencyLabel,
      availability: unavailableAvailability('UNAVAILABLE'),
      primaryAmount: {
        status: 'UNAVAILABLE',
        amount: null,
        label: 'monto disponible',
      },
      availabilityMessage: !currency
        ? CREDIT_CURRENCY_UNAVAILABLE_MESSAGE
        : CREDIT_AVAILABILITY_UNAVAILABLE_MESSAGE,
    }
  }

  const limit = resolveNativeAmount({
    currency,
    primaryCurrency: credit.currency,
    primaryAmount: credit.credit_limit,
    penAmount: credit.credit_limit_pen,
    usdAmount: credit.credit_limit_usd,
  })
  const used = resolveNativeAmount({
    currency,
    primaryCurrency: credit.currency,
    primaryAmount: credit.used_amount,
    penAmount: credit.used_amount_pen,
    usdAmount: credit.used_amount_usd,
  })

  if (limit === null || limit <= 0 || used === null) {
    return {
      product,
      productLabel,
      currency,
      currencyLabel,
      availability: unavailableAvailability('UNAVAILABLE'),
      primaryAmount: {
        status: 'UNAVAILABLE',
        amount: null,
        label: 'monto disponible',
      },
      availabilityMessage: CREDIT_AVAILABILITY_UNAVAILABLE_MESSAGE,
    }
  }

  const amount = Math.max(limit - used, 0)
  const availability: CreditDetailAvailability = {
    status: 'AVAILABLE',
    amount,
    limit,
    used,
    utilizationPct: Math.min((used / limit) * 100, 100),
  }

  return {
    product,
    productLabel,
    currency,
    currencyLabel,
    availability,
    primaryAmount: {
      status: 'AVAILABLE',
      amount,
      label: 'disponible',
    },
    availabilityMessage: null,
  }
}
