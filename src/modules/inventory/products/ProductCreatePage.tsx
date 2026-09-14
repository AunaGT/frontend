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
 * Vista para crear un nuevo producto. Mismo estilo que detalle/editar: layout 40/60 (imagen | datos).
 * Conserva todos los atributos del inventario.
 */
import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Package, QrCode, Image as ImageIcon, Check, ChevronsUpDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useProductForm } from './hooks'
import { useCreateProduct } from '@/hooks/useCreateProduct'
import { useCategories } from '@/hooks/useCategories'
import { useSuppliers } from '@/hooks/useSuppliers'
import { SUPPLIERS_DROPDOWN_PARAMS } from '@/services/supplierService'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProductKitComponentsEditor } from './ProductKitComponentsEditor'
import { useKitAssemblePrompt } from './hooks/useKitAssemblePrompt'
import { getApiBaseUrl } from '@/services/api'
import type { ApiProduct } from '@/services/productService'
import type { ProductFormData } from './types'

type CategoryItem = { id: string | number; name: string }

export default function ProductCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { locale, currencyCode } = useSystemSettings()
  const currencySymbol = useMemo(() => {
    try {
      const parts = new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ' }).formatToParts(0)
      return parts.find((p) => p.type === 'currency')?.value ?? currencyCode ?? 'Q'
    } catch {
      return currencyCode || 'Q'
    }
  }, [locale, currencyCode])
  const productForm = useProductForm()
  const createProductMutation = useCreateProduct()
  const { data: categoriesData } = useCategories()
  const { data: suppliersData } = useSuppliers(SUPPLIERS_DROPDOWN_PARAMS)

  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false)

  const createdIdRef = useRef('')
  const goToCreatedProduct = () => navigate(createdIdRef.current ? `/inventario/${createdIdRef.current}` : '/inventario')
  const { promptDialog, offerAssemble } = useKitAssemblePrompt(goToCreatedProduct)

  const formData = productForm.formData
  const setFormData = productForm.setFormData
  const onFormChange = <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const suppliers = useMemo(() => suppliersData?.items ?? [], [suppliersData])
  const categories = useMemo((): CategoryItem[] => {
    if (!categoriesData) return []
    if (Array.isArray(categoriesData)) return categoriesData as CategoryItem[]
    return ((categoriesData as { items?: CategoryItem[] }).items ?? []) as CategoryItem[]
  }, [categoriesData])

  const categoryLabel = useMemo(() => {
    const id = formData.category
    if (!id) return ''
    const c = categories.find(x => String(x.id) === String(id))
    return c ? c.name : id
  }, [formData.category, categories])

  const supplierLabel = useMemo(() => {
    const id = formData.supplier
    if (!id) return ''
    const s = suppliers.find((x: { id: string }) => String(x.id) === String(id))
    return s ? (s as { name: string }).name : id
  }, [formData.supplier, suppliers])

  const handleProductImageFile = async (file: File) => {
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
      const fd = new FormData()
      fd.append('image', file)
      const response = await fetch(`${getApiBaseUrl()}/products/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Error al subir la imagen')
      const imageUrl = data.imageUrl ?? data.url
      if (!imageUrl) throw new Error('No se recibió la URL de la imagen')
      onFormChange('imageUrl', imageUrl)
      toast({ title: 'Imagen subida', description: 'La imagen del producto se subió correctamente.' })
    } catch (err: unknown) {
      toast({
        title: 'Error al subir imagen',
        description: (err as Error)?.message ?? 'No se pudo subir la imagen',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleSubmit = () => {
    if (!productForm.validateForm()) return
    const isKit = formData.productKind === 'KIT'
    const payload = {
      name: formData.name.trim(),
      category_id: Number(formData.category),
      brand: formData.brand?.trim() || undefined,
      size: formData.size?.trim() || undefined,
      stock: isKit ? 0 : formData.stock ? Number(formData.stock) : 0,
      min_stock: formData.minStock ? Number(formData.minStock) : 0,
      price: Number(formData.price),
      price_wholesale: formData.priceWholesale?.trim()
        ? Number(formData.priceWholesale)
        : undefined,
      price_promotion: formData.pricePromotion?.trim()
        ? Number(formData.pricePromotion)
        : undefined,
      promotion_valid_until: formData.promotionValidUntil?.trim()
        ? new Date(formData.promotionValidUntil).toISOString()
        : undefined,
      cost: formData.cost ? Number(formData.cost) : 0,
      image_url: formData.imageUrl || undefined,
      supplier_id: formData.supplier,
      barcode: formData.barcode?.trim() || undefined,
      description: formData.description?.trim() || undefined,
      status_id: 1,
      available_for_sale: formData.availableForSale,
      tracks_expiry: formData.tracksExpiry,
      kind: formData.productKind,
      ...(isKit
        ? {
            bom_components: formData.kitComponents
              .filter((c) => c.component_product_id && c.qty_per_unit > 0)
              .map((c) => ({
                component_product_id: c.component_product_id,
                qty_per_unit: c.qty_per_unit,
              })),
          }
        : {}),
    }
    createProductMutation.mutate(payload, {
      onSuccess: (data: ApiProduct) => {
        toast({ title: 'Producto creado', description: 'El producto fue creado correctamente' })
        productForm.resetForm()
        const id = data?.id != null ? String(data.id) : ''
        createdIdRef.current = id
        if (isKit) {
          void offerAssemble(id, formData.name.trim()).then((opened) => {
            if (!opened) goToCreatedProduct()
          })
        } else {
          goToCreatedProduct()
        }
      },
      onError: (err: unknown) => {
        const message = (err as { message?: string })?.message || 'No se pudo crear el producto'
        toast({ title: 'Error', description: message, variant: 'destructive' })
      },
    })
  }

  const isLoading = createProductMutation.isPending || isUploadingImage
  const isKit = formData.productKind === 'KIT'

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventario')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nuevo Producto</h1>
            <p className="text-sm text-muted-foreground">Crear un nuevo producto en el inventario</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del producto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Imagen - 40% */}
            <div className="lg:col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Imagen del producto</p>
              <div className="rounded-md overflow-hidden border border-border bg-muted flex flex-col items-center justify-center p-4 gap-4 min-h-[220px]">
                {formData.imageUrl ? (
                  <img src={formData.imageUrl} alt={formData.name || 'Producto'} className="w-full max-h-64 object-contain rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <span className="text-sm">Sin imagen</span>
                  </div>
                )}
                <ImageUploadDropzone
                  onFileSelect={(f) => {
                    void handleProductImageFile(f)
                  }}
                  onReject={(msg) =>
                    toast({ title: 'Archivo no válido', description: msg, variant: 'destructive' })
                  }
                  disabled={isUploadingImage || isLoading}
                  isUploading={isUploadingImage}
                  helperText={
                    <>
                      Opcional. Máx 5MB. Se almacenará en el bucket <span className="font-semibold">productos</span>.
                    </>
                  }
                />
              </div>
            </div>

            {/* Datos - 60% */}
            <div className="lg:col-span-3 space-y-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Datos del producto</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Nombre del Producto *</Label>
                    <Input
                      placeholder="Whisky Buchanans 18..."
                      value={formData.name}
                      onChange={(e) => onFormChange('name', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Categoría *</Label>
                    <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                          {categoryLabel || 'Seleccionar categoría'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar categoría..." />
                          <CommandEmpty>No se encontraron categorías.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              <ScrollArea className="h-48">
                                {categories.map((c) => (
                                  <CommandItem
                                    key={String(c.id)}
                                    value={String(c.name)}
                                    onSelect={() => {
                                      onFormChange('category', String(c.id))
                                      setCategoryPopoverOpen(false)
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${String(c.id) === formData.category ? 'opacity-100' : 'opacity-0'}`} />
                                    {c.name}
                                  </CommandItem>
                                ))}
                              </ScrollArea>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Marca</Label>
                    <Input
                      placeholder="Buchanans"
                      value={formData.brand}
                      onChange={(e) => onFormChange('brand', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tamaño</Label>
                    <Input
                      placeholder="750ml"
                      value={formData.size}
                      onChange={(e) => onFormChange('size', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Precio de Venta *</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground min-w-[3.5rem]">{currencySymbol}</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={formData.price}
                        onChange={(e) => onFormChange('price', e.target.value)}
                        className="pl-[4.5rem]"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Precio mayoreo (opcional)</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground min-w-[3.5rem]">{currencySymbol}</span>
                      <Input
                        type="number"
                        placeholder="—"
                        value={formData.priceWholesale}
                        onChange={(e) => onFormChange('priceWholesale', e.target.value)}
                        className="pl-[4.5rem]"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Precio promoción (opcional)</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground min-w-[3.5rem]">{currencySymbol}</span>
                      <Input
                        type="number"
                        placeholder="—"
                        value={formData.pricePromotion}
                        onChange={(e) => onFormChange('pricePromotion', e.target.value)}
                        className="pl-[4.5rem]"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Promoción válida hasta</Label>
                    <Input
                      type="datetime-local"
                      value={formData.promotionValidUntil}
                      onChange={(e) => onFormChange('promotionValidUntil', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Costo</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground min-w-[3.5rem]">{currencySymbol}</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={formData.cost}
                        onChange={(e) => onFormChange('cost', e.target.value)}
                        className="pl-[4.5rem]"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tipo de producto</Label>
                    <Select
                      value={formData.productKind}
                      onValueChange={(v) =>
                        onFormChange('productKind', v as ProductFormData['productKind'])
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STANDARD">Producto normal</SelectItem>
                        <SelectItem value="KIT">Kit / combo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isKit ? (
                    <div className="rounded-md border p-4 bg-muted/30">
                      <ProductKitComponentsEditor
                        value={formData.kitComponents}
                        onChange={(kitComponents) => onFormChange('kitComponents', kitComponents)}
                      />
                      <p className="text-xs text-muted-foreground mt-3">
                        El stock del kit se calcula según los componentes. No lleva stock propio.
                      </p>
                    </div>
                  ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Stock Inicial</Label>
                    <div className="relative mt-1">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.stock}
                        onChange={(e) => onFormChange('stock', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Stock Mínimo</Label>
                    <div className="relative mt-1">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.minStock}
                        onChange={(e) => onFormChange('minStock', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                  )}
                </div>

                <div className="mt-4">
                  <Label className="text-muted-foreground">Proveedor *</Label>
                  <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                        {supplierLabel || 'Seleccionar proveedor'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar proveedor..." />
                        <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                        <CommandList>
                          <CommandGroup>
                            <ScrollArea className="h-48">
                              {suppliers.map((s: { id: string; name: string }) => (
                                <CommandItem
                                  key={String(s.id)}
                                  value={s.name}
                                  onSelect={() => {
                                    onFormChange('supplier', String(s.id))
                                    setSupplierPopoverOpen(false)
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${String(s.id) === formData.supplier ? 'opacity-100' : 'opacity-0'}`} />
                                  {s.name}
                                </CommandItem>
                              ))}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="mt-4">
                  <Label className="text-muted-foreground">Código de Barras</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="7501001234567"
                      value={formData.barcode}
                      onChange={(e) => onFormChange('barcode', e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={productForm.generateBarcode}>
                      <QrCode className="w-4 h-4 mr-2" />
                      Generar
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <Label className="text-muted-foreground">Descripción</Label>
                  <Textarea
                    placeholder="Descripción del producto..."
                    value={formData.description}
                    onChange={(e) => onFormChange('description', e.target.value)}
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="create-available-sale">Disponible para la venta</Label>
                    <p className="text-xs text-muted-foreground max-w-xl">
                      Si se desactiva esta opción, el producto no aparece al registrar ventas ni puede venderse.
                    </p>
                  </div>
                  <Switch
                    id="create-available-sale"
                    checked={formData.availableForSale}
                    onCheckedChange={(v) => onFormChange('availableForSale', v)}
                  />
                </div>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="create-tracks-expiry">Controla caducidad</Label>
                    <p className="text-xs text-muted-foreground max-w-xl">
                      Si se activa, cada ingreso de mercancía exigirá la fecha de caducidad del lote recibido.
                    </p>
                  </div>
                  <Switch
                    id="create-tracks-expiry"
                    checked={formData.tracksExpiry}
                    onCheckedChange={(v) => onFormChange('tracksExpiry', v)}
                  />
                </div>

              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => navigate('/inventario')} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button
                  className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    'Guardar Producto'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {promptDialog}
    </div>
  )
}
