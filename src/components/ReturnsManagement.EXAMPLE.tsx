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
 * EXAMPLE: Refactored Returns Management Component
 * 
 * This is a demonstration of how ReturnsManagement.tsx should look after refactoring.
 * Compare this with the current version to see the improvements.
 * 
 * Key Changes:
 * - Uses shared utilities from @/utils
 * - Uses shared components from @/components/shared
 * - Cleaner code with less duplication
 * - Better type safety
 * - Easier to maintain
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RotateCcw, Search, Eye, Check, X, Package } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useReturns, useUpdateReturnStatus } from '@/modules/returns/hooks/useReturns'
import { Return } from '@/modules/returns/api/returnService'

//  Import shared utilities instead of defining locally
import { formatMoney, formatDateTime } from '@/utils'

//  Import shared components
import { 
  StatusBadge, 
  Pagination, 
  LoadingState, 
  EmptyState,
  ConfirmDialog 
} from '@/components/shared'

type ReturnStatusName = 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Completada'

const ReturnsManagementRefactored = () => {
  const { toast } = useToast()

  // State management - grouped by concern
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    page: 1
  })

  const [dialogs, setDialogs] = useState({
    view: false,
    statusUpdate: false,
    stockRestore: false
  })

  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null)
  const [statusToUpdate, setStatusToUpdate] = useState<ReturnStatusName | null>(null)
  const [returnToUpdate, setReturnToUpdate] = useState<Return | null>(null)
  const [shouldRestoreStock, setShouldRestoreStock] = useState(true)

  // Data fetching
  const { data: returnsData, isLoading, refetch } = useReturns({
    status: filters.status !== 'all' ? filters.status : undefined,
    page: filters.page,
    pageSize: 10
  })

  const updateStatusMutation = useUpdateReturnStatus()

  // Event handlers - clear and focused
  const handleViewReturn = (returnRecord: Return) => {
    setSelectedReturn(returnRecord)
    setDialogs(prev => ({ ...prev, view: true }))
  }

  const handleOpenStatusUpdate = (returnRecord: Return, newStatus: ReturnStatusName) => {
    setReturnToUpdate(returnRecord)
    setStatusToUpdate(newStatus)
    
    if (newStatus === 'Aprobada') {
      setShouldRestoreStock(true)
      setDialogs(prev => ({ ...prev, stockRestore: true }))
    } else {
      setDialogs(prev => ({ ...prev, statusUpdate: true }))
    }
  }

  const handleConfirmStatusUpdate = async (restoreStock?: boolean) => {
    if (!returnToUpdate || !statusToUpdate) return

    try {
      const payload: { status_name: ReturnStatusName; restore_stock?: boolean } = {
        status_name: statusToUpdate
      }

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

      // Close dialogs and reset
      setDialogs({ view: false, statusUpdate: false, stockRestore: false })
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

  // Filter returns by search term
  const filteredReturns = returnsData?.items.filter((ret) => {
    if (!filters.search) return true
    const term = filters.search.toLowerCase()
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
      {/* Header */}
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
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
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
        </CardHeader>
        <CardContent>
          {/* ✅ Using LoadingState component */}
          {isLoading ? (
            <LoadingState message="Cargando devoluciones..." />
          ) : filteredReturns.length === 0 ? (
            /* ✅ Using EmptyState component */
            <EmptyState
              icon={RotateCcw}
              title="No se encontraron devoluciones"
              description="No hay devoluciones que coincidan con los filtros seleccionados"
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">ID Devolución</th>
                      <th className="text-left p-3 font-medium">Fecha</th>
                      <th className="text-left p-3 font-medium">Venta</th>
                      <th className="text-left p-3 font-medium">Cliente</th>
                      <th className="text-left p-3 font-medium">Items</th>
                      <th className="text-left p-3 font-medium">Total Reembolso</th>
                      <th className="text-left p-3 font-medium">Estado</th>
                      <th className="text-left p-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.map((ret) => (
                      <tr key={ret.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-mono text-sm">{ret.id.substring(0, 8)}...</td>
                        {/* ✅ Using formatDateTime from utils */}
                        <td className="p-3 text-sm">{formatDateTime(ret.return_date)}</td>
                        <td className="p-3 font-mono text-sm">{ret.sale_id.substring(0, 8)}...</td>
                        <td className="p-3">{ret.sale?.customer || 'N/A'}</td>
                        <td className="p-3 text-center">{ret.items_count}</td>
                        {/* ✅ Using formatMoney from utils */}
                        <td className="p-3 font-medium">{formatMoney(ret.total_refund)}</td>
                        {/* ✅ Using StatusBadge component */}
                        <td className="p-3"><StatusBadge status={ret.status.name} /></td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewReturn(ret)}
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {ret.status.name === 'Pendiente' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:bg-green-50"
                                  onClick={() => handleOpenStatusUpdate(ret, 'Aprobada')}
                                  title="Aprobar"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => handleOpenStatusUpdate(ret, 'Rechazada')}
                                  title="Rechazar"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {ret.status.name === 'Aprobada' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 hover:bg-blue-50"
                                onClick={() => handleOpenStatusUpdate(ret, 'Completada')}
                                title="Completar"
                              >
                                <Package className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ✅ Using Pagination component */}
              <Pagination
                currentPage={returnsData?.page || 1}
                totalPages={returnsData?.totalPages || 1}
                onPageChange={(newPage) => setFilters(prev => ({ ...prev, page: newPage }))}
                hasNextPage={!!returnsData?.nextPage}
                hasPrevPage={!!returnsData?.prevPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* View Return Dialog - Simplified with shared components */}
      <Dialog open={dialogs.view} onOpenChange={(open) => setDialogs(prev => ({ ...prev, view: open }))}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Devolución</DialogTitle>
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
                  <div>{formatDateTime(selectedReturn.return_date)}</div>
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
                  <Label>Estado</Label>
                  <div><StatusBadge status={selectedReturn.status.name} /></div>
                </div>
                <div>
                  <Label>Total Reembolso</Label>
                  <div className="font-bold text-lg">{formatMoney(selectedReturn.total_refund)}</div>
                </div>
              </div>

              {selectedReturn.reason && (
                <div>
                  <Label>Razón de Devolución</Label>
                  <div className="text-sm bg-muted p-3 rounded">{selectedReturn.reason}</div>
                </div>
              )}

              <div>
                <Label>Productos Devueltos</Label>
                <div className="border rounded-lg divide-y mt-2">
                  {selectedReturn.return_items.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-medium">{item.product?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Cantidad devuelta: {item.qty_returned}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatMoney(item.refund_amount)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatMoney(item.refund_amount / item.qty_returned)}/u
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ Using ConfirmDialog component for stock restoration */}
      <Dialog 
        open={dialogs.stockRestore} 
        onOpenChange={(open) => setDialogs(prev => ({ ...prev, stockRestore: open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cambio de Estado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>¿Estás seguro de cambiar el estado de esta devolución a <strong>Aprobada</strong>?</p>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="font-medium mb-3 text-blue-900">
                ¿Deseas restaurar el stock de los productos devueltos?
              </p>
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
                  setDialogs(prev => ({ ...prev, stockRestore: false }))
                  setReturnToUpdate(null)
                  setStatusToUpdate(null)
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => handleConfirmStatusUpdate(shouldRestoreStock)} 
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? 'Actualizando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog for other statuses */}
      {/* ✅ Could be replaced with ConfirmDialog component */}
      <Dialog 
        open={dialogs.statusUpdate} 
        onOpenChange={(open) => setDialogs(prev => ({ ...prev, statusUpdate: open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cambio de Estado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              ¿Estás seguro de cambiar el estado de esta devolución a <strong>{statusToUpdate}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setDialogs(prev => ({ ...prev, statusUpdate: false }))}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => handleConfirmStatusUpdate()} 
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? 'Actualizando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ReturnsManagementRefactored
