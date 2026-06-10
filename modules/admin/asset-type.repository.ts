import type { AssetTypeRow as AssetType, TablesInsert, TablesUpdate } from '@/types/database.types'
import { BaseRepository, type DbClient }               from '@/modules/shared/repository.base'
import { type Result, Errors, ok }                     from '@/modules/shared/result.types'

function normalizeAssetTypeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function preferAssetTypeCandidate(current: AssetType, candidate: AssetType): AssetType {
  const currentOwned = !current.is_system && current.user_id !== null
  const candidateOwned = !candidate.is_system && candidate.user_id !== null

  if (currentOwned !== candidateOwned) return candidateOwned ? candidate : current
  if (current.is_active !== candidate.is_active) return candidate.is_active ? candidate : current

  return current
}

function dedupeAssetTypes(items: AssetType[]): AssetType[] {
  const grouped = new Map<string, AssetType>()

  for (const item of items) {
    const key = normalizeAssetTypeName(item.name)
    const existing = grouped.get(key)
    grouped.set(key, existing ? preferAssetTypeCandidate(existing, item) : item)
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.is_system !== b.is_system) return a.is_system ? 1 : -1
    return a.name.localeCompare(b.name, 'es')
  })
}

export class AssetTypeRepository extends BaseRepository {
  constructor(db: DbClient) { super(db) }

  async findAllByUser(userId: string): Promise<Result<AssetType[]>> {
    const result = await this.queryList(async () =>
      await this.db
        .from('asset_types')
        .select('*')
        .or(`user_id.eq.${userId},is_system.eq.true`)
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })
    )

    if (!result.ok) return result
    return ok(dedupeAssetTypes(result.data))
  }

  async findByIdAccessible(id: string): Promise<Result<AssetType>> {
    return this.query(async () =>
      await this.db
        .from('asset_types')
        .select('*')
        .eq('id', id)
        .single()
    )
  }

  async create(data: TablesInsert<'asset_types'>): Promise<Result<AssetType>> {
    return this.query(async () =>
      await this.db.from('asset_types').insert(data).select().single()
    )
  }

  async updateOwned(
    id: string,
    userId: string,
    data: TablesUpdate<'asset_types'>
  ): Promise<Result<AssetType>> {
    return this.query(async () =>
      await this.db
        .from('asset_types')
        .update(data)
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_system', false)
        .select()
        .single()
    )
  }

  async deleteOwned(id: string, userId: string): Promise<Result<true>> {
    try {
      const { error } = await this.db
        .from('asset_types')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_system', false)

      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (caught) {
      return Errors.database(caught instanceof Error ? caught.message : 'Error desconocido')
    }
  }
}
