export const IMPORT_TEMPLATE_VERSION = 'excel-v3' as const

export const IMPORT_JOB_STATUSES = [
  'DRAFT',
  'VALIDATED',
  'COMMITTED',
  'FAILED',
  'CANCELLED',
] as const

export const IMPORT_ROW_STATUSES = [
  'VALID',
  'WARNING',
  'ERROR',
  'IMPORTED',
  'SKIPPED',
] as const

export type ImportJobStatus = typeof IMPORT_JOB_STATUSES[number]
export type ImportRowStatus = typeof IMPORT_ROW_STATUSES[number]

export type ImportJobSummary = {
  sheets?: Record<string, {
    totalRows: number
    validRows: number
    errorRows: number
    warningRows: number
  }>
  totals?: {
    rows: number
    validRows: number
    errorRows: number
    warningRows: number
  }
  projectedBalances?: Array<{
    portfolioKey: string
    currency: string
    initialBalance: number
    projectedBalance: number
  }>
  globalErrors?: Array<{
    field?: string
    message?: string
    code?: string
  }>
  globalWarnings?: Array<{
    field?: string
    message?: string
    code?: string
  }>
  committedTables?: Record<string, number>
  committedAt?: string
  lastCommitError?: string
  rollbackVersion?: 'rollback-v1'
  rollbackReady?: boolean
  rollbackCounts?: Record<string, number>
  rolledBackAt?: string
  lastRollbackError?: string
}

export type ImportJob = {
  id: string
  user_id: string
  source: 'EXCEL'
  status: ImportJobStatus
  template_version: string
  file_name: string | null
  file_url: string | null
  file_size_bytes: number | null
  file_hash: string | null
  summary: ImportJobSummary
  error_count: number
  warning_count: number
  created_at: string
  updated_at: string
  committed_at: string | null
}

export type ImportJobRow = {
  id: string
  import_job_id: string
  user_id: string
  sheet_name: string
  row_number: number
  row_key: string | null
  status: ImportRowStatus
  payload: Record<string, unknown>
  errors: Array<Record<string, unknown>>
  warnings: Array<Record<string, unknown>>
  target_table: string | null
  target_record_id: string | null
  created_at: string
  updated_at: string
}

export type ImportJobWithRows = ImportJob & {
  rows: ImportJobRow[]
}
