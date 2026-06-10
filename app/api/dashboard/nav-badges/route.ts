import { createClient } from '@/lib/supabase.server'
import { apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { getNavBadgesForUser } from '@/lib/server/nav-badges'

export async function GET() {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const badges = await getNavBadgesForUser(userId)
  return apiOk(badges)
}
