'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import type { V3WorkbenchMotionSource } from '@/lib/ui/use-v3-workbench-presence'

export interface V3FilterDrawerProps {
  open: boolean
  title?: string
  contextLabel?: string
  children: ReactNode
  onCancel: () => void
  onApply: () => void
  onClearDraft: () => void
  applyDisabled?: boolean
  applying?: boolean
  motionSource?: V3WorkbenchMotionSource
  testId?: string
}

/** The owning module holds both draft and applied query state. This shell never edits a URL. */
export function V3FilterDrawer({
  open,
  title = 'Filtros',
  contextLabel,
  children,
  onCancel,
  onApply,
  onClearDraft,
  applyDisabled = false,
  applying = false,
  motionSource = 'keyboard',
  testId,
}: V3FilterDrawerProps) {
  return (
    <RecordModal
      open={open}
      onClose={() => { if (!applying) onCancel() }}
      title={title}
      eyebrow={contextLabel}
      presentation="workbench"
      motionSource={motionSource}
      testId={testId}
    >
      <div className="ft-v3-filter-fields">{children}</div>
      <RecordModalFooter>
        <div className="ft-v3-filter-footer">
          <Button type="button" variant="ghost" onClick={onClearDraft} disabled={applying}>
            Limpiar filtros
          </Button>
          <div className="ft-v3-filter-footer-actions">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={applying}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onApply}
              disabled={applyDisabled || applying}
              loading={applying}
              stableLoading
              loadingText="Aplicando…"
            >
              Aplicar filtros
            </Button>
          </div>
        </div>
      </RecordModalFooter>
    </RecordModal>
  )
}
