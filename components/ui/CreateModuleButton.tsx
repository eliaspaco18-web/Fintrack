'use client'

import { Button } from '@/components/ui/Button'

interface CreateModuleButtonProps {
  label: string
  href?: string
  onClick?: () => void
  className?: string
  testId?: string
  prefetch?: boolean
  scroll?: boolean
}

const BASE_CLASS = 'module-create-btn'

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

export function CreateModuleButton({
  label,
  href,
  onClick,
  className = '',
  testId,
  prefetch = true,
  scroll = true,
}: CreateModuleButtonProps) {
  const classes = `${BASE_CLASS} ${className}`.trim()

  if (href) {
    return (
      <Button
        href={href}
        prefetch={prefetch}
        scroll={scroll}
        testId={testId}
        variant="primary"
        size="md"
        className={classes}
        leadingIcon={<IconPlus />}
      >
        {label}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      testId={testId}
      variant="primary"
      size="md"
      className={classes}
      leadingIcon={<IconPlus />}
    >
      {label}
    </Button>
  )
}
