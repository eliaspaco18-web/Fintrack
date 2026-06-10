'use client'

import type { ElementType, ReactNode } from 'react'

interface PremiumCardProps {
  children: ReactNode
  className?: string
  innerClassName?: string
  as?: ElementType
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function PremiumCard({
  children,
  className,
  innerClassName,
  as: Tag = 'section',
}: PremiumCardProps) {
  return (
    <Tag
      className={joinClasses(
        'premium-dashboard-card rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1',
        'shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] duration-200 ease-[var(--ease-out)]',
        'hover:border-[var(--c-border-hover)] hover:shadow-[var(--shadow-md)] active:scale-[0.995]',
        className
      )}
    >
      <div
        className={joinClasses(
          'premium-dashboard-card-inner rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface)]',
          'shadow-[inset_0_1px_0_color-mix(in_srgb,var(--c-text-on-primary)_24%,transparent)]',
          innerClassName
        )}
      >
        {children}
      </div>
    </Tag>
  )
}
