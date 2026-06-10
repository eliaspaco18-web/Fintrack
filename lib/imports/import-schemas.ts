import { z } from 'zod'
import {
  IMPORT_JOB_STATUSES,
  IMPORT_TEMPLATE_VERSION,
} from '@/lib/imports/import-types'

export const zImportJobStatus = z.enum(IMPORT_JOB_STATUSES)

export const zImportJobsQuerySchema = z.object({
  status: zImportJobStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const zCreateImportJobSchema = z.object({
  template_version: z.string().trim().min(1).max(40).default(IMPORT_TEMPLATE_VERSION),
  file_name: z.string().trim().min(1).max(240).optional(),
  file_url: z.string().trim().min(1).max(500).optional(),
  file_size_bytes: z.number().int().min(0).optional(),
  file_hash: z.string().trim().min(8).max(160).optional(),
})

export type ImportJobsQuery = z.infer<typeof zImportJobsQuerySchema>
export type CreateImportJobInput = z.infer<typeof zCreateImportJobSchema>
