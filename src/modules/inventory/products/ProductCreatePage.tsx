import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
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
 * Vista para crear un nuevo producto con fotografía acotada y opciones a todo el ancho.
 * Conserva todos los atributos del inventario.
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { ServiceQuantityFields } from './ServiceQuantityFields'
import { ServiceScheduleFields } from '@/modules/appointments/components/ServiceScheduleFields'
import { useServiceScheduleDraft } from '@/modules/appointments/useServiceScheduleDraft'
import { useDraftGuard } from '@/modules/appointments/components/DraftGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Package, QrCode, Image as ImageIcon, Check, ChevronsUpDown, ChevronDown, Settings2 } from 'lucide-react'
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
import { useExperienceProfile } from '@/hooks/useExperienceProfile'
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
import {EMPTY_PRODUCT_FORM} from './types'
import {UnitSettingsFields} from '../units/UnitSettingsFields'
import {useUnitCatalog} from '../units/useUnitCatalog'
import {normalizeUnitDecimal,initialUnitsConfiguration,productDecimalPayload} from '../units/public'
import {useTenant} from '@/context/useTenant'

type CategoryItem = { id: string | number; name: string }

export default function ProductCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const serviceRequested = searchParams.get('tipo') === 'services'
  const { toast } = useToast()
  const { locale, currencyCode,inventoryServicesEnabled,inventoryUnitsEnabled } = useSystemSettings()
  const unitCatalog=useUnitCatalog(inventoryUnitsEnabled)
  const {registerTenantExitGuard}=useTenant()
  const isService = serviceRequested && inventoryServicesEnabled
  const agenda = useServiceScheduleDraft(isService)
  usePageTrail([...(isService ? [{label:'Servicios',to:'/inventario?tipo=services'}] : []),{label:isService?'Nuevo servicio':'Nuevo producto'}])
  const currencySymbol = useMemo(() => {
    try {
      const parts = new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ' }).formatToParts(0)
      return parts.find((p) => p.type === 'currency')?.value ?? currencyCode ?? 'Q'
    } catch {
      return currencyCode || 'Q'
    }
  }, [locale, currencyCode])
  const productForm = useProductForm(isService ? 'SERVICE' : 'STANDARD')
  const createProductMutation = useCreateProduct()
  const categoriesQuery = useCategories()
  const { data: categoriesData } = categoriesQuery
  const suppliersQuery = useSuppliers(SUPPLIERS_DROPDOWN_PARAMS)
  const { data: suppliersData } = suppliersQuery
  const { showAdvancedByDefault } = useExperienceProfile()

  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(showAdvancedByDefault)

  const createdIdRef = useRef('')
  const goToCreatedProduct = () => agendaGuard.proceed(() => navigate(createdIdRef.current ? `/inventario/${createdIdRef.current}` : '/inventario'))
  const { promptDialog, offerAssemble } = useKitAssemblePrompt(goToCreatedProduct)

  const formData = productForm.formData
  const setFormData = productForm.setFormData
  const scopeKey=JSON.stringify(unitCatalog.scope),liveScope=useRef(scopeKey),imageOperation=useRef(0)
  liveScope.current=scopeKey
  useEffect(()=>{liveScope.current=scopeKey;imageOperation.current++;setIsUploadingImage(false);productForm.resetForm();createdIdRef.current='';return()=>{imageOperation.current++;if(liveScope.current===scopeKey)liveScope.current='disposed'}},[scopeKey])
  const agendaGuard=useDraftGuard(isUploadingImage||!!agenda.dirty||JSON.stringify(formData)!==JSON.stringify({...EMPTY_PRODUCT_FORM,productKind:isService?'SERVICE':'STANDARD'}),registerTenantExitGuard,scopeKey)
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
    const owner=scopeKey,operation=++imageOperation.current
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
      if(liveScope.current!==owner||imageOperation.current!==operation)return
      if (!response.ok) throw new Error(data.message || 'Error al subir la imagen')
      const imageUrl = data.imageUrl ?? data.url
      if (!imageUrl) throw new Error('No se recibió la URL de la imagen')
      onFormChange('imageUrl', imageUrl)
      toast({ title: 'Imagen subida', description: 'La imagen del producto se subió correctamente.' })
    } catch (err: unknown) {
      if(liveScope.current!==owner||imageOperation.current!==operation)return
      toast({
        title: 'Error al subir imagen',
        description: (err as Error)?.message ?? 'No se pudo subir la imagen',
        variant: 'destructive',
      })
    } finally {
      if(liveScope.current===owner&&imageOperation.current===operation)setIsUploadingImage(false)
    }
  }

  const handleSubmit = () => {
    if (!agenda.ready || !unitCatalog.canWrite || createProductMutation.isPending) return
    if (!productForm.validateForm()) return
    const isKit = formData.productKind === 'KIT'
    const requestScope=scopeKey
    const units=inventoryUnitsEnabled?initialUnitsConfiguration(formData.units,formData.productKind):undefined
    const decimals=productDecimalPayload({...formData,stock:isKit?'0':formData.stock},{kind:formData.productKind,quantityDecimals:units?.quantity_decimals??Number(formData.quantityDecimals),advanced:!!units},locale)
    const payload = {
      ...(units?{units_configuration:units}:{}),
      ...decimals,
      name: formData.name.trim(),
      category_id: Number(formData.category),
      ...(!isService ? {
      brand: formData.brand?.trim() || undefined,
      size: formData.size?.trim() || undefined,
      supplier_id: formData.supplier || null,
      tracks_expiry: formData.tracksExpiry,
      } : {service_unit_label:formData.serviceUnitLabel.trim(),quantity_decimals:units?.quantity_decimals??Number(formData.quantityDecimals)}),
      promotion_valid_until: formData.promotionValidUntil?.trim()
        ? new Date(formData.promotionValidUntil).toISOString()
        : undefined,
      image_url: formData.imageUrl || undefined,
      barcode: formData.barcode?.trim() || undefined,
      description: formData.description?.trim() || undefined,
      status_id: 1,
      available_for_sale: formData.availableForSale,
      kind: formData.productKind,
      ...agenda.payload,
      ...(isKit
        ? {
            bom_components: formData.kitComponents
              .map((c) => ({
                component_product_id: c.component_product_id,
                qty_per_unit: normalizeUnitDecimal(String(c.qty_per_unit),{decimals:6,allowZero:false}),
              })),
          }
        : {}),
    }
    createProductMutation.mutate(payload, {
      onSuccess: (data: ApiProduct) => {
        if(liveScope.current!==requestScope)return
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
        if(liveScope.current!==requestScope)return
        const message = (err as { message?: string })?.message || 'No se pudo crear el producto'
        toast({ title: 'Error', description: message, variant: 'destructive' })
      },
    })
  }

  const isLoading = createProductMutation.isPending || isUploadingImage || !unitCatalog.canWrite
  const isKit = formData.productKind === 'KIT'
  if (serviceRequested && !inventoryServicesEnabled) return <div role="alert" className="mx-auto max-w-[1560px] p-8">Los servicios están desactivados para esta empresa.</div>

  return (
    <div className="mx-auto w-full max-w-[1560px] p-4 sm:p-8 space-y-5 animate-fade-in">
      {agendaGuard.dialog}
      <h1 className="sr-only">Nuevo Producto</h1>

      <Card className="auna-surface">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Datos esenciales</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {isService ? 'Nombre, categoría, unidad de cobro y precio.' : 'Nombre, categoría y precio son suficientes. El proveedor habitual es opcional.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={()=>agendaGuard.request(()=>navigate(isService ? '/inventario?tipo=services' : '/inventario'))} disabled={isLoading}>Cancelar</Button>
          <Button type="button" onClick={handleSubmit} disabled={isLoading || !agenda.ready}>{isLoading ? 'Guardando…' : isService ? 'Guardar servicio' : 'Guardar Producto'}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            className="w-full gap-2 sm:w-auto"
          >
            <Settings2 className="h-4 w-4" />
            {advancedOpen ? 'Ocultar opciones' : 'Más opciones'}
            <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <section aria-labelledby="create-identity-heading" className="space-y-3">
            <h2 id="create-identity-heading" className="text-sm font-semibold">Datos del producto</h2>
            <div className={advancedOpen ? "grid items-start gap-5 lg:grid-cols-[180px_minmax(0,1fr)]" : "grid"}>
            <div className={advancedOpen ? 'min-w-0 space-y-2' : 'hidden'}>
              <p className="text-xs text-muted-foreground">Fotografía · opcional</p>
              <div className="space-y-2">
                {formData.imageUrl ? (
                  <img src={formData.imageUrl} alt={formData.name || 'Producto'} className="h-28 w-full object-contain rounded-lg" />
                ) : (
                  <div className="flex h-20 items-center justify-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-sm">Sin imagen</span>
                  </div>
                )}
                <ImageUploadDropzone
                  className="[&_.auna-file-dropzone]:min-h-0 [&_.auna-file-dropzone]:py-3 [&_.auna-file-dropzone_svg]:h-5 [&_.auna-file-dropzone_svg]:w-5"
                  onFileSelect={(f) => {
                    void handleProductImageFile(f)
                  }}
                  onReject={(msg) =>
                    toast({ title: 'Archivo no válido', description: msg, variant: 'destructive' })
                  }
                  disabled={isUploadingImage || isLoading}
                  isUploading={isUploadingImage}
                />
              </div>
            </div>
              <div className={advancedOpen ? "grid min-w-0 gap-3 sm:grid-cols-3" : "grid min-w-0 gap-3 sm:grid-cols-2"}>
                  <div className={advancedOpen ? "sm:col-span-2" : ""}>
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
                          {categoriesQuery.isLoading ? <p className="p-3 text-sm" role="status">Cargando categorías…</p> : categoriesQuery.isError ? <div className="p-3 text-sm" role="alert">No se pudieron cargar categorías.<Button type="button" variant="ghost" onClick={() => void categoriesQuery.refetch()}>Reintentar</Button></div> : <CommandEmpty><CollectionEmptyState compact filtered={categories.length > 0} title="Las categorías del catálogo aparecerán aquí" description="Configura las categorías para organizar tus registros." /></CommandEmpty>}
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
                  {advancedOpen && !isService && (
                    <>
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
                    </>
                  )}
                {!isService && <div>
                  <Label className="text-muted-foreground">Proveedor habitual (opcional)</Label>
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
                        {suppliersQuery.isLoading ? <p className="p-3 text-sm" role="status">Cargando proveedores…</p> : suppliersQuery.isError ? <div className="p-3 text-sm" role="alert">No se pudieron cargar proveedores.<Button type="button" variant="ghost" onClick={() => void suppliersQuery.refetch()}>Reintentar</Button></div> : <CommandEmpty><CollectionEmptyState compact filtered={suppliers.length > 0} title="Aquí aparecerán tus proveedores" description="Registra un contacto de tipo proveedor para asociarlo a tus productos." /></CommandEmpty>}
                        <CommandList>
                          <CommandItem onSelect={()=>{onFormChange('supplier','');setSupplierPopoverOpen(false)}}>Sin proveedor habitual</CommandItem>
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
                </div>}
                <div>
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
                {advancedOpen && <div className="sm:col-span-2">
                  <Label className="text-muted-foreground">Descripción</Label>
                  <Textarea
                    placeholder="Descripción del producto..."
                    value={formData.description}
                    onChange={(e) => onFormChange('description', e.target.value)}
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>}
              </div>
            </div>
          </section>
          <div className={isService ? "space-y-5" : "grid items-start gap-6 xl:grid-cols-2"}>
            <section aria-labelledby="create-prices-heading" className="min-w-0 space-y-3 border-t pt-4">
              <h2 id="create-prices-heading" className="text-sm font-semibold">Precios y venta</h2>
              <div className={advancedOpen ? isService ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-3" : "grid gap-3"}>
                {([{field:'price',label:'Precio de Venta *',placeholder:'0.00',visible:true},{field:'priceWholesale',label:'Precio mayoreo (opcional)',placeholder:'—',visible:advancedOpen},{field:'cost',label:'Costo',placeholder:'0.00',visible:advancedOpen&&!isService}] as const).filter(field=>field.visible).map(field=><div key={field.field} className="min-w-0 space-y-1.5">
                  <Label htmlFor={"create-"+field.field} className="text-muted-foreground">{field.label}</Label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                    <Input id={"create-"+field.field} type="text" inputMode="decimal" placeholder={field.placeholder} value={formData[field.field]} onChange={e=>onFormChange(field.field,e.target.value)} className="pl-12" step="0.01" />
                  </div>
                </div>)}
              </div>
              {advancedOpen&&<div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5"><Label htmlFor="create-promotion" className="text-muted-foreground">Precio promoción (opcional)</Label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                    <Input id="create-promotion" type="text" inputMode="decimal" placeholder="—" value={formData.pricePromotion} onChange={e=>onFormChange("pricePromotion",e.target.value)} className="pl-12" step="0.01" />
                  </div>
                </div>
                <div className="min-w-0 space-y-1.5"><Label htmlFor="create-promotion-until" className="text-muted-foreground">Promoción válida hasta</Label>
                  <Input id="create-promotion-until" type="datetime-local" value={formData.promotionValidUntil} onChange={e=>onFormChange("promotionValidUntil",e.target.value)} />
                </div>
              </div>}
              {isService&&<div className="grid gap-3 sm:grid-cols-2">
                  <ServiceQuantityFields unit={formData.serviceUnitLabel} decimals={formData.quantityDecimals} onUnitChange={value=>onFormChange('serviceUnitLabel',value)} onDecimalsChange={value=>onFormChange('quantityDecimals',value)} />
              </div>}
              {isService&&<div className="min-w-0">{unitCatalog.isError&&inventoryUnitsEnabled?<p role="alert" className="text-sm text-destructive">No se pudieron cargar las unidades. <Button type="button" variant="ghost" onClick={()=>void unitCatalog.refetch()}>Reintentar</Button></p>:<UnitSettingsFields enabled={inventoryUnitsEnabled} kind={formData.productKind} units={unitCatalog.units} value={formData.units} onChange={value=>onFormChange('units',value)} disabled={isLoading||unitCatalog.isLoading} basePrice={formData.price} locale={locale} />}</div>}
                {advancedOpen && <div className="flex items-start justify-between gap-3 border-t pt-3">
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
                </div>}
            </section>
            {!isService&&<section aria-labelledby="create-stock-heading" className="min-w-0 space-y-3 border-t pt-4">
              <h2 id="create-stock-heading" className="text-sm font-semibold">Existencias y unidades</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                  {advancedOpen && !isService && <div>
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
                  </div>}
                  {!isService && (advancedOpen && isKit ? (
                    <div className="border-t pt-4 sm:col-span-3">
                      <ProductKitComponentsEditor
                        value={formData.kitComponents}
                        onChange={(kitComponents) => onFormChange('kitComponents', kitComponents)}
                      />
                      <p className="text-xs text-muted-foreground mt-3">
                        El stock del kit se calcula según los componentes. No lleva stock propio.
                      </p>
                    </div>
                  ) : (
                <div className={advancedOpen ? "grid gap-3 sm:col-span-2 sm:grid-cols-2" : "grid gap-3 sm:col-span-3 sm:grid-cols-2"}>
                  <div>
                    <Label className="text-muted-foreground">Stock Inicial</Label>
                    <div className="relative mt-1">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text" inputMode="decimal"
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
                        type="text" inputMode="decimal"
                        placeholder="0"
                        value={formData.minStock}
                        onChange={(e) => onFormChange('minStock', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                  ))}
              </div>
          <div>{unitCatalog.isError&&inventoryUnitsEnabled?<p role="alert" className="text-sm text-destructive">No se pudieron cargar las unidades. <Button type="button" variant="ghost" onClick={()=>void unitCatalog.refetch()}>Reintentar</Button></p>:<UnitSettingsFields enabled={inventoryUnitsEnabled} kind={formData.productKind} units={unitCatalog.units} value={formData.units} onChange={value=>onFormChange('units',value)} disabled={isLoading||unitCatalog.isLoading} basePrice={formData.price} locale={locale} />}</div>
                {advancedOpen && !isService && <div className="flex items-start justify-between gap-3 border-t pt-3">
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
                </div>}
            </section>}
          </div>
                  {agenda.allowed && <div className="space-y-3 border-t pt-4 md:col-span-2">{agenda.error ? <p role="alert" className="text-destructive">No se pudo cargar la configuración de Agenda. Recarga antes de guardar.</p> : <ServiceScheduleFields value={agenda.value} onChange={agenda.change} directory={agenda.directory} disabled={!agenda.ready || createProductMutation.isPending} errors={{}} />}</div>}
        </CardContent>
      </Card>
      {promptDialog}
    </div>
  )
}
