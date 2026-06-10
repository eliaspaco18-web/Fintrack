'use client'

import { DashboardWorkspace } from './DashboardWorkspace'

interface DashboardClientProps {
  initialExchangeRate?: number
}

export function DashboardClient(_props: DashboardClientProps) {
  return <DashboardWorkspace />
}
