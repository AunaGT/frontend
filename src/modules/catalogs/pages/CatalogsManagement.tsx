/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  usePaymentTerms,
  useCreatePaymentTerm,
  useUpdatePaymentTerm,
  useDeletePaymentTerm,
  useRestorePaymentTerm,
  PaymentTerm,
} from '@/hooks/usePaymentTerms'
import {
  useProductCategories,
  useCreateProductCategory,
  useUpdateProductCategory,
  useDeleteProductCategory,
  useRestoreProductCategory,
  ProductCategory,
} from '@/hooks/useProductCategories'
import { Pencil, Trash2, Plus, RotateCcw, Loader2, FileUp, ImageIcon } from 'lucide-react'
import { CatalogImportDialog } from '../components/CatalogImportDialog'
import { PaymentMethodsTab } from '../components/PaymentMethodsTab'
import { CashRegistersTab } from '../components/CashRegistersTab'
import { Pagination } from '@/components/shared/Pagination'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { getApiBaseUrl } from '@/services/api'

/** Filas de catálogo: API actual devuelve `_count.supplier_payment_terms`; respuestas antiguas `suppliers`. */
function paymentTermSupplierUsageCount(term: {
  _count?: { supplier_payment_terms?: number; suppliers?: number }
}): number {
  const c = term._count
  return c?.supplier_payment_terms ?? c?.suppliers ?? 0
}

// Tipos para los diálogos
type PaymentTermDialogState = {
  open: boolean
  mode: 'create' | 'edit'
  item?: PaymentTerm
}

type ProductCategoryDialogState = {
  open: boolean
  mode: 'create' | 'edit'
  item?: ProductCategory
}

export function CatalogsManagement() {
  const [activeTab, setActiveTab] = useState('payment-methods')
  const [showDeleted, setShowDeleted] = useState(false)

  // Payment Terms Dialog State
  const [paymentTermDialog, setPaymentTermDialog] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    item?: PaymentTerm
  }>({ open: false, mode: 'create' })

  // Product Categories Dialog State
  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    item?: ProductCategory
  }>({ open: false, mode: 'create' })

  // Import Dialog State
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importType, setImportType] = useState<'categories' | 'payment-terms'>('categories')

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Datos maestros</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Listas compartidas: métodos de cobro (ventas), términos con proveedores, categorías de producto y cajas del POS
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-4 h-auto">
            <TabsTrigger value="payment-methods" className="text-xs sm:text-sm whitespace-nowrap">
              Métodos de pago
            </TabsTrigger>
            <TabsTrigger value="payment-terms" className="text-xs sm:text-sm whitespace-nowrap">
              Términos de pago
            </TabsTrigger>
            <TabsTrigger value="categories" className="text-xs sm:text-sm whitespace-nowrap">
              Categorías
            </TabsTrigger>
            <TabsTrigger value="cash-registers" className="text-xs sm:text-sm whitespace-nowrap">
              Cajas
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="payment-methods" className="space-y-4 mt-4">
          <PaymentMethodsTab />
        </TabsContent>

        <TabsContent value="payment-terms" className="space-y-4 mt-4">
          <PaymentTermsTab
            showDeleted={showDeleted}
            setShowDeleted={setShowDeleted}
            dialog={paymentTermDialog}
            setDialog={setPaymentTermDialog}
            onImportClick={() => {
              setImportType('payment-terms')
              setIsImportDialogOpen(true)
            }}
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4 mt-4">
          <ProductCategoriesTab
            showDeleted={showDeleted}
            setShowDeleted={setShowDeleted}
            dialog={categoryDialog}
            setDialog={setCategoryDialog}
            onImportClick={() => {
              setImportType('categories')
              setIsImportDialogOpen(true)
            }}
          />
        </TabsContent>

        <TabsContent value="cash-registers" className="space-y-4 mt-4">
          <CashRegistersTab />
        </TabsContent>
      </Tabs>

      {/* Payment Terms Dialog */}
      <PaymentTermDialog
        dialog={paymentTermDialog}
        setDialog={setPaymentTermDialog}
      />

      {/* Product Categories Dialog */}
      <ProductCategoryDialog
        dialog={categoryDialog}
        setDialog={setCategoryDialog}
      />

      {/* Import Dialog */}
      <CatalogImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        type={importType}
      />
    </div>
  )
}

// Payment Terms Tab Component
function PaymentTermsTab({
  showDeleted,
  setShowDeleted,
  dialog,
  setDialog,
  onImportClick,
}: {
  showDeleted: boolean
  setShowDeleted: (value: boolean) => void
  dialog: PaymentTermDialogState
  setDialog: (value: PaymentTermDialogState) => void
  onImportClick: () => void
}) {
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canManageCatalogs = hasPermission('catalogs.manage')
  const { page: currentPage, setPage: setCurrentPage, pageSize } = usePersistedListUiState(
    'catalogs/payment-terms',
    { defaultPage: 1, defaultPageSize: 10 }
  )
  useResetPageOnFilterChange(setCurrentPage, [showDeleted])
  
  const { data: paymentTermsData, isLoading } = usePaymentTerms({
    page: currentPage,
    pageSize,
    includeDeleted: showDeleted,
  })
  const paymentTerms = paymentTermsData?.items || []

  const deleteMutation = useDeletePaymentTerm()
  const restoreMutation = useRestorePaymentTerm()
  const [deleteConfirmTerm, setDeleteConfirmTerm] = useState<PaymentTerm | null>(null)
  const [restoreConfirmTerm, setRestoreConfirmTerm] = useState<PaymentTerm | null>(null)

  const confirmDeletePaymentTerm = async () => {
    if (!deleteConfirmTerm) return
    try {
      await deleteMutation.mutateAsync(deleteConfirmTerm.id)
      setDeleteConfirmTerm(null)
      toast({
        title: 'Término eliminado',
        description: 'El término de pago ha sido eliminado correctamente',
      })
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: apiError.response?.data?.message || 'No se pudo eliminar el término de pago',
      })
    }
  }

  const confirmRestorePaymentTerm = async () => {
    if (!restoreConfirmTerm) return
    try {
      await restoreMutation.mutateAsync(restoreConfirmTerm.id)
      setRestoreConfirmTerm(null)
      toast({
        title: 'Término restaurado',
        description: 'El término de pago ha sido restaurado correctamente',
      })
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo restaurar el término de pago',
      })
    }
  }

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">Términos de Pago</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Administra los términos disponibles</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleted(!showDeleted)}
              className="text-xs sm:text-sm"
            >
              {showDeleted ? 'Ocultar' : 'Ver eliminados'}
            </Button>
            {canManageCatalogs && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onImportClick}
                  className="text-xs sm:text-sm"
                >
                  <FileUp className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Importar</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setDialog({ open: true, mode: 'create' })}
                  className="text-xs sm:text-sm"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nuevo</span>
                </Button>
              </>
            )}
          </div>
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
                <TableHead className="whitespace-nowrap">Días neto</TableHead>
                <TableHead>Proveedores</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentTerms?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay términos de pago registrados
                  </TableCell>
                </TableRow>
              ) : (
                paymentTerms?.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell className="font-medium">{term.id}</TableCell>
                    <TableCell>{term.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {term.net_days != null ? `${term.net_days} d` : '—'}
                    </TableCell>
                    <TableCell>{paymentTermSupplierUsageCount(term)}</TableCell>
                    <TableCell>
                      {term.deleted ? (
                        <Badge variant="destructive">Eliminado</Badge>
                      ) : (
                        <Badge variant="default">Activo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageCatalogs && (
                        <div className="flex justify-end gap-2">
                          {term.deleted ? (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setRestoreConfirmTerm(term)}
                              disabled={restoreMutation.isPending}
                            >
                              {restoreMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setDialog({ open: true, mode: 'edit', item: term })}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => setDeleteConfirmTerm(term)}
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        {paymentTermsData && paymentTermsData.totalPages > 0 && paymentTermsData.totalItems > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={paymentTermsData.page}
              totalPages={paymentTermsData.totalPages}
              onPageChange={setCurrentPage}
              hasNextPage={paymentTermsData.nextPage !== null}
              hasPrevPage={paymentTermsData.prevPage !== null}
              loading={isLoading}
            />
          </div>
        )}
      </CardContent>

      <AlertDialog
        open={!!deleteConfirmTerm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmTerm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar término de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmTerm
                ? `Se marcará como eliminado «${deleteConfirmTerm.name}». Podrás restaurarlo desde «Ver eliminados».`
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
                void confirmDeletePaymentTerm()
              }}
            >
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!restoreConfirmTerm}
        onOpenChange={(open) => {
          if (!open) setRestoreConfirmTerm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar término de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreConfirmTerm
                ? `«${restoreConfirmTerm.name}» volverá a estar activo y disponible para asignar a proveedores.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoreMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                void confirmRestorePaymentTerm()
              }}
            >
              {restoreMutation.isPending ? 'Restaurando…' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// Product Categories Tab Component
function ProductCategoriesTab({
  showDeleted,
  setShowDeleted,
  dialog,
  setDialog,
  onImportClick,
}: {
  showDeleted: boolean
  setShowDeleted: (value: boolean) => void
  dialog: ProductCategoryDialogState
  setDialog: (value: ProductCategoryDialogState) => void
  onImportClick: () => void
}) {
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canManageCatalogs = hasPermission('catalogs.manage')
  const { page: currentPage, setPage: setCurrentPage, pageSize } = usePersistedListUiState(
    'catalogs/categories',
    { defaultPage: 1, defaultPageSize: 10 }
  )
  useResetPageOnFilterChange(setCurrentPage, [showDeleted])
  
  const { data: categoriesData, isLoading } = useProductCategories({
    page: currentPage,
    pageSize,
    includeDeleted: showDeleted,
  })
  const categories = categoriesData?.items || []

  const deleteMutation = useDeleteProductCategory()
  const restoreMutation = useRestoreProductCategory()
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<ProductCategory | null>(null)
  const [restoreConfirmCategory, setRestoreConfirmCategory] = useState<ProductCategory | null>(null)

  const confirmDeleteCategory = async () => {
    if (!deleteConfirmCategory) return
    try {
      await deleteMutation.mutateAsync(deleteConfirmCategory.id)
      setDeleteConfirmCategory(null)
      toast({
        title: 'Categoría eliminada',
        description: 'La categoría ha sido eliminada correctamente',
      })
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: apiError.response?.data?.message || 'No se pudo eliminar la categoría',
      })
    }
  }

  const confirmRestoreCategory = async () => {
    if (!restoreConfirmCategory) return
    try {
      await restoreMutation.mutateAsync(restoreConfirmCategory.id)
      setRestoreConfirmCategory(null)
      toast({
        title: 'Categoría restaurada',
        description: 'La categoría ha sido restaurada correctamente',
      })
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo restaurar la categoría',
      })
    }
  }

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">Categorías</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Administra las categorías disponibles</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleted(!showDeleted)}
              className="text-xs sm:text-sm"
            >
              {showDeleted ? 'Ocultar' : 'Ver eliminados'}
            </Button>
            {canManageCatalogs && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onImportClick}
                  className="text-xs sm:text-sm"
                >
                  <FileUp className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Importar</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setDialog({ open: true, mode: 'create' })}
                  className="text-xs sm:text-sm"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nueva</span>
                </Button>
              </>
            )}
          </div>
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
                <TableHead className="w-[72px]">Imagen</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Proveedores</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No hay categorías registradas
                  </TableCell>
                </TableRow>
              ) : (
                categories?.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      {category.image_url ? (
                        <img
                          src={category.image_url}
                          alt={category.name}
                          className="h-12 w-12 rounded-md border border-border object-cover bg-muted"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border bg-muted/50 text-muted-foreground"
                          aria-hidden
                        >
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{category.id}</TableCell>
                    <TableCell>{category.name}</TableCell>
                    <TableCell>{category._count?.products || 0}</TableCell>
                    <TableCell>{category._count?.suppliers || 0}</TableCell>
                    <TableCell>
                      {category.deleted ? (
                        <Badge variant="destructive">Eliminado</Badge>
                      ) : (
                        <Badge variant="default">Activo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageCatalogs && (
                        <div className="flex justify-end gap-2">
                          {category.deleted ? (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setRestoreConfirmCategory(category)}
                              disabled={restoreMutation.isPending}
                            >
                              {restoreMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setDialog({ open: true, mode: 'edit', item: category })}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => setDeleteConfirmCategory(category)}
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        {categoriesData && categoriesData.totalPages > 0 && categoriesData.totalItems > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={categoriesData.page}
              totalPages={categoriesData.totalPages}
              onPageChange={setCurrentPage}
              hasNextPage={categoriesData.nextPage !== null}
              hasPrevPage={categoriesData.prevPage !== null}
              loading={isLoading}
            />
          </div>
        )}
      </CardContent>

      <AlertDialog
        open={!!deleteConfirmCategory}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmCategory(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmCategory
                ? `Se marcará como eliminada «${deleteConfirmCategory.name}». Podrás restaurarla desde «Ver eliminados».`
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
                void confirmDeleteCategory()
              }}
            >
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!restoreConfirmCategory}
        onOpenChange={(open) => {
          if (!open) setRestoreConfirmCategory(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreConfirmCategory
                ? `«${restoreConfirmCategory.name}» volverá a estar activa y disponible para productos.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoreMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                void confirmRestoreCategory()
              }}
            >
              {restoreMutation.isPending ? 'Restaurando…' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// Payment Term Dialog Component
function PaymentTermDialog({
  dialog,
  setDialog,
}: {
  dialog: PaymentTermDialogState
  setDialog: (value: PaymentTermDialogState) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [netDays, setNetDays] = useState('')
  const createMutation = useCreatePaymentTerm()
  const updateMutation = useUpdatePaymentTerm()

  useEffect(() => {
    if (!dialog.open) return
    if (dialog.mode === 'create' || !dialog.item) {
      setName('')
      setNetDays('')
    } else {
      setName(dialog.item.name)
      setNetDays(dialog.item.net_days != null ? String(dialog.item.net_days) : '')
    }
  }, [dialog.open, dialog.mode, dialog.item])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('')
      setNetDays('')
      setDialog({ open: false, mode: 'create' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El nombre es requerido',
      })
      return
    }

    let netDaysPayload: number | null | undefined
    if (netDays.trim() !== '') {
      const n = Number(netDays.trim())
      if (!Number.isFinite(n) || n < 0 || n > 3650) {
        toast({
          variant: 'destructive',
          title: 'Días neto',
          description: 'Indica un número entre 0 y 3650 o déjalo vacío',
        })
        return
      }
      netDaysPayload = Math.floor(n)
    } else {
      netDaysPayload = dialog.mode === 'edit' ? null : undefined
    }

    try {
      if (dialog.mode === 'create') {
        await createMutation.mutateAsync({
          name: name.trim(),
          net_days: netDaysPayload,
        })
        toast({
          title: 'Término creado',
          description: 'El término de pago ha sido creado correctamente',
        })
      } else if (dialog.item) {
        await updateMutation.mutateAsync({
          id: dialog.item.id,
          data: {
            name: name.trim(),
            net_days: netDaysPayload,
          },
        })
        toast({
          title: 'Término actualizado',
          description: 'El término de pago ha sido actualizado correctamente',
        })
      }

      handleOpenChange(false)
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: apiError.response?.data?.message || 'Ocurrió un error',
      })
    }
  }

  return (
    <Dialog open={dialog.open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {dialog.mode === 'create' ? 'Nuevo Término de Pago' : 'Editar Término de Pago'}
          </DialogTitle>
          <DialogDescription>
            {dialog.mode === 'create'
              ? 'Crea un nuevo término de pago para asignar a proveedores'
              : 'Modifica los datos del término de pago'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del término</Label>
              <Input
                id="name"
                placeholder="Ej: 30 días, 60 días, Contado"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="net-days">Días neto (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Días naturales desde la fecha de ingreso hasta el vencimiento sugerido al registrar mercancía;
                si no envías vencimiento manual, el servidor usa esta fecha.
              </p>
              <Input
                id="net-days"
                type="number"
                min={0}
                max={3650}
                placeholder="Ej: 30"
                value={netDays}
                onChange={(e) => setNetDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {dialog.mode === 'create' ? 'Crear' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Product Category Dialog Component
function ProductCategoryDialog({
  dialog,
  setDialog,
}: {
  dialog: ProductCategoryDialogState
  setDialog: (value: ProductCategoryDialogState) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const createMutation = useCreateProductCategory()
  const updateMutation = useUpdateProductCategory()

  useEffect(() => {
    if (dialog.open) {
      if (dialog.mode === 'edit' && dialog.item) {
        setName(dialog.item.name)
        setImageUrl(dialog.item.image_url ?? null)
      } else {
        setName('')
        setImageUrl(null)
      }
    }
  }, [dialog.open, dialog.mode, dialog.item])

  const resetForm = () => {
    setName('')
    setImageUrl(null)
    setIsUploadingImage(false)
    setDialog({ open: false, mode: 'create' })
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm()
  }

  const handleCategoryImageFile = async (file: File) => {
    try {
      setIsUploadingImage(true)
      const fd = new FormData()
      fd.append('image', file)
      const response = await fetch(`${getApiBaseUrl()}/catalogs/product-categories/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Error al subir la imagen')
      const uploadedUrl = data.imageUrl ?? data.url
      if (!uploadedUrl) throw new Error('No se recibió la URL de la imagen')
      setImageUrl(uploadedUrl)
      toast({
        title: 'Imagen subida',
        description: 'La imagen de la categoría se subió correctamente.',
      })
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error al subir imagen',
        description: (error as Error)?.message ?? 'No se pudo subir la imagen',
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El nombre es requerido',
      })
      return
    }

    const payload = {
      name: name.trim(),
      image_url: imageUrl,
    }

    try {
      if (dialog.mode === 'create') {
        await createMutation.mutateAsync(payload)
        toast({
          title: 'Categoría creada',
          description: 'La categoría ha sido creada correctamente',
        })
      } else if (dialog.item) {
        await updateMutation.mutateAsync({ id: dialog.item.id, data: payload })
        toast({
          title: 'Categoría actualizada',
          description: 'La categoría ha sido actualizada correctamente',
        })
      }

      resetForm()
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: apiError.response?.data?.message || 'Ocurrió un error',
      })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={dialog.open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {dialog.mode === 'create' ? 'Nueva Categoría' : 'Editar Categoría'}
          </DialogTitle>
          <DialogDescription>
            {dialog.mode === 'create'
              ? 'Crea una nueva categoría para clasificar productos'
              : 'Modifica los datos de la categoría'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Imagen representativa</Label>
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name || 'Categoría'}
                    className="mx-auto h-32 w-32 rounded-lg border border-border object-cover bg-muted"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                    <ImageIcon className="h-10 w-10 mb-2" />
                    <span className="text-sm">Sin imagen</span>
                  </div>
                )}
                <ImageUploadDropzone
                  onFileSelect={(f) => {
                    void handleCategoryImageFile(f)
                  }}
                  onReject={(msg) =>
                    toast({ title: 'Archivo no válido', description: msg, variant: 'destructive' })
                  }
                  disabled={isUploadingImage || isSaving}
                  isUploading={isUploadingImage}
                  helperText={
                    <>
                      Opcional. Máx 5MB. Bucket{' '}
                      <span className="font-semibold">categorias</span>.
                    </>
                  }
                />
                {imageUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setImageUrl(null)}
                    disabled={isUploadingImage || isSaving}
                  >
                    Quitar imagen
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryName">Nombre de la categoría</Label>
              <Input
                id="categoryName"
                placeholder="Ej: Licores, Cervezas, Vinos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving || isUploadingImage}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || isUploadingImage}>
              {(isSaving || isUploadingImage) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {dialog.mode === 'create' ? 'Crear' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

