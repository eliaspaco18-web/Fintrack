'use client'

// =============================================================================
// components/ui/CountrySelect.tsx
// Selector de países del mundo. Usado en:
// - Administración → Entidades Bancarias (campo País)
// - Administración → Monedas (campo País)
// =============================================================================

import { ComponentStyles } from '@/lib/tokens'

interface CountrySelectProps {
  value: string
  onChange: (value: string) => void
  id?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function CountrySelect({
  value,
  onChange,
  id,
  required = false,
  disabled = false,
  className = '',
}: CountrySelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className={`${ComponentStyles.input} ${className}`}
    >
      <option value="">Seleccionar país...</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.flag} {c.name}
        </option>
      ))}
    </select>
  )
}

// ─── Lista de países (principales + Latam completo) ──────────────────────────

const COUNTRIES = [
  // Latinoamérica (prioridad)
  { code: 'PE', name: 'Perú',               flag: '🇵🇪' },
  { code: 'AR', name: 'Argentina',           flag: '🇦🇷' },
  { code: 'BO', name: 'Bolivia',             flag: '🇧🇴' },
  { code: 'BR', name: 'Brasil',              flag: '🇧🇷' },
  { code: 'CL', name: 'Chile',               flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia',            flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica',          flag: '🇨🇷' },
  { code: 'CU', name: 'Cuba',                flag: '🇨🇺' },
  { code: 'DO', name: 'República Dominicana',flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador',             flag: '🇪🇨' },
  { code: 'SV', name: 'El Salvador',         flag: '🇸🇻' },
  { code: 'GT', name: 'Guatemala',           flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras',            flag: '🇭🇳' },
  { code: 'MX', name: 'México',              flag: '🇲🇽' },
  { code: 'NI', name: 'Nicaragua',           flag: '🇳🇮' },
  { code: 'PA', name: 'Panamá',              flag: '🇵🇦' },
  { code: 'PY', name: 'Paraguay',            flag: '🇵🇾' },
  { code: 'PR', name: 'Puerto Rico',         flag: '🇵🇷' },
  { code: 'UY', name: 'Uruguay',             flag: '🇺🇾' },
  { code: 'VE', name: 'Venezuela',           flag: '🇻🇪' },
  // Norteamérica
  { code: 'US', name: 'Estados Unidos',      flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá',              flag: '🇨🇦' },
  // Europa
  { code: 'ES', name: 'España',              flag: '🇪🇸' },
  { code: 'GB', name: 'Reino Unido',         flag: '🇬🇧' },
  { code: 'FR', name: 'Francia',             flag: '🇫🇷' },
  { code: 'DE', name: 'Alemania',            flag: '🇩🇪' },
  { code: 'IT', name: 'Italia',              flag: '🇮🇹' },
  { code: 'PT', name: 'Portugal',            flag: '🇵🇹' },
  { code: 'NL', name: 'Países Bajos',        flag: '🇳🇱' },
  { code: 'CH', name: 'Suiza',               flag: '🇨🇭' },
  { code: 'SE', name: 'Suecia',              flag: '🇸🇪' },
  { code: 'NO', name: 'Noruega',             flag: '🇳🇴' },
  // Asia
  { code: 'JP', name: 'Japón',               flag: '🇯🇵' },
  { code: 'CN', name: 'China',               flag: '🇨🇳' },
  { code: 'KR', name: 'Corea del Sur',       flag: '🇰🇷' },
  { code: 'IN', name: 'India',               flag: '🇮🇳' },
  // Oceanía
  { code: 'AU', name: 'Australia',           flag: '🇦🇺' },
  { code: 'NZ', name: 'Nueva Zelanda',       flag: '🇳🇿' },
] as const

export type CountryCode = typeof COUNTRIES[number]['code']

export { COUNTRIES }
