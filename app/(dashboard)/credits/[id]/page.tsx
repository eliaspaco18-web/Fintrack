// app/(dashboard)/credits/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient }       from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import { CreditDetail }       from '@/components/detail/ModuleDetails'
import { getLoanScheduleIntegrity } from '@/modules/credits/loan-schedule-integrity'
import type { CreditDetailLoanEvidence } from '@/modules/credits/credit-detail-presentation'

const SERVER_QUERY_TIMEOUT_MS = 4_000

export default async function CreditDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [creditResult, loanResult, installmentsResult] = await Promise.allSettled([
    withTimeout(
      supabase.from('credits').select('*').eq('id', params.id).eq('user_id', user.id).single(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
    withTimeout(
      supabase.from('loans')
        .select('id,total_installments,currency,principal_amount')
        .eq('credit_id', params.id)
        .eq('user_id', user.id)
        .maybeSingle(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
    withTimeout(
      supabase.from('installments')
        .select('*, loan:loans!inner(credit_id,user_id)')
        .eq('loan.credit_id', params.id)
        .eq('loan.user_id', user.id)
        .order('installment_number'),
      SERVER_QUERY_TIMEOUT_MS,
    ),
  ])

  const credit =
    creditResult.status === 'fulfilled' && !creditResult.value.error
      ? creditResult.value.data
      : null
  const installments =
    installmentsResult.status === 'fulfilled' && !installmentsResult.value.error
      ? (installmentsResult.value.data ?? [])
      : []
  const loan =
    loanResult.status === 'fulfilled' && !loanResult.value.error
      ? loanResult.value.data
      : null

  if (!credit) notFound()

  const loanVerificationFailed = (
    loanResult.status === 'rejected'
    || (loanResult.status === 'fulfilled' && Boolean(loanResult.value.error))
  )
  const scheduleIntegrity = getLoanScheduleIntegrity({
    requiresSchedule: credit.credit_type !== 'CREDIT_CARD' && (loanVerificationFailed || Boolean(loan)),
    expectedInstallments: loan?.total_installments ?? null,
    installments,
    verificationFailed: (
      loanVerificationFailed
      || installmentsResult.status === 'rejected'
      || (installmentsResult.status === 'fulfilled' && Boolean(installmentsResult.value.error))
    ),
  })
  const loanEvidence: CreditDetailLoanEvidence = loanVerificationFailed
    ? { status: 'UNAVAILABLE' }
    : loan
      ? {
          status: 'VERIFIED',
          currency: loan.currency,
          principalAmount: loan.principal_amount,
        }
      : { status: 'NOT_APPLICABLE' }

  const txId = credit.transaction_id
  const transaction = txId
    ? await withTimeout(
        supabase.from('transactions').select('id,description').eq('id', txId).single(),
        SERVER_QUERY_TIMEOUT_MS,
      ).then(result => (!result.error ? result.data : null)).catch(() => null)
    : null

  return (
    <CreditDetail
      credit={credit}
      installments={installments ?? []}
      scheduleIntegrity={scheduleIntegrity}
      loanEvidence={loanEvidence}
      transaction={transaction}
    />
  )
}
