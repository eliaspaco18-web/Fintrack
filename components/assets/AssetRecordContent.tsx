import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatCurrency, formatDateLabel } from '@/lib/contracts/ui.contracts'
import {
  getAssetStatusPresentation,
  getAssetPurchaseValue,
  getAssetTypePresentation,
  getRecordedAssetValue,
  type AssetWithTypeInfo,
} from '@/modules/assets/asset-presentation'

type AssetTransaction = {
  id: string
  description: string | null
  source_account?: { id: string; name: string } | null
} | null

function displayAmount(value: number | null, currency: string) {
  if (value === null) return 'No verificable'
  if (currency === 'PEN' || currency === 'USD') return formatCurrency(value, currency)
  return `${currency || 'Moneda no verificable'} ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-[var(--ft-border)] py-3 last:border-0">
      <p className="text-[11px] font-medium leading-4 text-[var(--ft-text-muted)]">{label}</p>
      <div className="mt-1 break-words text-[13px] font-medium leading-5 text-[var(--ft-text-strong)]">{children}</div>
    </div>
  )
}

export function AssetRecordContent({ asset, transaction }: { asset: AssetWithTypeInfo; transaction?: AssetTransaction }) {
  const status = getAssetStatusPresentation(asset.status)
  const type = getAssetTypePresentation(asset)
  const currentValue = getRecordedAssetValue(asset)
  const purchaseValue = getAssetPurchaseValue(asset)

  return (
    <div className="space-y-5" data-testid="asset-record-content">
      <section aria-label="Valores registrados" className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ft-text-muted)]">Valor actual registrado</p>
            <p className="mt-1 text-[26px] font-semibold leading-8 tracking-[-0.04em] tabular-nums text-[var(--ft-text-strong)]">
              {displayAmount(currentValue, asset.currency)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--ft-text-strong)]">{type.label}</span>
            <span className="rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--ft-text-strong)]">{status.label}</span>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-5 text-[var(--ft-text-muted)]">Importe registrado por ti; no representa una tasación automática ni un valor de mercado.</p>
      </section>

      <section aria-labelledby="asset-record-purchase-heading" className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] px-4 sm:px-5">
        <h3 id="asset-record-purchase-heading" className="border-b border-[var(--ft-border)] py-3 text-[13px] font-semibold text-[var(--ft-text-strong)]">Compra y registro</h3>
        <div className="grid gap-x-8 sm:grid-cols-2">
          <Fact label="Valor de compra">{displayAmount(purchaseValue, asset.currency)}</Fact>
          <Fact label="Moneda original">{asset.currency || 'No verificable'}</Fact>
          <Fact label="Fecha de compra">{formatDateLabel(asset.purchase_date)}</Fact>
          <Fact label="Tipo de activo">{type.label}{type.source === 'CUSTOM' ? ' · Personalizado' : ''}</Fact>
          {asset.recipient ? <Fact label="Proveedor o destinatario">{asset.recipient}</Fact> : null}
          {asset.serial_number ? <Fact label="Número de serie">{asset.serial_number}</Fact> : null}
          {asset.location ? <Fact label="Ubicación">{asset.location}</Fact> : null}
          {asset.depreciation_rate != null && Number.isFinite(asset.depreciation_rate) ? <Fact label="Tasa de depreciación registrada">{new Intl.NumberFormat('es-PE', { style: 'percent', maximumFractionDigits: 2 }).format(asset.depreciation_rate)}</Fact> : null}
        </div>
        {asset.notes ? <div className="border-t border-[var(--ft-border)] py-3"><p className="text-[11px] font-medium text-[var(--ft-text-muted)]">Notas</p><p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-[var(--ft-text-strong)]">{asset.notes}</p></div> : null}
      </section>

      <section aria-labelledby="asset-record-origin-heading" className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] px-4 sm:px-5">
        <h3 id="asset-record-origin-heading" className="border-b border-[var(--ft-border)] py-3 text-[13px] font-semibold text-[var(--ft-text-strong)]">Origen de compra</h3>
        {transaction ? (
          <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--ft-text-strong)]">{transaction.description || 'Compra de activo'}</p>
              <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">{transaction.source_account?.name ?? 'Cuenta de origen no disponible'}</p>
            </div>
            <Link className="shrink-0 text-[12px] font-semibold text-[var(--ft-primary)] underline-offset-2 hover:underline" href={`/transactions/${transaction.id}`}>Ver movimiento</Link>
          </div>
        ) : (
          <p className="py-3 text-[12px] leading-5 text-[var(--ft-text-muted)]">No hay una transacción de compra vinculada verificable.</p>
        )}
      </section>

      {asset.attachment_url ? (
        <section className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] p-4 sm:p-5">
          <p className="text-[12px] font-semibold text-[var(--ft-text-strong)]">Referencia histórica de comprobante</p>
          <p className="mt-1 break-all text-[12px] leading-5 text-[var(--ft-text-muted)]">{asset.attachment_url}</p>
        </section>
      ) : null}
    </div>
  )
}
