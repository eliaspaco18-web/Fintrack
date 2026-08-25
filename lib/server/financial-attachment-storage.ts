import type { FinancialAttachmentStorage } from '@/modules/attachments/attachment-integrity'

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30

type StorageClient = {
  storage: {
    getBucket: (bucket: string) => Promise<{ data: unknown; error: unknown }>
    createBucket: (
      bucket: string,
      options: {
        public: boolean
        fileSizeLimit: string
        allowedMimeTypes: string[]
      },
    ) => Promise<{ error: unknown }>
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File,
        options: { contentType: string; upsert: boolean; cacheControl: string },
      ) => Promise<{ error: unknown }>
      remove: (paths: string[]) => Promise<{ error: unknown }>
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl?: string } | null; error: unknown }>
    }
  }
}

export function createFinancialAttachmentStorage(params: {
  service: StorageClient
  bucket: string
  maxFileSizeBytes: number
  allowedMimeTypes: string[]
}): FinancialAttachmentStorage {
  const bucket = params.bucket

  return {
    async ensureReady() {
      const lookup = await params.service.storage.getBucket(bucket)
      if (!lookup.error && lookup.data) return

      const created = await params.service.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: `${params.maxFileSizeBytes}`,
        allowedMimeTypes: params.allowedMimeTypes,
      })
      if (created.error) throw new Error('attachment storage unavailable')
    },

    async upload(path, file, contentType) {
      const result = await params.service.storage.from(bucket).upload(path, file, {
        contentType,
        upsert: false,
        cacheControl: '3600',
      })
      if (result.error) throw new Error('attachment upload failed')
    },

    async remove(path) {
      const result = await params.service.storage.from(bucket).remove([path])
      if (result.error) throw new Error('attachment cleanup failed')
    },

    async createSignedUrl(path) {
      const result = await params.service.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

      if (result.error) return null
      return result.data?.signedUrl ?? null
    },
  }
}
