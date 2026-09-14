/**
 * Pestaña de métodos de pago en Datos maestros (ventas y cierre de caja).
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
import { Pagination } from '@/components/shared/Pagination'
import {
  usePaymentMethodsCatalog,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  paymentMethodUsageCounts,
  catalogApiErrorMessage,
  type PaymentMethodCatalog,
} from '@/hooks/usePaymentMethodsCatalog'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

type MethodDialogState = {
  open: boolean
  mode: 'create' | 'edit'
  item?: PaymentMethodCatalog
}

export function PaymentMethodsTab() {
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canManageCatalogs = hasPermission('catalogs.manage')

  const { page: currentPage, setPage: setCurrentPage, pageSize } = usePersistedListUiState(
    'catalogs/payment-methods',
    { defaultPage: 1, defaultPageSize: 10 }
  )

  const { data, isLoading } = usePaymentMethodsCatalog({
    page: currentPage,
    pageSize,
  })
  const items = data?.items ?? []

  const [dialog, setDialog] = useState<MethodDialogState>({ open: false, mode: 'create' })
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodCatalog | null>(null)
  const deleteMutation = useDeletePaymentMethod()

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
      toast({
        title: 'Método eliminado',
        description: 'El método de pago ha sido eliminado correctamente',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: catalogApiErrorMessage(error, 'No se pudo eliminar el método de pago'),
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl">Métodos de pago</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Administra los métodos de cobro en ventas y cierre de caja
              </CardDescription>
            </div>
            {canManageCatalogs && (
              <Button
                size="sm"
                onClick={() => setDialog({ open: true, mode: 'create' })}
                className="text-xs sm:text-sm shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Nuevo</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ventas</TableHead>
                  <TableHead>Cierres de caja</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No hay métodos de pago registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((method) => {
                    const usage = paymentMethodUsageCounts(method)
                    const inUse = usage.total > 0
                    return (
                      <TableRow key={method.id}>
                        <TableCell className="font-medium">{method.id}</TableCell>
                        <TableCell>{method.name}</TableCell>
                        <TableCell>{usage.sales}</TableCell>
                        <TableCell>{usage.closures}</TableCell>
                        <TableCell>
                          <Badge variant="default">Activo</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageCatalogs && (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  setDialog({ open: true, mode: 'edit', item: method })
                                }
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                title={
                                  inUse
                                    ? 'No se puede eliminar: tiene ventas o cierres registrados'
                                    : 'Eliminar'
                                }
                                onClick={() => setDeleteTarget(method)}
                                disabled={inUse || deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
          {data && data.totalPages > 0 && data.totalItems > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={data.page}
                totalPages={data.totalPages}
                onPageChange={setCurrentPage}
                hasNextPage={data.nextPage !== null}
                hasPrevPage={data.prevPage !== null}
                loading={isLoading}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentMethodDialog dialog={dialog} setDialog={setDialog} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar método de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Se eliminará «${deleteTarget.name}» de forma permanente. No podrás usarlo en ventas ni cierres nuevos.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PaymentMethodDialog({
  dialog,
  setDialog,
}: {
  dialog: MethodDialogState
  setDialog: (v: MethodDialogState) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const createMutation = useCreatePaymentMethod()
  const updateMutation = useUpdatePaymentMethod()

  useEffect(() => {
    if (!dialog.open) return
    if (dialog.mode === 'create' || !dialog.item) {
      setName('')
    } else {
      setName(dialog.item.name)
    }
  }, [dialog.open, dialog.mode, dialog.item])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('')
      setDialog({ open: false, mode: 'create' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El nombre es requerido',
      })
      return
    }
    if (trimmed.length > 50) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El nombre no puede superar 50 caracteres',
      })
      return
    }

    try {
      if (dialog.mode === 'create') {
        await createMutation.mutateAsync({ name: trimmed })
        toast({
          title: 'Método creado',
          description: 'El método de pago ha sido creado correctamente',
        })
      } else if (dialog.item) {
        await updateMutation.mutateAsync({ id: dialog.item.id, data: { name: trimmed } })
        toast({
          title: 'Método actualizado',
          description: 'El método de pago ha sido actualizado correctamente',
        })
      }
      handleOpenChange(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: catalogApiErrorMessage(error, 'Ocurrió un error'),
      })
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={dialog.open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {dialog.mode === 'create' ? 'Nuevo método de pago' : 'Editar método de pago'}
          </DialogTitle>
          <DialogDescription>
            {dialog.mode === 'create'
              ? 'Crea un método de cobro para el punto de venta y el arqueo de caja'
              : 'Modifica el nombre del método de pago'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Nombre del método</Label>
              <Input
                id="pm-name"
                placeholder="Ej: Efectivo, Tarjeta, Transferencia"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {dialog.mode === 'create' ? 'Crear' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
