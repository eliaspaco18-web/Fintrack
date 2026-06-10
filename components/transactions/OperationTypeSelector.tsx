'use client'

// =============================================================================
// OperationTypeSelector — PRD v3 §3: Primer paso al crear una transacción.
// El usuario elige entre 6 tipos de operación antes de ver el formulario.
// =============================================================================

/**
 * Tipo de operación según PRD v3:
 *   - income:          Ingreso directo
 *   - expense:         Egreso directo
 *   - transfer:        Transferencia entre cuentas propias
 *   - asset_purchase:  Compra de activo (tipo Egreso, relacionado con módulo ACTIVOS)
 *   - payable:         Cuentas por pagar (tipo Ingreso, relacionado con módulo POR PAGAR)
 *   - receivable:      Cuentas por cobrar (tipo Egreso, relacionado con módulo POR COBRAR)
 */
export type OperationType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'asset_purchase'
  | 'payable'
  | 'receivable'

interface OperationCard {
  type: OperationType
  label: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
  priority: 'primary' | 'secondary'
}

import React from 'react'

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
  {
    type: 'payable',
    label: 'Registrar cuenta por pagar',
    description: 'Crear una obligación pendiente',
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
    priority: 'secondary',
  },
  {
    type: 'receivable',
    label: 'Registrar cuenta por cobrar',
    description: 'Crear un cobro pendiente',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(6,182,212,0.25)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    priority: 'secondary',
  },
]

interface OperationTypeSelectorProps {
  onSelect: (type: OperationType) => void
}

export function OperationTypeSelector({ onSelect }: OperationTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
          Nueva transacción
        </p>
        <p className="max-w-[48ch] text-[13px] leading-5 text-[var(--c-text-muted)]">
          Elige el movimiento que quieres registrar. Las tres opciones principales aparecen primero.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {OPERATION_CARDS.map(card => (
          <button
            key={card.type}
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
        ))}
      </div>
    </div>
  )
}

/**
 * Convierte un OperationType del PRD al initialValues del TransactionForm existente.
 * Mantiene compatibilidad con el orchestrator actual.
 */
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
    case 'payable':
      return { type: 'INCOME', creates_payable: true }
    case 'receivable':
      return { type: 'EXPENSE', creates_receivable: true }
    default:
      return { type: 'EXPENSE' }
  }
}

/** Devuelve el título del formulario según el tipo de operación */
export function operationTypeLabel(operationType: OperationType): string {
  const card = OPERATION_CARDS.find(c => c.type === operationType)
  return card?.label ?? 'Transacción'
}
