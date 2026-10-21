'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { FormField, FormSection } from '@/components/forms/primitives'
import { IncomeDatePicker } from '@/components/forms/TransactionForm/IncomeDatePicker'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE } from '@/modules/attachments/attachment-integrity'
import styles from './AssetsListPanel.module.css'

type AccountOption = { id: string; name: string; type: string; currency: string; is_active: boolean }
type AssetTypeOption = { id: string; name: string; color: string | null; icon: string | null }
type AssetFormState = { dirty: boolean; saving: boolean; ready: boolean }
type FormValues = { name: string; account_id: string; asset_type_id: string; purchase_date: string; purchase_value: string; description: string; recipient: string; notes: string }

interface AssetsFormProps {
  onSuccess: (assetName: string) => void
  onFormStateChange: (state: AssetFormState) => void
}

const VALID_ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'STOCKS', 'ETF', 'CRYPTO', 'OTHER']
const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function AssetsForm({ onSuccess, onFormStateChange }: AssetsFormProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [form, setForm] = useState<FormValues>({ name: '', account_id: '', asset_type_id: '', purchase_date: todayIso(), purchase_value: '', description: '', recipient: '', notes: '' })
  const formRef = useRef(form)
  const dirtyRef = useRef(false)
  const initialFormRef = useRef(form)
  const validAccounts = useMemo(() => accounts.filter(account => account.is_active && VALID_ACCOUNT_TYPES.includes(account.type)), [accounts])
  const selectedAccount = validAccounts.find(account => account.id === form.account_id) ?? null
  const amount = parseNumericInput(form.purchase_value, 0)
  const ready = !loadingData && !referenceError && Boolean(selectedAccount)

  const update = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    const next = { ...formRef.current, [key]: value }
    formRef.current = next
    const changed = Object.keys(next).some(field => next[field as keyof FormValues] !== initialFormRef.current[field as keyof FormValues])
    dirtyRef.current = changed
    setDirty(changed)
    setForm(next)
    setError(null)
  }, [])

  const loadReferenceData = useCallback(async () => {
    setLoadingData(true)
    setReferenceError(null)
    try {
      const [accountResponse, typeResponse] = await Promise.all([
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/asset-types', { cache: 'no-store' }),
      ])
      const [accountJson, typeJson] = await Promise.all([
        accountResponse.json().catch(() => null),
        typeResponse.json().catch(() => null),
      ])
      if (!accountResponse.ok || !accountJson?.ok) throw new Error(getApiErrorMessage(accountJson, 'No se pudieron cargar los portafolios.'))
      if (!typeResponse.ok || !typeJson?.ok) throw new Error(getApiErrorMessage(typeJson, 'No se pudieron cargar los tipos de activo.'))
      const nextAccounts = (accountJson.data as AccountOption[]) ?? []
      const nextTypes = (typeJson.data as AssetTypeOption[]) ?? []
      setAccounts(nextAccounts)
      setAssetTypes(nextTypes)
      const nextForm = {
        ...formRef.current,
        account_id: formRef.current.account_id || nextAccounts.find(account => account.is_active && VALID_ACCOUNT_TYPES.includes(account.type))?.id || '',
        asset_type_id: formRef.current.asset_type_id || nextTypes[0]?.id || '',
      }
      formRef.current = nextForm
      setForm(nextForm)
      if (!dirtyRef.current) initialFormRef.current = nextForm
    } catch (caught) {
      setReferenceError(caught instanceof Error ? caught.message : 'No se pudieron cargar los datos del formulario.')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => { void loadReferenceData() }, [loadReferenceData])
  useEffect(() => { onFormStateChange({ dirty, saving, ready }) }, [dirty, onFormStateChange, ready, saving])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || !ready) return
    const name = form.name.trim()
    if (name.length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }
    if (!form.account_id) { setError('Selecciona un portafolio.'); return }
    if (!form.purchase_date || dateError) { setError(dateError ?? 'Selecciona una fecha de compra válida.'); return }
    const purchaseValue = roundToDecimals(parseNumericInput(form.purchase_value, Number.NaN), 2)
    if (!Number.isFinite(purchaseValue) || purchaseValue <= 0) { setError('El monto debe ser mayor a 0.'); return }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          account_id: form.account_id,
          asset_type_id: form.asset_type_id || null,
          purchase_date: form.purchase_date,
          purchase_value: purchaseValue,
          currency: selectedAccount?.currency ?? 'PEN',
          description: form.description.trim() || null,
          recipient: form.recipient.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo registrar el activo.'))
      setDirty(false)
      dirtyRef.current = false
      onSuccess(name)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo registrar el activo.')
    } finally {
      setSaving(false)
    }
  }, [dateError, form, onSuccess, ready, saving, selectedAccount])

  return (
    <form id="asset-form" data-testid="asset-form" onSubmit={handleSubmit} className={styles.assetForm}>
      {referenceError ? (
        <div className={styles.referenceError} role="alert">
          <p>{referenceError}</p>
          <button type="button" onClick={() => void loadReferenceData()} disabled={loadingData}>Reintentar</button>
        </div>
      ) : null}

      <FormSection title="Identificación" columns="2" className={styles.formSection}>
        <FormField label="Nombre del activo">
          <input value={form.name} onChange={event => update('name', event.target.value)} data-testid="asset-name-input" className="field-base ft-form-input w-full" placeholder="Ej.: Laptop de operaciones" maxLength={150} required />
        </FormField>
        <FormField label="Tipo de activo" optional>
          <AppSelect value={form.asset_type_id} onChange={value => update('asset_type_id', value)} testId="asset-type-select" options={assetTypes.length ? assetTypes.map(type => ({ value: type.id, label: type.name })) : [{ value: '', label: 'Sin tipos configurados', disabled: true }]} searchable searchPlaceholder="Buscar tipo..." />
        </FormField>
      </FormSection>

      <FormSection title="Compra" columns="2" className={styles.formSection}>
        <FormField label="Cuenta de origen">
          <AppSelect value={form.account_id} onChange={value => update('account_id', value)} testId="asset-account-select" options={validAccounts.length ? validAccounts.map(account => ({ value: account.id, label: `${account.name} · ${account.currency}` })) : [{ value: '', label: loadingData ? 'Cargando cuentas…' : 'Sin cuentas disponibles', disabled: true }]} searchable searchPlaceholder="Buscar cuenta..." />
        </FormField>
        <div className={styles.amountRow}>
          <FormField label="Importe de compra">
            <NumericInput value={form.purchase_value} onValueChange={value => update('purchase_value', value)} step="0.01" decimals={2} min={0} data-testid="asset-amount-input" className="field-base ft-form-amount-input w-full px-3.5 py-3 text-base font-semibold" placeholder="0.00" required />
          </FormField>
          <div className={styles.currencyContext} aria-live="polite">
            <span>Moneda de la cuenta</span>
            <strong>{selectedAccount?.currency ?? '—'}</strong>
          </div>
        </div>
        {amount > 0 && selectedAccount ? <p className={`${styles.amountPreview} md:col-span-2`}>Importe registrado: <strong>{formatCurrency(amount, selectedAccount.currency as 'PEN' | 'USD')}</strong></p> : null}
        <FormField label="Fecha de compra">
          <IncomeDatePicker value={form.purchase_date} onChange={value => { update('purchase_date', value); setDateError(null) }} onInvalidInput={setDateError} error={dateError ?? undefined} inputLabel="Fecha de compra" inputTestId="asset-date-input" disabled={saving} />
        </FormField>
        <FormField label="Proveedor o destinatario" optional>
          <input value={form.recipient} onChange={event => update('recipient', event.target.value)} data-testid="asset-recipient-input" className="field-base ft-form-input w-full" placeholder="Nombre del proveedor" maxLength={160} />
        </FormField>
        <FormField label="Descripción" optional className="md:col-span-2">
          <input value={form.description} onChange={event => update('description', event.target.value)} data-testid="asset-description-input" className="field-base ft-form-input w-full" placeholder="Motivo o referencia de compra" maxLength={300} />
        </FormField>
      </FormSection>

      <FormSection title="Información adicional" className={styles.formSection}>
        <FormField label="Notas" optional>
          <textarea rows={3} value={form.notes} onChange={event => update('notes', event.target.value)} className="field-base ft-form-textarea w-full resize-y" placeholder="Contexto interno del activo" maxLength={500} />
        </FormField>
        <div className={styles.attachmentNotice} data-testid="asset-attachment-unavailable">
          <span className={styles.noticeIcon} aria-hidden="true">i</span>
          <p><strong>Comprobantes no disponibles</strong><span>{ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE}</span></p>
        </div>
      </FormSection>

      {error ? <p role="alert" className={styles.formError}>{error}</p> : null}
    </form>
  )
}
