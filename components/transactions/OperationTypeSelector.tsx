'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import styles from '@/components/tables/TransactionsRound07.module.css'

export type OperationType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'asset_purchase'
  | 'receivable_issue'
  | 'receivable_collect'
  | 'payable_issue'
  | 'payable_pay'

type AstraIcon = 'up' | 'down' | 'moves' | 'box'

interface OperationCard {
  type: OperationType
  label: string
  description: string
  icon: AstraIcon
}

interface OperationPopoverItem {
  type: OperationType
  label: string
  description?: string
  icon: AstraIcon
}

interface OperationTypeSelectorProps {
  onSelect: (type: OperationType) => void
}

interface OperationTypePopoverProps {
  anchorRef: { current: HTMLElement | null }
  menuId: string
  open: boolean
  onClose: () => void
  onSelect: (type: OperationType) => void
}

const ASTRA_ICONS: Record<AstraIcon, React.ReactNode> = {
  down: <path d="M7 7h10v10M17 7 7 17" />,
  up: <path d="M7 17h10V7M7 17 17 7" />,
  moves: <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />,
  box: <path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7 5.8l9 5" />,
}

// Desktop is the effective Round 07 refinement.js menu. The older dialog in
// app.js remains the reference fallback used below 768px.
const ASTRA_POPOVER_ITEMS: OperationPopoverItem[] = [
  { type: 'income', label: 'Ingreso', description: 'Dinero que recibes', icon: 'down' },
  { type: 'expense', label: 'Egreso', description: 'Dinero que sale', icon: 'up' },
  { type: 'transfer', label: 'Transferencia interna', description: 'Entre tus propias cuentas', icon: 'moves' },
  { type: 'receivable_issue', label: 'Prestar dinero', description: '', icon: 'down' },
  { type: 'receivable_collect', label: 'Registrar cobro', description: '', icon: 'down' },
  { type: 'payable_issue', label: 'Dinero recibido a devolver', description: '', icon: 'up' },
  { type: 'payable_pay', label: 'Registrar pago', description: '', icon: 'up' },
  { type: 'asset_purchase', label: 'Comprar un activo', description: '', icon: 'box' },
]

const ASTRA_DRAWER_ITEMS: OperationCard[] = [
  { type: 'income', label: 'Ingreso', description: 'Dinero que recibiste', icon: 'down' },
  { type: 'expense', label: 'Egreso', description: 'Un gasto de tu día a día', icon: 'up' },
  { type: 'transfer', label: 'Transferencia', description: 'Entre tus cuentas', icon: 'moves' },
  { type: 'asset_purchase', label: 'Compra de activo', description: 'Un bien que conservarás', icon: 'box' },
  { type: 'receivable_issue', label: 'Prestar dinero', description: 'Crea un pendiente por cobrar', icon: 'up' },
  { type: 'receivable_collect', label: 'Cobrar', description: 'Reduce un pendiente registrado', icon: 'down' },
  { type: 'payable_issue', label: 'Recibir un préstamo', description: 'Crea un pendiente por pagar', icon: 'down' },
  { type: 'payable_pay', label: 'Pagar un pendiente', description: 'Reduce una obligación registrada', icon: 'up' },
]

function AstraIconView({ name, size = 16 }: { name: AstraIcon; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ASTRA_ICONS[name]}
    </svg>
  )
}

export function OperationTypePopover({
  anchorRef,
  menuId,
  open,
  onClose,
  onSelect,
}: OperationTypePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const lastInputRef = useRef<'pointer' | 'keyboard'>('pointer')

  useEffect(() => {
    const markPointer = () => { lastInputRef.current = 'pointer' }
    const markKeyboard = () => { lastInputRef.current = 'keyboard' }
    document.addEventListener('pointerdown', markPointer, true)
    document.addEventListener('keydown', markKeyboard, true)
    return () => {
      document.removeEventListener('pointerdown', markPointer, true)
      document.removeEventListener('keydown', markKeyboard, true)
    }
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const popover = popoverRef.current
    const anchor = anchorRef.current?.querySelector('button') ?? anchorRef.current
    if (!popover || !anchor) return

    if (!popover.matches(':popover-open')) {
      if (typeof popover.showPopover === 'function') {
        popover.showPopover()
      } else {
        popover.dataset.fallbackOpen = 'true'
      }
    }

    const anchorBox = anchor.getBoundingClientRect()
    const popoverBox = popover.getBoundingClientRect()
    const below = anchorBox.bottom + 8 + popoverBox.height <= window.innerHeight - 12
    const left = Math.max(12, Math.min(anchorBox.right - popoverBox.width, window.innerWidth - popoverBox.width - 12))
    const top = below
      ? anchorBox.bottom + 8
      : Math.max(12, anchorBox.top - popoverBox.height - 8)
    const originX = Math.max(12, Math.min(popoverBox.width - 12, anchorBox.left + anchorBox.width / 2 - left))

    popover.style.left = `${left}px`
    popover.style.top = `${top}px`
    popover.style.transformOrigin = `${originX}px ${below ? 'top' : 'bottom'}`

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const openedByKeyboard = lastInputRef.current === 'keyboard'
    if (!reduceMotion && !openedByKeyboard && typeof popover.animate === 'function') {
      popover.animate(
        [
          { opacity: 0.6, transform: `translateY(${below ? -4 : 4}px) scale(.97)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 160, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'backwards' },
      )
    }

    if (openedByKeyboard) {
      popover.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true })
    }

    const closeAndRestoreFocus = () => {
      const shouldRestoreFocus = popover.contains(document.activeElement)
      onClose()
      if (shouldRestoreFocus) anchor.focus({ preventScroll: true })
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !popover.contains(target) && !anchor.contains(target)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!popover.contains(event.target as Node)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        closeAndRestoreFocus()
        return
      }
      if (event.key === 'Tab') {
        onClose()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const items = Array.from(popover.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      if (!items.length) return
      event.preventDefault()
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !popover.contains(event.target)) onClose()
    }
    const onResize = () => onClose()

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      if (popover.matches(':popover-open') && typeof popover.hidePopover === 'function') popover.hidePopover()
      delete popover.dataset.fallbackOpen
    }
  }, [anchorRef, onClose, open])

  const selectOperation = useCallback((type: OperationType) => {
    onSelect(type)
  }, [onSelect])

  return (
    <div
      ref={popoverRef}
      id={menuId}
      popover="manual"
      role="menu"
      aria-label="Registrar una operación"
      data-testid="operation-type-menu"
      className={styles.operationPopover}
    >
      <div className={styles.operationPopoverHeading}>Registrar una operación</div>
      {ASTRA_POPOVER_ITEMS.map(item => (
        <button
          key={item.type}
          type="button"
          role="menuitem"
          data-testid={`operation-type-${item.type}`}
          className={styles.operationMenuItem}
          onClick={() => selectOperation(item.type)}
        >
          <AstraIconView name={item.icon} />
          <span>
            {item.label}
            {item.description ? <small>{item.description}</small> : null}
          </span>
        </button>
      ))}
    </div>
  )
}

function OperationCardButton({
  card,
  onSelect,
}: {
  card: OperationCard
  onSelect: (type: OperationType) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card.type)}
      data-testid={`operation-type-${card.type}`}
      className={styles.operation}
    >
      <AstraIconView name={card.icon} size={18} />
      <span>
        <strong>{card.label}</strong>
        <small>{card.description}</small>
      </span>
    </button>
  )
}

export function OperationTypeSelector({ onSelect }: OperationTypeSelectorProps) {
  return (
    <div className={styles.operationSelector}>
      <div className={styles.operationGrid}>
        {ASTRA_DRAWER_ITEMS.map(card => (
          <OperationCardButton key={card.type} card={card} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

export function operationTypeToFormConfig(operationType: OperationType): Record<string, unknown> {
  switch (operationType) {
    case 'income':
      return { type: 'INCOME' }
    case 'expense':
      return { type: 'EXPENSE' }
    case 'transfer':
      return { type: 'TRANSFER' }
    case 'asset_purchase':
      return { type: 'EXPENSE', creates_asset: true }
    case 'receivable_issue':
      return { type: 'EXPENSE', creates_receivable: true }
    case 'receivable_collect':
      return { type: 'INCOME', creates_receivable: false }
    case 'payable_issue':
      return { type: 'INCOME', creates_payable: true }
    case 'payable_pay':
      return { type: 'EXPENSE', creates_payable: false }
    default:
      return { type: 'EXPENSE' }
  }
}

export function operationTypeLabel(operationType: OperationType): string {
  const labels: Record<OperationType, string> = {
    income: 'Ingreso',
    expense: 'Egreso',
    transfer: 'Transferencia',
    asset_purchase: 'Compra de Activo',
    receivable_issue: 'Registrar cuenta por cobrar',
    receivable_collect: 'Registrar cobro',
    payable_issue: 'Registrar cuenta por pagar',
    payable_pay: 'Registrar pago',
  }
  return labels[operationType] ?? 'Transacción'
}
