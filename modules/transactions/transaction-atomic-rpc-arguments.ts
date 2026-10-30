import type { AtomicTransactionPayload } from './transaction.service.types'

type DerivedJsonbArguments = Pick<
  AtomicTransactionPayload,
  'p_asset' | 'p_credit' | 'p_loan' | 'p_receivable' | 'p_payable'
>

/** PostgREST serializes RPC arguments; jsonb values must remain objects. */
export function atomicDerivedJsonbArguments(
  payload: DerivedJsonbArguments,
): DerivedJsonbArguments {
  return {
    p_asset: payload.p_asset,
    p_credit: payload.p_credit,
    p_loan: payload.p_loan,
    p_receivable: payload.p_receivable,
    p_payable: payload.p_payable,
  }
}
