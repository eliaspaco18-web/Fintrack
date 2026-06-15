import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeveloperWorkspace } from '@/components/developer/DeveloperWorkspace'
import { DEVELOPER_TOOLS_ENABLED } from '@/lib/developer/tools'

export const metadata: Metadata = {
  title: 'Developer | FinTrack',
  description: 'Herramientas locales para preparar assets y presets de FinTrack.',
}

export default function DeveloperPage() {
  if (!DEVELOPER_TOOLS_ENABLED) notFound()

  return <DeveloperWorkspace />
}
