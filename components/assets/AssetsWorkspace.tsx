'use client'

// =============================================================================
// components/assets/AssetsWorkspace.tsx
// PRD v3 — Módulo 5: Activos
// Orquestador principal: resumen superior + botón crear + modal + listado
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { mutate } from 'swr'
import { useToast } from '@/lib/toast/toast'
import { RecordModal } from '@/components/ui/RecordModal'
import { AssetsForm } from '@/components/assets/AssetsForm'
import { AssetsListPanel } from '@/components/assets/AssetsListPanel'

function toNextUrl(pathname: string, params: URLSearchParams): string {
  const qs = params.toString()
  return qs.length > 0 ? `${pathname}?${qs}` : pathname
}

export function AssetsWorkspace() {
  const pathname     = usePathname()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { toast }    = useToast()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formKey, setFormKey]         = useState(0)
  const handledRef                    = useRef(false)

  const openFromQuery = searchParams.get('new') === 'asset'

  const clearQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [pathname, router, searchParams])

  const openModal = useCallback(() => {
    setFormKey(k => k + 1)
    setIsModalOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('new', 'asset')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [pathname, router, searchParams])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    clearQuery()
  }, [clearQuery])

  const handleSuccess = useCallback(async (assetName: string) => {
    toast.success('Activo registrado', assetName)
    setIsModalOpen(false)
    clearQuery()
    await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/assets'))
    router.refresh()
  }, [clearQuery, router, toast])

  useEffect(() => {
    if (openFromQuery) {
      if (handledRef.current) return
      handledRef.current = true
      setFormKey(k => k + 1)
      setIsModalOpen(true)
      return
    }
    handledRef.current = false
  }, [openFromQuery])

  return (
    <div className="space-y-5">
      <AssetsListPanel onCreate={openModal} />

      {/* ── MODAL CREAR ──────────────────────────────────────────────────── */}
      <RecordModal
        open={isModalOpen}
        onClose={closeModal}
        eyebrow="Activos"
        title="Nuevo activo"
        subtitle="Registra un bien, equipo o inversión en tu patrimonio."
        widthClassName="w-[calc(100vw-32px)] max-w-[960px]"
      >
        <AssetsForm key={formKey} onSuccess={handleSuccess} onCancel={closeModal} />
      </RecordModal>
    </div>
  )
}
