import type { createClient } from '@/lib/supabase.server'
import { PromiseTimeoutError, withAbortableTimeout } from '@/lib/server/promise-timeout'
import { measureServerOperation } from '@/lib/server/observability'

const SERVER_QUERY_TIMEOUT_MS = 2_500
const SLOW_QUERY_LOG_THRESHOLD_MS = 450

type BadgeQueryName = 'overdue_installments' | 'receivables' | 'payables'
type BadgeQueryOutcome = 'verified' | 'supabase_error' | 'unverified_count' | 'timeout' | 'cancelled' | 'request_error'

export interface BadgeQueryObservation {
  query: BadgeQueryName
  durationMs: number
  outcome: BadgeQueryOutcome
}

interface NavBadgeReadOptions {
  timeoutMs?: number
  onQueryObservation?: (observation: BadgeQueryObservation) => void
}

interface CountResult {
  count: number | null
  error: { message: string } | null
}

interface AbortableCountQuery extends PromiseLike<CountResult> {
  abortSignal(signal: AbortSignal): PromiseLike<CountResult>
}

class NavBadgeQueryError extends Error {
  constructor(query: BadgeQueryName) {
    super(`Could not verify ${query} navigation count`)
    this.name = 'NavBadgeQueryError'
  }
}

function reportQueryObservation(
  observation: BadgeQueryObservation,
  observer?: NavBadgeReadOptions['onQueryObservation'],
) {
  if (observer) {
    observer(observation)
    return
  }

  if (observation.outcome === 'verified' && observation.durationMs < SLOW_QUERY_LOG_THRESHOLD_MS) return

  const message = `[perf] dashboard.nav-badges.query=${observation.query} duration_ms=${observation.durationMs} outcome=${observation.outcome}`
  if (observation.outcome === 'verified') console.info(message)
  else console.warn(message)
}

export async function getNavBadgesFromClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  options: NavBadgeReadOptions = {},
): Promise<Partial<Record<string, number>>> {
  const today = new Date().toISOString().split('T')[0]
  const timeoutMs = options.timeoutMs ?? SERVER_QUERY_TIMEOUT_MS
  const activeControllers = new Set<AbortController>()

  const readCount = async (
    queryName: BadgeQueryName,
    buildQuery: () => AbortableCountQuery,
  ): Promise<number> => {
    const controller = new AbortController()
    activeControllers.add(controller)
    const startedAt = Date.now()
    let outcome: BadgeQueryOutcome = 'request_error'

    try {
      const result = await withAbortableTimeout(
        signal => buildQuery().abortSignal(signal),
        timeoutMs,
        controller,
      )

      if (result.error) {
        outcome = 'supabase_error'
        throw new NavBadgeQueryError(queryName)
      }
      if (result.count === null) {
        outcome = 'unverified_count'
        throw new NavBadgeQueryError(queryName)
      }

      outcome = 'verified'
      reportQueryObservation({
        query: queryName,
        durationMs: Date.now() - startedAt,
        outcome,
      }, options.onQueryObservation)
      return result.count
    } catch (error) {
      if (error instanceof PromiseTimeoutError) outcome = 'timeout'
      else if (controller.signal.aborted && outcome === 'request_error') outcome = 'cancelled'

      reportQueryObservation({
        query: queryName,
        durationMs: Date.now() - startedAt,
        outcome,
      }, options.onQueryObservation)

      if (error instanceof NavBadgeQueryError) throw error
      throw new NavBadgeQueryError(queryName)
    } finally {
      activeControllers.delete(controller)
    }
  }

  try {
    const [overdueInstallments, urgentReceivables, urgentPayables] = await Promise.all([
      readCount('overdue_installments', () =>
        supabase
          .from('installments')
          .select('id, loan:loans!inner(user_id)', { count: 'exact', head: true })
          .eq('loan.user_id', userId)
          .eq('status', 'OVERDUE'),
      ),
      readCount('receivables', () =>
        supabase
          .from('accounts_receivable')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'PENDING')
          .lt('due_date', today),
      ),
      readCount('payables', () =>
        supabase
          .from('accounts_payable')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'PENDING')
          .lt('due_date', today),
      ),
    ])

    return {
      credits: overdueInstallments > 0 ? overdueInstallments : undefined,
      receivables: urgentReceivables > 0 ? urgentReceivables : undefined,
      payables: urgentPayables > 0 ? urgentPayables : undefined,
      alerts: overdueInstallments + urgentReceivables + urgentPayables > 0
        ? overdueInstallments + urgentReceivables + urgentPayables
        : undefined,
    }
  } catch (error) {
    // A failed badge invalidates this response as a whole. Stop sibling reads
    // immediately so their database work does not continue after the response.
    for (const controller of activeControllers) controller.abort()
    throw error
  }
}

export async function getNavBadgesForUser(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Partial<Record<string, number>>> {
  return measureServerOperation(
    'dashboard.nav-badges',
    async () => getNavBadgesFromClient(supabase, userId),
    { warnAtMs: SLOW_QUERY_LOG_THRESHOLD_MS },
  )
}
