'use client'

import { FilterBar } from '@/components/finance'
import { AppSelect, type AppSelectOption } from '@/components/ui/AppSelect'

export type TypeFilter = 'all' | 'CRITICAL' | 'OPERATIONAL' | 'SUGGESTION'
export type ModuleFilter = 'all' | 'credits' | 'budgets' | 'receivables' | 'payables' | 'recurring' | 'alerts'

interface AlertFiltersProps {
  typeFilter: TypeFilter
  moduleFilter: ModuleFilter
  onTypeChange: (value: TypeFilter) => void
  onModuleChange: (value: ModuleFilter) => void
  originModuleOptions: AppSelectOption[]
}

export function AlertFilters({
  typeFilter,
  moduleFilter,
  onTypeChange,
  onModuleChange,
  originModuleOptions,
}: AlertFiltersProps) {
  return (
    <FilterBar className="justify-start md:justify-end">
      <AppSelect
        value={typeFilter}
        onChange={value => onTypeChange(value as TypeFilter)}
        className="filters-control w-full sm:w-[176px]"
        ariaLabel="Filtrar avisos por severidad"
        testId="alerts-severity-filter"
        compact
        searchable={false}
        matchTriggerWidth
        options={[
          { value: 'all', label: 'Todas las severidades' },
          { value: 'CRITICAL', label: 'Críticas' },
          { value: 'OPERATIONAL', label: 'Operativas' },
          { value: 'SUGGESTION', label: 'Sugerencias' },
        ]}
      />
      <AppSelect
        value={moduleFilter}
        onChange={value => onModuleChange(value as ModuleFilter)}
        className="filters-control w-full sm:w-[196px]"
        ariaLabel="Filtrar avisos por módulo de origen"
        testId="alerts-module-filter"
        compact
        searchable={false}
        matchTriggerWidth
        options={originModuleOptions}
      />
    </FilterBar>
  )
}
