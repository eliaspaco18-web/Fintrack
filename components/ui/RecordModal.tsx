'use client'

import {
  Children,
  isValidElement,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { FocusTrap } from '@/components/ui/accessibility'
import { useV3WorkbenchPresence, type V3WorkbenchMotionSource } from '@/lib/ui/use-v3-workbench-presence'
import { acquireV3ModalBackground } from '@/lib/ui/v3-modal-background'

type RecordModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full-form'

const MODAL_SIZE_PRESETS: Record<RecordModalSize, { widthClassName: string; padding: string }> = {
  sm: {
    widthClassName: 'w-[calc(100vw-32px)] max-w-[480px]',
    padding: 'var(--ft-space-6)',
  },
  md: {
    widthClassName: 'w-[calc(100vw-32px)] max-w-[760px]',
    padding: 'var(--ft-space-6)',
  },
  lg: {
    widthClassName: 'w-[calc(100vw-32px)] max-w-[900px]',
    padding: 'var(--ft-space-6)',
  },
  xl: {
    widthClassName: 'w-[calc(100vw-32px)] max-w-[1280px]',
    padding: 'var(--ft-space-6)',
  },
  'full-form': {
    widthClassName: 'w-[calc(100vw-16px)] max-w-[1680px]',
    padding: 'var(--ft-space-5)',
  },
}

interface RecordModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  eyebrow?: string
  testId?: string
  children: ReactNode
  footer?: ReactNode
  size?: RecordModalSize
  widthClassName?: string
  bodyClassName?: string
  footerClassName?: string
  overlayClassName?: string
  focusTrapActive?: boolean
  presentation?: 'legacy' | 'workbench'
  workbenchKind?: 'ordinary' | 'schedule'
  motionSource?: V3WorkbenchMotionSource
}

export function RecordModalFooter({ children }: { children: ReactNode }) {
  return <>{children}</>
}

RecordModalFooter.displayName = 'RecordModalFooter'

export function RecordModal({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  testId,
  children,
  footer,
  size = 'xl',
  widthClassName,
  bodyClassName = '',
  footerClassName = '',
  overlayClassName = 'z-modal',
  focusTrapActive = true,
  presentation = 'legacy',
  workbenchKind = 'ordinary',
  motionSource = 'keyboard',
}: RecordModalProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const [closeMotionSource, setCloseMotionSource] = useState<V3WorkbenchMotionSource>('keyboard')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const subtitleId = useId()
  const sizePreset = MODAL_SIZE_PRESETS[size]
  const resolvedWidthClassName = widthClassName ?? sizePreset.widthClassName
  const { bodyChildren, extractedFooter } = useMemo(() => {
    const nodes = Children.toArray(children)
    const nextBodyChildren: ReactNode[] = []
    let nextFooter: ReactNode = footer

    nodes.forEach(node => {
      if (isValidElement(node) && node.type === RecordModalFooter) {
        if (nextFooter === undefined) {
          nextFooter = node.props.children
        }
        return
      }

      nextBodyChildren.push(node)
    })

    return {
      bodyChildren: nextBodyChildren,
      extractedFooter: nextFooter,
    }
  }, [children, footer])
  const modalStyle = {
    '--ft-modal-padding': sizePreset.padding,
  } as CSSProperties
  const isWorkbench = presentation === 'workbench'
  const presence = useV3WorkbenchPresence(
    open,
    isWorkbench && !!portalRoot,
    open ? motionSource : closeMotionSource,
  )

  useEffect(() => {
    setPortalRoot(document.body)
  }, [])

  useEffect(() => {
    if (open) setCloseMotionSource('keyboard')
  }, [open])

  useEffect(() => {
    if (!isWorkbench || !presence.mounted || !portalRoot || !overlayRef.current) return
    return acquireV3ModalBackground(overlayRef.current)
  }, [isWorkbench, presence.mounted, portalRoot])

  if ((!open && !isWorkbench) || (isWorkbench && !presence.mounted) || !portalRoot) return null

  return createPortal(
    <div
      ref={overlayRef}
      className={`app-modal-overlay ${overlayClassName}`.trim()}
      data-ft-v3={isWorkbench ? '' : undefined}
      data-ft-workbench-overlay={isWorkbench ? '' : undefined}
      data-phase={isWorkbench ? presence.phase : undefined}
      onPointerDown={event => {
        if (event.target === event.currentTarget ||
          (event.target instanceof HTMLElement && event.target.hasAttribute('data-ft-workbench-veil'))) {
          if (isWorkbench) setCloseMotionSource('pointer')
          onClose()
        }
      }}
    >
      {isWorkbench ? <div ref={presence.veilRef} className="ft-v3-workbench-veil" data-ft-workbench-veil="" aria-hidden="true" /> : null}
      <FocusTrap
        active={(isWorkbench ? presence.mounted : open) && focusTrapActive}
        onEscape={focusTrapActive ? () => {
          if (isWorkbench) setCloseMotionSource('keyboard')
          onClose()
        } : undefined}
        className={isWorkbench ? 'ft-v3-workbench-wrapper' : undefined}
        initialFocusRef={isWorkbench ? headingRef : undefined}
        deferRestoreFocus={isWorkbench}
      >
        <div
          ref={isWorkbench ? presence.frameRef : undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={subtitle ? subtitleId : undefined}
          data-testid={testId}
          data-ft-workbench={isWorkbench ? workbenchKind : undefined}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
          className={`
            ${resolvedWidthClassName}
            flex max-h-[calc(100dvh-16px)] flex-col overflow-hidden sm:max-h-[calc(100dvh-32px)]
            rounded-panel border border-[var(--ft-border)] sm:rounded-modal
            bg-[var(--ft-modal-bg)]
            shadow-elevation-xl
          `}
          style={modalStyle}
        >
          <div
            className="
              sticky top-0 z-[1] flex shrink-0 items-start justify-between gap-4 border-b border-[var(--ft-border)]
              bg-[var(--ft-modal-bg)]
              px-[var(--ft-modal-padding)] pb-4 pt-5
            "
          >
            <div className="min-w-0">
              {eyebrow && (
                <p className="mb-1 text-[12px] font-medium tracking-[0.04em] text-[var(--ft-text-subtle)]">
                  {eyebrow}
                </p>
              )}
              <h2
                id={titleId}
                ref={headingRef}
                tabIndex={isWorkbench ? -1 : undefined}
                className="text-[1rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--ft-text-strong)] md:text-[1.05rem]"
              >
                {title}
              </h2>
              {subtitle && (
                <p id={subtitleId} className="mt-1 max-w-[65ch] text-[13px] leading-5 text-[var(--ft-text-muted)]">
                  {subtitle}
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={event => {
                if (isWorkbench) setCloseMotionSource(event.detail === 0 ? 'keyboard' : 'pointer')
                onClose()
              }}
              ariaLabel={isWorkbench ? 'Cerrar panel' : 'Cerrar modal'}
              variant="secondary"
              size="icon-md"
              className="shrink-0 focus-visible:ring-offset-[var(--ft-modal-bg)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </Button>
          </div>

          <div
            ref={isWorkbench ? presence.bodyRef : undefined}
            data-record-modal-body="true"
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--ft-modal-padding)] py-5 ${bodyClassName}`.trim()}
          >
            {bodyChildren}
          </div>

          {extractedFooter ? (
            <div
              className={`
                shrink-0 border-t border-[var(--ft-border)] bg-[var(--ft-modal-bg)]
                px-[var(--ft-modal-padding)] py-4
                ${footerClassName}
              `.trim()}
            >
              {extractedFooter}
            </div>
          ) : null}
        </div>
      </FocusTrap>
    </div>,
    portalRoot,
  )
}
