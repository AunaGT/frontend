import { MoreHorizontal, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function CatalogRowActions({ onEdit, onDelete, onRestore, disabled = false, deleteDisabled = false }: {
  onEdit?: () => void
  onDelete?: () => void
  onRestore?: () => void
  disabled?: boolean
  deleteDisabled?: boolean
}) {
  return <div className="flex justify-end gap-2">
    {onEdit && <Button variant="outline" size="icon" aria-label="Editar" disabled={disabled} onClick={onEdit}><Pencil className="h-4 w-4" /></Button>}
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Más acciones" disabled={disabled}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onRestore && <DropdownMenuItem onSelect={onRestore}><RotateCcw className="mr-2 h-4 w-4" />Restaurar</DropdownMenuItem>}
        {onDelete && <DropdownMenuItem disabled={deleteDisabled} onSelect={onDelete} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />{deleteDisabled ? 'En uso: no se puede eliminar' : 'Eliminar'}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
}
