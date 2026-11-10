export type CreditBankFilterSource = {
  bank_entity?: {
    id: string
    name?: string | null
    short_name?: string | null
  } | null
}

export type CreditBankFilterOption = {
  id: string
  name: string
}

/**
 * The credit list already selects each row's bank entity. Build filter options
 * from that user-scoped relation instead of making a second list request.
 */
export function getCreditBankFilterOptions<T extends CreditBankFilterSource>(
  credits: readonly T[],
): CreditBankFilterOption[] {
  const options = new Map<string, string>()

  for (const credit of credits) {
    const bank = credit.bank_entity
    if (!bank?.id) continue

    const name = bank.name?.trim() || bank.short_name?.trim() || 'Entidad sin nombre'
    if (!options.has(bank.id)) options.set(bank.id, name)
  }

  return [...options.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es'))
}
