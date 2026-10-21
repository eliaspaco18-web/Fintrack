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
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/finance'
import { AssetsForm } from '@/components/assets/AssetsForm'
import { AssetsListPanel } from '@/components/assets/AssetsListPanel'
import styles from './AssetsListPanel.module.css'
import { FormActions } from '@/components/forms/primitives'

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
  const [isDirty, setIsDirty]         = useState(false)
  const [isSaving, setIsSaving]       = useState(false)
  const [formReady, setFormReady]     = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const handledRef                    = useRef(false)

  const openFromQuery = searchParams.get('new') === 'asset'

  const clearQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [pathname, router, searchParams])

  const openModal = useCallback(() => {
    setFormKey(k => k + 1)
    setIsDirty(false)
    setIsSaving(false)
    setFormReady(false)
    setIsModalOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('new', 'asset')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [pathname, router, searchParams])

  const handleFormStateChange = useCallback((state: { dirty: boolean; saving: boolean; ready: boolean }) => {
    setIsDirty(state.dirty)
    setIsSaving(state.saving)
    setFormReady(state.ready)
  }, [])

  const closeModal = useCallback(() => {
    if (isSaving) return
    if (isDirty) {
      setDiscardOpen(true)
      return
    }
    setIsModalOpen(false)
    clearQuery()
  }, [clearQuery, isDirty, isSaving])

  const confirmClose = useCallback(() => {
    setDiscardOpen(false)
    setIsDirty(false)
    setIsModalOpen(false)
    clearQuery()
  }, [clearQuery])

  const handleSuccess = useCallback(async (assetName: string) => {
    toast.success('Activo registrado', assetName)
    setIsDirty(false)
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
      setIsDirty(false)
      setIsSaving(false)
      setFormReady(false)
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
        title="Registrar activo"
        subtitle="Registra la compra y los datos del activo en una sola operación."
        presentation="workbench"
        size="xl"
        overlayClassName={styles.createOverlay}
        focusTrapActive={!discardOpen}
        preserveFocusOnResume
        testId="assets-create-modal"
        footer={(
          <FormActions
            secondaryAction={<Button type="button" variant="secondary" onClick={closeModal} disabled={isSaving}>Cancelar</Button>}
            primaryAction={<Button type="submit" form="asset-form" variant="primary" loading={isSaving} disabled={!formReady || isSaving} testId="asset-submit-button">Registrar activo</Button>}
          />
        )}
      >
        <AssetsForm
          key={formKey}
          onSuccess={handleSuccess}
          onFormStateChange={handleFormStateChange}
        />
      </RecordModal>
      <ConfirmDialog
        open={discardOpen}
        title="Descartar cambios"
        message="Hay cambios sin guardar. ¿Quieres cerrar sin registrar el activo?"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={confirmClose}
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        testId="assets-create-discard-modal"
      />
    </div>
  )
}
