import type { AccountType } from '@/types/database.types'

export type AccountIdentityViolation = {
  field: 'currency' | 'type'
  message: string
  detail: string
}

type ExistingAccountIdentity = {
  currency: string
  type: AccountType
}

type RequestedAccountIdentity = {
  currency?: string
  type?: AccountType
}

const CURRENCY_CHANGE_VIOLATION: AccountIdentityViolation = {
  field: 'currency',
  message: 'La moneda de una cuenta existente no se puede cambiar.',
  detail: 'Crea una cuenta nueva para usar otra moneda y conservar la interpretación de los saldos registrados.',
}

const TECHNICAL_ACCOUNT_TRANSITION_VIOLATION: AccountIdentityViolation = {
  field: 'type',
  message: 'No puedes convertir una cuenta operativa en tarjeta de crédito ni una tarjeta de crédito en cuenta operativa.',
  detail: 'Crea una cuenta nueva para conservar la interpretación de los saldos registrados.',
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase()
}

export function crossesTechnicalAccountBoundary(
  existingType: AccountType,
  requestedType: AccountType,
): boolean {
  return (existingType === 'CREDIT_CARD') !== (requestedType === 'CREDIT_CARD')
}

export function getAccountIdentityViolation(
  existing: ExistingAccountIdentity,
  requested: RequestedAccountIdentity,
): AccountIdentityViolation | null {
  if (
    requested.currency !== undefined
    && normalizeCurrency(requested.currency) !== normalizeCurrency(existing.currency)
  ) {
    return CURRENCY_CHANGE_VIOLATION
  }

  const requestedType = requested.type ?? existing.type
  if (crossesTechnicalAccountBoundary(existing.type, requestedType)) {
    return TECHNICAL_ACCOUNT_TRANSITION_VIOLATION
  }

  return null
}
