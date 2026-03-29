// =============================================================================
// components/layout/Brand.tsx
// Identidad visual reutilizable de FinTrack.
// =============================================================================

import type { ReactNode } from 'react'

interface BrandMarkProps {
  size?: number
  className?: string
}

interface BrandWordmarkProps {
  titleClassName?: string
  subtitleClassName?: string
  subtitle?: ReactNode
}

export function BrandMark({ size = 40, className = '' }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="ft-mark-bg" x1="8" y1="8" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f766e"/>
          <stop offset="0.55" stopColor="#0ea5a3"/>
          <stop offset="1" stopColor="#0369a1"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="64" height="64" rx="18" fill="url(#ft-mark-bg)"/>
      <path
        d="M23 19H49M23 32H41M23 45H37M23 19V53"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M43 45L50 38M50 38H44M50 38V44"
        stroke="#bbf7d0"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrandWordmark({
  titleClassName = '',
  subtitleClassName = '',
  subtitle = 'Finanzas inteligentes',
}: BrandWordmarkProps) {
  return (
    <div className="min-w-0">
      <p className={`truncate text-[28px] leading-none font-display font-bold tracking-[-0.03em] text-[var(--color-text)] ${titleClassName}`}>
        FinTrack
      </p>
      <p className={`mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] ${subtitleClassName}`}>
        {subtitle}
      </p>
    </div>
  )
}
