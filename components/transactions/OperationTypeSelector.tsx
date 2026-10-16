'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { OperationTypeIcon, type OperationType } from '@/components/transactions/OperationTypeIcon'
import styles from '@/components/tables/TransactionsRound07.module.css'
export type { OperationType } from '@/components/transactions/OperationTypeIcon'

export const OPERATION_TITLES: Record<OperationType, string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  receivable_collect: 'Registrar cobro',
  payable_issue: 'Recibir préstamo',
  receivable_issue: 'Prestar dinero',
  payable_pay: 'Registrar pago',
  asset_purchase: 'Comprar activo',
  transfer: 'Transferencia',
}

interface OperationPopoverItem {
  type: OperationType
  label: string
  description?: string
  flow: 'income' | 'expense' | 'transfer'
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

const OPERATION_GROUPS: Array<{
  id: 'income' | 'expense' | 'transfer'
  label: string
  items: OperationPopoverItem[]
}> = [
  {
    id: 'income',
    label: 'Dinero que entra',
    items: [
      { type: 'income', label: OPERATION_TITLES.income, description: 'Dinero que recibes.', flow: 'income' },
      { type: 'receivable_collect', label: OPERATION_TITLES.receivable_collect, description: 'Cobras dinero que te debían.', flow: 'income' },
      { type: 'payable_issue', label: OPERATION_TITLES.payable_issue, description: 'Recibes dinero que luego devolverás.', flow: 'income' },
    ],
  },
  {
    id: 'expense',
    label: 'Dinero que sale',
    items: [
      { type: 'expense', label: OPERATION_TITLES.expense, description: 'Dinero que gastas.', flow: 'expense' },
      { type: 'receivable_issue', label: OPERATION_TITLES.receivable_issue, description: 'Das dinero que te devolverán.', flow: 'expense' },
      { type: 'payable_pay', label: OPERATION_TITLES.payable_pay, description: 'Pagas una deuda pendiente.', flow: 'expense' },
      { type: 'asset_purchase', label: OPERATION_TITLES.asset_purchase, description: 'Compras un bien para conservarlo.', flow: 'expense' },
    ],
  },
  {
    id: 'transfer',
    label: 'Entre tus cuentas',
    items: [
      { type: 'transfer', label: OPERATION_TITLES.transfer, description: 'Mueves dinero entre tus cuentas o tarjetas.', flow: 'transfer' },
    ],
  },
]

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
    const maxTop = Math.max(12, window.innerHeight - popoverBox.height - 12)
    const top = below
      ? anchorBox.bottom + 8
      : Math.max(12, Math.min(anchorBox.top - popoverBox.height - 8, maxTop))
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
      <div className={styles.operationPopoverHeading}>Elige una operación</div>
      <OperationGroups onSelect={selectOperation} menuItem />
    </div>
  )
}

function OperationButton({
  card,
  onSelect,
  menuItem = false,
}: {
  card: OperationPopoverItem
  onSelect: (type: OperationType) => void
  menuItem?: boolean
}) {
  const flowClass = {
    income: styles.operationIncome,
    expense: styles.operationExpense,
    transfer: styles.operationTransfer,
    asset: styles.operationAsset,
  }[card.flow]

  return (
    <button
      type="button"
      onClick={() => onSelect(card.type)}
      data-testid={`operation-type-${card.type}`}
      className={`${styles.operation} ${flowClass}`}
      data-operation-flow={card.flow}
      role={menuItem ? 'menuitem' : undefined}
    >
      <span className={styles.operationIcon}><OperationTypeIcon operationType={card.type} size={18} /></span>
      <span>
        <strong>{card.label}</strong>
        <small>{card.description}</small>
      </span>
    </button>
  )
}

function OperationGroups({
  onSelect,
  menuItem = false,
}: {
  onSelect: (type: OperationType) => void
  menuItem?: boolean
}) {
  return (
    <div className={styles.operationGroups}>
      {OPERATION_GROUPS.map(group => (
        <section
          key={group.id}
          className={styles.operationGroup}
          data-operation-group={group.id}
          role="group"
          aria-label={group.label}
        >
          <h3 className={styles.operationGroupHeading}>{group.label}</h3>
          <div className={styles.operationGroupItems}>
            {group.items.map(card => (
              <OperationButton key={card.type} card={card} onSelect={onSelect} menuItem={menuItem} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function OperationTypeSelector({ onSelect }: OperationTypeSelectorProps) {
  return (
    <div className={styles.operationSelector}>
      <OperationGroups onSelect={onSelect} />
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
