import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE } from '@/modules/attachments/attachment-integrity'

type Params = { params: { id: string } }

/**
 * Legacy endpoint retained only to return a controlled response to old clients.
 * Active loan documents use the verified `/documents` contract from G1D-P01A;
 * billing-cycle statements do not yet have a safe cycle-scoped association.
 */
export async function POST(_req: NextRequest, _context: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  return apiError({
    code: 'BUSINESS_RULE_ERROR',
    message: ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
  })
}
