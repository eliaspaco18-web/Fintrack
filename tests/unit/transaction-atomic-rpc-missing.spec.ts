import { expect, test } from '@playwright/test'
import { TransactionService } from '@/modules/transactions/transaction.service'
import type { AtomicTransactionPayload } from '@/modules/transactions/transaction.service.types'

test('missing atomic transaction RPC fails closed before any table write', async () => {
  let tableWrites = 0
  let rpcCalls = 0
  const db = {
    rpc: async () => {
      rpcCalls += 1
      return { data: null, error: { message: 'Could not find the function public.create_transaction_atomic' } }
    },
    from: () => {
      tableWrites += 1
      throw new Error('unexpected fallback write')
    },
  }
  const payload: AtomicTransactionPayload = {
    p_user_id: 'synthetic-user',
    p_source_account_id: 'synthetic-account',
    p_destination_account_id: null,
    p_category_id: null,
    p_budget_id: null,
    p_budget_period_id: null,
    p_type: 'EXPENSE',
    p_amount: 100,
    p_currency: 'PEN',
    p_exchange_rate: 1,
    p_description: 'fixture only',
    p_transaction_date: '2026-10-25',
    p_notes: null,
    p_is_recurring: false,
    p_sender: null,
    p_recipient: null,
    p_asset: { name: 'fixture asset', asset_type: 'OTHER', purchase_date: '2026-10-25', current_value: 100 },
    p_credit: null,
    p_loan: null,
    p_receivable: null,
    p_payable: null,
  }

  const service = new TransactionService(db as never)
  const result = await (service as unknown as {
    callAtomicFunction(input: AtomicTransactionPayload): Promise<{ ok: boolean; error?: { code: string } }>
  }).callAtomicFunction(payload)

  expect(rpcCalls).toBe(1)
  expect(tableWrites).toBe(0)
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe('ATOMICITY_FAILURE')
})

test('credit-operation preflight detects a missing atomic RPC before module writes', async () => {
  let rpcCalls = 0
  let tableWrites = 0
  let preflightType = ''
  const db = {
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      rpcCalls += 1
      preflightType = String(args.p_type)
      return { data: null, error: { message: 'Could not find the function public.create_transaction_atomic' } }
    },
    from: () => {
      tableWrites += 1
      throw new Error('unexpected write before atomic RPC preflight')
    },
  }
  const service = new TransactionService(db as never)
  const payload: AtomicTransactionPayload = {
    p_user_id: 'synthetic-user', p_source_account_id: 'synthetic-account', p_destination_account_id: null,
    p_category_id: null, p_budget_id: null, p_budget_period_id: null, p_type: 'EXPENSE', p_amount: 10,
    p_currency: 'PEN', p_exchange_rate: 1, p_description: 'fixture', p_transaction_date: '2026-10-25',
    p_notes: null, p_is_recurring: false, p_sender: null, p_recipient: null, p_asset: null, p_credit: null,
    p_loan: null, p_receivable: null, p_payable: null,
  }
  const result = await (service as unknown as {
    verifyAtomicFunctionAvailable(input: AtomicTransactionPayload): Promise<{ ok: boolean; error?: { code: string } }>
  }).verifyAtomicFunctionAvailable(payload)

  expect(rpcCalls).toBe(1)
  expect(preflightType).toBe('__FINTRACK_ATOMIC_RPC_PREFLIGHT__')
  expect(tableWrites).toBe(0)
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe('ATOMICITY_FAILURE')
})

test('derived-operation preflight accepts the converged RPC authorization guard', async () => {
  const db = {
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      expect(args.p_type).toBe('__FINTRACK_ATOMIC_RPC_PREFLIGHT__')
      expect(args.p_user_id).toBe('00000000-0000-0000-0000-000000000000')
      return { data: null, error: { message: 'Not authorized to create this transaction' } }
    },
    from: () => { throw new Error('preflight must not query/write tables') },
  }
  const service = new TransactionService(db as never)
  const payload: AtomicTransactionPayload = {
    p_user_id: 'synthetic-user', p_source_account_id: 'synthetic-account', p_destination_account_id: null,
    p_category_id: null, p_budget_id: null, p_budget_period_id: null, p_type: 'EXPENSE', p_amount: 10,
    p_currency: 'PEN', p_exchange_rate: 1, p_description: 'fixture', p_transaction_date: '2026-10-25',
    p_notes: null, p_is_recurring: false, p_sender: null, p_recipient: null, p_asset: null, p_credit: null,
    p_loan: null, p_receivable: null, p_payable: null,
  }
  const result = await (service as unknown as {
    verifyAtomicFunctionAvailable(input: AtomicTransactionPayload): Promise<{ ok: boolean; error?: { code: string } }>
  }).verifyAtomicFunctionAvailable(payload)

  expect(result.ok).toBe(true)
})

test('derived-operation preflight fails closed on old RPC behavior, permission or signature errors', async () => {
  const db = {
    rpc: async () => ({ data: null, error: { message: 'invalid input value for enum transaction_type' } }),
    from: () => { throw new Error('preflight must not query/write tables') },
  }
  const service = new TransactionService(db as never)
  const payload: AtomicTransactionPayload = {
    p_user_id: 'synthetic-user', p_source_account_id: 'synthetic-account', p_destination_account_id: null,
    p_category_id: null, p_budget_id: null, p_budget_period_id: null, p_type: 'EXPENSE', p_amount: 10,
    p_currency: 'PEN', p_exchange_rate: 1, p_description: 'fixture', p_transaction_date: '2026-10-25',
    p_notes: null, p_is_recurring: false, p_sender: null, p_recipient: null, p_asset: null, p_credit: null,
    p_loan: null, p_receivable: null, p_payable: null,
  }
  const result = await (service as unknown as {
    verifyAtomicFunctionAvailable(input: AtomicTransactionPayload): Promise<{ ok: boolean; error?: { code: string } }>
  }).verifyAtomicFunctionAvailable(payload)

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe('ATOMICITY_FAILURE')
})

test('missing atomic RPC cannot partially create any derived financial record', async () => {
  let tableWrites = 0
  const db = {
    rpc: async () => ({ data: null, error: { message: 'function create_transaction_atomic does not exist' } }),
    from: () => { tableWrites += 1; throw new Error('unexpected non-atomic write') },
  }
  const service = new TransactionService(db as never)
  const callAtomic = (service as unknown as {
    callAtomicFunction(input: AtomicTransactionPayload): Promise<{ ok: boolean; error?: { code: string } }>
  }).callAtomicFunction.bind(service)
  const base: AtomicTransactionPayload = {
    p_user_id: 'synthetic-user', p_source_account_id: 'synthetic-account', p_destination_account_id: null,
    p_category_id: null, p_budget_id: null, p_budget_period_id: null, p_type: 'EXPENSE', p_amount: 10,
    p_currency: 'PEN', p_exchange_rate: 1, p_description: 'fixture', p_transaction_date: '2026-10-25',
    p_notes: null, p_is_recurring: false, p_sender: null, p_recipient: null, p_asset: null, p_credit: null,
    p_loan: null, p_receivable: null, p_payable: null,
  }
  const derivedPayloads: AtomicTransactionPayload[] = [
    { ...base, p_asset: { name: 'fixture asset', asset_type: 'OTHER', current_value: 10, purchase_date: '2026-10-25' } },
    { ...base, p_credit: { credit_type: 'CREDIT_CARD', name: 'fixture card', credit_limit: 10, interest_rate: 0 } },
    { ...base, p_loan: { creditor_name: 'fixture lender', interest_rate: 0, total_installments: 1, start_date: '2026-10-25', end_date: '2026-11-25', generate_schedule: false } },
    { ...base, p_receivable: { debtor_name: 'fixture debtor' } },
    { ...base, p_payable: { creditor_name: 'fixture creditor' } },
  ]

  for (const payload of derivedPayloads) {
    const result = await callAtomic(payload)
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('ATOMICITY_FAILURE')
  }
  expect(tableWrites).toBe(0)
})
