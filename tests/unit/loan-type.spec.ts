import { expect, test } from '@playwright/test'
import { LOAN_TYPE_VALUES, getLoanTypeLabel } from '@/modules/loans/loan-type'

test.describe('loan type classification', () => {
  test('uses a controlled label for every supported market comparison type', () => {
    expect(LOAN_TYPE_VALUES.map(getLoanTypeLabel)).toEqual([
      'Consumo personal',
      'Vehicular',
      'Hipotecario',
      'Pequeña empresa',
      'Microempresa',
      'Otro',
    ])
  })

  test('does not display an unrecognized persisted value as a known type', () => {
    expect(getLoanTypeLabel('UNRECOGNIZED')).toBe('No especificado')
  })
})
