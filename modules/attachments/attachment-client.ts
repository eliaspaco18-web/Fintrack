import { getApiErrorMessage } from '@/lib/api/error-message'
import {
  ATTACHMENT_CONFIRMATION_MESSAGE,
  ATTACHMENT_TIMEOUT_MESSAGE,
  type AttachmentAvailability,
} from './attachment-integrity'

export type AttachmentUploadResponse = {
  path: string
  file_name: string
  file_size: number
  content_type: string
  signed_url: string | null
  availability: AttachmentAvailability
}

export const ATTACHMENT_UNVERIFIED_NOTICE =
  'El archivo quedó asociado, pero su disponibilidad no pudo verificarse.'

export type AttachmentAvailabilityOutcome =
  | { kind: 'AVAILABLE'; message: null }
  | { kind: 'UNVERIFIED'; message: string }

export function getAttachmentAvailabilityOutcome(
  result: Pick<AttachmentUploadResponse, 'availability'>,
): AttachmentAvailabilityOutcome {
  return result.availability === 'AVAILABLE'
    ? { kind: 'AVAILABLE', message: null }
    : { kind: 'UNVERIFIED', message: ATTACHMENT_UNVERIFIED_NOTICE }
}

type AttachmentRequestRuntime = {
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class AttachmentRequestTimeoutError extends Error {
  constructor() {
    super(ATTACHMENT_TIMEOUT_MESSAGE)
    this.name = 'AttachmentRequestTimeoutError'
  }
}

function isConfirmedAttachmentResult(
  value: unknown,
  expectedFile: File,
): value is AttachmentUploadResponse {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<AttachmentUploadResponse>

  if (typeof result.path !== 'string' || result.path.trim().length === 0) return false
  if (result.file_name !== expectedFile.name) return false
  if (result.file_size !== expectedFile.size) return false
  if (typeof result.content_type !== 'string' || result.content_type.length === 0) return false
  if (result.availability !== 'AVAILABLE' && result.availability !== 'UNVERIFIED') return false
  if (result.signed_url !== null && typeof result.signed_url !== 'string') return false
  if (result.availability === 'AVAILABLE' && !result.signed_url) return false
  if (result.availability === 'UNVERIFIED' && result.signed_url !== null) return false

  return true
}

export async function requestAttachmentUpload(
  endpoint: string,
  file: File,
  runtime: AttachmentRequestRuntime = {},
): Promise<AttachmentUploadResponse> {
  const timeoutMs = Math.max(1, runtime.timeoutMs ?? 12_000)
  const fetchImpl = runtime.fetchImpl ?? fetch
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false

  const request = async () => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || !payload?.ok) {
      throw new Error(getApiErrorMessage(payload, 'No se pudo adjuntar el archivo.'))
    }

    if (!isConfirmedAttachmentResult(payload.data, file)) {
      throw new Error(ATTACHMENT_CONFIRMATION_MESSAGE)
    }

    return payload.data
  }

  try {
    return await Promise.race([
      request(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true
          controller.abort()
          reject(new AttachmentRequestTimeoutError())
        }, timeoutMs)
      }),
    ])
  } catch (error) {
    if (timedOut) throw new AttachmentRequestTimeoutError()
    throw error
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
