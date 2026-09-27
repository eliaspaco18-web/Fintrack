'use client'

import { usePathname, useRouter } from 'next/navigation'
import { AnchoredActionMenu, type AnchoredAction } from '@/components/ui/AnchoredActionMenu'
import { QUICK_CONTEXTUAL_CREATE, QUICK_OPERATIONS } from '@/lib/constants/quick-operations'
import { IconPlus } from './LayoutIcons'

/** One persistent launcher for the eight existing transaction operations. */
export function QuickActionsFAB() {
  const pathname = usePathname()
  const router = useRouter()
  const contextual = pathname.startsWith('/portfolio')
    ? QUICK_CONTEXTUAL_CREATE.portfolio
    : pathname.startsWith('/budgets')
      ? QUICK_CONTEXTUAL_CREATE.budgets
      : pathname.startsWith('/credits')
        ? QUICK_CONTEXTUAL_CREATE.credits
        : null
  const navigate = (href: string, source: 'pointer' | 'keyboard') => {
    const target = new URL(href, window.location.origin)
    window.dispatchEvent(new CustomEvent('ft-v3-route-intent', { detail: { pathname: target.pathname, source } }))
    router.push(href)
  }
  const actions: AnchoredAction[] = QUICK_OPERATIONS.map(operation => ({
    id: operation.id,
    label: operation.label,
    groupLabel: 'group' in operation ? operation.group : undefined,
    onSelect: source => navigate(operation.href, source),
  }))
  if (contextual) {
    actions.push({
      id: contextual.id,
      label: contextual.label,
      groupLabel: 'En este módulo',
      onSelect: source => navigate(contextual.href, source),
    })
  }

  return (
    <div className="ft-quick-register-shell">
      <AnchoredActionMenu
        label="Registrar"
        actions={actions}
        className="ft-quick-register"
        menuClassName="ft-register-menu"
        focusFirstOnPointer={false}
        dismissOnSourceScroll
        dismissOnFocusExit
        dismissSignal={pathname}
        renderTriggerContent={open => <IconPlus size={21} className={open ? 'ft-register-plus-open' : 'ft-register-plus'} />}
      />
    </div>
  )
}
