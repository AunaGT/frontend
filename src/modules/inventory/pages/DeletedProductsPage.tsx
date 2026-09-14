/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Pagination } from '@/components/shared/Pagination'
import { useToast } from '@/hooks/use-toast'
import { useDeletedProducts, useRestoreProduct } from '@/hooks/useProducts'
import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
import type { Product } from '@/types'
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react'

export default function DeletedProductsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { page: currentPage, setPage: setCurrentPage, pageSize } = usePersistedListUiState(
    'inventario/productos-eliminados',
    { defaultPage: 1, defaultPageSize: 20 }
  )

  const { data: allDeletedProducts = [], isLoading, isError, refetch } = useDeletedProducts()

  const totalPages = Math.max(1, Math.ceil(allDeletedProducts.length / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const products = allDeletedProducts.slice(startIndex, startIndex + pageSize)

  const restoreMutation = useRestoreProduct()
  const [restoreConfirmProduct, setRestoreConfirmProduct] = useState<Product | null>(null)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

  const confirmRestoreDeletedProduct = async () => {
    if (!restoreConfirmProduct) return
    const name = restoreConfirmProduct.name
    try {
      await restoreMutation.mutateAsync(restoreConfirmProduct.id)
      setRestoreConfirmProduct(null)
      void refetch()
      toast({
        title: 'Producto restaurado',
        description: `El producto "${name}" ha sido restaurado exitosamente`,
      })
    } catch (error) {
      const apiError = error as { response?: { data?: { message?: string } } }
      toast({
        title: 'Error',
        description: apiError.response?.data?.message || 'No se pudo restaurar el producto',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 w-fit" onClick={() => navigate('/inventario')}>
            <ArrowLeft className="h-4 w-4" />
            Volver al inventario
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Productos eliminados</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Restaura productos que fueron eliminados; volverán al listado principal.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg">Listado</CardTitle>
          <CardDescription>Productos marcados como eliminados en el sistema</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {isError ? (
            <p className="text-center text-destructive py-8 text-sm">Error al cargar productos eliminados</p>
          ) : isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No hay productos eliminados</p>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          {typeof product.category === 'string'
                            ? product.category
                            : (product.category as { name: string }).name || '-'}
                        </TableCell>
                        <TableCell>{product.brand || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={product.stock > 0 ? 'default' : 'secondary'}>{product.stock}</Badge>
                        </TableCell>
                        <TableCell>
                          {typeof product.supplier === 'string'
                            ? product.supplier
                            : (product.supplier as { name: string })?.name || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRestoreConfirmProduct(product)}
                            disabled={restoreMutation.isPending}
                          >
                            {restoreMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Restaurar
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    hasNextPage={currentPage < totalPages}
                    hasPrevPage={currentPage > 1}
                    loading={isLoading}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!restoreConfirmProduct}
        onOpenChange={(o) => {
          if (!o) setRestoreConfirmProduct(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreConfirmProduct
                ? `«${restoreConfirmProduct.name}» volverá al inventario y estará disponible de nuevo.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoreMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                void confirmRestoreDeletedProduct()
              }}
            >
              {restoreMutation.isPending ? 'Restaurando…' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
