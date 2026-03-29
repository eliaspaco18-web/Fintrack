'use client'

import type { VisualIconOption } from '@/lib/constants/visual-options'
import { FinancialIcon } from './FinancialIcon'

interface IconGridPickerProps {
  value: string
  onChange: (value: string) => void
  options: readonly VisualIconOption[]
  wrapperTestId?: string
  optionTestIdPrefix?: string
}

export function IconGridPicker({
  value,
  onChange,
  options,
  wrapperTestId,
  optionTestIdPrefix,
}: IconGridPickerProps) {
  return (
    <div
      role="radiogroup"
      data-testid={wrapperTestId}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {options.map(option => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-testid={optionTestIdPrefix ? `${optionTestIdPrefix}-${option.value}` : undefined}
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-all ${
              isSelected
                ? 'border-emerald-400/70 bg-emerald-500/10 text-emerald-200'
                : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:border-[color:var(--color-border-hover)] hover:text-[var(--color-text)]'
            }`}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--color-border)] bg-[var(--color-surface)]">
              <FinancialIcon name={option.value} size={14}/>
            </span>
            <span className="truncate font-semibold">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

interface ColorSwatchPickerProps {
  value: string
  onChange: (value: string) => void
  palette: readonly string[]
  swatchTestIdPrefix?: string
  customInputTestId?: string
  wrapperTestId?: string
}

export function ColorSwatchPicker({
  value,
  onChange,
  palette,
  swatchTestIdPrefix,
  customInputTestId,
  wrapperTestId,
}: ColorSwatchPickerProps) {
  const normalized = value.toLowerCase()

  return (
    <div className="space-y-1.5" data-testid={wrapperTestId}>
      <div className="flex flex-wrap items-center gap-2">
        {palette.map(color => {
          const isSelected = normalized === color
          return (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              data-testid={swatchTestIdPrefix ? `${swatchTestIdPrefix}-${color.slice(1)}` : undefined}
              onClick={() => onChange(color)}
              className={`h-8 w-8 rounded-md border transition-all ${
                isSelected
                  ? 'border-white/65 ring-2 ring-emerald-400/70'
                  : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-hover)]'
              }`}
              style={{ backgroundColor: color }}
            />
          )
        })}
        <label className="inline-flex items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1">
          <span className="text-[11px] text-[var(--color-text-muted)]">Otro</span>
          <input
            type="color"
            value={value}
            onChange={event => onChange(event.target.value)}
            data-testid={customInputTestId}
            className="h-6 w-8 cursor-pointer rounded border border-[color:var(--color-border)] bg-transparent p-0"
          />
        </label>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">Seleccionado: {value.toUpperCase()}</p>
    </div>
  )
}
