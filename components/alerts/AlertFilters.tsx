'use client'

// =============================================================================
// components/alerts/AlertFilters.tsx
// PRD v3 — Módulo 9: Filtros compactos para la Risk Inbox
// =============================================================================

import { FilterBar } from '@/components/finance'
import { AppSelect } from '@/components/ui/AppSelect'

export type TypeFilter   = 'all' | 'CRITICAL' | 'OPERATIONAL' | 'SUGGESTION'
export type ReadFilter   = 'all' | 'unread' | 'read'
export type ModuleFilter = 'all' | 'credits' | 'budgets' | 'receivables' | 'payables' | 'recurring'

interface AlertFiltersProps {
  typeFilter:    TypeFilter
  readFilter:    ReadFilter
  moduleFilter:  ModuleFilter
  onTypeChange:   (v: TypeFilter)   => void
  onReadChange:   (v: ReadFilter)   => void
  onModuleChange: (v: ModuleFilter) => void
}

export function AlertFilters({
  typeFilter,
  readFilter,
  moduleFilter,
  onTypeChange,
  onReadChange,
  onModuleChange,
}: AlertFiltersProps) {
  return (
    <FilterBar className="justify-start md:justify-end">
      <AppSelect
        value={typeFilter}
        onChange={v => onTypeChange(v as TypeFilter)}
        className="filters-control sm:w-[176px]"
        compact
        searchable={false}
        options={[
          { value: 'all',         label: 'Todas las prioridades' },
          { value: 'CRITICAL',    label: 'Críticas'              },
          { value: 'OPERATIONAL', label: 'Operativas'            },
          { value: 'SUGGESTION',  label: 'Sugerencias'           },
        ]}
      />
      <AppSelect
        value={readFilter}
        onChange={v => onReadChange(v as ReadFilter)}
        className="filters-control sm:w-[164px]"
        compact
        searchable={false}
        options={[
          { value: 'all',    label: 'Todos los estados' },
          { value: 'unread', label: 'Pendientes'         },
          { value: 'read',   label: 'Resueltas'          },
        ]}
      />
      <AppSelect
        value={moduleFilter}
        onChange={v => onModuleChange(v as ModuleFilter)}
        className="filters-control sm:w-[196px]"
        compact
        searchable={false}
        options={[
          { value: 'all',         label: 'Todos los módulos'   },
          { value: 'credits',     label: 'Créditos'            },
          { value: 'budgets',     label: 'Presupuestos'        },
          { value: 'receivables', label: 'Cuentas por cobrar'  },
          { value: 'payables',    label: 'Cuentas por pagar'   },
          { value: 'recurring',   label: 'Recurrentes'         },
        ]}
      />
    </FilterBar>
  )
}
