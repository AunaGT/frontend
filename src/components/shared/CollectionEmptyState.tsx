import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from './EmptyState'

export function CollectionEmptyState({ title, description, action, filtered = false, onReset, compact = false }: {
  title: string
  description?: string
  action?: ReactNode
  filtered?: boolean
  onReset?: () => void
  compact?: boolean
}) {
  return <EmptyState illustration size={compact ? 'compact' : 'default'}
    title={filtered ? 'Busquemos por otro lado' : title}
    description={filtered ? 'Prueba otra búsqueda o ajusta los filtros para encontrar lo que necesitas.' : description}
    action={filtered ? onReset && <Button type="button" variant="outline" onClick={onReset}>Limpiar filtros</Button> : action} />
}
