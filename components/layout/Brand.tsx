// =============================================================================
// components/layout/Brand.tsx
// V3 FinTrack identity mark with the existing wordmark.
// =============================================================================

import Image from 'next/image'
import type { ReactNode } from 'react'

interface BrandMarkProps {
  size?:      number
  className?: string
  /** 'default' = Forest Green, 'white' = para paneles oscuros */
  variant?:   'default' | 'white'
}

interface BrandWordmarkProps {
  titleClassName?:    string
  subtitleClassName?: string
  subtitle?:          ReactNode | null
  /** 'default' = Deep Forest, 'white' = para paneles oscuros */
  variant?:           'default' | 'white'
}

// ─── BRAND MARK ───────────────────────────────────────────────────────────────
// Use the approved Astra Round 07 ligature in light- and dark-surface variants.

export function BrandMark({ size = 40, className = '', variant = 'default' }: BrandMarkProps) {
  return (
    <Image
      src={variant === 'white' ? '/brand/v3/ft-ligature-dark.svg' : '/brand/v3/ft-ligature.svg'}
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      unoptimized
      className={`shrink-0 object-contain ${className}`.trim()}
    />
  )
}

// ─── BRAND WORDMARK ───────────────────────────────────────────────────────────

export function BrandWordmark({
  titleClassName    = '',
  subtitleClassName = '',
  subtitle          = null,
  variant           = 'default',
}: BrandWordmarkProps) {
  const textColor = variant === 'white'
    ? 'text-white'
    : 'text-[var(--c-text)]'

  const mutedColor = variant === 'white'
    ? 'text-white/60'
    : 'text-[var(--c-text-faint)]'

  return (
    <div className="min-w-0">
      <p
        className={`truncate text-[17px] leading-none font-display font-bold tracking-[-0.022em] ${textColor} ${titleClassName}`}
      >
        FinTrack
      </p>
      {subtitle && (
        <p
          className={`mt-0.5 truncate text-[9.5px] uppercase tracking-[0.20em] font-semibold ${mutedColor} ${subtitleClassName}`}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ─── BRAND FULL (mark + wordmark juntos) ─────────────────────────────────────

interface BrandFullProps {
  size?:    number
  variant?: 'default' | 'white'
  className?: string
}

export function BrandFull({ size = 36, variant = 'default', className = '' }: BrandFullProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark size={size} variant={variant} />
      <BrandWordmark variant={variant} />
    </div>
  )
}
