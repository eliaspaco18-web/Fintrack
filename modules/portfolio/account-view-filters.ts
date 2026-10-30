export type PortfolioFilterAccount = Readonly<{
  name: string
  type: string
  currency: string
  is_active: boolean
  bank_entity_id: string | null
  institution: string | null
  bank_entity?: Readonly<{ name: string | null; short_name: string | null }> | null
}>

export type PortfolioAccountFilters = Readonly<{
  query: string
  currency: string
  type: string
  status: 'all' | 'active' | 'inactive'
  bank: string
  technical: boolean
}>

export function filterPortfolioAccounts<T extends PortfolioFilterAccount>(
  accounts: readonly T[],
  filters: PortfolioAccountFilters,
  typeLabels: Readonly<Record<string, string>>,
): T[] {
  const query = filters.query.trim().toLowerCase()

  return accounts.filter(account => {
    const isTechnical = account.type === 'CREDIT_CARD'
    if (filters.technical !== isTechnical) return false
    if (filters.currency !== 'all' && account.currency !== filters.currency) return false
    if (filters.type !== 'all' && account.type !== filters.type) return false
    if (filters.status === 'active' && !account.is_active) return false
    if (filters.status === 'inactive' && account.is_active) return false

    if (filters.bank === 'none' && account.bank_entity_id) return false
    if (filters.bank !== 'all' && filters.bank !== 'none' && account.bank_entity_id !== filters.bank) return false

    if (!query) return true

    const institution = account.bank_entity?.name?.trim()
      || account.bank_entity?.short_name?.trim()
      || account.institution?.trim()
      || (account.bank_entity_id ? 'Entidad no disponible' : 'Sin banco')

    return (
      account.name.toLowerCase().includes(query)
      || institution.toLowerCase().includes(query)
      || (typeLabels[account.type] ?? account.type).toLowerCase().includes(query)
      || account.currency.toLowerCase().includes(query)
    )
  })
}
