import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateImportJobInput,
  ImportJobsQuery,
} from '@/lib/imports/import-schemas'
import type { ExcelImportAnalysis } from '@/lib/imports/excel-analyzer'
import type {
  ImportJob,
  ImportJobRow,
  ImportJobWithRows,
} from '@/lib/imports/import-types'

const IMPORT_JOB_SELECT = `
  id,
  user_id,
  source,
  status,
  template_version,
  file_name,
  file_url,
  file_size_bytes,
  file_hash,
  summary,
  error_count,
  warning_count,
  created_at,
  updated_at,
  committed_at
` as const

const IMPORT_ROW_SELECT = `
  id,
  import_job_id,
  user_id,
  sheet_name,
  row_number,
  row_key,
  status,
  payload,
  errors,
  warnings,
  target_table,
  target_record_id,
  created_at,
  updated_at
` as const

function untyped(supabase: SupabaseClient) {
  return supabase as SupabaseClient
}

export async function listImportJobs(
  supabase: SupabaseClient,
  userId: string,
  query: ImportJobsQuery,
): Promise<{ data: ImportJob[] | null; error: { message: string } | null }> {
  const db = untyped(supabase)
  let request = db
    .from('import_jobs')
    .select(IMPORT_JOB_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(query.limit)

  if (query.status) request = request.eq('status', query.status)

  const { data, error } = await request
  return { data: data as ImportJob[] | null, error }
}

export async function getImportJobWithRows(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ data: ImportJobWithRows | null; error: { message: string; code?: string } | null }> {
  const db = untyped(supabase)
  const { data: job, error } = await db
    .from('import_jobs')
    .select(IMPORT_JOB_SELECT)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error || !job) return { data: null, error }

  const { data: rows, error: rowsError } = await db
    .from('import_job_rows')
    .select(IMPORT_ROW_SELECT)
    .eq('user_id', userId)
    .eq('import_job_id', id)
    .order('sheet_name', { ascending: true })
    .order('row_number', { ascending: true })
    .limit(500)

  if (rowsError) return { data: null, error: rowsError }

  return {
    data: {
      ...(job as ImportJob),
      rows: (rows ?? []) as ImportJobRow[],
    },
    error: null,
  }
}

export async function getLatestImportJobByFileHash(
  supabase: SupabaseClient,
  userId: string,
  fileHash: string,
  statuses?: Array<ImportJob['status']>,
): Promise<{ data: ImportJobWithRows | null; error: { message: string; code?: string } | null }> {
  const db = untyped(supabase)
  let request = db
    .from('import_jobs')
    .select(IMPORT_JOB_SELECT)
    .eq('user_id', userId)
    .eq('file_hash', fileHash)
    .order('created_at', { ascending: false })
    .limit(1)

  if (statuses && statuses.length > 0) {
    request = request.in('status', statuses)
  }

  const { data: jobs, error } = await request
  if (error) return { data: null, error }

  const job = (jobs ?? [])[0] as ImportJob | undefined
  if (!job) return { data: null, error: null }

  return getImportJobWithRows(supabase, userId, job.id)
}

export async function createImportJob(
  supabase: SupabaseClient,
  userId: string,
  input: CreateImportJobInput,
): Promise<{ data: ImportJob | null; error: { message: string } | null }> {
  const db = untyped(supabase)
  const { data, error } = await db
    .from('import_jobs')
    .insert({
      user_id: userId,
      source: 'EXCEL',
      status: 'DRAFT',
      template_version: input.template_version,
      file_name: input.file_name ?? null,
      file_url: input.file_url ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      file_hash: input.file_hash ?? null,
      summary: {},
      error_count: 0,
      warning_count: 0,
    })
    .select(IMPORT_JOB_SELECT)
    .single()

  return { data: data as ImportJob | null, error }
}

export async function createAnalyzedImportJob(
  supabase: SupabaseClient,
  userId: string,
  input: CreateImportJobInput,
  analysis: ExcelImportAnalysis,
): Promise<{ data: ImportJobWithRows | null; error: { message: string } | null }> {
  const db = untyped(supabase)
  const totalErrorCount = analysis.summary.totals.errorRows + analysis.errors.length
  const totalWarningCount = analysis.summary.totals.warningRows + analysis.warnings.length

  const { data: job, error } = await db
    .from('import_jobs')
    .insert({
      user_id: userId,
      source: 'EXCEL',
      status: 'VALIDATED',
      template_version: analysis.templateVersion ?? input.template_version,
      file_name: input.file_name ?? null,
      file_url: input.file_url ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      file_hash: input.file_hash ?? null,
      summary: {
        ...analysis.summary,
        globalErrors: analysis.errors,
        globalWarnings: analysis.warnings,
      },
      error_count: totalErrorCount,
      warning_count: totalWarningCount,
    })
    .select(IMPORT_JOB_SELECT)
    .single()

  if (error || !job) return { data: null, error }

  const rowsToInsert = analysis.rows.map(row => ({
    import_job_id: String(job.id),
    user_id: userId,
    sheet_name: row.sheet_name,
    row_number: row.row_number,
    row_key: row.row_key,
    status: row.status,
    payload: row.payload,
    errors: row.errors,
    warnings: row.warnings,
    target_table: null,
    target_record_id: null,
  }))

  if (rowsToInsert.length > 0) {
    for (let index = 0; index < rowsToInsert.length; index += 250) {
      const chunk = rowsToInsert.slice(index, index + 250)
      const { error: rowsError } = await db
        .from('import_job_rows')
        .insert(chunk)

      if (rowsError) return { data: null, error: rowsError }
    }
  }

  const { data: savedRows, error: savedRowsError } = await db
    .from('import_job_rows')
    .select(IMPORT_ROW_SELECT)
    .eq('user_id', userId)
    .eq('import_job_id', String(job.id))
    .order('sheet_name', { ascending: true })
    .order('row_number', { ascending: true })
    .limit(500)

  if (savedRowsError) return { data: null, error: savedRowsError }

  return {
    data: {
      ...(job as ImportJob),
      rows: (savedRows ?? []) as ImportJobRow[],
    },
    error: null,
  }
}
