type LinkedRecordCountResponse = {
  count: number | null
  error: unknown
}

type LinkedRecordCountQuery = () => Promise<LinkedRecordCountResponse>

type VerifiedLinkedRecordCounts = {
  transactions: number
  credits: number
  total: number
}

export type AccountLinkedRecordCheck =
  | { status: 'clear'; counts: VerifiedLinkedRecordCounts }
  | { status: 'linked'; counts: VerifiedLinkedRecordCounts }
  | { status: 'unavailable' }

export const ACCOUNT_LINK_VERIFICATION_UNAVAILABLE_ERROR = {
  code: 'DATABASE_ERROR',
  message: 'No pudimos verificar si esta cuenta tiene registros vinculados.',
  detail: 'La cuenta no fue modificada. Inténtalo nuevamente.',
} as const

function isReliableCount(count: number | null): count is number {
  return count !== null && Number.isSafeInteger(count) && count >= 0
}

export async function checkAccountLinkedRecords(
  countTransactions: LinkedRecordCountQuery,
  countCredits: LinkedRecordCountQuery,
): Promise<AccountLinkedRecordCheck> {
  try {
    const [transactionResult, creditResult] = await Promise.all([
      countTransactions(),
      countCredits(),
    ])

    if (
      transactionResult.error
      || creditResult.error
      || !isReliableCount(transactionResult.count)
      || !isReliableCount(creditResult.count)
    ) {
      return { status: 'unavailable' }
    }

    const counts = {
      transactions: transactionResult.count,
      credits: creditResult.count,
      total: transactionResult.count + creditResult.count,
    }

    return counts.total > 0
      ? { status: 'linked', counts }
      : { status: 'clear', counts }
  } catch {
    return { status: 'unavailable' }
  }
}
