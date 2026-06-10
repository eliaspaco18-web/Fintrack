'use client'

// =============================================================================
// components/credits/CreditsWorkspace.tsx
// PRD v3 — Módulo 4: Créditos
// Tipo 1: Tarjeta de Crédito | Tipo 2: Crédito Bancario
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { mutate } from 'swr'
import { useToast } from '@/lib/toast/toast'
import { RecordModal } from '@/components/ui/RecordModal'
import { CreditTypeSelector } from '@/components/credits/CreditTypeSelector'
import { CreditCardForm } from '@/components/credits/CreditCardForm'
import { BankLoanForm } from '@/components/credits/BankLoanForm'
import { CreditsListPanel } from '@/components/credits/CreditsListPanel'

export type CreditMode = 'CARD' | 'BANK'
type CreditModalSize = 'sm' | 'lg' | 'xl' | 'full-form'

function toNextUrl(pathname: string, params: URLSearchParams): string {
  const qs = params.toString()
  return qs.length > 0 ? `${pathname}?${qs}` : pathname
}

export function CreditsWorkspace() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<'select_type' | 'form'>('select_type')
  const [selectedMode, setSelectedMode] = useState<CreditMode | null>(null)
  const [modalSize, setModalSize] = useState<CreditModalSize>('sm')
  const [isNestedModalOpen, setIsNestedModalOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const handledRef = useRef(false)

  const openFromQuery = searchParams.get('new') === 'credit'

  const clearQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [pathname, router, searchParams])

  const openModal = useCallback(() => {
    setModalStep('select_type')
    setSelectedMode(null)
    setModalSize('sm')
    setIsNestedModalOpen(false)
    setFormKey(k => k + 1)
    setIsModalOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('new', 'credit')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [pathname, router, searchParams])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    setModalStep('select_type')
    setSelectedMode(null)
    setModalSize('sm')
    setIsNestedModalOpen(false)
    clearQuery()
  }, [clearQuery])

  const handleTypeSelected = useCallback((mode: CreditMode) => {
    setSelectedMode(mode)
    setModalSize('lg')
    setIsNestedModalOpen(false)
    setFormKey(k => k + 1)
    setModalStep('form')
  }, [])

  const handleBack = useCallback(() => {
    setModalStep('select_type')
    setSelectedMode(null)
    setModalSize('sm')
    setIsNestedModalOpen(false)
  }, [])

  const handleSuccess = useCallback(async (creditName: string) => {
    toast.success('Crédito registrado', creditName)
    setIsModalOpen(false)
    clearQuery()
    await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits'))
    router.refresh()
  }, [clearQuery, router, toast])

  useEffect(() => {
    if (openFromQuery) {
      if (handledRef.current) return
      handledRef.current = true
      setModalStep('select_type')
      setSelectedMode(null)
      setModalSize('sm')
      setIsNestedModalOpen(false)
      setFormKey(k => k + 1)
      setIsModalOpen(true)
      return
    }
    handledRef.current = false
  }, [openFromQuery])

  const modalTitle = modalStep === 'form'
    ? (selectedMode === 'CARD' ? 'Nueva tarjeta de crédito' : 'Nuevo crédito bancario')
    : 'Nuevo crédito'

  const modalSubtitle = modalStep === 'form'
    ? (selectedMode === 'CARD'
      ? 'Completa los datos esenciales de la tarjeta y revisa el cronograma desde un resumen compacto dentro del mismo flujo.'
      : 'Completa los datos base del préstamo y revisa el cronograma desde un resumen compacto dentro del mismo flujo.')
    : 'Selecciona el tipo de crédito a registrar.'

  return (
    <div className="space-y-5">
      <CreditsListPanel onCreate={openModal} />

      {/* ── MODAL CREAR ──────────────────────────────────────────────── */}
      <RecordModal
        open={isModalOpen}
        onClose={closeModal}
        eyebrow="Créditos"
        title={modalTitle}
        subtitle={modalSubtitle}
        size={modalSize}
        focusTrapActive={!isNestedModalOpen}
        bodyClassName={modalStep === 'form' ? 'credits-modal-body !overflow-hidden py-4' : ''}
      >
        {modalStep === 'select_type' ? (
          <CreditTypeSelector onSelect={handleTypeSelected} />
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ft-text-muted)] transition-colors duration-150 hover:text-[var(--ft-text)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Cambiar tipo de crédito
            </button>
            {selectedMode === 'CARD' ? (
              <CreditCardForm
                key={formKey}
                onSuccess={handleSuccess}
                onCancel={closeModal}
                onLayoutPreferenceChange={setModalSize}
                onNestedModalOpenChange={setIsNestedModalOpen}
              />
            ) : (
              <BankLoanForm
                key={formKey}
                onSuccess={handleSuccess}
                onCancel={closeModal}
                onLayoutPreferenceChange={setModalSize}
                onNestedModalOpenChange={setIsNestedModalOpen}
              />
            )}
          </div>
        )}
      </RecordModal>
    </div>
  )
}
