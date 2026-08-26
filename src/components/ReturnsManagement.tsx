/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Search,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Package
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useReturns, useUpdateReturnStatus } from '@/hooks/useReturns'
import { Return } from '@/services/returnService'
import { formatMoney, formatDateTime } from '@/utils'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'

type ReturnStatusName = 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Completada'

const ReturnsManagement = () => {
  const { toast } = useToast()
  const { locale, currencyCode } = useSystemSettings()
  const { hasPermission } = useAuthPermissions()
  // Con solo returns.view se puede consultar, pero no aprobar/rechazar/completar
  const canManageReturns = hasPermission('returns.manage')

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const { page, setPage } = usePersistedListUiState('devoluciones/lista', { defaultPage: 1, defaultPageSize: 10 })
  useResetPageOnFilterChange(setPage, [statusFilter, searchTerm])

  // Fetch returns with filters
  const { data: returnsData, isLoading, refetch } = useReturns({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    pageSize: 10
  })

  // Mutations
  const updateStatusMutation = useUpdateReturnStatus()

  // View return dialog
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null)

  // Status update confirmation
  const [isStatusUpdateOpen, setIsStatusUpdateOpen] = useState(false)
  const [statusToUpdate, setStatusToUpdate] = useState<ReturnStatusName | null>(null)
  const [returnToUpdate, setReturnToUpdate] = useState<Return | null>(null)

  // Stock restoration confirmation (only for "Aprobada" status)
  const [isStockRestoreConfirmOpen, setIsStockRestoreConfirmOpen] = useState(false)
  const [shouldRestoreStock, setShouldRestoreStock] = useState(true)



  const getStatusBadge = (statusName: string) => {
    switch (statusName) {
      case 'Pendiente':
        return <Badge className="bg-yellow-500 text-white">Pendiente</Badge>
      case 'Aprobada':
        return <Badge className="bg-blue-500 text-white">Aprobada</Badge>
      case 'Rechazada':
        return <Badge variant="destructive">Rechazada</Badge>
      case 'Completada':
        return <Badge className="bg-green-500 text-white">Completada</Badge>
      default:
        return <Badge variant="outline">{statusName}</Badge>
    }
  }

  const getTypeBadge = (type: Return['type']) =>
    type === 'EXCHANGE'
      ? <Badge className="bg-blue-500 text-white">Cambio</Badge>
      : <Badge className="bg-orange-500 text-white">Devolución</Badge>

  const viewReturn = (returnRecord: Return) => {
    setSelectedReturn(returnRecord)
    setIsViewOpen(true)
  }

  const openStatusUpdate = (returnRecord: Return, newStatus: ReturnStatusName) => {
    setIsViewOpen(false)
    setReturnToUpdate(returnRecord)
    setStatusToUpdate(newStatus)

    // Si el nuevo estado es "Aprobada", preguntar primero si desea restaurar stock
    if (newStatus === 'Aprobada') {
      setShouldRestoreStock(true) // Por defecto, sí restaurar
      setIsStockRestoreConfirmOpen(true)
    } else {
      // Para otros estados, mostrar confirmación normal
      setIsStatusUpdateOpen(true)
    }
  }

  const confirmStatusUpdate = async (restoreStock?: boolean) => {
    if (!returnToUpdate || !statusToUpdate) return

    try {
      const payload: { status_name: ReturnStatusName; restore_stock?: boolean } = {
        status_name: statusToUpdate
      }

      // Solo incluir restore_stock si el estado es "Aprobada"
      if (statusToUpdate === 'Aprobada' && restoreStock !== undefined) {
        payload.restore_stock = restoreStock
      }

      await updateStatusMutation.mutateAsync({
        id: returnToUpdate.id,
        payload
      })

      const stockMessage =
        statusToUpdate === 'Aprobada' && restoreStock
          ? ' El stock ha sido restaurado.'
          : statusToUpdate === 'Aprobada' && !restoreStock
            ? ' El stock NO fue restaurado.'
            : ''

      toast({
        title: 'Estado actualizado',
        description: `La devolución ahora está en estado: ${statusToUpdate}.${stockMessage}`,
        variant: 'default'
      })

      setIsStatusUpdateOpen(false)
      setIsStockRestoreConfirmOpen(false)
      setReturnToUpdate(null)
      setStatusToUpdate(null)
      refetch()
    } catch (error) {
      toast({
        title: 'Error al actualizar estado',
        description: (error as Error).message || 'No se pudo actualizar el estado',
        variant: 'destructive'
      })
    }
  }

  // Filter returns by search term (client-side filtering)
  const filteredReturns = returnsData?.items.filter((ret) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      ret.id.toLowerCase().includes(term) ||
      ret.sale_id.toLowerCase().includes(term) ||
      ret.sale?.customer?.toLowerCase().includes(term) ||
      ret.return_items.some((item) =>
        item.product?.name.toLowerCase().includes(term)
      )
    )
  }) || []

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestión de Devoluciones</h2>
          <p className="text-muted-foreground">Control de devoluciones y reembolsos</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="ID, venta, cliente, producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Aprobada">Aprobada</SelectItem>
                  <SelectItem value="Rechazada">Rechazada</SelectItem>
                  <SelectItem value="Completada">Completada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => refetch()} className="w-full">
                Actualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Returns List */}
      <Card>
        <CardHeader>
          <CardTitle>Devoluciones Registradas ({returnsData?.totalItems || 0})</CardTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Haz clic en una fila para ver el detalle y gestionar el estado si aplica.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando devoluciones...</div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron devoluciones
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">ID Devolución</th>
                      <th className="text-left p-3 font-medium">Tipo</th>
                      <th className="text-left p-3 font-medium">Fecha</th>
                      <th className="text-left p-3 font-medium">Venta</th>
                      <th className="text-left p-3 font-medium">Cliente</th>
                      <th className="text-left p-3 font-medium">Sucursal</th>
                      <th className="text-left p-3 font-medium">Items</th>
                      <th className="text-left p-3 font-medium">Total Reembolso</th>
                      <th className="text-left p-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.map((ret) => (
                      <tr
                        key={ret.id}
                        role="button"
                        tabIndex={0}
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onClick={() => viewReturn(ret)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            viewReturn(ret)
                          }
                        }}
                      >
                        <td className="p-3 font-mono text-sm">{ret.id.substring(0, 8)}...</td>
                        <td className="p-3">{getTypeBadge(ret.type)}</td>
                        <td className="p-3 text-sm">{formatDateTime(ret.return_date, undefined, locale)}</td>
                        <td className="p-3 font-mono text-sm">{ret.sale_id.substring(0, 8)}...</td>
                        <td className="p-3">{ret.sale?.customer || 'N/A'}</td>
                        <td className="p-3 text-sm text-muted-foreground">{ret.sale?.branch?.name ?? '—'}</td>
                        <td className="p-3 text-center">{ret.items_count}</td>
                        <td className="p-3 font-medium">{formatMoney(ret.total_refund, locale, currencyCode)}</td>
                        <td className="p-3">{getStatusBadge(ret.status.name)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-end items-center gap-2 mt-4">
                <span className="text-sm text-muted-foreground mr-2">
                  Página {returnsData?.page} de {returnsData?.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!returnsData?.prevPage}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!returnsData?.nextPage}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View Return Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReturn?.type === 'EXCHANGE' ? 'Detalle de Cambio' : 'Detalle de Devolución'}</DialogTitle>
            <DialogDescription className="sr-only">
              Productos, montos y estado de esta {selectedReturn?.type === 'EXCHANGE' ? 'cambio' : 'devolución'}.
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID Devolución</Label>
                  <div className="font-mono text-sm">{selectedReturn.id}</div>
                </div>
                <div>
                  <Label>Fecha</Label>
                  <div>{formatDateTime(selectedReturn.return_date, undefined, locale)}</div>
                </div>
                <div>
                  <Label>Venta Relacionada</Label>
                  <div className="font-mono text-sm">{selectedReturn.sale_id}</div>
                </div>
                <div>
                  <Label>Cliente</Label>
                  <div>{selectedReturn.sale?.customer || 'N/A'}</div>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <div>{getTypeBadge(selectedReturn.type)}</div>
                </div>
                <div>
                  <Label>Estado</Label>
                  <div>{getStatusBadge(selectedReturn.status.name)}</div>
                </div>
                <div>
                  <Label>{selectedReturn.type === 'EXCHANGE' ? 'Valor Devuelto' : 'Total Reembolso'}</Label>
                  <div className="font-bold text-lg">{formatMoney(selectedReturn.total_refund, locale, currencyCode)}</div>
                </div>
              </div>

              {selectedReturn.reason && (
                <div>
                  <Label>Razón de Devolución</Label>
                  <div className="text-sm bg-muted p-3 rounded">{selectedReturn.reason}</div>
                </div>
              )}

              {selectedReturn.notes && (
                <div>
                  <Label>Notas</Label>
                  <div className="text-sm bg-muted p-3 rounded">{selectedReturn.notes}</div>
                </div>
              )}

              <div>
                <Label>{selectedReturn.type === 'EXCHANGE' ? 'Productos que Entregó el Cliente' : 'Productos Devueltos'}</Label>
                <div className="border rounded-lg divide-y mt-2">
                  {selectedReturn.return_items.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-medium">{item.product?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Cantidad devuelta: {item.qty_returned}
                        </div>
                        {item.reason && (
                          <div className="text-sm text-muted-foreground italic">{item.reason}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatMoney(item.refund_amount, locale, currencyCode)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatMoney(item.refund_amount / item.qty_returned, locale, currencyCode)}/u
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedReturn.type === 'EXCHANGE' && (
                <>
                  <div>
                    <Label>Productos de Reemplazo (se llevó el cliente)</Label>
                    <div className="border rounded-lg divide-y mt-2">
                      {(selectedReturn.replacement_items ?? []).map((item) => (
                        <div key={item.id} className="p-3 flex justify-between items-center">
                          <div className="flex-1">
                            <div className="font-medium">{item.product?.name}</div>
                            <div className="text-sm text-muted-foreground">Cantidad: {item.qty}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatMoney(item.line_total, locale, currencyCode)}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatMoney(item.unit_price, locale, currencyCode)}/u
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg flex justify-between items-center">
                    <span className="font-bold">
                      {Number(selectedReturn.price_difference) > 0
                        ? 'A cobrar al cliente:'
                        : Number(selectedReturn.price_difference) < 0
                          ? 'A devolver al cliente:'
                          : 'Sin diferencia:'}
                    </span>
                    <span className={`text-xl font-bold ${Number(selectedReturn.price_difference) > 0 ? 'text-red-600' : Number(selectedReturn.price_difference) < 0 ? 'text-green-600' : ''}`}>
                      {formatMoney(Math.abs(Number(selectedReturn.price_difference)), locale, currencyCode)}
                    </span>
                  </div>
                </>
              )}

              {selectedReturn.processed_at && (
                <div className="text-sm text-muted-foreground">
                  Procesado: {formatDateTime(selectedReturn.processed_at, undefined, locale)}
                </div>
              )}

              {canManageReturns && (selectedReturn.status.name === 'Pendiente' || selectedReturn.status.name === 'Aprobada') && (
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {selectedReturn.status.name === 'Pendiente' && (
                    <>
                      <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => openStatusUpdate(selectedReturn, 'Aprobada')}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Aprobar
                      </Button>
                      <Button variant="destructive" onClick={() => openStatusUpdate(selectedReturn, 'Rechazada')}>
                        <X className="w-4 h-4 mr-2" />
                        Rechazar
                      </Button>
                    </>
                  )}
                  {selectedReturn.status.name === 'Aprobada' && (
                    <Button variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50" onClick={() => openStatusUpdate(selectedReturn, 'Completada')}>
                      <Package className="w-4 h-4 mr-2" />
                      Marcar completada
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock Restoration Confirmation Dialog (for "Aprobada" status) */}
      <Dialog open={isStockRestoreConfirmOpen} onOpenChange={setIsStockRestoreConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cambio de Estado</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de cambiar el estado de esta devolución a <strong>Aprobada</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="font-medium mb-3 text-blue-900">¿Deseas restaurar el stock de los productos devueltos?</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 bg-white rounded cursor-pointer hover:bg-blue-50 border border-transparent hover:border-blue-300 transition">
                  <input
                    type="radio"
                    name="restore_stock"
                    checked={shouldRestoreStock === true}
                    onChange={() => setShouldRestoreStock(true)}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">Sí, restaurar el stock</div>
                    <div className="text-xs text-muted-foreground">
                      Los productos devueltos volverán al inventario
                    </div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 bg-white rounded cursor-pointer hover:bg-blue-50 border border-transparent hover:border-blue-300 transition">
                  <input
                    type="radio"
                    name="restore_stock"
                    checked={shouldRestoreStock === false}
                    onChange={() => setShouldRestoreStock(false)}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">No, no restaurar el stock</div>
                    <div className="text-xs text-muted-foreground">
                      El inventario permanecerá sin cambios
                    </div>
                  </div>
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsStockRestoreConfirmOpen(false)
                  setReturnToUpdate(null)
                  setStatusToUpdate(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => confirmStatusUpdate(shouldRestoreStock)}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? 'Actualizando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Update Confirmation Dialog (for other statuses) */}
      <Dialog open={isStatusUpdateOpen} onOpenChange={setIsStatusUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cambio de Estado</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de cambiar el estado de esta devolución a <strong>{statusToUpdate}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {statusToUpdate === 'Rechazada' && (
              <div className="bg-red-50 p-3 rounded text-sm">
                <strong>Nota:</strong> Esta acción no se puede revertir.
              </div>
            )}
            {statusToUpdate === 'Completada' && (
              <div className="bg-green-50 p-3 rounded text-sm">
                <strong>Nota:</strong> Marca la devolución como completada. El reembolso debe haber sido procesado.
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsStatusUpdateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => confirmStatusUpdate()} disabled={updateStatusMutation.isPending}>
                {updateStatusMutation.isPending ? 'Actualizando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ReturnsManagement
