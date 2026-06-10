'use client'

export interface ApiEnvelope<T> {
  ok: boolean
  data: T
  error?: {
    code?: string
    message?: string
  }
}

export async function fetchDashboardData<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const payload = (await response.json()) as ApiEnvelope<T>

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? 'No se pudo cargar la data del dashboard')
  }

  return payload.data
}
