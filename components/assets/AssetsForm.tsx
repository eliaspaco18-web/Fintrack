'use client'

// =============================================================================
// components/assets/AssetsForm.tsx
// PRD v3 — Módulo 5: Activos
//
// Campos PRD exactos:
//   - Portafolio (desplegable, obligatorio)
//   - Fecha (calendario, obligatorio)
//   - Tipo de Activo (desplegable desde Administración, obligatorio)
//   - Descripción (texto libre)
//   - Moneda (automático desde portafolio, no editable)
//   - Monto (numérico, obligatorio + equivalencia)
//   - Destinatario (texto libre)
//   - Notas (texto libre)
//   - Adjuntar constancia o comprobante
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import { Button } from '@/components/ui/Button'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { RecordModalFooter } from '@/components/ui/RecordModal'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { formatCurrency } from '@/lib/contracts/ui.contracts'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type AccountOption = {
  id: string
  name: string
  type: string
  currency: string
  is_active: boolean
}

type AssetTypeOption = {
  id: string
  name: string
  color: string | null
  icon: string | null
}

interface AssetsFormProps {
  onSuccess: (assetName: string) => void
  onCancel: () => void
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 8 * 1024 * 1024
const ALLOWED_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx']

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Tipos de portafolio válidos para compra de activo (excluir CREDIT_CARD)
const VALID_ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'STOCKS', 'ETF', 'CRYPTO', 'OTHER']

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function AssetsForm({ onSuccess, onCancel }: AssetsFormProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Archivo adjunto
  const [attachment, setAttachment] = useState<File | null>(null)

  // ── Estado del formulario
  const [form, setForm] = useState({
    name: '',
    account_id: '',
    asset_type_id: '',
    purchase_date: todayIso(),
    purchase_value: '',
    description: '',
    recipient: '',
    notes: '',
  })

  // Portafolios válidos (excluir CREDIT_CARD)
  const validAccounts = useMemo(
    () => accounts.filter(a => a.is_active && VALID_ACCOUNT_TYPES.includes(a.type)),
    [accounts]
  )

  // Moneda automática desde portafolio seleccionado
  const selectedAccount = useMemo(
    () => validAccounts.find(a => a.id === form.account_id) ?? null,
    [validAccounts, form.account_id]
  )
  const currency = selectedAccount?.currency ?? '—'

  // Equivalencia en USD/PEN (si es USD muestra PEN, y viceversa)
  const parsedAmount = parseNumericInput(form.purchase_value, 0)
  // Carga inicial de portafolios y tipos de activo
  useEffect(() => {
    const load = async () => {
      setLoadingData(true)
      try {
        const [accRes, atRes] = await Promise.all([
          fetch('/api/accounts', { cache: 'no-store' }),
          fetch('/api/asset-types', { cache: 'no-store' }),
        ])
        const [accJson, atJson] = await Promise.all([accRes.json(), atRes.json()])
        if (accJson?.ok) {
          const loaded = (accJson.data as AccountOption[]) ?? []
          setAccounts(loaded)
          const first = loaded.find(a => a.is_active && VALID_ACCOUNT_TYPES.includes(a.type))
          if (first) setForm(prev => ({ ...prev, account_id: first.id }))
        }
        if (atJson?.ok) {
          const types = (atJson.data as AssetTypeOption[]) ?? []
          setAssetTypes(types)
          const firstType = types[0]
          if (firstType) setForm(prev => ({ ...prev, asset_type_id: firstType.id }))
        }
      } catch {
        setError('No se pudieron cargar los datos del formulario.')
      } finally {
        setLoadingData(false)
      }
    }
    void load()
  }, [])

  const handleFileChange = useCallback((file: File | null) => {
    if (!file) { setAttachment(null); return }
    if (file.size > MAX_FILE_BYTES) { setError('El archivo supera 8 MB.'); return }
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    if (!ALLOWED_EXTS.includes(ext)) { setError('Formato no permitido.'); return }
    setError(null)
    setAttachment(file)
  }, [])

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return

    const name = form.name.trim()
    if (name.length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }
    if (!form.account_id) { setError('Selecciona un portafolio.'); return }
    if (!form.purchase_date) { setError('La fecha es obligatoria.'); return }

    const amount = roundToDecimals(parseNumericInput(form.purchase_value, Number.NaN), 2)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('El monto debe ser mayor a 0.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          account_id: form.account_id,
          asset_type_id: form.asset_type_id || null,
          purchase_date: form.purchase_date,
          purchase_value: amount,
          currency: selectedAccount?.currency ?? 'PEN',
          description: form.description.trim() || null,
          recipient: form.recipient.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo registrar el activo'))

      // Subir adjunto si existe (endpoint genérico)
      if (attachment && json.data?.id) {
        const fd = new FormData()
        fd.append('file', attachment)
        await fetch(`/api/assets/${json.data.id}/attachment`, { method: 'POST', body: fd })
          .catch(() => null) // No bloquear si falla el adjunto
      }

      onSuccess(name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el activo')
    } finally {
      setSaving(false)
    }
  }, [form, saving, selectedAccount, attachment, onSuccess])

  return (
    <>
      <form id="asset-form" data-testid="asset-form" onSubmit={handleSubmit} className="space-y-[var(--ft-form-section-gap)]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.98fr)_minmax(400px,1.02fr)]">
          <FormSection
            title="Activo"
            description="Identifica el bien que vas a incorporar y deja una lectura compacta del registro antes de guardar."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre">
              <input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                data-testid="asset-name-input"
                className="field-base ft-form-input w-full"
                placeholder="Ej: Laptop operaciones"
                required
              />
            </FormField>

            <FormField label="Tipo de activo">
              {loadingData ? (
                <div className="field-base ft-form-input flex w-full items-center text-[var(--ft-form-muted)]">
                  Cargando tipos...
                </div>
              ) : (
                <div className="space-y-2">
                  <AppSelect
                    value={form.asset_type_id}
                    onChange={v => setForm(prev => ({ ...prev, asset_type_id: v }))}
                    testId="asset-type-select"
                    options={assetTypes.length === 0
                      ? [{ value: '', label: 'Sin tipos de activo configurados', disabled: true }]
                      : assetTypes.map(t => ({ value: t.id, label: t.name }))
                    }
                    searchPlaceholder="Buscar tipo..."
                  />
                  {assetTypes.length === 0 ? (
                    <p className="text-[12px] leading-[1.45] text-amber-500">
                      Configura tipos de activo en Administración antes de registrar compras.
                    </p>
                  ) : null}
                </div>
              )}
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Preview</p>
                <p className="mt-1 text-[14px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                  {form.name.trim() || 'Activo sin nombre'}
                </p>
                <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  {assetTypes.find(type => type.id === form.asset_type_id)?.name ?? 'Selecciona un tipo'}
                </p>
              </div>

              <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Lectura</p>
                <p className="mt-1 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--c-text)]">
                  {parsedAmount > 0 && selectedAccount
                    ? formatCurrency(parsedAmount, selectedAccount.currency as 'PEN' | 'USD')
                    : 'Monto pendiente'}
                </p>
                <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  {selectedAccount?.name ?? 'Sin portafolio seleccionado'}
                </p>
              </div>
            </div>

            <FormField label="Notas" optional>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="field-base ft-form-textarea w-full resize-none"
                placeholder="Detalle interno, referencia o contexto adicional"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Compra"
            description="Relaciona la compra con el portafolio de salida, el importe y la fecha del movimiento."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Portafolio">
              {loadingData ? (
                <div className="field-base ft-form-input flex w-full items-center text-[var(--ft-form-muted)]">
                  Cargando portafolios...
                </div>
              ) : (
                <AppSelect
                  value={form.account_id}
                  onChange={v => setForm(prev => ({ ...prev, account_id: v }))}
                  testId="asset-account-select"
                  options={validAccounts.length === 0
                    ? [{ value: '', label: 'Sin portafolios disponibles', disabled: true }]
                    : validAccounts.map(a => ({ value: a.id, label: `${a.name} · ${a.currency}` }))
                  }
                  searchPlaceholder="Buscar portafolio..."
                />
              )}
            </FormField>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <FormField label="Monto">
                <NumericInput
                  step="0.01"
                  decimals={2}
                  min={0}
                  value={form.purchase_value}
                  onValueChange={v => setForm(prev => ({ ...prev, purchase_value: v }))}
                  data-testid="asset-amount-input"
                  className="field-base ft-form-amount-input w-full px-3.5 py-3 text-base font-semibold"
                  placeholder="0.00"
                  required
                />
              </FormField>

              <FormField
                label="Moneda contextual"
                description="Se hereda del portafolio."
              >
                <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                  <p className="text-sm font-semibold text-[var(--c-text)]">{currency}</p>
                  <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                    {selectedAccount ? selectedAccount.name : 'Selecciona un portafolio'}
                  </p>
                </div>
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Fecha">
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={e => setForm(prev => ({ ...prev, purchase_date: e.target.value }))}
                  data-testid="asset-date-input"
                  className="field-base ft-form-input w-full"
                  required
                />
              </FormField>

              <FormField label="Proveedor" optional>
                <input
                  value={form.recipient}
                  onChange={e => setForm(prev => ({ ...prev, recipient: e.target.value }))}
                  data-testid="asset-recipient-input"
                  className="field-base ft-form-input w-full"
                  placeholder="Ej: Memory Kings"
                />
              </FormField>
            </div>

            <FormField label="Descripcion">
              <input
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                data-testid="asset-description-input"
                className="field-base ft-form-input w-full"
                placeholder="Ej: Compra de equipo para soporte"
              />
            </FormField>
          </FormSection>
        </div>

        <FormSection
          title="Comprobante"
          description="Adjunta la constancia o documento de respaldo en una tira compacta."
          columns="1"
          className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="ui-pressable inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-[var(--ft-form-radius)] border border-dashed border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-4 py-3 text-[12px] font-medium text-[var(--ft-form-muted)] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="min-w-0 truncate" title={attachment?.name}>
                {attachment ? attachment.name : 'Subir archivo (PDF, imagen, Word o Excel)'}
              </span>
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="flex items-center gap-3">
              <p className="text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                {attachment ? 'Archivo listo para enviarse con el activo.' : 'Opcional. Maximo 8 MB.'}
              </p>
              {attachment ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAttachment(null)}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
        </FormSection>

        {error ? (
          <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
            <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
          </div>
        ) : null}
      </form>

      <RecordModalFooter>
        <FormActions
          secondaryAction={(
            <Button
              type="button"
              onClick={onCancel}
              disabled={saving}
              variant="secondary"
              size="lg"
            >
              Cancelar
            </Button>
          )}
          primaryAction={(
            <Button
              type="submit"
              form="asset-form"
              disabled={saving || loadingData || !form.account_id}
              loading={saving}
              testId="asset-submit-button"
              variant="primary"
              size="lg"
            >
              Registrar activo
            </Button>
          )}
        />
      </RecordModalFooter>
    </>
  )
}
