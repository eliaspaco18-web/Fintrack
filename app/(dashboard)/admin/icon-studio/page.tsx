import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { DEVELOPER_TOOLS_ENABLED } from '@/lib/developer/tools'

export const metadata: Metadata = {
  title: 'Editor de logos bancarios | FinTrack',
  description: 'Ruta heredada del editor de logos bancarios.',
}

export default function BankIconStudioPage() {
  if (!DEVELOPER_TOOLS_ENABLED) notFound()

  redirect('/developer/bank-icons')
}
