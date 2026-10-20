/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * EmptyState - Reusable empty state component
 */
import type { LucideIcon } from 'lucide-react'
import './emptyState.css'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  illustration?: boolean
  size?: 'default' | 'compact'
}

export const EmptyState = ({ icon: Icon, title, description, action, illustration = false, size = 'default' }: EmptyStateProps) => {
  return (
    <div className={`auna-empty-state${size === 'compact' ? ' auna-empty-state--compact' : ''}`} role={illustration ? 'status' : undefined}>
      {illustration ? <img className="auna-empty-state-art" src="/illustrations/empty-states/workspace-flat.png" alt="" aria-hidden="true" width={size === 'compact' ? 96 : 180} height={size === 'compact' ? 64 : 120} decoding="async" />
        : Icon && <Icon aria-hidden="true" className="w-12 h-12 text-muted-foreground/50 mb-4" />}
      <h3 className="auna-empty-state-title">{title}</h3>
      {description && (
        <p className="auna-empty-state-description">
          {description}
        </p>
      )}
      {action && <div className="auna-empty-state-action">{action}</div>}
    </div>
  )
}
