/**
 * Detalle de producto organizado por tareas, con edición agrupada.
 */
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Edit, MoreHorizontal, Check, ChevronsUpDown, Trash2, CalendarDays, Warehouse, Info, Boxes, Banknote } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { formatMoney } from '@/utils'
import type { Product } from '@/types'
import { adaptApiProduct, fetchProductById, type ApiProduct } from '@/services/productService'
import { Input } from '@/components/ui/input'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useSuppliers } from '@/hooks/useSuppliers'
import { SUPPLIERS_DROPDOWN_PARAMS } from '@/services/supplierService'
import { useCategories } from '@/hooks/useCategories'
import useUpdateProduct from '@/hooks/useUpdateProduct'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getApiBaseUrl } from '@/services/api'
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
import { useDeleteProduct, useRemoveProductFromBranch } from '@/hooks/useDeleteProduct'
import { useTenant } from '@/context/useTenant'
import { ProductKitSection } from './ProductKitSection'
import { ProductLotsSection } from './ProductLotsSection'
import { ProductLocationsSection } from './ProductLocationsSection'
import { ProductDetailSummary } from './ProductDetailSummary'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { LoadingState } from '@/components/shared/LoadingState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import '@/components/shared/recordEditLayout.css'

type CategoryItem = { id: number | string; name: string }

const getStatusBadge = (product: Product) => {
  if (product.kind === 'KIT') {
    return <Badge variant="outline">Kit / combo</Badge>
  }
  if (product.stock === 0 || product.status === 'out_of_stock') {
    return <Badge variant="destructive">Sin stock</Badge>
  }
  if (product.stock <= product.minStock || product.status === 'low_stock') {
    return <Badge className="border-0 bg-amber-500/15 text-amber-800 dark:text-amber-300">Stock bajo</Badge>
  }
  return <Badge className="border-0 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">Disponible</Badge>
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canEdit = hasPermission('products.edit')
  const canDelete = hasPermission('products.delete')
  const canViewCost = hasPermission('products.create')
  const { locale, currencyCode } = useSystemSettings()
  const fmt = (n: number) => formatMoney(n, locale, currencyCode)

  const { data: suppliersData } = useSuppliers(SUPPLIERS_DROPDOWN_PARAMS)
  const { data: categoriesData } = useCategories()
  const suppliers = useMemo(() => suppliersData?.items ?? [], [suppliersData])
  const categories = useMemo((): CategoryItem[] => {
    if (!categoriesData) return []
    if (Array.isArray(categoriesData)) return categoriesData as CategoryItem[]
    return ((categoriesData as { items?: CategoryItem[] }).items ?? []) as CategoryItem[]
  }, [categoriesData])

  const [rawProduct, setRawProduct] = useState<ApiProduct | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const updateMutation = useUpdateProduct()
  const { mutateAsync: updateProductAsync, isPending: isSaving } = updateMutation
  const deleteMutation = useDeleteProduct()
  const { mutateAsync: deleteProductAsync, isPending: deleteIsLoading } = deleteMutation

  const { branch, branches } = useTenant()
  const { mutateAsync: removeFromBranchAsync, isPending: removeBranchIsLoading } = useRemoveProductFromBranch()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setIsLoading(true)
      try {
        const data = await fetchProductById(id)
        setRawProduct(data)
      } catch (e) {
        toast({
          title: 'Error',
          description: (e as Error)?.message ?? 'No se pudo cargar el producto',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id, toast])

  const reloadProduct = async () => {
    if (!id) return
    const data = await fetchProductById(id)
    setRawProduct(data)
  }

  const product: Product | null = useMemo(
    () => (rawProduct ? adaptApiProduct(rawProduct) : null),
    [rawProduct]
  )

  const [isEditing, setIsEditing] = useState(false)
  const [detailTab, setDetailTab] = useState('information')
  usePageTrail([{ label: 'Detalle' }, ...(isEditing ? [{ label: 'Editar' }] : detailTab !== 'information' ? [{ label: ({lots:'Lotes y caducidades',locations:'Existencias por ubicación',kit:'Componentes del kit'} as Record<string,string>)[detailTab] || 'Información y precios' }] : [])])
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editPriceWholesale, setEditPriceWholesale] = useState('')
  const [editPricePromotion, setEditPricePromotion] = useState('')
  const [editPromotionUntil, setEditPromotionUntil] = useState('')
  const [editStock, setEditStock] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editSize, setEditSize] = useState('')
  const [editBarcode, setEditBarcode] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editMinStock, setEditMinStock] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<string | undefined>(undefined)
  const [editSupplierId, setEditSupplierId] = useState<string | undefined>(undefined)
  const [editImageUrl, setEditImageUrl] = useState<string | undefined>(undefined)
  const [editAvailableForSale, setEditAvailableForSale] = useState(true)
  const [editTracksExpiry, setEditTracksExpiry] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  useEffect(() => {
    if (!product) return
    setEditName(product.name ?? '')
    setEditPrice(String(product.price ?? ''))
    setEditPriceWholesale(
      product.priceWholesale != null && product.priceWholesale > 0 ? String(product.priceWholesale) : ''
    )
    setEditPricePromotion(
      product.pricePromotion != null && product.pricePromotion > 0 ? String(product.pricePromotion) : ''
    )
    setEditPromotionUntil(
      product.promotionValidUntil ? String(product.promotionValidUntil).slice(0, 16) : ''
    )
    setEditStock(String(product.stock ?? ''))
    setEditBrand(product.brand ?? '')
    setEditSize(product.size ?? '')
    setEditBarcode(product.barcode ?? '')
    setEditDescription(product.description ?? '')
    setEditCost(String(product.cost ?? ''))
    setEditMinStock(String(product.minStock ?? ''))
    setEditImageUrl(product.imageUrl ?? undefined)
    const rawCategoryId = (rawProduct as { category_id?: string | number } | null)?.category_id
    setEditCategoryId(rawCategoryId ? String(rawCategoryId) : undefined)
    const rawSupplierId = (rawProduct as { supplier_id?: string | number } | null)?.supplier_id
    setEditSupplierId(rawSupplierId ? String(rawSupplierId) : undefined)
    setEditAvailableForSale(product.availableForSale !== false)
    setEditTracksExpiry(product.tracksExpiry === true)
  }, [product, rawProduct])

  const categoryLabel = useMemo(() => {
    if (!product) return ''
    if (product.category && isNaN(Number(product.category as unknown as number))) return String(product.category)
    const rawCategoryId = (rawProduct as { category_id?: string | number } | null)?.category_id
    const effectiveId = editCategoryId ?? rawCategoryId
    const found = categories.find((c) => String(c.id) === String(effectiveId))
    return found?.name ?? String(effectiveId ?? '')
  }, [product, rawProduct, categories, editCategoryId])

  const supplierLabel = useMemo(() => {
    if (!product) return ''
    if (product.supplier && !/^[0-9a-f-]{8,}$/.test(String(product.supplier))) return String(product.supplier)
    const rawSupplierId = (rawProduct as { supplier_id?: string | number } | null)?.supplier_id
    const effectiveId = editSupplierId ?? rawSupplierId
    const found = suppliers.find((s) => String(s.id) === String(effectiveId))
    return found?.name ?? String(effectiveId ?? '')
  }, [product, rawProduct, suppliers, editSupplierId])

  if (!id) {
    navigate('/inventario')
    return null
  }
  if (isLoading && !product) {
    return (
      <div className="p-6">

        <LoadingState variant="detail" message="Cargando producto…" />
      </div>
    )
  }
  if (!product) {
    return (
      <div className="p-6">

        <div className="mt-6 text-center text-destructive">Producto no encontrado.</div>
      </div>
    )
  }

  const handleDeleteProduct = async () => {
    if (!product) return
    try {
      await deleteProductAsync(product.id)
      setIsDeleteDialogOpen(false)
      toast({ title: 'Producto eliminado', description: 'El producto fue eliminado correctamente.' })
      navigate('/inventario')
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'No se pudo eliminar el producto'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleRemoveFromBranch = async () => {
    if (!product) return
    try {
      await removeFromBranchAsync(product.id)
      setIsBranchDialogOpen(false)
      toast({ title: 'Producto quitado', description: `Ya no se maneja en ${branch?.name || 'esta sucursal'}.` })
      navigate('/inventario')
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'No se pudo quitar el producto de la sucursal'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleEditProductImageFile = async (file: File) => {
    try {
      setIsUploadingImage(true)
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Error', description: 'La imagen no debe exceder 5MB', variant: 'destructive' })
        return
      }
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Error', description: 'Solo se permiten archivos de imagen', variant: 'destructive' })
        return
      }
      const formData = new FormData()
      formData.append('image', file)
      const response = await fetch(`${getApiBaseUrl()}/products/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = (await response.json()) as {
        imageUrl?: string
        url?: string
        message?: string
      }
      if (!response.ok) {
        const msg = typeof data.message === 'string' ? data.message : 'No se pudo subir la imagen'
        throw new Error(msg)
      }
      const imageUrl = data.imageUrl ?? data.url
      if (!imageUrl) throw new Error('La respuesta no contiene la URL de la imagen')
      setEditImageUrl(imageUrl)
      toast({ title: 'Imagen actualizada', description: 'La imagen se subió correctamente.' })
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error)?.message ?? 'Error al subir la imagen',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  const resetEditState = () => {
    if (!product || !rawProduct) return
    setEditName(product.name ?? '')
    setEditPrice(String(product.price ?? ''))
    setEditPriceWholesale(
      product.priceWholesale != null && product.priceWholesale > 0 ? String(product.priceWholesale) : ''
    )
    setEditPricePromotion(
      product.pricePromotion != null && product.pricePromotion > 0 ? String(product.pricePromotion) : ''
    )
    setEditPromotionUntil(
      product.promotionValidUntil ? String(product.promotionValidUntil).slice(0, 16) : ''
    )
    setEditStock(String(product.stock ?? ''))
    setEditBrand(product.brand ?? '')
    setEditSize(product.size ?? '')
    setEditBarcode(product.barcode ?? '')
    setEditDescription(product.description ?? '')
    setEditCost(String(product.cost ?? ''))
    setEditMinStock(String(product.minStock ?? ''))
    setEditImageUrl(product.imageUrl ?? undefined)
    const rawCategoryId = (rawProduct as { category_id?: string | number } | null)?.category_id
    setEditCategoryId(rawCategoryId ? String(rawCategoryId) : undefined)
    const rawSupplierId = (rawProduct as { supplier_id?: string | number } | null)?.supplier_id
    setEditSupplierId(rawSupplierId ? String(rawSupplierId) : undefined)
    setEditAvailableForSale(product.availableForSale !== false)
    setEditTracksExpiry(product.tracksExpiry === true)
  }

  return (
    <div className="mx-auto w-full max-w-[1560px] min-w-0 space-y-4 px-4 py-5 sm:px-8">
      <header className="space-y-4">

        <ProductDetailSummary product={product} category={categoryLabel} status={getStatusBadge(product)} actions={
          !isEditing && <>
            {canEdit && <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" aria-hidden="true" />Editar
            </Button>}
            {canDelete && <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><MoreHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />Más acciones</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {branches.length > 1 && <DropdownMenuItem onSelect={() => setIsBranchDialogOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />Quitar de esta sucursal
                </DropdownMenuItem>}
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setIsDeleteDialogOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />{branches.length > 1 ? 'Eliminar de la empresa' : 'Eliminar'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
          </>
        } />
        {!isEditing && <MetricStrip label="Precio y existencias" items={[
          { label: 'Precio de venta', value: fmt(product.price) },
          { label: 'Stock actual', value: `${product.stock} unidades` },
          { label: 'Stock mínimo', value: `${product.minStock} unidades` },
        ]} />}
      </header>
      <AlertDialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <AlertDialogContent variant="auna">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar de {branch?.name || 'esta sucursal'}?</AlertDialogTitle>
            <AlertDialogDescription>
              «{product.name}» dejará de manejarse en esta sucursal. Sigue existiendo en las demás y puede volver a
              darse de alta aquí ingresando mercancía. Requiere stock en 0.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBranchIsLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeBranchIsLoading}
              onClick={(e) => {
                e.preventDefault()
                void handleRemoveFromBranch()
              }}
            >
              {removeBranchIsLoading ? 'Quitando…' : 'Quitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent variant="auna">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {branches.length > 1 ? '¿Eliminar el producto de toda la empresa?' : '¿Eliminar producto?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {branches.length > 1 ? (
                <>
                  El catálogo es de la empresa, así que «{product.name}» dejará de existir en{' '}
                  <strong>las {branches.length} sucursales</strong>, no solo en {branch?.name || 'esta'}. Para sacarlo
                  únicamente de aquí usá «Quitar de esta sucursal». Podés restaurarlo desde Inventario → Acciones →
                  Productos eliminados.
                </>
              ) : (
                <>
                  Se eliminará «{product.name}» del inventario. Podrás restaurarlo desde Inventario → Acciones →
                  Productos eliminados.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteIsLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteIsLoading}
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteProduct()
              }}
            >
              {deleteIsLoading
                ? 'Eliminando…'
                : branches.length > 1
                  ? `Eliminar de las ${branches.length} sucursales`
                  : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isEditing && canEdit ? <div className="record-edit">
        <div><h2 className="text-lg font-semibold">Editar producto</h2><p className="text-sm text-muted-foreground">Los cambios se aplican al guardar.</p></div>
        <fieldset className="record-edit-panel">
          <legend className="sr-only">Identificación</legend>
          <h3 className="record-edit-heading" aria-hidden="true"><Info />Identificación</h3>
          <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label>Fotografía</Label>
              <div className="flex items-start gap-3">
              {(editImageUrl || product.imageUrl) && <img src={editImageUrl ?? product.imageUrl} alt={product.name} width={80} height={80} className="h-20 w-20 shrink-0 rounded-lg border object-contain p-2" />}
              <ImageUploadDropzone
                className="min-w-0 flex-1"
                onFileSelect={file => void handleEditProductImageFile(file)}
                onReject={message => toast({ title: 'Archivo no válido', description: message, variant: 'destructive' })}
                disabled={isUploadingImage || isSaving} isUploading={isUploadingImage}
                helperText="Máx. 5 MB. Guarda los cambios para aplicar la imagen."
              />
              </div>
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { id: 'edit-name', label: 'Nombre', value: editName, set: setEditName },
                { id: 'edit-brand', label: 'Marca', value: editBrand, set: setEditBrand },
                { id: 'edit-size', label: 'Presentación', value: editSize, set: setEditSize },
                { id: 'edit-barcode', label: 'Código de barras', value: editBarcode, set: setEditBarcode },
              ].map(field => <div key={field.id} className="min-w-0 space-y-1.5">
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input id={field.id} value={field.value} onChange={event => field.set(event.target.value)} disabled={isSaving} />
              </div>)}
                    <div>
                      <Label id="edit-category-label" className="text-muted-foreground">Categoría</Label>
                      {isEditing && canEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-labelledby="edit-category-label" disabled={isSaving} className="w-full justify-between mt-1">
                              {categoryLabel || 'Seleccionar categoría'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0">
                            <Command>
                              <CommandInput placeholder="Buscar categoría..." />
                              <CommandEmpty>No se encontraron categorías.</CommandEmpty>
                              <CommandList>
                                <CommandGroup>
                                  <ScrollArea className="h-48">
                                    {categories.map((category) => (
                                      <CommandItem key={String(category.id)} value={String(category.name)} onSelect={() => setEditCategoryId(String(category.id))}>
                                        <Check className={`mr-2 h-4 w-4 ${String(category.id) === String(editCategoryId) ? 'opacity-100' : 'opacity-0'}`} />
                                        {category.name}
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <p className="text-foreground font-medium mt-1">{categoryLabel}</p>
                      )}
                    </div>

                    <div>
                      <Label id="edit-supplier-label" className="text-muted-foreground">Proveedor</Label>
                      {isEditing && canEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-labelledby="edit-supplier-label" disabled={isSaving} className="w-full justify-between mt-1">
                              {supplierLabel || 'Seleccionar proveedor'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0">
                            <Command>
                              <CommandInput placeholder="Buscar proveedor..." />
                              <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                              <CommandList>
                                <CommandGroup>
                                  <ScrollArea className="h-48">
                                    {suppliers.map((supplier) => (
                                      <CommandItem key={String(supplier.id)} value={supplier.name} onSelect={() => setEditSupplierId(String(supplier.id))}>
                                        <Check className={`mr-2 h-4 w-4 ${String(supplier.id) === String(editSupplierId) ? 'opacity-100' : 'opacity-0'}`} />
                                        {supplier.name}
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <p className="text-foreground font-medium mt-1">{supplierLabel}</p>
                      )}
                    </div>

              <div className="space-y-1.5 sm:col-span-2 xl:col-span-3">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea id="edit-description" value={editDescription} onChange={event => setEditDescription(event.target.value)} rows={2} disabled={isSaving} />
              </div>
            </div>
          </div>
        </fieldset>
        <div className="record-edit-columns">
        <fieldset className="record-edit-panel">
          <legend className="sr-only">Precios</legend>
          <h3 className="record-edit-heading" aria-hidden="true"><Banknote />Precios</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { id: 'edit-price', label: 'Precio de venta', value: editPrice, set: setEditPrice },
              { id: 'edit-wholesale', label: 'Precio mayoreo', value: editPriceWholesale, set: setEditPriceWholesale },
              { id: 'edit-promotion', label: 'Precio promoción', value: editPricePromotion, set: setEditPricePromotion },
              ...(canViewCost ? [{ id: 'edit-cost', label: 'Costo', value: editCost, set: setEditCost }] : []),
            ].map(field => <div key={field.id} className="space-y-1.5">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input id={field.id} type="number" value={field.value} onChange={event => field.set(event.target.value)} disabled={isSaving} />
            </div>)}
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="edit-promotion-until">Promoción hasta</Label>
              <Input id="edit-promotion-until" type="datetime-local" value={editPromotionUntil} onChange={event => setEditPromotionUntil(event.target.value)} disabled={isSaving} />
            </div>
          </div>
        </fieldset>
        <fieldset className="record-edit-panel">
          <legend className="sr-only">Control de inventario</legend>
          <h3 className="record-edit-heading" aria-hidden="true"><Boxes />Control de inventario</h3>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="edit-stock">Stock actual</Label><Input id="edit-stock" type="number" value={editStock} onChange={event => setEditStock(event.target.value)} disabled={isSaving} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-min-stock">Stock mínimo</Label><Input id="edit-min-stock" type="number" value={editMinStock} onChange={event => setEditMinStock(event.target.value)} disabled={isSaving} /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3"><Label htmlFor="edit-available-sale">Disponible para la venta</Label><Switch id="edit-available-sale" checked={editAvailableForSale} onCheckedChange={setEditAvailableForSale} disabled={isSaving} /></div>
              <p className="text-xs text-muted-foreground">Si lo desactivas, no aparecerá al registrar ventas.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3"><Label htmlFor="edit-tracks-expiry">Control de caducidad</Label><Switch id="edit-tracks-expiry" checked={editTracksExpiry} onCheckedChange={setEditTracksExpiry} disabled={isSaving} /></div>
              <p className="text-xs text-muted-foreground">Exige fecha de caducidad en cada ingreso de mercancía.</p>
            </div>
          </div>
        </fieldset>
        </div>
        <div className="record-edit-actions">
          <Button variant="outline" onClick={() => { setIsEditing(false); resetEditState(); }} disabled={isSaving || isUploadingImage}>Cancelar cambios</Button>
          <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={isSaving || isUploadingImage}
                onClick={async () => {
                  if (!product || !rawProduct) return
                  try {
                    const numeric = (v: string) => (v ? Number(v) : undefined)
                    const rawCategoryId = (rawProduct as { category_id?: string | number } | null)?.category_id
                    const rawSupplierId = (rawProduct as { supplier_id?: string | number } | null)?.supplier_id
                    const updated = await updateProductAsync({
                      id: product.id,
                      payload: {
                        id: product.id,
                        name: editName.trim() || product.name,
                        category_id: editCategoryId ?? rawCategoryId ?? '',
                        brand: editBrand || undefined,
                        size: editSize || undefined,
                        stock: numeric(editStock),
                        min_stock: numeric(editMinStock),
                        price: numeric(editPrice),
                        price_wholesale: editPriceWholesale.trim() ? Number(editPriceWholesale) : null,
                        price_promotion: editPricePromotion.trim() ? Number(editPricePromotion) : null,
                        promotion_valid_until: editPromotionUntil.trim()
                          ? new Date(editPromotionUntil).toISOString()
                          : null,
                        cost: numeric(editCost),
                        image_url: editImageUrl ?? product.imageUrl,
                        supplier_id: editSupplierId ?? (rawSupplierId ? String(rawSupplierId) : undefined),
                        barcode: editBarcode || undefined,
                        description: editDescription || undefined,
                        available_for_sale: editAvailableForSale,
                        tracks_expiry: editTracksExpiry,
                      },
                    })
                    setRawProduct(updated)
                    setIsEditing(false)
                    toast({ title: 'Producto actualizado', description: 'Los cambios se guardaron correctamente.' })
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: (error as Error)?.message ?? 'No se pudieron guardar los cambios',
                      variant: 'destructive',
                    })
                  }
                }}
          >{isSaving ? 'Guardando…' : 'Guardar cambios'}</Button>
        </div>
      </div> : <Tabs value={detailTab} onValueChange={setDetailTab}>
        <div className="overflow-x-auto">
          <TabsList variant="detail" aria-label="Detalles del producto">
            <TabsTrigger value="information"><Info className="mr-2 h-4 w-4" aria-hidden="true" />Información y precios</TabsTrigger>
            {product.kind !== 'KIT' && <TabsTrigger value="lots"><CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />Lotes y caducidades</TabsTrigger>}
            <TabsTrigger value="locations"><Warehouse className="mr-2 h-4 w-4" aria-hidden="true" />Ubicaciones</TabsTrigger>
            {(product.kind === 'KIT' || canEdit) && <TabsTrigger value="kit"><Boxes className="mr-2 h-4 w-4" aria-hidden="true" />Kit / combo</TabsTrigger>}
          </TabsList>
        </div>
        {product.kind !== 'KIT' && <TabsContent value="lots" forceMount hidden={detailTab !== 'lots'} className="mt-5 data-[state=inactive]:hidden">
          <ProductLotsSection productId={id} tracksExpiry={product.tracksExpiry === true} onMutated={() => void reloadProduct()} />
        </TabsContent>}
        <TabsContent value="locations" forceMount hidden={detailTab !== 'locations'} className="mt-5 data-[state=inactive]:hidden"><ProductLocationsSection productId={id} /></TabsContent>
        <TabsContent value="information" forceMount hidden={detailTab !== 'information'} className="mt-5 data-[state=inactive]:hidden">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <section className="auna-surface min-w-0 space-y-4 rounded-xl border p-5" aria-labelledby="product-information-heading">
              <h2 id="product-information-heading" className="text-lg font-semibold">Información del producto</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Categoría', categoryLabel || 'Sin categoría'],
                  ['Proveedor', supplierLabel || 'Sin proveedor'],
                  ['Código de barras', product.barcode || '—'],
                  ['Disponible para venta', product.availableForSale !== false ? 'Sí' : 'No'],
                  ['Control de caducidad', product.tracksExpiry ? 'Sí' : 'No'],
                ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}
              </dl>
              <div className="border-t pt-4"><h3 className="text-sm font-medium">Descripción</h3><p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">{product.description || 'Sin descripción'}</p></div>
            </section>
            <section className="auna-surface min-w-0 space-y-4 rounded-xl border p-5" aria-labelledby="product-prices-heading">
              <h2 id="product-prices-heading" className="text-lg font-semibold">Precios y rentabilidad</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Precio mayoreo', product.priceWholesale != null && product.priceWholesale > 0 ? fmt(product.priceWholesale) : 'No configurado'],
                  ['Precio promoción', product.pricePromotion != null && product.pricePromotion > 0 ? fmt(product.pricePromotion) : 'No configurado'],
                  ['Promoción hasta', product.promotionValidUntil ? new Date(product.promotionValidUntil).toLocaleString(locale || 'es-GT') : 'Sin fecha'],
                  ...(canViewCost ? [
                    ['Costo', fmt(product.cost)],
                    ['Margen de ganancia', `${fmt(product.price - product.cost)} (${product.price > 0 ? (((product.price - product.cost) / product.price) * 100).toFixed(1) : '0'}%)`],
                    ['Valor de inventario', fmt(product.stock * product.cost)],
                  ] : []),
                ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium tabular-nums">{value}</dd></div>)}
              </dl>
            </section>
          </div>
        </TabsContent>
        {(product.kind === 'KIT' || canEdit) && <TabsContent value="kit" forceMount hidden={detailTab !== 'kit'} className="mt-5 data-[state=inactive]:hidden">
          <ProductKitSection product={product} productId={id} canEdit={canEdit} onUpdated={() => void reloadProduct()} />
        </TabsContent>}
      </Tabs>}
    </div>
  )
}
