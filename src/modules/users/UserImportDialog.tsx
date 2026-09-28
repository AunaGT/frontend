import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTenant } from '@/context/useTenant'

export function UserImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { company } = useTenant()
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="users-overlay">
    <DialogHeader><DialogTitle>Importar usuarios</DialogTitle><DialogDescription>El asistente carga, mapea y valida el archivo antes de crear cuentas en {company?.name || 'la empresa activa'}.</DialogDescription></DialogHeader>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => { onOpenChange(false); navigate('/usuarios/importar') }}>Abrir asistente</Button></DialogFooter>
  </DialogContent></Dialog>
}

export default UserImportDialog
