import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
/**
 * Detalle de producto organizado por tareas, con edición agrupada.
 */
import { usePageTrail } from '@/components/layout/PageNavigation'
import { ServiceQuantityFields } from './ServiceQuantityFields'
import { ServiceScheduleFields } from '@/modules/appointments/components/ServiceScheduleFields'
import { useServiceScheduleDraft } from '@/modules/appointments/useServiceScheduleDraft'
import { useDraftGuard } from '@/modules/appointments/components/DraftGuard'
import { ProductCommercialHistory } from './ProductCommercialHistory'
import { useMemo, useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
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
import {UnitSettingsFields} from '../units/UnitSettingsFields'
import {useUnitCatalog} from '../units/useUnitCatalog'
import {exactProductValues,unitsDraft,emptyUnitsDraft,productDecimalPayload,fetchPresentations,savePresentation,archivePresentation,formatUnitDecimal,formatUnitMoney,unitProductMetrics} from '../units/public'
import {presentationDraft,presentationInput} from '../units/model'
import type {ProductUnitsDraft,PresentationDraft} from '../units/types'

type CategoryItem = { id: number | string; name: string }

const getStatusBadge = (product: Product) => {
  if (product.kind === 'SERVICE') return <Badge variant="secondary" className={product.availableForSale !== false ? 'border-0 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : undefined}>{product.availableForSale !== false ? 'Disponible para venta' : 'No disponible'}</Badge>
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const hasEditPermission = hasPermission('products.edit')
  const canDelete = hasPermission('products.delete')
  const canViewCost = hasPermission('products.create')
  const { locale, currencyCode, inventoryServicesEnabled,inventoryUnitsEnabled } = useSystemSettings()
  const unitCatalog=useUnitCatalog(inventoryUnitsEnabled)
  const contextKey=JSON.stringify([id,unitCatalog.scope.companyId,unitCatalog.scope.branchId]),liveContext=useRef(contextKey),loadedContext=useRef(contextKey),skipScalarReset=useRef(false),unitsInFlight=useRef(false),imageOperation=useRef(0)
  liveContext.current=contextKey
  const fmt = (n: number) => formatMoney(n, locale, currencyCode)

  const suppliersQuery = useSuppliers(SUPPLIERS_DROPDOWN_PARAMS)
  const { data: suppliersData } = suppliersQuery
  const categoriesQuery = useCategories()
  const { data: categoriesData } = categoriesQuery
  const suppliers = useMemo(() => suppliersData?.items ?? [], [suppliersData])
  const categories = useMemo((): CategoryItem[] => {
    if (!categoriesData) return []
    if (Array.isArray(categoriesData)) return categoriesData as CategoryItem[]
    return ((categoriesData as { items?: CategoryItem[] }).items ?? []) as CategoryItem[]
  }, [categoriesData])

  const [rawProduct, setRawProduct] = useState<ApiProduct | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const updateMutation = useUpdateProduct()
  const { mutateAsync: updateProductAsync } = updateMutation
  const deleteMutation = useDeleteProduct()
  const { mutateAsync: deleteProductAsync, isPending: deleteIsLoading } = deleteMutation

  const { branch, branches,registerTenantExitGuard } = useTenant()
  const { mutateAsync: removeFromBranchAsync, isPending: removeBranchIsLoading } = useRemoveProductFromBranch()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false)

  useEffect(() => {
    const controller=new AbortController(),owner=contextKey
    imageOperation.current++;setIsUploadingImage(false)
    liveContext.current=owner
    setRawProduct(null);setBaseLocked(null);setUnitsError('');setUnitsBusy(false);setEditUnits(emptyUnitsDraft())
    const load = async () => {
      if (!id) return
      setIsLoading(true)
      try {
        const data = await fetchProductById(id,{signal:controller.signal,scope:unitCatalog.scope})
        if(liveContext.current!==owner||controller.signal.aborted)return
        loadedContext.current=owner
        setRawProduct(data)
        if(inventoryUnitsEnabled){
          const configuration=await fetchPresentations(unitCatalog.scope,id,controller.signal)
          if(liveContext.current!==owner||controller.signal.aborted)return
          setBaseLocked(configuration.base_unit_locked)
        }
      } catch (e) {
        if(liveContext.current!==owner||controller.signal.aborted)return
        setUnitsError((e as Error).message)
        toast({
          title: 'Error',
          description: (e as Error)?.message ?? 'No se pudo cargar el producto',
          variant: 'destructive',
        })
      } finally {
        if(liveContext.current===owner&&!controller.signal.aborted)setIsLoading(false)
      }
    }
    load()
    return()=>{imageOperation.current++;controller.abort();if(liveContext.current===owner)liveContext.current='disposed'}
  }, [contextKey,inventoryUnitsEnabled])

  const reloadProduct = async () => {
    if (!id) return
    const owner=contextKey
    const data = await fetchProductById(id,{scope:unitCatalog.scope})
    if(liveContext.current===owner)setRawProduct(data)
  }

  const product: Product | null = useMemo(
    () => (rawProduct&&loadedContext.current===contextKey ? adaptApiProduct(rawProduct) : null),
    [rawProduct,contextKey]
  )
  const isService = product?.kind === 'SERVICE'
  const agenda = useServiceScheduleDraft(isService, id)
  const serviceReadOnly = isService && !inventoryServicesEnabled
  const canEdit = hasEditPermission && !serviceReadOnly && unitCatalog.canWrite

  const [isEditing, setIsEditing] = useState(() => canEdit && searchParams.get('editar') === '1')
  useEffect(() => { if (!canEdit) setIsEditing(false) }, [canEdit])
  useEffect(() => {
    if (!isEditing && searchParams.get('editar') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('editar')
      setSearchParams(next, { replace: true })
    }
  }, [isEditing, searchParams, setSearchParams])
  const [detailTab, setDetailTab] = useState('information')
  usePageTrail([...(isService ? [{label:'Servicios',to:'/inventario?tipo=services'}] : []),{ label: product?.name || 'Detalle' }, ...(isEditing ? [{ label: 'Editar' }] : detailTab !== 'information' ? [{ label: ({lots:'Lotes y caducidades',locations:'Existencias por ubicación',kit:'Componentes del kit'} as Record<string,string>)[detailTab] || 'Información y precios' }] : [])])
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
  const [editServiceUnit,setEditServiceUnit] = useState('')
  const [editQuantityDecimals,setEditQuantityDecimals] = useState('0')
  const [baseLocked,setBaseLocked]=useState<boolean|null>(null),[unitsBusy,setUnitsBusy]=useState(false),[unitsError,setUnitsError]=useState(''),[editUnits,setEditUnits]=useState<ProductUnitsDraft>(emptyUnitsDraft)
  const isSaving=updateMutation.isPending||unitsBusy
  const originalExact=product?exactProductValues(product):null
  const scalarDirty=!!product&&[editName!==product.name,editPrice!==originalExact.price,editPriceWholesale!==(originalExact.priceWholesale??''),editPricePromotion!==(originalExact.pricePromotion??''),editStock!==originalExact.stock,editCost!==originalExact.cost,editMinStock!==originalExact.minStock,editDescription!==product.description,editBarcode!==product.barcode,editBrand!==product.brand,editSize!==product.size,editAvailableForSale!==(product.availableForSale!==false),editTracksExpiry!==(product.tracksExpiry===true),editCategoryId!==String(rawProduct?.category_id??''),editSupplierId!==String(rawProduct?.supplier_id??''),editImageUrl!==product.imageUrl,editServiceUnit!==(product.serviceUnitLabel??''),editQuantityDecimals!==String(product.quantityDecimals??0),editPromotionUntil!==(product.promotionValidUntil?.slice(0,16)??'')].some(Boolean)
  const originalUnits=unitsDraft(product?.unitConfiguration??product?.baseUnitConfiguration)
  const unitsDirty=JSON.stringify(editUnits)!==JSON.stringify(originalUnits)
  const presentationChanges=JSON.stringify(editUnits.presentations)!==JSON.stringify(originalUnits.presentations)
  const agendaGuard = useDraftGuard(isUploadingImage||isEditing && (!!agenda.dirty||scalarDirty||unitsDirty),registerTenantExitGuard,contextKey)

  useEffect(() => {
    if (!product) return
    if(skipScalarReset.current){skipScalarReset.current=false;return}
    const exact=exactProductValues(product)
    setEditUnits(unitsDraft(product.unitConfiguration??product.baseUnitConfiguration))
    setEditName(product.name ?? '')
    setEditServiceUnit(product.serviceUnitLabel ?? '')
    setEditQuantityDecimals(String(product.quantityDecimals ?? 0))
    setEditPrice(exact.price)
    setEditPriceWholesale(
      exact.priceWholesale??''
    )
    setEditPricePromotion(
      exact.pricePromotion??''
    )
    setEditPromotionUntil(
      product.promotionValidUntil ? String(product.promotionValidUntil).slice(0, 16) : ''
    )
    setEditStock(exact.stock)
    setEditBrand(product.brand ?? '')
    setEditSize(product.size ?? '')
    setEditBarcode(product.barcode ?? '')
    setEditDescription(product.description ?? '')
    setEditCost(exact.cost)
    setEditMinStock(exact.minStock)
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
      agendaGuard.proceed(() => navigate('/inventario'))
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
      agendaGuard.proceed(() => navigate('/inventario'))
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'No se pudo quitar el producto de la sucursal'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleEditProductImageFile = async (file: File) => {
    const owner=contextKey,operation=++imageOperation.current
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
      if(liveContext.current!==owner||imageOperation.current!==operation)return
      if (!response.ok) {
        const msg = typeof data.message === 'string' ? data.message : 'No se pudo subir la imagen'
        throw new Error(msg)
      }
      const imageUrl = data.imageUrl ?? data.url
      if (!imageUrl) throw new Error('La respuesta no contiene la URL de la imagen')
      setEditImageUrl(imageUrl)
      toast({ title: 'Imagen actualizada', description: 'La imagen se subió correctamente.' })
    } catch (error) {
      if(liveContext.current!==owner||imageOperation.current!==operation)return
      toast({
        title: 'Error',
        description: (error as Error)?.message ?? 'Error al subir la imagen',
        variant: 'destructive',
      })
    } finally {
      if(liveContext.current===owner&&imageOperation.current===operation)setIsUploadingImage(false)
    }
  }

  const resetEditState = () => {
    if (!product || !rawProduct) return
    const exact=exactProductValues(product)
    setEditUnits(unitsDraft(product.unitConfiguration??product.baseUnitConfiguration))
    setEditServiceUnit(product.serviceUnitLabel ?? '')
    setEditQuantityDecimals(String(product.quantityDecimals ?? 0))
    setEditName(product.name ?? '')
    setEditPrice(exact.price)
    setEditPriceWholesale(
      exact.priceWholesale??''
    )
    setEditPricePromotion(
      exact.pricePromotion??''
    )
    setEditPromotionUntil(
      product.promotionValidUntil ? String(product.promotionValidUntil).slice(0, 16) : ''
    )
    setEditStock(exact.stock)
    setEditBrand(product.brand ?? '')
    setEditSize(product.size ?? '')
    setEditBarcode(product.barcode ?? '')
    setEditDescription(product.description ?? '')
    setEditCost(exact.cost)
    setEditMinStock(exact.minStock)
    setEditImageUrl(product.imageUrl ?? undefined)
    const rawCategoryId = (rawProduct as { category_id?: string | number } | null)?.category_id
    setEditCategoryId(rawCategoryId ? String(rawCategoryId) : undefined)
    const rawSupplierId = (rawProduct as { supplier_id?: string | number } | null)?.supplier_id
    setEditSupplierId(rawSupplierId ? String(rawSupplierId) : undefined)
    setEditAvailableForSale(product.availableForSale !== false)
    setEditTracksExpiry(product.tracksExpiry === true)
  }

  const mutatePresentation=async(row:PresentationDraft,archive=false)=>{
    if(!canEdit||!isEditing||!rawProduct?.base_unit_id||isSaving||unitsInFlight.current||liveContext.current!==contextKey)return
    const owner=contextKey
    unitsInFlight.current=true;setUnitsBusy(true);setUnitsError('')
    try{
      const result=archive&&row.id?await archivePresentation(unitCatalog.scope,product.id,row.id,rawProduct.unit_revision??1):await savePresentation(unitCatalog.scope,product.id,rawProduct.unit_revision??1,presentationInput(row,product.kind),row.id)
      if(liveContext.current!==owner)return
      const saved=result.presentation
      const nextDefault=(old:string|null|undefined,enabled:boolean)=>old===row.id?(saved.active&&enabled?saved.id:null):old??null
      skipScalarReset.current=true
      setRawProduct(previous=>previous?{...previous,unit_revision:result.unit_revision,base_unit_locked:true,presentations:row.id?(previous.presentations??[]).flatMap(p=>p.id===row.id?saved.active?[saved]:[]:[p]):[...(previous.presentations??[]),...(saved.active?[saved]:[])],default_purchase_presentation_id:nextDefault(previous.default_purchase_presentation_id,saved.purchase_enabled),default_sale_presentation_id:nextDefault(previous.default_sale_presentation_id,saved.sale_enabled)}:previous)
      setEditUnits(previous=>({...previous,presentations:previous.presentations.flatMap(p=>p.key===row.key?saved.active?[presentationDraft(saved)]:[]:[p]),defaultPurchaseKey:previous.defaultPurchaseKey===row.key?(saved.active&&saved.purchase_enabled?saved.id:null):previous.defaultPurchaseKey,defaultSaleKey:previous.defaultSaleKey===row.key?(saved.active&&saved.sale_enabled?saved.id:null):previous.defaultSaleKey}))
      setBaseLocked(true)
      toast({title:archive?'Presentación archivada':'Presentación guardada',description:archive?'Los registros anteriores conservan su presentación.':'Los nuevos registros usarán la versión guardada.'})
    }catch(error){if(liveContext.current===owner)setUnitsError((error as Error).message);throw error}
    finally{unitsInFlight.current=false;if(liveContext.current===owner)setUnitsBusy(false)}
  }
  const exact=exactProductValues(product),advanced=!!product.unitConfiguration
  const displayMoney=(raw:string)=>formatUnitMoney(raw,locale,currencyCode)
  const measuredMetrics=advanced?unitProductMetrics(exact.price,exact.cost,exact.stock):null

  return (
    <div className="mx-auto w-full max-w-[1560px] min-w-0 space-y-4 px-4 py-5 sm:px-8">
      {agendaGuard.dialog}
      {serviceReadOnly && <p role="status" className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">Los servicios están desactivados para esta empresa. Puedes consultar este registro y su historial, pero no modificarlo ni crear nuevas operaciones.</p>}
      <header className="space-y-4">

        <ProductDetailSummary product={product} category={categoryLabel} status={getStatusBadge(product)} actions={
          !isEditing && <>
            {canEdit && <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" aria-hidden="true" />Editar
            </Button>}
            {canDelete && <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><MoreHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />Más acciones</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isService && branches.length > 1 && <DropdownMenuItem onSelect={() => setIsBranchDialogOpen(true)}>
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
          { label: 'Precio de venta', value: advanced?displayMoney(exact.price):fmt(product.price) },
          ...(isService ? [{label:'Unidad de cobro',value:product.serviceUnitLabel || '—'},{label:'Decimales',value:product.quantityDecimals ?? 0}] : [
          { label: 'Stock actual', value: `${advanced?formatUnitDecimal(exact.stock,locale):product.stock} ${rawProduct?.base_unit?.label??'unidades'}` },
          { label: 'Stock mínimo', value: `${advanced?formatUnitDecimal(exact.minStock,locale):product.minStock} ${rawProduct?.base_unit?.label??'unidades'}` }]),
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
              ].filter(field=>!isService || !['edit-brand','edit-size'].includes(field.id)).map(field => <div key={field.id} className="min-w-0 space-y-1.5">
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
                              {categoriesQuery.isLoading ? <p className="p-3 text-sm" role="status">Cargando categorías…</p> : categoriesQuery.isError ? <div className="p-3 text-sm" role="alert">No se pudieron cargar categorías.<Button type="button" variant="ghost" onClick={() => void categoriesQuery.refetch()}>Reintentar</Button></div> : <CommandEmpty><CollectionEmptyState compact filtered={categories.length > 0} title="Las categorías del catálogo aparecerán aquí" description="Configura las categorías para organizar tus registros." /></CommandEmpty>}
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

                    {!isService && <div>
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
                              {suppliersQuery.isLoading ? <p className="p-3 text-sm" role="status">Cargando proveedores…</p> : suppliersQuery.isError ? <div className="p-3 text-sm" role="alert">No se pudieron cargar proveedores.<Button type="button" variant="ghost" onClick={() => void suppliersQuery.refetch()}>Reintentar</Button></div> : <CommandEmpty><CollectionEmptyState compact filtered={suppliers.length > 0} title="Aquí aparecerán tus proveedores" description="Registra un contacto de tipo proveedor para asociarlo a tus productos." /></CommandEmpty>}
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
                    </div>}

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
              ...(canViewCost && !isService ? [{ id: 'edit-cost', label: 'Costo', value: editCost, set: setEditCost }] : []),
            ].map(field => <div key={field.id} className="space-y-1.5">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input id={field.id} type="text" inputMode="decimal" value={field.value} onChange={event => field.set(event.target.value)} disabled={isSaving} />
            </div>)}
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="edit-promotion-until">Promoción hasta</Label>
              <Input id="edit-promotion-until" type="datetime-local" value={editPromotionUntil} onChange={event => setEditPromotionUntil(event.target.value)} disabled={isSaving} />
            </div>
          </div>
        </fieldset>
        <fieldset className="record-edit-panel">
          <legend className="sr-only">Control de inventario</legend>
          <h3 className="record-edit-heading" aria-hidden="true"><Boxes />{isService ? 'Condiciones del servicio' : 'Control de inventario'}</h3>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            {isService ? <ServiceQuantityFields unit={editServiceUnit} decimals={editQuantityDecimals} onUnitChange={setEditServiceUnit} onDecimalsChange={setEditQuantityDecimals} disabled={isSaving||!!editUnits.baseUnitId} /> : <>
            <div className="space-y-1.5"><Label htmlFor="edit-stock">Stock actual{rawProduct?.base_unit?.label?` (${rawProduct.base_unit.label})`:''}</Label><Input id="edit-stock" type="text" inputMode="decimal" value={editStock} onChange={event => setEditStock(event.target.value)} disabled={isSaving} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-min-stock">Stock mínimo{rawProduct?.base_unit?.label?` (${rawProduct.base_unit.label})`:''}</Label><Input id="edit-min-stock" type="text" inputMode="decimal" value={editMinStock} onChange={event => setEditMinStock(event.target.value)} disabled={isSaving} /></div>
            </>}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3"><Label htmlFor="edit-available-sale">Disponible para la venta</Label><Switch id="edit-available-sale" checked={editAvailableForSale} onCheckedChange={setEditAvailableForSale} disabled={isSaving} /></div>
              <p className="text-xs text-muted-foreground">Si lo desactivas, no aparecerá al registrar ventas.</p>
            </div>
            {!isService && <div className="space-y-2">
              <div className="flex items-center justify-between gap-3"><Label htmlFor="edit-tracks-expiry">Control de caducidad</Label><Switch id="edit-tracks-expiry" checked={editTracksExpiry} onCheckedChange={setEditTracksExpiry} disabled={isSaving} /></div>
              <p className="text-xs text-muted-foreground">Exige fecha de caducidad en cada ingreso de mercancía.</p>
            </div>}
          </div>
        </fieldset>
        </div>
        <div className="record-edit-panel">{unitsError&&<p role="alert" className="text-sm text-destructive">{unitsError}</p>}<UnitSettingsFields enabled={inventoryUnitsEnabled} kind={product.kind??'STANDARD'} units={unitCatalog.units} value={editUnits} onChange={setEditUnits} disabled={isSaving||!canEdit||unitCatalog.isLoading||unitCatalog.isError} baseLocked={baseLocked!==false} allowPresentationDrafts={!!rawProduct?.base_unit_id} basePrice={editPrice} locale={locale} onSavePresentation={rawProduct?.base_unit_id?row=>mutatePresentation(row):undefined} onArchivePresentation={row=>mutatePresentation(row,true)} />{presentationChanges&&<p role="status" className="mt-3 text-sm text-muted-foreground">Guarda o quita las presentaciones modificadas antes de guardar los demás cambios.</p>}</div>
        {agenda.allowed && <fieldset className="record-edit-panel"><legend className="sr-only">Agenda del servicio</legend>{agenda.error ? <p role="alert" className="text-destructive">No se pudo cargar Agenda; recarga antes de guardar.</p> : <ServiceScheduleFields value={agenda.value} onChange={agenda.change} directory={agenda.directory} disabled={isSaving || !agenda.ready} errors={{}} />}</fieldset>}
        <div className="record-edit-actions">
          <Button variant="outline" onClick={() => agendaGuard.request(() => { setIsEditing(false); resetEditState(); agenda.reset(); })} disabled={isSaving || isUploadingImage}>Cancelar cambios</Button>
          <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={isSaving || isUploadingImage || !agenda.ready || presentationChanges || !canEdit}
                onClick={async () => {
                  if (!product || !rawProduct || !canEdit || isSaving || presentationChanges || liveContext.current!==contextKey) return
                  const owner=contextKey
                  try {
                    const unitFieldsChanged=editUnits.baseUnitId!==originalUnits.baseUnitId||editUnits.quantityDecimals!==originalUnits.quantityDecimals||editUnits.defaultPurchaseKey!==originalUnits.defaultPurchaseKey||editUnits.defaultSaleKey!==originalUnits.defaultSaleKey
                    const advanced=inventoryUnitsEnabled&&!!(product.unitConfiguration||unitFieldsChanged&&editUnits.baseUnitId)
                    const values=productDecimalPayload({price:editPrice,priceWholesale:editPriceWholesale,pricePromotion:editPricePromotion,stock:editStock,minStock:editMinStock,cost:editCost===exactProductValues(product).cost?undefined:editCost},{kind:product.kind??'STANDARD',quantityDecimals:advanced?Number(editUnits.quantityDecimals):Number(editQuantityDecimals),advanced},locale)
                    if(values.price==='0')throw new Error('El precio debe ser mayor a cero')
                    const unitPayload=advanced?{unit_revision:rawProduct.unit_revision??1,...(unitFieldsChanged?{base_unit_id:editUnits.baseUnitId,quantity_decimals:Number(editUnits.quantityDecimals),default_purchase_presentation_id:editUnits.defaultPurchaseKey,default_sale_presentation_id:editUnits.defaultSaleKey}:{})}:{}
                    if (isService && (!editServiceUnit.trim() || !/^[0-4]$/.test(editQuantityDecimals))) throw new Error('Ingresa una unidad de cobro y de 0 a 4 decimales')
                    const rawCategoryId = (rawProduct as { category_id?: string | number } | null)?.category_id
                    const rawSupplierId = (rawProduct as { supplier_id?: string | number } | null)?.supplier_id
                    const updated = await updateProductAsync({
                      id: product.id,
                      payload: {
                        ...values,
                        ...unitPayload,
                        id: product.id,
                        name: editName.trim() || product.name,
                        category_id: editCategoryId ?? rawCategoryId ?? '',
                        ...(!isService ? {
                        brand: editBrand || undefined,
                        size: editSize || undefined,
                        supplier_id: editSupplierId ?? (rawSupplierId ? String(rawSupplierId) : undefined),
                        tracks_expiry: editTracksExpiry,
                        } : {service_unit_label:editServiceUnit.trim(),quantity_decimals:advanced?Number(editUnits.quantityDecimals):Number(editQuantityDecimals)}),
                        promotion_valid_until: editPromotionUntil.trim()
                          ? new Date(editPromotionUntil).toISOString()
                          : null,
                        image_url: editImageUrl ?? product.imageUrl,
                        barcode: editBarcode || undefined,
                        description: editDescription || undefined,
                        available_for_sale: editAvailableForSale,
                        ...agenda.payload,
                      },
                    })
                    if(liveContext.current!==owner)return
                    setRawProduct(updated)
                    await agenda.reload()
                    setIsEditing(false)
                    toast({ title: 'Producto actualizado', description: 'Los cambios se guardaron correctamente.' })
                  } catch (error) {
                    if(liveContext.current!==owner)return
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
            {isService && hasPermission('sales.view') && <TabsTrigger value="history">Historial de ventas</TabsTrigger>}
            {!isService && product.kind !== 'KIT' && <TabsTrigger value="lots"><CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />Lotes y caducidades</TabsTrigger>}
            {!isService && <TabsTrigger value="locations"><Warehouse className="mr-2 h-4 w-4" aria-hidden="true" />Ubicaciones</TabsTrigger>}
            {!isService && (product.kind === 'KIT' || canEdit) && <TabsTrigger value="kit"><Boxes className="mr-2 h-4 w-4" aria-hidden="true" />Kit / combo</TabsTrigger>}
          </TabsList>
        </div>
        {!isService && product.kind !== 'KIT' && <TabsContent value="lots" forceMount hidden={detailTab !== 'lots'} className="mt-5 data-[state=inactive]:hidden">
          <ProductLotsSection productId={id} baseDecimals={product.unitConfiguration?.quantity_decimals??0} baseLabel={product.unitConfiguration?.base_unit?.label??'unidades'} tracksExpiry={product.tracksExpiry === true} onMutated={() => void reloadProduct()} />
        </TabsContent>}
        {!isService && <TabsContent value="locations" forceMount hidden={detailTab !== 'locations'} className="mt-5 data-[state=inactive]:hidden"><ProductLocationsSection productId={id} baseDecimals={product.unitConfiguration?.quantity_decimals??0} baseLabel={product.unitConfiguration?.base_unit?.label??'unidades'} /></TabsContent>}
        <TabsContent value="information" forceMount hidden={detailTab !== 'information'} className="mt-5 data-[state=inactive]:hidden">
          <div className="auna-surface mb-4 rounded-xl border p-5"><UnitSettingsFields enabled={inventoryUnitsEnabled} kind={product.kind??'STANDARD'} units={unitCatalog.units} value={unitsDraft(product.unitConfiguration??product.baseUnitConfiguration)} onChange={()=>{}} disabled baseLocked={baseLocked!==false} basePrice={exactProductValues(product).price} locale={locale} /></div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <section className="auna-surface min-w-0 space-y-4 rounded-xl border p-5" aria-labelledby="product-information-heading">
              <h2 id="product-information-heading" className="text-lg font-semibold">Información del producto</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Categoría', categoryLabel || 'Sin categoría'],
                  ...(isService ? [['Unidad de cobro',product.serviceUnitLabel || '—'],['Decimales de cantidad',String(product.quantityDecimals ?? 0)]] : [['Proveedor', supplierLabel || 'Sin proveedor']]),
                  ['Código de barras', product.barcode || '—'],
                  ['Disponible para venta', product.availableForSale !== false ? 'Sí' : 'No'],
                  ...(!isService ? [['Control de caducidad', product.tracksExpiry ? 'Sí' : 'No']] : []),
                ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}
              </dl>
              <div className="border-t pt-4"><h3 className="text-sm font-medium">Descripción</h3><p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">{product.description || 'Sin descripción'}</p></div>
            </section>
            <section className="auna-surface min-w-0 space-y-4 rounded-xl border p-5" aria-labelledby="product-prices-heading">
              <h2 id="product-prices-heading" className="text-lg font-semibold">Precios y rentabilidad</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Precio mayoreo', advanced?(exact.priceWholesale==null?'No configurado':displayMoney(exact.priceWholesale)):product.priceWholesale != null && product.priceWholesale > 0 ? fmt(product.priceWholesale) : 'No configurado'],
                  ['Precio promoción', advanced?(exact.pricePromotion==null?'No configurado':displayMoney(exact.pricePromotion)):product.pricePromotion != null && product.pricePromotion > 0 ? fmt(product.pricePromotion) : 'No configurado'],
                  ['Promoción hasta', product.promotionValidUntil ? new Date(product.promotionValidUntil).toLocaleString(locale || 'es-GT') : 'Sin fecha'],
                  ...(canViewCost && !isService ? [
                    ['Costo', advanced?`${formatUnitDecimal(exact.cost,locale)} ${currencyCode}`:fmt(product.cost)],
                    ['Margen de ganancia', measuredMetrics?`${displayMoney(measuredMetrics.marginMoney)} (${measuredMetrics.marginPercent}%)`:`${fmt(product.price - product.cost)} (${product.price > 0 ? (((product.price - product.cost) / product.price) * 100).toFixed(1) : '0'}%)`],
                    ['Valor de inventario', measuredMetrics?displayMoney(measuredMetrics.inventoryValue):fmt(product.stock * product.cost)],
                  ] : []),
                ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium tabular-nums">{value}</dd></div>)}
              </dl>
            </section>
          </div>
        </TabsContent>
        {!isService && (product.kind === 'KIT' || canEdit) && <TabsContent value="kit" forceMount hidden={detailTab !== 'kit'} className="mt-5 data-[state=inactive]:hidden">
          <ProductKitSection product={product} productId={id} canEdit={canEdit} onUpdated={() => void reloadProduct()} />
        </TabsContent>}
        {isService && hasPermission('sales.view') && detailTab==='history' && <TabsContent value="history" className="mt-5"><ProductCommercialHistory productId={id} /></TabsContent>}
      </Tabs>}
    </div>
  )
}
