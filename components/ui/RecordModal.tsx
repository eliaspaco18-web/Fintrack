'use client'

import {
  Children,
  isValidElement,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { FocusTrap } from '@/components/ui/accessibility'

type RecordModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full-form'

const MODAL_SIZE_PRESETS: Record<RecordModalSize, { widthClassName: string; padding: string }> = {
  sm: {
    widthClassName: 'w-[calc(100vw-32px)] max-w-[480px]',
    padding: '24px',
  },
  md: {
    widthClassName: 'w-[calc(100vw-32px)] max-w-[760px]',
    padding: '24px',
  },
  lg: {
    widthClassName: 'w-[calc(100vw-32px)] max-w-[900px]',
    padding: '28px',
  },
  xl: {
    widthClassName: 'w-[calc(100vw-32px)] max-w-[1280px]',
    padding: '28px',
  },
  'full-form': {
    widthClassName: 'w-[calc(100vw-32px)] max-w-[1280px]',
    padding: '20px',
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
  overlayClassName = 'z-[120]',
  focusTrapActive = true,
}: RecordModalProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
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

  useEffect(() => {
    setPortalRoot(document.body)
  }, [])

  if (!open || !portalRoot) return null

  return createPortal(
    <div
      className={`app-modal-overlay ${overlayClassName}`.trim()}
      onPointerDown={event => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <FocusTrap active={open && focusTrapActive} onEscape={focusTrapActive ? onClose : undefined}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={subtitle ? subtitleId : undefined}
          data-testid={testId}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
          className={`
            ${resolvedWidthClassName}
            flex max-h-[calc(100dvh-32px)] flex-col overflow-hidden
            rounded-xl border border-[var(--c-border)]
            bg-[var(--c-modal-bg)]
            shadow-[var(--shadow-lg)]
          `}
          style={modalStyle}
        >
          <div
            className="
              sticky top-0 z-[1] flex items-start justify-between gap-3 border-b border-[var(--ft-form-border)]
              bg-[var(--ft-form-surface)]
              px-[var(--ft-modal-padding)] pt-5 pb-4 backdrop-blur-xl
            "
          >
            <div className="min-w-0">
              {eyebrow && (
                <p className="mb-1 text-[10px] font-medium tracking-[0.12em] text-[var(--c-text-faint)]">
                  {eyebrow}
                </p>
              )}
              <h2
                id={titleId}
                className="text-[1rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--c-text)] md:text-[1.05rem]"
              >
                {title}
              </h2>
              {subtitle && (
                <p id={subtitleId} className="mt-1 max-w-[65ch] text-[12px] text-[var(--c-text-muted)]">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="
                flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg
                border border-[var(--c-border)] bg-[var(--c-surface-2)]
                text-[var(--c-text-muted)] hover:text-[var(--c-text)]
                hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface-hover)]
                transition-colors duration-150
              "
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div
            data-record-modal-body="true"
            className={`min-h-0 flex-1 overflow-y-auto px-[var(--ft-modal-padding)] py-5 ${bodyClassName}`.trim()}
          >
            {bodyChildren}
          </div>

          {extractedFooter ? (
            <div
              className={`
                border-t border-[var(--ft-form-border)] bg-[var(--ft-form-surface)]
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
