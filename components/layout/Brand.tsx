// =============================================================================
// components/layout/Brand.tsx
// Identidad visual FinTrack — Rediseño v2
// Logo aprobado: isotipo circular oficial + wordmark "FinTrack" (Plus Jakarta Sans)
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
// Isotipo oficial (archivo en /public/brand)

export function BrandMark({ size = 40, className = '', variant = 'default' }: BrandMarkProps) {
  return (
    <span
      className={`relative inline-flex overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: variant === 'white'
          ? '0 0 0 1px rgba(255,255,255,0.28) inset'
          : '0 0 0 1px rgba(13,79,74,0.14) inset',
      }}
    >
      <Image
        src="/brand/fintrack-mark.png"
        alt="FinTrack"
        fill
        sizes={`${size}px`}
        unoptimized
        className="object-cover"
      />
    </span>
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
