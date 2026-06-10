import type {
  AssetTypeRow,
  Tables,
} from '@/types/database.types'

type BankEntityRow = Tables<'bank_entities'>

export function normalizeCatalogText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

export function normalizeCatalogCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toLocaleUpperCase('es')
}

export function normalizeCountryCode(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleUpperCase('es')
}

function preferAssetTypeCandidate(current: AssetTypeRow, candidate: AssetTypeRow): AssetTypeRow {
  const currentOwned = !current.is_system && current.user_id !== null
  const candidateOwned = !candidate.is_system && candidate.user_id !== null

  if (currentOwned !== candidateOwned) return candidateOwned ? candidate : current
  if (current.is_active !== candidate.is_active) return candidate.is_active ? candidate : current

  return current
}

export function dedupeAssetTypes(items: AssetTypeRow[]): AssetTypeRow[] {
  const grouped = new Map<string, AssetTypeRow>()

  for (const item of items) {
    const key = normalizeCatalogText(item.name)
    const existing = grouped.get(key)
    grouped.set(key, existing ? preferAssetTypeCandidate(existing, item) : item)
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.is_system !== b.is_system) return a.is_system ? 1 : -1
    return a.name.localeCompare(b.name, 'es')
  })
}

type BankEntityLike = Omit<Pick<BankEntityRow, 'name' | 'short_name' | 'code' | 'country' | 'is_active'>, never> & {
  created_at?: string | null
  updated_at?: string | null
  user_id?: string | null
}

export function bankEntityConflicts(left: BankEntityLike, right: BankEntityLike): boolean {
  const sameCountry = normalizeCountryCode(left.country) === normalizeCountryCode(right.country)
  if (!sameCountry) return false

  const leftName = normalizeCatalogText(left.name)
  const rightName = normalizeCatalogText(right.name)
  if (leftName === rightName) return true

  const leftCode = left.code ? normalizeCatalogCode(left.code) : ''
  const rightCode = right.code ? normalizeCatalogCode(right.code) : ''
  if (leftCode && rightCode && leftCode === rightCode) return true

  const leftShortName = left.short_name ? normalizeCatalogText(left.short_name) : ''
  const rightShortName = right.short_name ? normalizeCatalogText(right.short_name) : ''
  if (leftShortName && rightShortName && leftShortName === rightShortName) return true

  return false
}

function preferBankEntityCandidate(current: BankEntityLike, candidate: BankEntityLike): BankEntityLike {
  const currentOwned = current.user_id !== null
  const candidateOwned = candidate.user_id !== null

  if (currentOwned !== candidateOwned) return candidateOwned ? candidate : current
  if (current.is_active !== candidate.is_active) return candidate.is_active ? candidate : current

  const currentUpdated = current.updated_at ?? current.created_at ?? ''
  const candidateUpdated = candidate.updated_at ?? candidate.created_at ?? ''
  if (currentUpdated !== candidateUpdated) return candidateUpdated > currentUpdated ? candidate : current

  return current
}

export function dedupeBankEntities<T extends BankEntityLike>(items: T[]): T[] {
  const deduped: T[] = []

  for (const item of items) {
    const existingIndex = deduped.findIndex(existing => bankEntityConflicts(existing, item))
    if (existingIndex === -1) {
      deduped.push(item)
      continue
    }

    const existing = deduped[existingIndex]
    if (!existing) {
      deduped.push(item)
      continue
    }

    const preferred = preferBankEntityCandidate(existing, item) as T
    deduped[existingIndex] = preferred
  }

  return deduped.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
