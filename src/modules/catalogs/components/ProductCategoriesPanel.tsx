/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'


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
  useProductCategories,
  useCreateProductCategory,
  useUpdateProductCategory,
  useDeleteProductCategory,
  useRestoreProductCategory,
  ProductCategory,
} from '@/hooks/useProductCategories'
import { Plus, Loader2, FileUp, ImageIcon } from 'lucide-react'
import { CatalogFilters } from './CatalogFilters'
import { CatalogRowActions } from './CatalogRowActions'
import { useCatalogSearch } from './useCatalogSearch'
import '../catalogs.css'
import { Pagination } from '@/components/shared/Pagination'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { getApiBaseUrl } from '@/services/api'
import { MASTER_DATA_IMPORT_PATH } from '@/config/appModules'

type ProductCategoryDialogState = { open: boolean; mode: 'create' | 'edit'; item?: ProductCategory }
export function ProductCategoriesPanel() {
 const navigate = useNavigate()
 const [showDeleted, setShowDeleted] = useState(false)
 const [dialog, setDialog] = useState<ProductCategoryDialogState>({open:false, mode:'create'})
 return <><ProductCategoriesTab showDeleted={showDeleted} setShowDeleted={setShowDeleted} dialog={dialog} setDialog={setDialog} onImportClick={() => navigate(`${MASTER_DATA_IMPORT_PATH}?type=categories`)} /><ProductCategoryDialog dialog={dialog} setDialog={setDialog} /></>
}
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
  const { search, setSearch, query } = useCatalogSearch()
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  useResetPageOnFilterChange(setCurrentPage, [showDeleted, query, order])

  const { data: categoriesData, isLoading, isFetching, error: categoriesError } = useProductCategories({
    includeSummary: true,
    page: currentPage,
    pageSize,
    includeDeleted: showDeleted,
    search: query, order,
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
      const apiError = error as Error
      toast({
        variant: 'destructive',
        title: 'Error',
        description: apiError.message || 'No se pudo eliminar la categoría',
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
    <><MetricStrip className="mb-5" label="Resumen de categorías" loading={isLoading} items={[
      { label: 'Categorías', value: categoriesError ? '—' : categoriesData?.summary?.total ?? '—' },
      { label: 'Activas', value: categoriesError ? '—' : categoriesData?.summary?.active ?? '—' },
      { label: 'Eliminadas', value: categoriesError ? '—' : categoriesData?.summary?.deleted ?? '—' },
    ]} />

      <CatalogFilters actions={<><div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleted(!showDeleted)}
              className="text-xs sm:text-sm"
            >
              {showDeleted ? 'Ocultar' : 'Ver eliminados'}
            </Button>
            {canManageCatalogs && (
              <>
                <Button
                  variant="outline"
                  onClick={onImportClick}
                  className="text-xs sm:text-sm"
                >
                  <FileUp className="w-4 h-4 sm:mr-2" />
                  <span>Importar</span>
                </Button>
                <Button
                  onClick={() => setDialog({ open: true, mode: 'create' })}
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span>Nueva categoría</span>
                </Button>
              </>
            )}
          </div></>} search={search} onSearch={setSearch} order={order} onOrder={setOrder} />
      <Card className="auna-data-table-shell auna-surface">
      <CardContent className="catalog-content">
        {isFetching && categoriesData && <LoadingIndicator message="Actualizando categorías…" />}
        {categoriesError ? <p role="alert" className="p-6 text-destructive">{categoriesError.message}</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Proveedores</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableLoadingRows columns={5} message="Cargando categorías…" /> : categories?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No hay categorías registradas
                  </TableCell>
                </TableRow>
              ) : (
                categories?.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
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
                      <div><span className="font-semibold">{category.name}</span><span className="block text-xs text-muted-foreground">#{category.id}</span></div>
                      </div>
                    </TableCell>
                    <TableCell>{category._count?.products || 0}</TableCell>
                    <TableCell>{category._count?.suppliers || 0}</TableCell>
                    <TableCell>
                      {category.deleted ? (
                        <Badge variant="destructive">Eliminado</Badge>
                      ) : (
                        <Badge className="catalog-status">Activo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageCatalogs && (
                        <CatalogRowActions
                          onEdit={category.deleted ? undefined : () => setDialog({ open: true, mode: 'edit', item: category })}
                          onDelete={category.deleted ? undefined : () => setDeleteConfirmCategory(category)}
                          onRestore={category.deleted ? () => setRestoreConfirmCategory(category) : undefined}
                          disabled={deleteMutation.isPending || restoreMutation.isPending}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

      </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteConfirmCategory}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmCategory(null)
        }}
      >
        <AlertDialogContent variant="auna">
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
        <AlertDialogContent variant="auna">
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
<div className="auna-pagination-outside">{categoriesData && categoriesData.totalPages > 0 && categoriesData.totalItems > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={categoriesData.page}
              totalPages={categoriesData.totalPages}
              onPageChange={setCurrentPage}
              hasNextPage={categoriesData.nextPage !== null}
              hasPrevPage={categoriesData.prevPage !== null}
              loading={isLoading}
              totalItems={categoriesData.totalItems}
              pageSize={pageSize}
              count={categories.length}
              itemLabel="categorías"
            />
          </div>
        )}</div></>
  )
}

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
      const apiError = error as Error
      toast({
        variant: 'destructive',
        title: 'Error',
        description: apiError.message || 'Ocurrió un error',
      })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={dialog.open} onOpenChange={handleOpenChange}>
      <DialogContent variant="auna" className="sm:max-w-lg">
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
                      Imagen opcional. Máximo 5 MB.
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
