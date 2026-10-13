import type { KeyboardEvent, MouseEvent } from 'react'

export function recordCardNavigation(open?: () => void) {
  if (!open) return {}
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (!event.defaultPrevented && !(event.target as HTMLElement)?.closest?.('button, a, input, select, textarea, [role="menuitem"]')) open()
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        open()
      }
    },
  }
}
