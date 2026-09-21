import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase.server'
import { apiCreated, apiError, apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { createFinancialAttachmentStorage } from '@/lib/server/financial-attachment-storage'
import {
  ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
  AttachmentIntegrityError,
  FINANCIAL_ATTACHMENT_MIME_TYPES,
  MAX_FINANCIAL_ATTACHMENT_BYTES,
  hasStoredAttachmentReference,
  storeFinancialAttachment,
} from '@/modules/attachments/attachment-integrity'

type Params = { params: { id: string; cycleId: string } }

const ATTACHMENT_BUCKET = 'credit-documents'

async function findOwnedBillingCycle(params: Params['params'], userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('billing_cycles')
    .select('id, credit_id, statement_url, credit:credits!inner(id, user_id, credit_type)')
    .eq('id', params.cycleId)
    .eq('credit_id', params.id)
    .eq('credit.user_id', userId)
    .eq('credit.credit_type', 'CREDIT_CARD')
    .maybeSingle()

  return { supabase, cycle: data, error }
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const ownedCycle = await findOwnedBillingCycle(params, userId)
  if (ownedCycle.error || !ownedCycle.cycle) {
    return apiError({ code: 'NOT_FOUND', message: 'Ciclo de facturación no encontrado' })
  }

  if (hasStoredAttachmentReference(ownedCycle.cycle.statement_url)) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
    })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'No se pudo leer el formulario' })
  }

  const fileValue = formData.get('file')
  if (!(fileValue instanceof File)) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Debes adjuntar un archivo válido' })
  }

  const service = createServiceClient() as any
  const storage = createFinancialAttachmentStorage({
    service,
    bucket: ATTACHMENT_BUCKET,
    maxFileSizeBytes: MAX_FINANCIAL_ATTACHMENT_BYTES,
    allowedMimeTypes: Array.from(FINANCIAL_ATTACHMENT_MIME_TYPES),
  })

  try {
    const result = await storeFinancialAttachment({
      userId,
      module: 'credits',
      recordId: params.cycleId,
      file: fileValue,
      storage,
      associate: async path => {
        const { data, error } = await ownedCycle.supabase
          .from('billing_cycles')
          .update({ statement_url: path })
          .eq('id', params.cycleId)
          .eq('credit_id', params.id)
          .is('statement_url', null)
          .select('id')
          .maybeSingle()

        if (error || !data) throw new Error('statement association failed')
      },
    })

    return apiCreated({
      path: result.path,
      file_name: result.fileName,
      file_size: result.fileSize,
      content_type: result.contentType,
      signed_url: result.signedUrl,
      availability: result.availability,
    })
  } catch (error) {
    if (error instanceof AttachmentIntegrityError) {
      return apiError({ code: error.code, message: error.message })
    }
    return apiError({ code: 'DATABASE_ERROR', message: 'No se pudo asociar el estado de cuenta.' })
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const ownedCycle = await findOwnedBillingCycle(params, userId)
  if (ownedCycle.error || !ownedCycle.cycle) {
    return apiError({ code: 'NOT_FOUND', message: 'Ciclo de facturación no encontrado' })
  }

  if (!hasStoredAttachmentReference(ownedCycle.cycle.statement_url)) {
    return apiError({ code: 'NOT_FOUND', message: 'Este ciclo no tiene un estado de cuenta adjunto' })
  }

  const service = createServiceClient() as any
  const storage = createFinancialAttachmentStorage({
    service,
    bucket: ATTACHMENT_BUCKET,
    maxFileSizeBytes: MAX_FINANCIAL_ATTACHMENT_BYTES,
    allowedMimeTypes: Array.from(FINANCIAL_ATTACHMENT_MIME_TYPES),
  })
  const signedUrl = await storage.createSignedUrl(ownedCycle.cycle.statement_url)

  if (!signedUrl) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: 'No se pudo preparar el estado de cuenta para visualizarlo.',
    })
  }

  return apiOk({ signed_url: signedUrl })
}
