import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AppStateScreen } from '@/components/system/AppStateScreen'
import type { AppControlModule } from '@/lib/constants/app-control'
import { findControlledModuleByKey } from '@/lib/constants/app-control'

export const metadata: Metadata = {
  title: 'Estado del módulo | FinTrack',
  description: 'Pantalla pública de estado o disponibilidad por módulo.',
}

function launchFeatures(moduleInfo: AppControlModule) {
  const features: Record<string, string[]> = {
    portfolio: [
      'Organiza bancos, tarjetas y cuentas en un solo lugar.',
      'Elige logos e identidades visuales para reconocer cada entidad rápido.',
      'Prepara tu portafolio para conectar mejor saldos, créditos y movimientos.',
    ],
    transactions: [
      'Registra ingresos, gastos y transferencias con más claridad.',
      'Encuentra tus movimientos recientes sin perder contexto.',
      'Mantén tu historial listo para reportes y decisiones rápidas.',
    ],
    credits: [
      'Controla tarjetas, préstamos y cuotas desde una vista ordenada.',
      'Revisa vencimientos y compromisos sin saltar entre pantallas.',
      'Entiende mejor el impacto de tus créditos en tu flujo.',
    ],
    budgets: [
      'Define límites por categoría y periodo.',
      'Detecta a tiempo cuando un gasto se acerca al límite.',
      'Convierte tus metas en seguimiento diario.',
    ],
    alerts: [
      'Recibe señales importantes sobre vencimientos y riesgos.',
      'Prioriza lo urgente sin revisar todo manualmente.',
      'Mantén el control antes de que algo se escape.',
    ],
  }

  return features[moduleInfo.key] ?? [
    `Explora ${moduleInfo.label} con una experiencia preparada para ayudarte mejor.`,
    moduleInfo.objective,
    'Usa esta novedad como una nueva pieza dentro de tu flujo financiero.',
  ]
}

export default function ModuleStatusPage({
  params,
}: {
  params: { moduleKey: string }
}) {
  const moduleInfo = findControlledModuleByKey(params.moduleKey)

  if (!moduleInfo) notFound()
  if (moduleInfo.status === 'live') redirect(moduleInfo.href)

  const isComingSoon = moduleInfo.status === 'coming-soon'
  const isLaunch = moduleInfo.status === 'launch'
  const fallbackMessage = isLaunch
    ? `${moduleInfo.label} ya está disponible. Entra para explorar sus novedades y aprovechar esta nueva experiencia dentro de FinTrack.`
    : isComingSoon
    ? `Estamos construyendo ${moduleInfo.label} para que pronto tengas una nueva forma de avanzar dentro de FinTrack. Falta poco para estrenarlo.`
    : `Estamos ajustando ${moduleInfo.label} para que vuelva con mejoras que se noten desde el primer uso.`
  const note = moduleInfo.note.trim()
  const noteLooksLikeMaintenance = /afinando|ajustando|mantenimiento|mejoras|vuelva|volveremos/i.test(note)
  const publicMessage = note && !((isComingSoon || isLaunch) && noteLooksLikeMaintenance)
    ? note
    : fallbackMessage

  return (
    <AppStateScreen
      eyebrow={isLaunch ? 'Nuevo en FinTrack' : isComingSoon ? 'Muy pronto' : 'Estamos trabajando aquí'}
      title={isLaunch
        ? `${moduleInfo.label} ya está listo`
        : isComingSoon
        ? `${moduleInfo.label} está por llegar`
        : `${moduleInfo.label} está recibiendo mejoras`}
      message={publicMessage}
      tone={isLaunch ? 'launch' : isComingSoon ? 'coming-soon' : 'maintenance'}
      scope="module"
      primaryHref={isLaunch ? `${moduleInfo.href}?ft_launch=open` : '/dashboard'}
      primaryLabel={isLaunch ? 'Vamos allí' : 'Ir al dashboard'}
      secondaryHref={isLaunch ? '/dashboard' : undefined}
      secondaryLabel={isLaunch ? 'Ver dashboard' : undefined}
      featureItems={isLaunch ? launchFeatures(moduleInfo) : undefined}
    />
  )
}
