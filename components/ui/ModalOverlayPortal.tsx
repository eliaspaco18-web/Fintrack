'use client'

import { type HTMLAttributes, type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalOverlayPortalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
}

export function ModalOverlayPortal({
  children,
  className = '',
  onClick,
  onPointerDown,
  ...rest
}: ModalOverlayPortalProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalRoot(document.body)
  }, [])

  if (!portalRoot) return null

  return createPortal(
    <div
      className={`app-modal-overlay ${className}`.trim()}
      onPointerDown={event => {
        onPointerDown?.(event)
        if (event.target === event.currentTarget && onClick) {
          onClick(event)
        }
      }}
      onClick={event => {
        if (event.target === event.currentTarget) {
          onClick?.(event)
        }
      }}
      {...rest}
    >
      {children}
    </div>,
    portalRoot,
  )
}
