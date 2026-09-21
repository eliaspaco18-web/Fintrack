// =============================================================================
// Credit-card transfer policy
//
// A transfer touching a credit-card account is never a generic transfer: it is
// either a card payment or a cash disposition. Keeping this policy pure lets
// the client prevent invalid choices and lets the service enforce the same rule.
// =============================================================================

export type CreditCardTransferKind = 'PAYMENT' | 'DISPOSITION'

export type CreditCardTransferViolation =
  | 'CARD_TO_CARD'
  | 'INVALID_COUNTERPARTY'

export interface CreditCardTransferPolicy {
  kind: CreditCardTransferKind | null
  violation: CreditCardTransferViolation | null
}

const LIQUID_COUNTERPARTY_TYPES = new Set([
  'CHECKING',
  'SAVINGS',
  'CASH',
])

/**
 * Classifies a transfer involving a credit card.
 *
 * Transfers between non-card accounts remain ordinary transfers. A card can
 * only move against a liquid own account: debit -> card is a payment and
 * card -> debit is a disposition. Investment accounts cannot act as a
 * shortcut for either operation.
 */
export function getCreditCardTransferPolicy(
  sourceAccountType: string | null | undefined,
  destinationAccountType: string | null | undefined,
): CreditCardTransferPolicy {
  const sourceIsCreditCard = sourceAccountType === 'CREDIT_CARD'
  const destinationIsCreditCard = destinationAccountType === 'CREDIT_CARD'

  if (!sourceIsCreditCard && !destinationIsCreditCard) {
    return { kind: null, violation: null }
  }

  if (sourceIsCreditCard && destinationIsCreditCard) {
    return { kind: null, violation: 'CARD_TO_CARD' }
  }

  const counterpartyType = sourceIsCreditCard
    ? destinationAccountType
    : sourceAccountType

  if (!counterpartyType || !LIQUID_COUNTERPARTY_TYPES.has(counterpartyType)) {
    return { kind: null, violation: 'INVALID_COUNTERPARTY' }
  }

  return {
    kind: sourceIsCreditCard ? 'DISPOSITION' : 'PAYMENT',
    violation: null,
  }
}
