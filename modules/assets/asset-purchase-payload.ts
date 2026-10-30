import type { TransactionFormValues } from '@/lib/contracts/ui.contracts'
import type { CreateAssetModuleInput } from '@/modules/transactions/transaction.service.types'

/** Map the approved purchase form's asset-specific fields into its linked asset record. */
export function buildAssetPurchaseModulePayload(
  values: TransactionFormValues,
): CreateAssetModuleInput {
  return {
    name: values.asset_name!,
    asset_type: values.asset_type ?? 'OTHER',
    asset_type_id: values.asset_type_id || undefined,
    purchase_value: Number(values.amount),
    serial_number: values.asset_serial || undefined,
    location: values.asset_location || undefined,
    notes: values.notes?.trim() || undefined,
  }
}
