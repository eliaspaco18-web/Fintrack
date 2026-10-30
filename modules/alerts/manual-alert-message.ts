export type ManualAlertModule = 'credits' | 'budgets' | 'receivables' | 'payables' | 'recurring' | 'alerts'
export type ManualAlertChannel = 'inbox_email' | 'inbox' | 'digest'

export function formatManualAlertMessage(input: {
  sourceModule: ManualAlertModule
  channel: ManualAlertChannel
  threshold?: string
}) {
  const moduleName: Record<ManualAlertModule, string> = {
    credits: 'Créditos',
    budgets: 'Presupuestos',
    receivables: 'Por cobrar',
    payables: 'Por pagar',
    recurring: 'Plantillas',
    alerts: 'Avisos',
  }
  const channelName: Record<ManualAlertChannel, string> = {
    inbox_email: 'Inbox y correo',
    inbox: 'Solo inbox',
    digest: 'Resumen semanal',
  }

  return [
    `Aviso manual relacionado con ${moduleName[input.sourceModule]}.`,
    input.threshold ? `Umbral de referencia: ${input.threshold}%.` : null,
    `Canal guardado como referencia: ${channelName[input.channel]}.`,
    'No se programan reglas ni se realizan envíos automáticos.',
  ].filter(Boolean).join(' ')
}
