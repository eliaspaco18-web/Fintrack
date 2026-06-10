// =============================================================================
// app/(dashboard)/admin/page.tsx
// Administración — Módulo 10 del PRD v3
// Gestión de Entidades Bancarias, Monedas, Categorías y Tipos de Activo
// =============================================================================

import type { Metadata } from 'next'
import { AdminWorkspace } from '@/components/management/AdminWorkspace'

export const metadata: Metadata = {
  title: 'Administración | FinTrack',
  description: 'Catálogos base de bancos, monedas, categorías y tipos de activo.',
}

export default function AdminPage() {
  return <AdminWorkspace />
}
