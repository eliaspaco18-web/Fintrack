'use client'

import { useCallback, useState } from 'react'
import { IncomeDatePicker } from '@/components/forms/TransactionForm/IncomeDatePicker'

/** Credit schedule date input; keeps ISO values while using the approved V3 calendar. */
export function CreditScheduleDateField({
  value,
  onChange,
  label,
  testId,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  testId: string
  disabled?: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const handleChange = useCallback((next: string) => {
    onChange(next)
    setError(null)
  }, [onChange])

  return (
    <div className="min-w-[156px]">
      <IncomeDatePicker
        value={value}
        onChange={handleChange}
        onInvalidInput={setError}
        error={error ?? undefined}
        inputLabel={label}
        inputTestId={testId}
        disabled={disabled}
      />
    </div>
  )
}
