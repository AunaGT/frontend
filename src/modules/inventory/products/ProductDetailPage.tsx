/**
 * Vista de detalle de producto: información, edición inline, imagen en columna 40/60.
 */
import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Edit, QrCode, Check, ChevronsUpDown, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { formatMoney } from '@/utils'
import type { Product } from '@/types'
import { adaptApiProduct, fetchProductById, type ApiProduct } from '@/services/productService'
import { Input } from '@/components/ui/input'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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

type CategoryItem = { id: number | string; name: string }

const getStatusBadge = (product: Product) => {
  if (product.kind === 'KIT') {
    return <Badge variant="outline">Kit / combo</Badge>
  }
  if (product.stock === 0 || product.status === 'out_of_stock') {
    return <Badge variant="destructive">Sin Stock</Badge>
  }
  if (product.stock <= product.minStock || product.status === 'low_stock') {
    return <Badge className="bg-liquor-amber text-liquor-bronze">Stock Bajo</Badge>
  }
  return <Badge className="bg-liquor-gold text-liquor-bronze">Disponible</Badge>
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
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }
  if (!product) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/inventario')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
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
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventario')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
            <p className="text-sm text-muted-foreground">Detalle del producto</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {canEdit && !isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
          {canDelete && !isEditing && branches.length > 1 && (
            <Button variant="outline" onClick={() => setIsBranchDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Quitar de esta sucursal
            </Button>
          )}
          {canDelete && !isEditing && (
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              {branches.length > 1 ? 'Eliminar de la empresa' : 'Eliminar'}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <AlertDialogContent>
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
        <AlertDialogContent>
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

      <Card className={isEditing && canEdit ? 'ring-2 ring-liquor-amber/30' : ''}>
        <CardHeader>
          <CardTitle>Información del producto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing && canEdit && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => { setIsEditing(false); resetEditState(); }} disabled={isSaving}>
                Cancelar cambios
              </Button>
              <Button
                className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                disabled={isSaving}
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
              >
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Imagen</p>
              <div className="rounded-md overflow-hidden border border-border bg-muted flex flex-col items-center justify-center p-4 gap-4 min-h-[220px]">
                {editImageUrl || product.imageUrl ? (
                  <img src={editImageUrl ?? product.imageUrl} alt={product.name} className="w-full max-h-64 object-contain" />
                ) : (
                  <div className="flex items-center justify-center text-muted-foreground text-sm py-8">Sin imagen</div>
                )}
                {isEditing && canEdit && (
                  <ImageUploadDropzone
                    onFileSelect={(f) => {
                      void handleEditProductImageFile(f)
                    }}
                    onReject={(msg) =>
                      toast({ title: 'Archivo no válido', description: msg, variant: 'destructive' })
                    }
                    disabled={isUploadingImage || isSaving}
                    isUploading={isUploadingImage}
                    helperText="Máx 5MB. Se guardará al pulsar «Guardar cambios»."
                  />
                )}
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Datos del producto</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Nombre</Label>
                      {isEditing && canEdit ? <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" /> : <p className="text-foreground font-medium">{product.name}</p>}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Marca</Label>
                      {isEditing && canEdit ? <Input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} className="mt-1" /> : <p className="text-foreground font-medium">{product.brand}</p>}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Tamaño</Label>
                      {isEditing && canEdit ? <Input value={editSize} onChange={(e) => setEditSize(e.target.value)} className="mt-1" /> : <p className="text-foreground font-medium">{product.size}</p>}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Precio de venta</Label>
                      {isEditing && canEdit ? <Input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="mt-1" /> : <p className="text-foreground font-medium">{fmt(product.price)}</p>}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Precio mayoreo</Label>
                      {isEditing && canEdit ? (
                        <Input type="number" value={editPriceWholesale} onChange={(e) => setEditPriceWholesale(e.target.value)} className="mt-1" placeholder="Opcional" />
                      ) : (
                        <p className="text-foreground font-medium">
                          {product.priceWholesale != null && product.priceWholesale > 0 ? fmt(product.priceWholesale) : '—'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Precio promoción</Label>
                      {isEditing && canEdit ? (
                        <Input type="number" value={editPricePromotion} onChange={(e) => setEditPricePromotion(e.target.value)} className="mt-1" placeholder="Opcional" />
                      ) : (
                        <p className="text-foreground font-medium">
                          {product.pricePromotion != null && product.pricePromotion > 0 ? fmt(product.pricePromotion) : '—'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Promoción hasta</Label>
                      {isEditing && canEdit ? (
                        <Input type="datetime-local" value={editPromotionUntil} onChange={(e) => setEditPromotionUntil(e.target.value)} className="mt-1" />
                      ) : (
                        <p className="text-foreground font-medium">
                          {product.promotionValidUntil
                            ? new Date(product.promotionValidUntil).toLocaleString(locale || 'es-GT')
                            : '—'}
                        </p>
                      )}
                    </div>
                    {canViewCost && (
                      <div>
                        <Label className="text-muted-foreground">Costo</Label>
                        {isEditing && canEdit ? <Input type="number" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="mt-1" /> : <p className="text-foreground font-medium">{fmt(product.cost)}</p>}
                      </div>
                    )}
                    <div>
                      <Label className="text-muted-foreground">Stock actual</Label>
                      {isEditing && canEdit ? <Input type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} className="mt-1" /> : <p className="text-foreground font-medium">{product.stock} unidades</p>}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Stock mínimo</Label>
                      {isEditing && canEdit ? <Input type="number" value={editMinStock} onChange={(e) => setEditMinStock(e.target.value)} className="mt-1" /> : <p className="text-foreground font-medium">{product.minStock} unidades</p>}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Categoría</Label>
                      {isEditing && canEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
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
                      <Label className="text-muted-foreground">Estado</Label>
                      <div className="mt-1">{getStatusBadge(product)}</div>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="edit-available-sale" className="text-muted-foreground">
                        Disponible para la venta (POS)
                      </Label>
                      {isEditing && canEdit ? (
                        <div className="mt-2 flex items-center gap-3">
                          <Switch
                            id="edit-available-sale"
                            checked={editAvailableForSale}
                            onCheckedChange={setEditAvailableForSale}
                          />
                          <span className="text-sm text-muted-foreground">
                            Si lo desactivas, el producto no aparece al registrar ventas.
                          </span>
                        </div>
                      ) : (
                        <p className="text-foreground font-medium mt-1">
                          {product.availableForSale !== false ? 'Sí, aparece en ventas' : 'No (solo inventario)'}
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="edit-tracks-expiry" className="text-muted-foreground">
                        Controla caducidad (lotes)
                      </Label>
                      {isEditing && canEdit ? (
                        <div className="mt-2 flex items-center gap-3">
                          <Switch
                            id="edit-tracks-expiry"
                            checked={editTracksExpiry}
                            onCheckedChange={setEditTracksExpiry}
                          />
                          <span className="text-sm text-muted-foreground">
                            Si lo activas, cada ingreso de mercancía exigirá fecha de caducidad.
                          </span>
                        </div>
                      ) : (
                        <p className="text-foreground font-medium mt-1">
                          {product.tracksExpiry === true ? 'Sí, exige fecha de caducidad al ingresar' : 'No'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Proveedor</Label>
                      {isEditing && canEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
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
                    <div>
                      <Label className="text-muted-foreground">Código de barras</Label>
                      {isEditing && canEdit ? <Input value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} className="mt-1" /> : (
                        <div className="flex items-center gap-2 mt-1">
                          <code className="bg-muted px-2 py-1 rounded text-sm">{product.barcode || '—'}</code>
                          <QrCode className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {canViewCost && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Margen de ganancia:</span>
                      <div className="font-medium">{fmt(product.price - product.cost)} ({product.price > 0 ? (((product.price - product.cost) / product.price) * 100).toFixed(1) : '0'}%)</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor de inventario:</span>
                      <div className="font-medium">{fmt(product.stock * product.cost)}</div>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Descripción</p>
                {isEditing && canEdit ? (
                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descripción del producto..." rows={4} className="resize-none" />
                ) : (
                  <p className="text-muted-foreground">{product.description || 'Sin descripción'}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {product && id && (
        <ProductKitSection
          product={product}
          productId={id}
          canEdit={canEdit}
          onUpdated={() => void reloadProduct()}
        />
      )}

      {product && id && <ProductLocationsSection productId={id} />}

      {product && id && product.kind !== 'KIT' && (
        <ProductLotsSection productId={id} tracksExpiry={product.tracksExpiry === true} onMutated={() => void reloadProduct()} />
      )}
    </div>
  )
}
