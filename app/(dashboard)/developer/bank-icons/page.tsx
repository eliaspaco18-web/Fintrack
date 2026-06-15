import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BankIconStudio } from '@/components/management/BankIconStudio'
import { DEVELOPER_TOOLS_ENABLED } from '@/lib/developer/tools'

export const metadata: Metadata = {
  title: 'Logos bancarios | Developer | FinTrack',
  description: 'Herramienta local para preparar logos bancarios predefinidos.',
}

export default function DeveloperBankIconsPage() {
  if (!DEVELOPER_TOOLS_ENABLED) notFound()

  return <BankIconStudio />
}
