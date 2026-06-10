import { createClient, createServiceClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { CURRENT_RELEASE, normalizeReleaseHighlights, type ReleaseHighlight } from '@/lib/release/current-release'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ReleasePayload {
  id: string
  version: string
  title: string
  summary: string
  highlights: ReleaseHighlight[]
  deployed_at: string
}

async function getLatestRelease() {
  const service = createServiceClient()
  const { data, error } = await service
    .from('app_releases')
    .select('id, version, title, summary, highlights, deployed_at')
    .order('deployed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    id: data.id,
    version: data.version,
    title: data.title,
    summary: data.summary,
    highlights: normalizeReleaseHighlights(data.highlights),
    deployed_at: data.deployed_at,
  } satisfies ReleasePayload
}

async function ensureUserState(releaseId: string, userId: string) {
  const service = createServiceClient()
  const { data, error } = await service
    .from('app_release_user_state')
    .upsert({
      release_id: releaseId,
      user_id: userId,
    }, {
      onConflict: 'release_id,user_id',
    })
    .select('id, in_app_seen_at')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function GET() {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  try {
    const latestRelease = await getLatestRelease()
    if (!latestRelease) {
      return apiOk({
        currentVersion: CURRENT_RELEASE.version,
        pendingAnnouncement: null,
      })
    }

    const state = await ensureUserState(latestRelease.id, userId)

    return apiOk({
      currentVersion: latestRelease.version,
      pendingAnnouncement: state.in_app_seen_at ? null : latestRelease,
    })
  } catch (error) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'No se pudo cargar la versión actual',
    })
  }
}

export async function PATCH() {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  try {
    const latestRelease = await getLatestRelease()
    if (!latestRelease) return apiOk({ ok: true, releaseId: null })

    const service = createServiceClient()
    const now = new Date().toISOString()
    const { error } = await service
      .from('app_release_user_state')
      .upsert({
        release_id: latestRelease.id,
        user_id: userId,
        in_app_seen_at: now,
      }, {
        onConflict: 'release_id,user_id',
      })

    if (error) {
      return apiError({ code: 'DATABASE_ERROR', message: error.message })
    }

    return apiOk({ ok: true, releaseId: latestRelease.id, seenAt: now })
  } catch (error) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'No se pudo registrar la lectura del release',
    })
  }
}
