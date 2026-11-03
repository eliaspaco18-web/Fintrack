export const HISTORY_PAGE_SIZE = 500
export const HISTORY_MAX_PAGES = 200

/** Read every page or fail closed; callers must never turn a truncated read into a complete report. */
export async function readAllPages<T>(
  readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown | null }>,
  pageSize = HISTORY_PAGE_SIZE,
  maxPages = HISTORY_MAX_PAGES,
) {
  const rows: T[] = []
  for (let page = 0; page < maxPages; page += 1) {
    const { data, error } = await readPage(page * pageSize, (page + 1) * pageSize - 1)
    if (error) throw new Error('No se pudo leer el historial completo.')
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) return rows
  }
  throw new Error('El historial excede el límite seguro de exportación; no se generó un reporte parcial.')
}
