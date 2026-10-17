export type AccountMonthlyHistoryReason =
  | 'TECHNICAL_ACCOUNT'
  | 'MISSING_OPENING_DATE'
  | 'INVALID_OPENING_BALANCE'
  | 'INVALID_TRANSACTION'
  | 'TRANSACTION_BEFORE_OPENING'
  | 'CURRENCY_MISMATCH'
  | 'UNSUPPORTED_DESTINATION'
  | 'CURRENT_BALANCE_MISMATCH'
  | 'INSUFFICIENT_CLOSED_MONTHS'
  | 'DATASET_TOO_LARGE'

export interface MonthlyHistoryAccount {
  id: string
  type: string
  currency: string
  initial_balance: number | string | null
  initial_balance_date: string | null
  balance: number | string | null
  updated_at?: string
}

export interface MonthlyHistoryTransaction {
  source_account_id: string
  destination_account_id: string | null
  type: string
  amount: number | string
  currency: string
  transaction_date: string
  updated_at?: string
}

export interface MonthlyBalancePoint {
  month: string
  balance: number
}

export type AccountMonthlyHistory =
  | { status: 'available'; points: MonthlyBalancePoint[] }
  | { status: 'unavailable'; reason: AccountMonthlyHistoryReason; points: [] }

type AccountEffect = {
  date: string
  cents: number
}

function unavailable(reason: AccountMonthlyHistoryReason): AccountMonthlyHistory {
  return { status: 'unavailable', reason, points: [] }
}

function amountToCents(value: number | string | null): number | null {
  if (value === null || value === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  const cents = Math.round(amount * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

function parseISODate(value: string | null): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null
  return parsed
}

function monthStart(date: Date, offset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1))
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthEndISO(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)
}

function monthDistance(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12
    + to.getUTCMonth() - from.getUTCMonth()
}

export function calculateAccountMonthlyHistory(
  account: MonthlyHistoryAccount,
  transactions: readonly MonthlyHistoryTransaction[],
  asOfDate: string,
): AccountMonthlyHistory {
  if (account.type === 'CREDIT_CARD') return unavailable('TECHNICAL_ACCOUNT')

  const openingDate = parseISODate(account.initial_balance_date)
  if (!openingDate || !account.initial_balance_date) return unavailable('MISSING_OPENING_DATE')

  const openingCents = amountToCents(account.initial_balance)
  const currentCents = amountToCents(account.balance)
  if (openingCents === null || currentCents === null) {
    return unavailable('INVALID_OPENING_BALANCE')
  }

  const effects: AccountEffect[] = []

  for (const transaction of transactions) {
    const isSource = transaction.source_account_id === account.id
    const isDestination = transaction.destination_account_id === account.id
    if (!isSource && !isDestination) continue
    if (isSource && isDestination) return unavailable('INVALID_TRANSACTION')

    const transactionDate = parseISODate(transaction.transaction_date)
    const amountCents = amountToCents(transaction.amount)
    if (!transactionDate || amountCents === null || amountCents <= 0) {
      return unavailable('INVALID_TRANSACTION')
    }

    if (transaction.transaction_date < account.initial_balance_date) {
      return unavailable('TRANSACTION_BEFORE_OPENING')
    }

    if (isDestination && transaction.type !== 'TRANSFER') {
      return unavailable('UNSUPPORTED_DESTINATION')
    }

    if (transaction.currency.toUpperCase() !== account.currency.toUpperCase()) {
      return unavailable('CURRENCY_MISMATCH')
    }

    if (transaction.type === 'INCOME' && isSource) {
      effects.push({ date: transaction.transaction_date, cents: amountCents })
    } else if (transaction.type === 'EXPENSE' && isSource) {
      effects.push({ date: transaction.transaction_date, cents: -amountCents })
    } else if (transaction.type === 'TRANSFER') {
      effects.push({
        date: transaction.transaction_date,
        cents: isSource ? -amountCents : amountCents,
      })
    } else {
      return unavailable('INVALID_TRANSACTION')
    }
  }

  const expectedCurrentCents = effects.reduce((sum, effect) => sum + effect.cents, openingCents)
  if (!Number.isSafeInteger(expectedCurrentCents) || expectedCurrentCents !== currentCents) {
    return unavailable('CURRENT_BALANCE_MISMATCH')
  }

  const asOf = parseISODate(asOfDate)
  if (!asOf) return unavailable('INVALID_TRANSACTION')

  const latestClosedMonth = monthStart(asOf, -1)
  const openingMonth = monthStart(openingDate)
  if (openingMonth > latestClosedMonth) return unavailable('INSUFFICIENT_CLOSED_MONTHS')

  const firstRequestedMonth = monthStart(latestClosedMonth, -5)
  const firstMonth = openingMonth > firstRequestedMonth ? openingMonth : firstRequestedMonth
  const pointCount = monthDistance(firstMonth, latestClosedMonth) + 1
  if (pointCount < 2) return unavailable('INSUFFICIENT_CLOSED_MONTHS')

  effects.sort((left, right) => left.date.localeCompare(right.date))
  const points: MonthlyBalancePoint[] = []
  let balanceCents = openingCents
  let effectIndex = 0

  for (let index = 0; index < pointCount; index += 1) {
    const month = monthStart(firstMonth, index)
    const endDate = monthEndISO(month)
    while (effectIndex < effects.length) {
      const effect = effects[effectIndex]
      if (!effect || effect.date > endDate) break
      balanceCents += effect.cents
      effectIndex += 1
    }
    if (!Number.isSafeInteger(balanceCents)) return unavailable('INVALID_TRANSACTION')
    points.push({ month: monthKey(month), balance: balanceCents / 100 })
  }

  return { status: 'available', points }
}

export function calculateAccountMonthlyHistories(
  accounts: readonly MonthlyHistoryAccount[],
  transactions: readonly MonthlyHistoryTransaction[],
  asOfDate: string,
): Record<string, AccountMonthlyHistory> {
  const accountsById = new Map(accounts.map(account => [account.id, account]))
  const transactionsByAccount = new Map<string, MonthlyHistoryTransaction[]>()

  for (const transaction of transactions) {
    const relatedIds = new Set([transaction.source_account_id, transaction.destination_account_id])
    for (const accountId of relatedIds) {
      if (!accountId || !accountsById.has(accountId)) continue
      const related = transactionsByAccount.get(accountId) ?? []
      related.push(transaction)
      transactionsByAccount.set(accountId, related)
    }
  }

  return Object.fromEntries(accounts.map(account => [
    account.id,
    calculateAccountMonthlyHistory(
      account,
      transactionsByAccount.get(account.id) ?? [],
      asOfDate,
    ),
  ]))
}

const HISTORY_PAGE_SIZE = 1000
const HISTORY_MAX_TRANSACTIONS = 50_000
export const HISTORY_MAX_ACCOUNTS = 500
const HISTORY_READ_TIMEOUT_MS = 20_000

type HistoryReadResult<T> = {
  data: T | null
  error: { message?: string } | null
  count?: number | null
}

export type MonthlyHistoryReader = {
  getUserId: () => Promise<string | null>
  listAccounts: (userId: string, signal: AbortSignal) => Promise<HistoryReadResult<MonthlyHistoryAccount[]>>
  listTransactionsPage: (
    userId: string,
    snapshotAt: string,
    offset: number,
    limit: number,
    signal: AbortSignal,
  ) => Promise<HistoryReadResult<MonthlyHistoryTransaction[]>>
  hasTransactionsUpdatedAfter: (userId: string, snapshotAt: string, signal: AbortSignal) => Promise<HistoryReadResult<unknown[]>>
  hasAccountsUpdatedAfter: (userId: string, snapshotAt: string, signal: AbortSignal) => Promise<HistoryReadResult<unknown[]>>
}

export type MonthlyHistoryReadResult =
  | { status: 'unauthorized' }
  | { status: 'error' }
  | { status: 'timeout' }
  | { status: 'ok'; histories: Record<string, AccountMonthlyHistory> }

function historiesUnavailableForAll(
  accounts: readonly MonthlyHistoryAccount[],
  reason: 'DATASET_TOO_LARGE' | 'INVALID_TRANSACTION',
): Record<string, AccountMonthlyHistory> {
  return Object.fromEntries(accounts.map(account => [
    account.id,
    account.type === 'CREDIT_CARD'
      ? unavailable('TECHNICAL_ACCOUNT')
      : unavailable(reason),
  ]))
}

function currentDateInLima(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** Reads a consistent, owner-scoped ledger snapshot and fails closed on incomplete data. */
export async function readAccountMonthlyHistories(
  reader: MonthlyHistoryReader,
  options: { now?: () => Date; timeoutMs?: number } = {},
): Promise<MonthlyHistoryReadResult> {
  const now = options.now ?? (() => new Date())
  const timeoutMs = options.timeoutMs ?? HISTORY_READ_TIMEOUT_MS
  const controller = new AbortController()
  let didTimeout = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      didTimeout = true
      controller.abort()
      reject(new Error('MONTHLY_HISTORY_TIMEOUT'))
    }, timeoutMs)
  })

  try {
    const userId = await Promise.race([reader.getUserId(), deadline])
    if (!userId) return { status: 'unauthorized' }

    const snapshotAt = now().toISOString()
    const accountsResult = await Promise.race([
      reader.listAccounts(userId, controller.signal),
      deadline,
    ])
    if (accountsResult.error) return { status: 'error' }

    const accounts = accountsResult.data ?? []
    const historyAccounts = accounts.filter(account => account.type !== 'CREDIT_CARD')
    if (accounts.length > HISTORY_MAX_ACCOUNTS || (accountsResult.count ?? 0) > HISTORY_MAX_ACCOUNTS) {
      return { status: 'ok', histories: historiesUnavailableForAll(historyAccounts, 'DATASET_TOO_LARGE') }
    }
    const transactions: MonthlyHistoryTransaction[] = []
    let expectedCount: number | null = null

    for (let offset = 0; ; offset += HISTORY_PAGE_SIZE) {
      const pageResult = await Promise.race([
        reader.listTransactionsPage(userId, snapshotAt, offset, HISTORY_PAGE_SIZE, controller.signal),
        deadline,
      ])
      if (pageResult.error) return { status: 'error' }
      if (expectedCount === null) expectedCount = pageResult.count ?? 0
      if (pageResult.count !== expectedCount) {
        return { status: 'ok', histories: historiesUnavailableForAll(historyAccounts, 'INVALID_TRANSACTION') }
      }
      if (expectedCount > HISTORY_MAX_TRANSACTIONS) {
        return { status: 'ok', histories: historiesUnavailableForAll(historyAccounts, 'DATASET_TOO_LARGE') }
      }

      const page = pageResult.data ?? []
      transactions.push(...page)
      if (page.length < HISTORY_PAGE_SIZE || transactions.length >= expectedCount) break
    }

    if (transactions.length !== expectedCount) {
      return { status: 'ok', histories: historiesUnavailableForAll(historyAccounts, 'INVALID_TRANSACTION') }
    }

    const [newTransactions, newAccounts] = await Promise.race([
      Promise.all([
        reader.hasTransactionsUpdatedAfter(userId, snapshotAt, controller.signal),
        reader.hasAccountsUpdatedAfter(userId, snapshotAt, controller.signal),
      ]),
      deadline,
    ])
    if (newTransactions.error || newAccounts.error) return { status: 'error' }

    const accountChangedDuringRead = accounts.some(account =>
      account.updated_at && account.updated_at > snapshotAt
    )
    if ((newTransactions.data?.length ?? 0) > 0 || (newAccounts.data?.length ?? 0) > 0 || accountChangedDuringRead) {
      return { status: 'ok', histories: historiesUnavailableForAll(historyAccounts, 'INVALID_TRANSACTION') }
    }

    return {
      status: 'ok',
      histories: calculateAccountMonthlyHistories(historyAccounts, transactions, currentDateInLima(now())),
    }
  } catch {
    return { status: didTimeout ? 'timeout' : 'error' }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
