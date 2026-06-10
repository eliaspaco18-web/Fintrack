// =============================================================================
// components/forms/TransactionForm/sections/ModuleSections.tsx
// Secciones de módulos derivados. Cada sección es independiente y
// se renderiza condicionalmente según la visibilidad derivada.
// Reciben solo lo que necesitan del formulario — no tocan el estado global.
// =============================================================================

'use client'

import type { UseFormReturn }  from 'react-hook-form'
import type {
  FormSelectOption,
  TransactionFormValues,
} from '@/lib/contracts/ui.contracts'
import {
  FieldWrapper,
  Input,
  Select,
  CheckboxToggle,
  ModuleCard,
  CollapsibleSection,
  SectionDivider,
}                              from '../FormFields'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'

type Form = UseFormReturn<TransactionFormValues>

// ─── ICONS SVG ───────────────────────────────────────────────────────────────

const Icons = {
  asset: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  ),
  credit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
  ),
  loan: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  receivable: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="m9 15 2 2 4-4"/>
    </svg>
  ),
  payable: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><line x1="9" x2="15" y1="13" y2="13"/>
    </svg>
  ),
}

// ─── ASSET SECTION ────────────────────────────────────────────────────────────

export function AssetSection({
  form,
  assetTypes,
}: {
  form: Form
  assetTypes: FormSelectOption[]
}) {
  const { register, setValue, watch, formState: { errors } } = form
  const selectedAssetTypeId = watch('asset_type_id')
  const selectedAssetType = assetTypes.find(option => option.value === selectedAssetTypeId) ?? null

  return (
    <ModuleCard icon={Icons.asset} title="Detalles del activo" color="#8b5cf6">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="hidden"
          {...register('asset_type_id', { required: 'Selecciona el tipo de activo' })}
        />

        <FieldWrapper
          label="Nombre del activo"
          required
          error={errors.asset_name?.message}
          className="col-span-2"
        >
          <Input
            placeholder="Ej: Laptop Dell XPS 15"
            error={errors.asset_name?.message}
            {...register('asset_name', { required: 'Nombre del activo requerido' })}
          />
        </FieldWrapper>

        <FieldWrapper
          label="Tipo de activo"
          required
          error={errors.asset_type_id?.message || errors.asset_type?.message}
        >
          <Select
            value={selectedAssetTypeId ?? ''}
            onChange={event => {
              const nextId = event.target.value
              const nextOption = assetTypes.find(option => option.value === nextId) ?? null
              const legacyType =
                typeof nextOption?.meta?.legacyType === 'string'
                  ? nextOption.meta.legacyType
                  : 'OTHER'

              setValue('asset_type_id', nextId || undefined, {
                shouldDirty: true,
                shouldValidate: true,
              })
              setValue('asset_type', legacyType as TransactionFormValues['asset_type'], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }}
            error={errors.asset_type_id?.message || errors.asset_type?.message}
          >
            <option value="">Seleccionar tipo...</option>
            {assetTypes.map(assetType => (
              <option key={assetType.value} value={assetType.value}>
                {assetType.label}
              </option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Número de serie" error={errors.asset_serial?.message}>
          <Input
            placeholder="SN-000000"
            error={errors.asset_serial?.message}
            {...register('asset_serial')}
          />
        </FieldWrapper>

        <FieldWrapper label="Ubicación / descripción"
          error={errors.asset_location?.message}
          className="col-span-2"
        >
          <Input
            placeholder="Oficina principal, domicilio…"
            error={errors.asset_location?.message}
            {...register('asset_location')}
          />
        </FieldWrapper>
      </div>

      {selectedAssetType ? (
        <div className="mt-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
            Tipo seleccionado
          </p>
          <p className="mt-1 text-[13px] font-medium text-[var(--c-text)]">
            {selectedAssetType.label}
          </p>
        </div>
      ) : null}
    </ModuleCard>
  )
}

// ─── CREDIT SECTION ──────────────────────────────────────────────────────────

export function CreditSection({ form }: { form: Form }) {
  const { register, formState: { errors } } = form

  return (
    <ModuleCard icon={Icons.credit} title="Tarjeta o crédito bancario" color="#f59e0b">
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper
          label="Nombre del crédito"
          required
          error={errors.credit_name?.message}
          className="col-span-2"
        >
          <Input
            placeholder="Ej: Visa Banco Continental"
            error={errors.credit_name?.message}
            {...register('credit_name', { required: 'Nombre del crédito requerido' })}
          />
        </FieldWrapper>

        <FieldWrapper label="Tipo" error={errors.credit_type?.message}>
          <Select
            {...register('credit_type')}
            error={errors.credit_type?.message}
          >
            <option value="CREDIT_CARD">Tarjeta de crédito</option>
            <option value="LINE_OF_CREDIT">Crédito bancario (hipotecario, vehicular, etc.)</option>
          </Select>
        </FieldWrapper>

        <FieldWrapper
          label="Límite de crédito"
          required
          error={errors.credit_limit?.message}
        >
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            error={errors.credit_limit?.message}
            {...register('credit_limit', {
              setValueAs: value => {
                const parsed = parseNumericInput(value, Number.NaN)
                if (!Number.isFinite(parsed)) return undefined
                return roundToDecimals(parsed, 2)
              },
              validate: v => !v || v > 0 || 'El límite debe ser positivo',
            })}
          />
        </FieldWrapper>

        <FieldWrapper
          label="Tasa de interés mensual (%)"
          hint="0 = sin interés"
          error={errors.credit_rate?.message}
          className="col-span-2"
        >
          <Input
            type="number"
            step="0.01"
            placeholder="3.5"
            error={errors.credit_rate?.message}
            {...register('credit_rate', {
              setValueAs: value => {
                const parsed = parseNumericInput(value, Number.NaN)
                if (!Number.isFinite(parsed)) return undefined
                return roundToDecimals(parsed, 2)
              },
            })}
          />
        </FieldWrapper>
      </div>
    </ModuleCard>
  )
}

// ─── LOAN SECTION ─────────────────────────────────────────────────────────────

interface LoanSectionProps {
  form:         Form
  visible:      boolean
  onToggle:     (v: boolean) => void
  isActive:     boolean
}

export function LoanSection({ form, visible, onToggle, isActive }: LoanSectionProps) {
  const { register, formState: { errors } } = form

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--c-border)]">
      <div className="bg-[var(--c-surface-2)] px-4 py-3">
        <CheckboxToggle
          label="Registrar cronograma de cuotas"
          description="Genera el plan de pagos automáticamente (método francés)"
          checked={isActive}
          onChange={onToggle}
          accent="amber"
        />
      </div>

      <CollapsibleSection open={isActive}>
        <div className="px-4 pb-4">
          <ModuleCard icon={Icons.loan} title="Datos del préstamo" color="#f59e0b">
            <div className="grid grid-cols-2 gap-3">
              <FieldWrapper
                label="Acreedor"
                required
                error={errors.loan_creditor?.message}
                className="col-span-2"
              >
                <Input
                  placeholder="Banco / institución / persona"
                  error={errors.loan_creditor?.message}
                  {...register('loan_creditor', {
                    required: isActive ? 'El nombre del acreedor es requerido' : false,
                  })}
                />
              </FieldWrapper>

              <FieldWrapper
                label="Número de cuotas"
                required
                error={errors.loan_installments?.message}
              >
                <Input
                  type="number"
                  min="1"
                  max="600"
                  placeholder="12"
                  error={errors.loan_installments?.message}
                  {...register('loan_installments', {
                    setValueAs: value => {
                      const parsed = parseNumericInput(value, Number.NaN)
                      if (!Number.isFinite(parsed)) return undefined
                      return Math.max(1, Math.trunc(parsed))
                    },
                    required: isActive ? 'Número de cuotas requerido' : false,
                    min: { value: 1, message: 'Mínimo 1 cuota' },
                    max: { value: 600, message: 'Máximo 600 cuotas' },
                  })}
                />
              </FieldWrapper>

              <FieldWrapper
                label="Tasa mensual (%)"
                hint="0 = sin interés"
                error={errors.loan_rate?.message}
              >
                <Input
                  type="number"
                  step="0.001"
                  placeholder="1.5"
                  error={errors.loan_rate?.message}
                  {...register('loan_rate', {
                    setValueAs: value => {
                      const parsed = parseNumericInput(value, Number.NaN)
                      if (!Number.isFinite(parsed)) return undefined
                      return roundToDecimals(parsed, 3)
                    },
                  })}
                />
              </FieldWrapper>

              <FieldWrapper
                label="Fecha de última cuota"
                required
                error={errors.loan_end_date?.message}
                className="col-span-2"
              >
                <Input
                  type="date"
                  error={errors.loan_end_date?.message}
                  {...register('loan_end_date', {
                    required: isActive ? 'La fecha de fin es requerida' : false,
                  })}
                />
              </FieldWrapper>

              <div className="col-span-2 pt-1">
                <CheckboxToggle
                  label="Generar cronograma automáticamente"
                  description="Crea todas las cuotas con el método francés (cuota fija)"
                  checked={form.watch('loan_schedule')}
                  onChange={v => form.setValue('loan_schedule', v)}
                  accent="blue"
                />
              </div>
            </div>
          </ModuleCard>
        </div>
      </CollapsibleSection>
    </div>
  )
}

// ─── RECEIVABLE SECTION ───────────────────────────────────────────────────────

export function ReceivableSection({
  form,
  debtors,
}: {
  form: Form
  debtors: FormSelectOption[]
}) {
  const { register, formState: { errors } } = form

  return (
    <ModuleCard icon={Icons.receivable} title="Cuenta por cobrar" color="#0f766e">
      <p className="-mt-2 text-[11px] text-[var(--c-text-muted)]">
        El monto y la descripción se mantienen desde la transacción base.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper
          label="Deudor"
          required
          error={errors.receivable_debtor_id?.message}
          className="col-span-2"
        >
          <Select
            error={errors.receivable_debtor_id?.message}
            {...register('receivable_debtor_id', {
              required: 'Selecciona el deudor',
            })}
          >
            <option value="">Seleccionar deudor...</option>
            {debtors.map(debtor => (
              <option key={debtor.value} value={debtor.value}>
                {debtor.label}
              </option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper
          label="Fecha de vencimiento"
          hint="Opcional"
          error={errors.receivable_due?.message}
          className="col-span-2"
        >
          <Input
            type="date"
            error={errors.receivable_due?.message}
            {...register('receivable_due')}
          />
        </FieldWrapper>
      </div>
    </ModuleCard>
  )
}

// ─── PAYABLE SECTION ──────────────────────────────────────────────────────────

export function PayableSection({
  form,
  creditors,
}: {
  form: Form
  creditors: FormSelectOption[]
}) {
  const { register, formState: { errors } } = form

  return (
    <ModuleCard icon={Icons.payable} title="Cuenta por pagar" color="#b45309">
      <p className="-mt-2 text-[11px] text-[var(--c-text-muted)]">
        El monto y la descripción se mantienen desde la transacción base.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper
          label="Acreedor"
          required
          error={errors.payable_creditor_id?.message}
          className="col-span-2"
        >
          <Select
            error={errors.payable_creditor_id?.message}
            {...register('payable_creditor_id', {
              required: 'Selecciona el acreedor',
            })}
          >
            <option value="">Seleccionar acreedor...</option>
            {creditors.map(creditor => (
              <option key={creditor.value} value={creditor.value}>
                {creditor.label}
              </option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper
          label="Fecha de vencimiento"
          hint="Opcional"
          error={errors.payable_due?.message}
          className="col-span-2"
        >
          <Input
            type="date"
            error={errors.payable_due?.message}
            {...register('payable_due')}
          />
        </FieldWrapper>
      </div>
    </ModuleCard>
  )
}

// ─── TRIGGER HINT ─────────────────────────────────────────────────────────────
// Hint informativo que aparece cuando se selecciona una categoría
// que activa un módulo derivado.

interface ModuleTriggerHintProps {
  moduleName:  string
  description: string
  color:       string
}

export function ModuleTriggerHint({ moduleName, description, color }: ModuleTriggerHintProps) {
  return (
    <div
      className="rounded-lg border px-3.5 py-2.5 flex items-start gap-2.5
        animate-[slide-down_0.2s_ease-out]"
      style={{ borderColor: color + '30', background: color + '08' }}
    >
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="2" className="flex-shrink-0 mt-0.5"
      >
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/><path d="M12 8h.01"/>
      </svg>
      <div>
        <p className="text-xs font-semibold" style={{ color }}>{moduleName}</p>
        <p className="mt-0.5 text-[11px] text-[var(--c-text-faint)]">{description}</p>
      </div>
    </div>
  )
}
