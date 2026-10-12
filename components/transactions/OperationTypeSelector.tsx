'use client'

// =============================================================================
// OperationTypeSelector — Astra Round 07 operation-grid structure, connected
// to FinTrack's existing eight operation flows.
// =============================================================================

import React from 'react'
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

interface OperationCard {
  type: OperationType
  label: string
  description: string
}

interface ModuleAction {
  type: Extract<OperationType, 'receivable_issue' | 'receivable_collect' | 'payable_issue' | 'payable_pay'>
  label: string
  description: string
}

interface ModuleCardConfig {
  actions: ModuleAction[]
}

const OPERATION_CARDS: OperationCard[] = [
  {
    type: 'income',
    label: 'Ingreso',
    description: 'Dinero que recibiste',
  },
  {
    type: 'expense',
    label: 'Egreso',
    description: 'Un gasto de tu día a día',
  },
  {
    type: 'transfer',
    label: 'Transferencia',
    description: 'Entre tus cuentas',
  },
  {
    type: 'asset_purchase',
    label: 'Compra de activo',
    description: 'Un bien que conservarás',
  },
]

const MODULE_CARDS: ModuleCardConfig[] = [
  {
    actions: [
      {
        type: 'receivable_issue',
        label: 'Prestar dinero',
        description: 'Crea un pendiente por cobrar',
      },
      {
        type: 'receivable_collect',
        label: 'Cobrar',
        description: 'Reduce un pendiente registrado',
      },
    ],
  },
  {
    actions: [
      {
        type: 'payable_issue',
        label: 'Recibir un préstamo',
        description: 'Crea un pendiente por pagar',
      },
      {
        type: 'payable_pay',
        label: 'Pagar un pendiente',
        description: 'Reduce una obligación registrada',
      },
    ],
  },
]

const OPERATION_LABELS: Record<OperationType, string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  transfer: 'Transferencia',
  asset_purchase: 'Compra de Activo',
  receivable_issue: 'Registrar cuenta por cobrar',
  receivable_collect: 'Registrar cobro',
  payable_issue: 'Registrar cuenta por pagar',
  payable_pay: 'Registrar pago',
}

const ASTRA_ICON_PATHS: Record<OperationType, React.ReactNode> = {
  income: <path d="M7 7h10v10M17 7 7 17" />,
  expense: <path d="M7 17h10V7M7 17 17 7" />,
  transfer: <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />,
  asset_purchase: <path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7 5.8l9 5" />,
  receivable_issue: <path d="M7 17h10V7M7 17 17 7" />,
  receivable_collect: <path d="M7 7h10v10M17 7 7 17" />,
  payable_issue: <path d="M7 7h10v10M17 7 7 17" />,
  payable_pay: <path d="M7 17h10V7M7 17 17 7" />,
}

interface OperationTypeSelectorProps {
  onSelect: (type: OperationType) => void
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
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ASTRA_ICON_PATHS[card.type]}
      </svg>
      <span>
        <strong>{card.label}</strong>
        <small>{card.description}</small>
      </span>
    </button>
  )
}

export function OperationTypeSelector({ onSelect }: OperationTypeSelectorProps) {
  const moduleOperations = MODULE_CARDS.flatMap(module => module.actions.map(action => {
    return {
      type: action.type,
      label: action.label,
      description: action.description,
    }
  }))

  return (
    <div className={styles.operationSelector}>
      <div className={styles.operationGrid}>
        {[...OPERATION_CARDS, ...moduleOperations].map(card => (
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
  return OPERATION_LABELS[operationType] ?? 'Transacción'
}
