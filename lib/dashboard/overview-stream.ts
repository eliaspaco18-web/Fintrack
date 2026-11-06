export type DashboardOverviewSource = 'summary' | 'sidebar'
export type DashboardOverviewStreamEvent<TSummary, TSidebar> =
  | { source: 'summary'; data: TSummary | null; error: { code: string; message: string } | null }
  | { source: 'sidebar'; data: TSidebar | null; error: { code: string; message: string } | null }

/** Reads the overview's NDJSON stream and exposes each source as soon as it arrives. */
export async function consumeDashboardOverviewStream<TSummary, TSidebar>(
  response: Response,
  onSource: (event: DashboardOverviewStreamEvent<TSummary, TSidebar>) => void,
) {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string }; message?: string } | null
    throw new Error(body?.error?.message ?? body?.message ?? `No se pudo cargar Inicio (${response.status}).`)
  }
  if (!response.body) throw new Error('La respuesta de Inicio no incluyó el flujo de datos esperado.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const sources = new Set<DashboardOverviewSource>()
  const handleLine = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line) as DashboardOverviewStreamEvent<TSummary, TSidebar>
    if (event.source !== 'summary' && event.source !== 'sidebar') throw new Error('La respuesta de Inicio contiene una sección desconocida.')
    if (sources.has(event.source)) throw new Error(`La respuesta de Inicio repitió la sección ${event.source}.`)
    sources.add(event.source)
    onSource(event)
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      handleLine(buffer.slice(0, newline))
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) handleLine(buffer)
  if (!sources.has('summary') || !sources.has('sidebar')) {
    throw new Error('La respuesta de Inicio terminó antes de completar todas sus secciones.')
  }
}
