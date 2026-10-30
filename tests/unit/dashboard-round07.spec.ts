import { expect, test } from '@playwright/test'
import {
  currentLimaPeriod, documentedAgenda, documentedPending, nativeAccountPosition,
  type DashboardObligation,
} from '@/lib/dashboard/round07'

test('the account position excludes inactive and technical card accounts without converting currencies', () => {
  const result = nativeAccountPosition([
    { id: 'a', type: 'CHECKING', currency: 'PEN', balance: 120, is_active: true },
    { id: 'b', type: 'SAVINGS', currency: 'USD', balance: 80, is_active: true },
    { id: 'c', type: 'CREDIT_CARD', currency: 'PEN', balance: -30, is_active: true },
    { id: 'd', type: 'CASH', currency: 'PEN', balance: 500, is_active: false },
  ])
  expect(result).toEqual({ count: 2, amounts: [{ currency: 'PEN', value: 120 }, { currency: 'USD', value: 80 }] })
})

test('the documented pending position keeps open PEN and USD separate and reports unknown currency', () => {
  const result = documentedPending([
    { id: 'a', amount: 200, collected_amount: 50, currency: 'PEN', status: 'PARTIAL', due_date: null, concept: null },
    { id: 'b', amount: 100, collected_amount: 0, currency: 'USD', status: 'PENDING', due_date: null, concept: null },
    { id: 'c', amount: 90, collected_amount: 0, currency: 'PEN', status: 'COLLECTED', due_date: null, concept: null },
    { id: 'd', amount: 60, collected_amount: 0, currency: null, status: 'PENDING', due_date: null, concept: null },
  ], 'collected_amount')
  expect(result).toEqual({ amounts: [{ currency: 'PEN', value: 150 }, { currency: 'USD', value: 100 }], unverified: 1, openCount: 3 })
})

test('the agenda includes overdue and in-window documents but never invents a due date', () => {
  const source: DashboardObligation[] = [
    { id: 'past', amount: 100, collected_amount: 0, currency: 'PEN', status: 'PENDING', due_date: '2026-10-08', concept: 'Past' },
    { id: 'soon', amount: 200, collected_amount: 50, currency: 'USD', status: 'PARTIAL', due_date: '2026-10-12', concept: 'Soon' },
    { id: 'undated', amount: 50, collected_amount: 0, currency: 'PEN', status: 'PENDING', due_date: null, concept: 'No date' },
    { id: 'later', amount: 50, collected_amount: 0, currency: 'PEN', status: 'PENDING', due_date: '2026-11-20', concept: 'Later' },
  ]
  expect(documentedAgenda(source, [], '2026-10-09', 7).map(item => item.id)).toEqual(['past', 'soon'])
  expect(documentedAgenda(source, [], '2026-10-09', 7)[1]?.pending).toBe(150)
})

test('the period is based on Lima rather than UTC', () => {
  expect(currentLimaPeriod(new Date('2026-10-10T02:00:00Z'))).toEqual({ iso: '2026-10-09', month: '2026-10', day: 9 })
})
