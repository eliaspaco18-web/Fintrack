import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeveloperControlCenter } from '@/components/developer/DeveloperControlCenter'
import { DEVELOPER_TOOLS_ENABLED } from '@/lib/developer/tools'

export const metadata: Metadata = {
  title: 'Control Center | Developer | FinTrack',
  description: 'Centro de control local para mantenimiento global y estados por módulo.',
}

export default function DeveloperControlCenterPage() {
  if (!DEVELOPER_TOOLS_ENABLED) notFound()

  return <DeveloperControlCenter />
}
