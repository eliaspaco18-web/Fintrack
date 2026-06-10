'use client'

import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
} from 'react'
import {
  formatNumericForDisplay,
  getStepPrecision,
  normalizeForStore,
  normalizeNumericInput,
} from '@/lib/utils/numeric-input'

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  value?: string | number | readonly string[]
  defaultValue?: string | number | readonly string[]
  decimals?: number
  allowNegative?: boolean
  padOnBlur?: boolean
  onValueChange?: (value: string) => void
}

function stripTrailingDot(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value
}

function emitSyntheticChange(
  handler: NumericInputProps['onChange'],
  name: string | undefined,
  value: string,
) {
  if (!handler) return
  const syntheticEvent = {
    target: { name, value },
    currentTarget: { name, value },
  } as unknown as ChangeEvent<HTMLInputElement>
  handler(syntheticEvent)
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  function NumericInput({
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    onValueChange,
    decimals,
    allowNegative = false,
    step,
    className = '',
    inputMode,
    ...props
  }, ref) {
    const resolvedDecimals = useMemo(
      () => Math.max(0, decimals ?? getStepPrecision(step)),
      [decimals, step],
    )

    const isControlled = value !== undefined
    const controlledRaw = useMemo(
      () => normalizeNumericInput(value, { decimals: resolvedDecimals, allowNegative }),
      [allowNegative, resolvedDecimals, value],
    )

    const [internalRaw, setInternalRaw] = useState<string>(() => normalizeNumericInput(
      defaultValue ?? '',
      { decimals: resolvedDecimals, allowNegative },
    ))
    const [isFocused, setIsFocused] = useState(false)
    const [focusedRaw, setFocusedRaw] = useState<string | null>(null)

    const storedRaw = isControlled ? controlledRaw : internalRaw
    const activeRaw = isFocused ? (focusedRaw ?? storedRaw) : storedRaw

    useEffect(() => {
      if (isControlled || !isFocused) return
      setFocusedRaw(internalRaw)
    }, [internalRaw, isControlled, isFocused])

    useEffect(() => {
      if (!isControlled || isFocused) return
      setFocusedRaw(null)
    }, [controlledRaw, isControlled, isFocused])

    const displayValue = useMemo(() => {
      if (isFocused) {
        return formatNumericForDisplay(activeRaw, {
          decimals: resolvedDecimals,
          allowNegative,
          padDecimals: false,
        })
      }

      return formatNumericForDisplay(storedRaw, {
        decimals: resolvedDecimals,
        allowNegative,
        padDecimals: true,
      })
    }, [activeRaw, allowNegative, isFocused, resolvedDecimals, storedRaw])

    const commitValue = (nextRaw: string) => {
      const payload = stripTrailingDot(nextRaw)

      if (!isControlled) {
        setInternalRaw(payload)
      }

      onValueChange?.(payload)
      emitSyntheticChange(onChange, props.name, payload)
    }

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const normalized = normalizeNumericInput(event.target.value, {
        decimals: resolvedDecimals,
        allowNegative,
      })
      setFocusedRaw(normalized)
      commitValue(normalized)
    }

    const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      setFocusedRaw(storedRaw)
      onFocus?.(event)
    }

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
      const finalized = normalizeForStore(focusedRaw ?? storedRaw, {
        decimals: resolvedDecimals,
        allowNegative,
      })
      setIsFocused(false)
      setFocusedRaw(null)
      commitValue(finalized)

      if (onBlur) {
        const syntheticBlur = {
          ...event,
          target: { ...(event.target as HTMLInputElement), name: props.name, value: finalized },
          currentTarget: { ...(event.currentTarget as HTMLInputElement), name: props.name, value: finalized },
        } as FocusEvent<HTMLInputElement>
        onBlur(syntheticBlur)
      }
    }

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        step={step}
        value={displayValue}
        inputMode={inputMode ?? (resolvedDecimals > 0 ? 'decimal' : 'numeric')}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={className}
      />
    )
  },
)
