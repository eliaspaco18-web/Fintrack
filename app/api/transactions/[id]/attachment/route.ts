import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase.server'
import { apiCreated, apiError, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { createFinancialAttachmentStorage } from '@/lib/server/financial-attachment-storage'
import {
  ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
  AttachmentIntegrityError,
  FINANCIAL_ATTACHMENT_MIME_TYPES,
  MAX_FINANCIAL_ATTACHMENT_BYTES,
  hasStoredAttachmentReference,
  hasTransactionAttachmentReference,
  storeFinancialAttachment,
} from '@/modules/attachments/attachment-integrity'

type Params = { params: { id: string } }

const ATTACHMENT_BUCKET = 'transaction-documents'

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .select('id, attachment_url, notes')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (transactionError || !transaction) {
    return apiError({ code: 'NOT_FOUND', message: 'Transaccion no encontrada' })
  }

  if (
    hasStoredAttachmentReference(transaction.attachment_url)
    || hasTransactionAttachmentReference(transaction.notes)
  ) {
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
    return apiError({ code: 'VALIDATION_ERROR', message: 'Debes adjuntar un archivo valido' })
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
      module: 'transactions',
      recordId: params.id,
      file: fileValue,
      storage,
      associate: async path => {
        const { data, error } = await supabase
          .from('transactions')
          .update({ attachment_url: path })
          .eq('id', params.id)
          .eq('user_id', userId)
          .select('id')
          .single()

        if (error || !data) throw new Error('attachment association failed')
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
    return apiError({ code: 'DATABASE_ERROR', message: 'No se pudo asociar el archivo.' })
  }
}
