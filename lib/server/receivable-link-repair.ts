import { createClient } from '@/lib/supabase.server'

type SupabaseServerClient = ReturnType<typeof createClient>

function normalizeName(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase('es')
}

export async function repairLegacyReceivableLinks(
  supabase: SupabaseServerClient,
  userId: string,
  debtors: Array<{ id: string; name: string }>,
): Promise<void> {
  if (debtors.length === 0) return

  const debtorIdByName = new Map(
    debtors.map((debtor) => [normalizeName(debtor.name), debtor.id]),
  )
  const debtorNameById = new Map(
    debtors.map((debtor) => [debtor.id, debtor.name]),
  )

  const debtorIds = debtors.map((debtor) => debtor.id)

  const { data: existingReceivables } = await supabase
    .from('accounts_receivable')
    .select('transaction_id')
    .eq('user_id', userId)

  const existingTransactionIds = new Set(
    (existingReceivables ?? [])
      .map((row) => row.transaction_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )

  const { data: debtorTransactions } = await supabase
    .from('transactions')
    .select('id, debtor_id, description, amount, currency, transaction_date, notes, type')
    .eq('user_id', userId)
    .eq('type', 'EXPENSE')
    .in('debtor_id', debtorIds)

  const missingReceivables = (debtorTransactions ?? [])
    .filter((row) => row.debtor_id && !existingTransactionIds.has(row.id))
    .map((row) => ({
      user_id: userId,
      transaction_id: row.id,
      debtor_id: row.debtor_id,
      debtor_name: debtorNameById.get(row.debtor_id!) ?? 'Deudor',
      amount: row.amount,
      currency: row.currency,
      issue_date: row.transaction_date,
      concept: row.description,
      notes: row.notes,
      status: 'PENDING' as const,
    }))

  if (missingReceivables.length > 0) {
    await supabase
      .from('accounts_receivable')
      .insert(missingReceivables)
  }

  const { data: orphanReceivables, error } = await supabase
    .from('accounts_receivable')
    .select('id, transaction_id, debtor_name')
    .eq('user_id', userId)
    .is('debtor_id', null)

  if (error || !orphanReceivables || orphanReceivables.length === 0) return

  const receivableIdsByDebtor = new Map<string, string[]>()
  const transactionIdsByDebtor = new Map<string, string[]>()

  for (const row of orphanReceivables) {
    const debtorId = debtorIdByName.get(normalizeName(row.debtor_name))
    if (!debtorId) continue

    const receivableIds = receivableIdsByDebtor.get(debtorId) ?? []
    receivableIds.push(row.id)
    receivableIdsByDebtor.set(debtorId, receivableIds)

    if (row.transaction_id) {
      const transactionIds = transactionIdsByDebtor.get(debtorId) ?? []
      transactionIds.push(row.transaction_id)
      transactionIdsByDebtor.set(debtorId, transactionIds)
    }
  }

  await Promise.all([
    ...Array.from(receivableIdsByDebtor.entries()).map(([debtorId, receivableIds]) =>
      supabase
        .from('accounts_receivable')
        .update({ debtor_id: debtorId })
        .eq('user_id', userId)
        .in('id', receivableIds)
    ),
    ...Array.from(transactionIdsByDebtor.entries()).map(([debtorId, transactionIds]) =>
      supabase
        .from('transactions')
        .update({ debtor_id: debtorId })
        .eq('user_id', userId)
        .in('id', transactionIds)
    ),
  ])
}
