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
 * LoadingState - Reusable loading state component
 */
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import './loading.css'

interface LoadingStateProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'table' | 'cards' | 'detail' | 'page' | 'inline' | 'chart'
  columns?: readonly string[]
  rows?: number
  className?: string
}

/** Local feedback for refreshing existing data; never obscures or replaces it. */
export function LoadingIndicator({ message = 'Actualizando…', className }: { message?: string; className?: string }) {
  return <div role="status" aria-live="polite" className={cn('auna-loading-status', className)}>
    <span className="auna-loading-segment" aria-hidden="true"><i /><i /><i /></span>
    <span>{message}</span>
  </div>
}

/** Valid table children: keep the caller's headers instead of nesting another table. */
export function TableLoadingRows({ columns, rows = 5, message }: { columns: number; rows?: number; message?: string }) {
  return <>
    {message && <tr><td colSpan={columns}><LoadingIndicator message={message} /></td></tr>}
    {Array.from({ length: rows }, (_, row) => <tr key={row} data-loading-row="true" aria-hidden="true" className="auna-loading-row">
      {Array.from({ length: columns }, (_, column) => <td key={column} data-loading-cell="true"><Skeleton className="h-3.5 max-w-40" style={{ width: `${[58, 82, 65, 72][(row + column) % 4]}%` }} /></td>)}
    </tr>)}
  </>
}

export const LoadingState = ({ message = 'Cargando…', size = 'md', variant = 'table', columns, rows = size === 'sm' ? 3 : 5, className }: LoadingStateProps) => {
  if (variant === 'inline') return <LoadingIndicator message={message} className={className} />
  if (variant === 'chart') return <div aria-busy="true" className={cn('auna-loading-state auna-loading-chart', className)}>
    <LoadingIndicator message={message} />
    <Skeleton aria-hidden="true" className="min-h-0 w-full flex-1" />
  </div>
  const detail = variant === 'detail' || variant === 'page'
  return <div aria-busy="true" className={cn('auna-loading-state', variant === 'page' && 'auna-loading-page', className)}>
    <LoadingIndicator message={message} />
    {detail ? <div aria-hidden="true" className="space-y-4">
      <div className="flex items-center gap-4"><Skeleton className="h-20 w-20 shrink-0 rounded-lg" /><div className="flex-1 space-y-3"><Skeleton className="h-6 w-2/5" /><Skeleton className="h-3.5 w-3/5" /></div></div>
      <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <div key={index} className="auna-loading-panel space-y-4"><Skeleton className="h-5 w-2/5" /><div className="grid grid-cols-2 gap-5">{Array.from({ length: 6 }, (_, field) => <div key={field} className="space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-4 w-4/5" /></div>)}</div></div>)}</div>
    </div> : variant === 'cards' ? <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: rows }, (_, index) => <div key={index} className="auna-loading-panel space-y-4"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 shrink-0" /><Skeleton className="h-4 w-3/5" /></div><Skeleton className="h-3.5 w-4/5" /><Skeleton className="h-3.5 w-1/2" /></div>)}</div>
      : <div className="overflow-x-auto"><table className="auna-loading-table">
        {columns && <thead><tr>{columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead>}
        <tbody><TableLoadingRows columns={columns?.length || 4} rows={rows} /></tbody>
      </table></div>}
  </div>
}
