import { createClient } from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import { measureServerOperation } from '@/lib/server/observability'

const SERVER_QUERY_TIMEOUT_MS = 2_500

export async function getNavBadgesFromClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Partial<Record<string, number>>> {
      const today = new Date().toISOString().split('T')[0]

      const [
        overdueInstallmentsResult,
        urgentReceivablesResult,
        urgentPayablesResult,
      ] = await Promise.all([
        withTimeout(
          supabase
            .from('installments')
            .select('id, loan:loans!inner(user_id)', { count: 'exact', head: true })
            .eq('loan.user_id', userId)
            .eq('status', 'OVERDUE'),
          SERVER_QUERY_TIMEOUT_MS,
        ),
        withTimeout(
          supabase
            .from('accounts_receivable')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'PENDING')
            .lt('due_date', today),
          SERVER_QUERY_TIMEOUT_MS,
        ),
        withTimeout(
          supabase
            .from('accounts_payable')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'PENDING')
            .lt('due_date', today),
          SERVER_QUERY_TIMEOUT_MS,
        ),
      ])

      const requireCount = (label: string, result: { count: number | null; error: { message: string } | null }) => {
        if (result.error) throw new Error(`Could not load ${label}: ${result.error.message}`)
        if (result.count === null) throw new Error(`Could not verify ${label} count`)
        return result.count
      }
      const overdueInstallments = requireCount('overdue installments', overdueInstallmentsResult)
      const urgentReceivables = requireCount('urgent receivables', urgentReceivablesResult)
      const urgentPayables = requireCount('urgent payables', urgentPayablesResult)

      return {
        credits: overdueInstallments > 0 ? overdueInstallments : undefined,
        receivables: urgentReceivables > 0 ? urgentReceivables : undefined,
        payables: urgentPayables > 0 ? urgentPayables : undefined,
        alerts: overdueInstallments + urgentReceivables + urgentPayables > 0
          ? overdueInstallments + urgentReceivables + urgentPayables
          : undefined,
      }
}

export async function getNavBadgesForUser(userId: string): Promise<Partial<Record<string, number>>> {
  return measureServerOperation(
    'dashboard.nav-badges',
    async () => {
      const supabase = await createClient()
      return getNavBadgesFromClient(supabase, userId)
    },
    { warnAtMs: 450, meta: { user_id: userId } },
  )
}
