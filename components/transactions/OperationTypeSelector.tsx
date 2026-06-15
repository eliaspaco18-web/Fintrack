'use client'

// =============================================================================
// OperationTypeSelector — PRD v3 §3: Primer paso al crear una transacción.
// Separa operaciones directas de módulos con subflujo (por cobrar / por pagar).
// =============================================================================

import React from 'react'

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
  type: Exclude<OperationType, 'receivable_issue' | 'receivable_collect' | 'payable_issue' | 'payable_pay'>
  label: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
  priority: 'primary' | 'secondary'
}

interface ModuleAction {
  type: Extract<OperationType, 'receivable_issue' | 'receivable_collect' | 'payable_issue' | 'payable_pay'>
  label: string
  description: string
}

interface ModuleCardConfig {
  key: 'receivable' | 'payable'
  label: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
  actions: ModuleAction[]
}

const OPERATION_CARDS: OperationCard[] = [
  {
    type: 'income',
    label: 'Ingreso',
    description: 'Dinero que entra a tu cuenta',
    color: 'var(--c-primary)',
    bgColor: 'var(--c-primary-soft)',
    borderColor: 'var(--c-primary-border)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
    ),
    priority: 'primary',
  },
  {
    type: 'expense',
    label: 'Egreso',
    description: 'Dinero que sale de tu cuenta',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.25)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12l7 7 7-7"/>
      </svg>
    ),
    priority: 'primary',
  },
  {
    type: 'transfer',
    label: 'Transferencia',
    description: 'Entre tus propias cuentas',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.25)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 16V4m0 0-4 4m4-4 4 4"/>
        <path d="M17 8v12m0 0-4-4m4 4 4-4"/>
      </svg>
    ),
    priority: 'primary',
  },
  {
    type: 'asset_purchase',
    label: 'Compra de Activo',
    description: 'Registrar un activo nuevo',
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.08)',
    borderColor: 'rgba(139,92,246,0.25)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
    priority: 'secondary',
  },
]

const MODULE_CARDS: ModuleCardConfig[] = [
  {
    key: 'receivable',
    label: 'Ctas por cobrar',
    description: 'Crea pendientes o registra el cobro de una cuenta abierta.',
    color: '#0891b2',
    bgColor: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(6,182,212,0.25)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    actions: [
      {
        type: 'receivable_issue',
        label: 'Egreso',
        description: 'Crear cuenta por cobrar',
      },
      {
        type: 'receivable_collect',
        label: 'Ingreso',
        description: 'Registrar cobro',
      },
    ],
  },
  {
    key: 'payable',
    label: 'Ctas por pagar',
    description: 'Crea obligaciones pendientes o registra el pago de una cuenta abierta.',
    color: '#f97316',
    bgColor: 'rgba(249,115,22,0.08)',
    borderColor: 'rgba(249,115,22,0.25)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
      </svg>
    ),
    actions: [
      {
        type: 'payable_issue',
        label: 'Ingreso',
        description: 'Crear cuenta por pagar',
      },
      {
        type: 'payable_pay',
        label: 'Egreso',
        description: 'Registrar pago',
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
      className={`
        group relative flex min-h-[108px] flex-col items-start gap-2 rounded-[14px] border px-4 py-4 text-left
        transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out
        hover:-translate-y-px active:translate-y-0 active:scale-[0.98]
        ${card.priority === 'primary' ? 'bg-[var(--c-surface)]' : 'bg-[var(--c-surface-2)]/55'}
      `}
      style={{
        borderColor: card.borderColor,
        boxShadow: card.priority === 'primary'
          ? '0 1px 2px rgba(25,25,23,0.04)'
          : 'none',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-4 top-0 h-px rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${card.borderColor}, transparent)` }}
      />
      <span
        className="flex h-10 w-10 items-center justify-center rounded-[12px] transition-transform duration-150 group-hover:scale-[1.03]"
        style={{ color: card.color, backgroundColor: card.bgColor }}
      >
        {card.icon}
      </span>
      <div className="space-y-1">
        <span className="block text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
          {card.label}
        </span>
        <span
          className={`
            block leading-[1.4]
            ${card.priority === 'primary'
              ? 'text-[12px] text-[var(--c-text-muted)]'
              : 'text-[11px] text-[var(--c-text-faint)]'}
          `}
        >
          {card.description}
        </span>
      </div>
    </button>
  )
}

function ModuleOperationCard({
  card,
  onSelect,
}: {
  card: ModuleCardConfig
  onSelect: (type: OperationType) => void
}) {
  return (
    <div
      className="rounded-[16px] border bg-[var(--c-surface-2)]/55 p-4"
      style={{ borderColor: card.borderColor }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[12px]"
          style={{ color: card.color, backgroundColor: card.bgColor }}
        >
          {card.icon}
        </span>
        <div className="space-y-1">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
            {card.label}
          </p>
          <p className="text-[11px] leading-[1.45] text-[var(--c-text-faint)]">
            {card.description}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {card.actions.map(action => (
          <button
            key={action.type}
            type="button"
            data-testid={`operation-type-${action.type}`}
            onClick={() => onSelect(action.type)}
            className="rounded-[12px] border bg-[var(--c-surface)] px-3.5 py-3 text-left transition-colors hover:border-[color:var(--c-primary-border)] hover:bg-[var(--c-primary)]/4"
            style={{ borderColor: 'var(--c-border)' }}
          >
            <p className="text-[12px] font-semibold text-[var(--c-text)]">
              {action.label}
            </p>
            <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
              {action.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

export function OperationTypeSelector({ onSelect }: OperationTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
          Nueva transacción
        </p>
        <p className="max-w-[52ch] text-[13px] leading-5 text-[var(--c-text-muted)]">
          Elige primero el flujo general. En cuentas por cobrar y por pagar ahora puedes separar crear el pendiente de cobrarlo o pagarlo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {OPERATION_CARDS.map(card => (
          <OperationCardButton key={card.type} card={card} onSelect={onSelect} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {MODULE_CARDS.map(card => (
          <ModuleOperationCard key={card.key} card={card} onSelect={onSelect} />
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
