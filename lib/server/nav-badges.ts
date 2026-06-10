import { createClient } from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import { measureServerOperation } from '@/lib/server/observability'

const SERVER_QUERY_TIMEOUT_MS = 2_500

export async function getNavBadgesForUser(userId: string): Promise<Partial<Record<string, number>>> {
  return measureServerOperation(
    'dashboard.nav-badges',
    async () => {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]

      const [
        overdueInstallmentsResult,
        urgentReceivablesResult,
        urgentPayablesResult,
      ] = await Promise.allSettled([
        withTimeout(
          supabase
            .from('installments')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
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

      const overdueInstallments =
        overdueInstallmentsResult.status === 'fulfilled' && !overdueInstallmentsResult.value.error
          ? (overdueInstallmentsResult.value.count ?? 0)
          : 0

      const urgentReceivables =
        urgentReceivablesResult.status === 'fulfilled' && !urgentReceivablesResult.value.error
          ? (urgentReceivablesResult.value.count ?? 0)
          : 0

      const urgentPayables =
        urgentPayablesResult.status === 'fulfilled' && !urgentPayablesResult.value.error
          ? (urgentPayablesResult.value.count ?? 0)
          : 0

      return {
        credits: overdueInstallments > 0 ? overdueInstallments : undefined,
        receivables: urgentReceivables > 0 ? urgentReceivables : undefined,
        payables: urgentPayables > 0 ? urgentPayables : undefined,
        alerts: overdueInstallments + urgentReceivables + urgentPayables > 0
          ? overdueInstallments + urgentReceivables + urgentPayables
          : undefined,
      }
    },
    { warnAtMs: 450, meta: { user_id: userId } },
  )
}
