import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { getNavBadgesForUser } from '@/lib/server/nav-badges'

export async function GET() {
  const supabase = await createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  try {
    const badges = await getNavBadgesForUser(userId)
    return apiOk(badges)
  } catch (error) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Could not load navigation counts',
    })
  }
}
