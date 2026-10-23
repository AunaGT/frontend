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
 * POS de dos pasos: componer con catálogo a la derecha y revisar el pago
 * con la venta a la derecha, sin elegir un método por el cajero.
 * El registro y sus estados comerciales siguen bajo la autoridad del backend.
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PosNumericKeypad } from './components/PosNumericKeypad'
import { SalePresentationDialog } from './components/SalePresentationDialog'
import { applyPosKey } from './posInput'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { Pagination } from '@/components/shared/Pagination'
import { useCardPagination } from '@/hooks/useCardPagination'
import './pos.css'
import {normalizeQuantityInput,previewPartialLineTotal} from '@/lib/commercialQuantity'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, CreditCard, Printer, Receipt, Search, ChevronDown, PauseCircle, RotateCcw, Landmark, ImageIcon, Package, UserRound, SlidersHorizontal, Trash2 } from 'lucide-react'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchWarehouses } from '@/services/warehouseService'
import { fetchStockByLocation } from '@/services/stockMoveService'
import { PRODUCTS_QUERY_KEY } from '@/hooks/useProducts'
import {SALES_QUERY_KEY} from '@/hooks/useSales'
import {usePosAvailability} from './hooks/usePosAvailability'
import {usePosCatalog,preparePosPrices} from './hooks/usePosCatalog'
import { usePaymentMethods, PaymentMethod as PaymentMethodType } from '@/hooks/usePaymentMethods'
import { isCashMethod } from '@/services/paymentMethodsService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { checkCustomerCredit } from '@/modules/receivables'
import { formatMoney } from '@/utils'
import {useCheckoutFlow} from './checkout/useCheckoutFlow'
import {CheckoutRecoveryNotice} from './checkout/CheckoutRecoveryNotice'
import {downloadSavedSaleTicket} from './documents/saleTicketRecovery'
import {usePrintDestination,PrintDestination} from '@/modules/config/hardware/public'
import {
  fetchOrderById,
  pendingOrderLineQty,
  type Order,
} from '@/services/orderService'
import { resolvePosCatalogCode,adaptApiProduct, type ProductAvailability } from '@/services/productService'
import {UnitLineFields} from '@/components/shared/UnitLineFields'
import {useDraftGuard} from '@/modules/appointments/components/DraftGuard'
import {selectProductUnit,selectedBaseQuantity,selectedUnitPayload,selectedQuantity,exactProductValues,compareUnitQuantities,addUnitQuantities,stepUnitQuantity,formatUnitDecimal,formatUnitMoney,previewUnitLines,isUnitDocumentLine,frozenDocumentSelection,remainingDocumentQuantity,documentNetAmounts,unitCartKey,type UnitSelection} from '@/modules/inventory/units/public'
import {lookupScannedUnitProduct} from '@/services/scannerService'
import {ScannerField} from '@/components/shared/ScannerField'
import {resolveContextScan} from '@/services/contextScannerService'
import {
  saveNewSaleDraft,
  loadNewSaleDraft,
  consumeNewSaleDraft,
  hasNewSaleDraft,
  type NewSaleDraft,
} from '@/services/saleDraftStorage'
import { useAuth } from '@/context/useAuth'
import { useModules } from '@/context/useModules'
import type { Product } from '@/types/product'

import { useCart } from './hooks'
import { usePromotions } from '@/hooks/usePromotions'
import {
  AvailabilityDialog,
  AdminAuthDialog,
  PromotionCodeInput,
  SavedCustomerMany2One,
} from './components'
import { OpenCashRegisterPrompt } from './OpenCashRegisterPrompt'
import { CashRegisterPicker } from './CashRegisterPicker'
import { closeCashSession, fetchCashSessionCurrent } from '@/services/cashSessionsService'
import { CASH_SESSION_CURRENT_QUERY_KEY } from '@/modules/cash-closure'
import type { CashRegisterSessionDto, CashSessionCurrentResult } from '@/services/cashSessionsService'
import type { CartProduct } from './types'
import {useTenant} from '@/context/useTenant'

type ProductBrowseLayout = 'flat' | 'byCategory'

function presentationEquivalence(qty:string,selection?:UnitSelection,locale?:string){
  if(!selection?.snapshot.presentation)return null
  try{return `${formatUnitDecimal(qty,locale)} ${selection.snapshot.presentation.label} = ${formatUnitDecimal(selectedBaseQuantity(qty,{...selection,acceptRounding:true}),locale)} ${selection.snapshot.baseUnit.label}`}catch{return 'Revisa la cantidad y su equivalencia'}
}

const PRODUCT_LAYOUT_STORAGE_KEY = 'deposito:listUi:v1:ventas/nueva/productos-layout'

function readProductBrowseLayout(): ProductBrowseLayout {
  try {
    const v = sessionStorage.getItem(PRODUCT_LAYOUT_STORAGE_KEY)
    if (v === 'flat') return 'flat'
    if (v === 'byCategory') return 'byCategory'
  } catch {
    /* ignore */
  }
  return 'flat'
}

function writeProductBrowseLayout(layout: ProductBrowseLayout) {
  try {
    sessionStorage.setItem(PRODUCT_LAYOUT_STORAGE_KEY, layout)
  } catch {
    /* ignore */
  }
}

const ProductCard = ({ product, onAdd, disabled, formatPrice, displayUnitPrice, availableQty, physicalStock, posQty, posMode }: {
  product: Product; onAdd: () => void; disabled?: boolean; formatPrice: (n: number) => string
  displayUnitPrice: number; availableQty?: number; physicalStock?: number; posQty?: number | null; posMode?: boolean
}) => {
  const [imageFailed, setImageFailed] = useState(false)
  const stock = product.kind === 'SERVICE' ? product.serviceUnitLabel || 'Servicio' : posMode
    ? posQty != null ? `Mostrador: ${posQty}` : 'Mostrador: …'
    : `Disponible: ${availableQty ?? product.stock ?? 0}`
  return <button type="button" className="pos-product-tile pos-product-row" aria-label={`Agregar ${product.name}`} onClick={onAdd} disabled={disabled}>
    <span className="pos-tile-image">
      {product.imageUrl && !imageFailed ? <img src={product.imageUrl} alt="" width={96} height={96} loading="lazy" onError={() => setImageFailed(true)} /> : <Package className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
    </span>
    <span className="pos-tile-content">
      <span className="pos-tile-name" title={product.name}>{product.name}</span>
      <span className="pos-tile-price">{formatPrice(displayUnitPrice)}</span>
      <span className="pos-tile-stock">{stock}</span>
      {product.kind !== 'SERVICE' && posQty != null && availableQty != null && availableQty > posQty && <span className="pos-tile-other">{availableQty - posQty} en otros almacenes</span>}
      {!posMode && physicalStock != null && availableQty != null && physicalStock !== availableQty && <span className="pos-tile-other">{physicalStock} físicamente</span>}
    </span>
  </button>
}

const CategoryBrowseCard = ({ name, count, imageUrl, onSelect, disabled, selected }: {
  name: string; count: number; imageUrl?: string | null; onSelect: () => void; disabled?: boolean; selected?: boolean
}) => {
  const [imageFailed, setImageFailed] = useState(false)
  return <button type="button" className="pos-category-row" aria-pressed={Boolean(selected)} aria-label={`Ver categoría ${name}`} onClick={onSelect} disabled={disabled}>
    <span className="pos-category-image">
      {imageUrl && !imageFailed ? <img src={imageUrl} alt="" loading="lazy" width={48} height={48} onError={() => setImageFailed(true)} /> : <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
    </span>
    <span className="min-w-0 text-left"><span className="block font-medium">{name}</span><span className="text-xs text-muted-foreground">{count} {count === 1 ? 'producto' : 'productos'}</span></span>
  </button>
}

export default function NewSalePage() {
  const {company,branch,registerTenantExitGuard}=useTenant()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const { isEnabled } = useModules()
  const canLoadOrders = isEnabled('orders') && hasPermission('orders.view')
  const promotionsEnabled = isEnabled('promotions')
  const userId = user?.id ?? ''
  const checkoutScope=useMemo(()=>({companyId:company?.id??'',branchId:branch?.id??'',userId}),[company?.id,branch?.id,userId])
  const scopeKey=JSON.stringify(checkoutScope)
  const currentScope=useRef(scopeKey);currentScope.current=scopeKey
  const unitOwner=useMemo(()=>({active:true,controller:new AbortController(),key:scopeKey}),[scopeKey])
  useEffect(()=>{unitOwner.active=true;return()=>{unitOwner.active=false;unitOwner.controller.abort()}},[unitOwner])
  const {
    locale,
    timezone,
    currencyCode,
    companyName,
    companyLogoUrl,
    vatRegime,
    ivaRate,
    salesAllowCredit,
    salesShowFiscalFields,
    salesShowChannels,
    inventoryUnitsEnabled,
  } = useSystemSettings()
  const fmt = (n: number) => formatMoney(n, locale, currencyCode)

  const paymentMethodsQuery = usePaymentMethods()
  const paymentMethods = useMemo(() => paymentMethodsQuery.data ?? [], [paymentMethodsQuery.data])
  // Solo lo que maneja esta sucursal: no se puede vender lo que no está aquí.
  const {inventoryServicesEnabled}=useSystemSettings()
  const [scannedProducts,setScannedProducts]=useState<Product[]>([])

  // Ubicación desde la que despacha este punto de venta (si la sucursal la marcó).
  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: () => fetchWarehouses() })
  const posLocationId = useMemo(
    () => warehousesQuery.data?.flatMap((w) => w.locations).find((l) => l.is_sales)?.id ?? null,
    [warehousesQuery.data]
  )
  // Sin ubicación de venta, la caja no sabe de dónde despacha: el stock que
  // mostraría es la suma de todos los almacenes de la sucursal, que no es lo que
  // tiene a mano. Antes esto se ignoraba en silencio y se vendía igual.
  const posSinConfigurar = warehousesQuery.isSuccess && !posLocationId

  const [productSearch, setProductSearch] = useState('')
  const productSearchRef = useRef<HTMLInputElement | null>(null)
  const [productPage, setProductPage] = useState(1)
  const [productPageSize, setProductPageSize] = useState(9)
  const [productLayout, setProductLayout] = useState<ProductBrowseLayout>(readProductBrowseLayout)
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null)
  const productPagination = useCardPagination({ enabled: true, tablePageSize: productPageSize, onPageChange: setProductPage, storageKey: 'ventas/nueva/productos', cardMinWidth: 140, cardGap: 10 })
  const pageSize = productPagination.pageSize
  const catalogType=inventoryServicesEnabled?'all':'goods'
  const productsQuery=usePosCatalog(checkoutScope,{page:productPage,pageSize,search:productSearch,category:selectedCategoryName,catalogType},hasPermission('sales.create'))
  const pageProducts=useMemo(()=>productsQuery.data?.items??[],[productsQuery.data])
  const availableProducts=useMemo(()=>[...new Map([...productsQuery.retainedProducts,...scannedProducts].map(p=>[p.id,p])).values()],[productsQuery.retainedProducts,scannedProducts])
  const totalPages=productsQuery.data?.totalPages??1,safePage=productsQuery.data?.page??productPage
  useEffect(()=>{if(productsQuery.data&&productPage!==productsQuery.data.page)setProductPage(productsQuery.data.page)},[productsQuery.data,productPage])
  const [customer, setCustomer] = useState('Consumidor final')
  const [customerNit, setCustomerNit] = useState('')
  const [pickedCustomerId, setPickedCustomerId] = useState<string>('__none__')
  const [salesChannel, setSalesChannel] = useState<'POS' | 'WHOLESALE' | 'ONLINE'>('POS')
  const [unitPricesById, setUnitPricesById] = useState<Record<string, number>>({})
  const [unitPriceTier,setUnitPriceTier]=useState('LIST')
  const availabilityRef = useRef<Record<string, ProductAvailability>>({})
  const [isFinalConsumer, setIsFinalConsumer] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType | null>(null)
  const [amountReceived, setAmountReceived] = useState('')
  const [saleStep, setSaleStep] = useState<'products' | 'payment'>('products')
  const paymentTitleRef = useRef<HTMLHeadingElement | null>(null)
  const paymentReviewButtonRef = useRef<HTMLButtonElement | null>(null)
  const stepFocusRequest = useRef<{step: 'products' | 'payment'; scope: string} | null>(null)
  useEffect(() => {
    const request = stepFocusRequest.current
    stepFocusRequest.current = null
    if (!request || request.scope !== scopeKey || request.step !== saleStep) return
    const target = saleStep === 'payment' ? paymentTitleRef.current : paymentReviewButtonRef.current
    target?.focus()
  }, [saleStep, scopeKey])
  const [mobileView, setMobileView] = useState<'catalog' | 'sale'>('catalog')
  const [selectedLineKey, setSelectedLineKey] = useState<string | null>(null)
  const [unitChange, setUnitChange] = useState<{from: string; to: string; scope: string} | null>(null)
  const [quantityDraft, setQuantityDraft] = useState<{owner: string; value: string; replace: boolean} | null>(null)
  const [actionPanel, setActionPanel] = useState<'customer' | 'promotions' | 'options' | 'unit' | 'print' | 'turn' | null>(null)
  const [pendingPresentation,setPendingPresentation]=useState<{product:Product;scope:string;generation:number}|null>(null)
  const handledPresentation=useRef<object|null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isHydrating,setIsHydrating]=useState(false)
  const hydrationOwner=useRef<object|null>(null)
  const [promoCodesToRestore, setPromoCodesToRestore] = useState<string[] | null>(null)
  /** Fuerza recomputar si hay borrador en localStorage (React no observa el storage). */
  const [storedDraftRevision, setStoredDraftRevision] = useState(0)
  const restoredDraftId=useRef<string|undefined>()
  const [loadedOrder, setLoadedOrder] = useState<Order | null>(null)
  const visiblePaymentMethods = useMemo(
    () => paymentMethods.filter((method) => salesAllowCredit || !method.is_credit),
    [paymentMethods, salesAllowCredit]
  )
  /** Producto que el mostrador ya no tiene, pero sí hay en otra ubicación. */
  type ElsewhereState = { generation:number;product: Product;selection?:{presentationId?:string|null;priceContext?:string}; atPos: number|string; rows: { label: string; stock: number|string }[] }
  const [elsewhere, setElsewhere] = useState<ElsewhereState | null>(null)
  // El AlertDialog sigue montado durante la animación de cierre, cuando `elsewhere`
  // ya es null: leerlo directo pintaba "Solo quedan undefined en el mostrador".
  const elsewhereShownRef = useRef<ElsewhereState | null>(null)
  if (elsewhere) elsewhereShownRef.current = elsewhere
  const elsewhereView = elsewhere ?? elsewhereShownRef.current
  const [loadOrderRef, setLoadOrderRef] = useState('')
  const [loadOrderOpen, setLoadOrderOpen] = useState(false)
  const orderLineIdByProductRef = useRef<Map<string, string>>(new Map())
  const pedidoLoadedRef = useRef<string | null>(null)

  useEffect(() => {
    productSearchRef.current?.focus()
  }, [])

  const customerContactIdForPricing =
    pickedCustomerId !== '__none__' && pickedCustomerId.trim() ? pickedCustomerId : undefined

  // ---- Venta al crédito ----
  const [creditDueDate, setCreditDueDate] = useState('')
  const [initialCreditPayment, setInitialCreditPayment] = useState('')
  const [initialCreditMethod, setInitialCreditMethod] = useState('')
  const [creditOverride, setCreditOverride] = useState(false)
  const currentPaymentMethod = visiblePaymentMethods.find(method => method.id === paymentMethod?.id) ?? null
  const isCreditSale = Boolean(currentPaymentMethod?.is_credit)
  const canOverrideCredit = hasPermission('sales.credit.override')

  const getUnitPrice = useCallback(
    (p: Product) => {
      const original=loadedOrder?.lines.find(line=>line.product_id===p.id)
      if (original) return Number(original.unit_price)
      const u = unitPricesById[p.id]
      return u != null && Number.isFinite(u) ? u : Number(p.price ?? 0)
    },
    [unitPricesById,loadedOrder]
  )

  const getAvailableQty = useCallback(
    (p: Product) => availabilityRef.current[p.id]?.available ?? Number(p.stock ?? 0),
    []
  )

  const cartProducts=useMemo(()=>{
    if (!loadedOrder) return availableProducts
    const byId=new Map(availableProducts.map(product=>[product.id,product]))
    for (const line of loadedOrder.lines) {
      const current=byId.get(line.product_id)
      if (!current && line.item_kind!=='SERVICE'&&!isUnitDocumentLine(line)) continue
      const product=current ?? {id:line.product_id,name:line.item_name || 'Servicio',category:'',brand:'',size:'',stock:0,minStock:0,price:Number(line.unit_price),cost:0,supplier:'',barcode:line.product?.barcode || '',description:'',status:'Disponible'}
      byId.set(line.product_id,{...product,name:line.item_name ?? product.name,kind:line.item_kind ?? product.kind,serviceUnitLabel:line.unit_label ?? product.serviceUnitLabel,quantityDecimals:line.quantity_decimals ?? product.quantityDecimals})
    }
    return [...byId.values()]
  },[availableProducts,loadedOrder])
  const getAvailableQtyExact=useCallback((p:Product)=>String(availabilityRef.current[p.id]?.available??exactProductValues(p).stock),[])
  const cart = useCart({ availableProducts:cartProducts, getUnitPrice, getAvailableQty,getAvailableQtyExact,priceContext:unitPriceTier,isCurrent:()=>unitOwner.active&&currentScope.current===unitOwner.key })
  const draftGuard=useDraftGuard(cart.cartItems.length>0,registerTenantExitGuard,scopeKey)
  const oldCartScope=useRef(scopeKey)
  useEffect(()=>{if(oldCartScope.current!==scopeKey){oldCartScope.current=scopeKey;unitPrepareOwner.current=null;setUnitPreparing(false);cart.clearCart();setScannedProducts([]);setLoadedOrder(null);setUnitPricesById({});availabilityRef.current={};setPaymentMethod(null);setAmountReceived('');setInitialCreditPayment('');setInitialCreditMethod('');setCreditDueDate('');setCreditOverride(false);setSaleStep('products');setMobileView('catalog');setQuantityDraft(null);setSelectedLineKey(null);setActionPanel(null);setCustomer('Consumidor final');setCustomerNit('');setPickedCustomerId('__none__');setIsFinalConsumer(true)}},[scopeKey])
  const hydrateOrderCartRef=useRef(cart.hydrateFromLines)
  hydrateOrderCartRef.current=cart.hydrateFromLines
  useEffect(()=>{
    if (loadedOrder){const amounts=documentNetAmounts(loadedOrder);hydrateOrderCartRef.current(loadedOrder.lines.flatMap((line,index)=>{const advanced=isUnitDocumentLine(line),qty=advanced?remainingDocumentQuantity(line):String(pendingOrderLineQty(line));if(compareUnitQuantities(qty,'0')<=0)return[];const selection=advanced?frozenDocumentSelection({...line,line_total:amounts[index]},'BASE'):undefined;return[{productId:line.product_id,qty,unitSelection:selection,lineKey:unitCartKey(line.product_id,selection)}]}),[])}
  },[loadedOrder])

  /**
   * El mostrador despacha de SU ubicación. Si ahí ya no queda, no se bloquea la
   * venta: se dice en qué anaquel está el producto y el cajero decide. Después
   * sigue el flujo de siempre (cantidad adicional, autorización de admin).
   */
  const addingRef = useRef<Map<string,Promise<void>>>(new Map())
  const pendingAdditionsRef=useRef(new Map<object,number>())
  const [,setAdditionsRevision]=useState(0)
  const cartAcceptsAdditions=useRef(true)
  const cartGeneration=()=>cart.getGeneration()
  const hasPendingAdditions=()=>[...pendingAdditionsRef.current.values()].some(generation=>generation===cartGeneration())
  const additionIsCurrent=(generation:number)=>generation===cartGeneration()&&cartAcceptsAdditions.current&&currentScope.current===unitOwner.key&&unitOwner.active
  const trackAddition=<T,>(generation:number,run:()=>Promise<T>)=>{
    const token={};pendingAdditionsRef.current.set(token,generation);setAdditionsRevision(value=>value+1)
    return Promise.resolve().then(run).finally(()=>{pendingAdditionsRef.current.delete(token);if(unitOwner.active)setAdditionsRevision(value=>value+1)})
  }
  const hydrateCart=(run:(generation:number)=>Promise<boolean>)=>{
    if(hydrationOwner.current||isProcessing||unitPrepareOwner.current)return Promise.resolve(false)
    const token={},generation=cart.getGeneration()
    hydrationOwner.current=token;cartAcceptsAdditions.current=false;setIsHydrating(true)
    return trackAddition(generation,()=>run(generation)).finally(()=>{if(hydrationOwner.current===token){hydrationOwner.current=null;if(unitOwner.active)setIsHydrating(false)}})
  }
  useEffect(()=>{hydrationOwner.current=null;setIsHydrating(false)},[scopeKey])
  /** Hay un aviso de "está en otro almacén" esperando que el cajero decida. */
  const decisionPendienteRef = useRef(false)

  const addProduct = (product: Product,selection?:{presentationId?:string|null;priceContext?:string}) => {
    const generation=cartGeneration(),queueKey=JSON.stringify([generation,product.id])
    const run=async()=>{
    if(!additionIsCurrent(generation)||decisionPendienteRef.current)return
    try {
    if (product.kind==='SERVICE') {cart.addToCart(product,selection);return}
    if (posSinConfigurar) {
      toast({
        title: 'Falta configurar el punto de venta',
        description:
          'Esta sucursal no tiene una ubicación de venta marcada, así que la caja no sabe de qué almacén despacha. Configurala en Sucursales → Almacenes antes de vender.',
        variant: 'destructive',
      })
      return
    }
    if (!posLocationId) { cart.addToCart(product,selection); return }
      const fresh=await posAvailability.ensureCurrent([product.id])
      if(!additionIsCurrent(generation)||decisionPendienteRef.current)return
      availabilityRef.current={...availabilityRef.current,...fresh.availability}
      const known=fresh.availability[product.id]
      if(!known||known.location_stock==null)throw Error('No se pudo comprobar la disponibilidad del producto. Vuelve a intentarlo.')
      const chosen=product.unitConfiguration?selectProductUnit(product,selection?.presentationId,selection?.priceContext??unitPriceTier):undefined
      // Esta estimación no acepta el redondeo: el carrito conserva su revisión obligatoria.
      const required=addUnitQuantities(cart.getBaseQuantity(product.id),chosen?selectedBaseQuantity('1',{...chosen,acceptRounding:true}):'1')
      if(compareUnitQuantities(required,String(known.location_stock))<=0){cart.addToCart(product,selection);return}
      const rows = await queryClient.fetchQuery({
        queryKey: ['stock-by-location',checkoutScope.companyId,checkoutScope.branchId, product.id],
        queryFn: () => fetchStockByLocation(product.id,{signal:unitOwner.controller.signal,headers:{'X-Company-Id':checkoutScope.companyId,'X-Branch-Id':checkoutScope.branchId}}),
        staleTime: 0,
      })
      if(!additionIsCurrent(generation))return
      const atPos = rows.find((r) => r.location.id === posLocationId)?.stock ?? 0
      const otras = rows
        .filter((r) => r.location.id !== posLocationId && compareUnitQuantities(String(r.stock),'0')>0)
        .map((r) => ({ label: `${r.location.warehouse.name} · ${r.location.code}`, stock: r.stock }))
      if (compareUnitQuantities(required,String(atPos))>0 && otras.length > 0) {
        // Un solo aviso a la vez. Con dos productos en vuelo, el segundo abría su
        // aviso justo después de que el cajero resolvía el primero, y parecía que
        // el mismo diálogo reaparecía. Ese clic se descarta: el cajero lo repite.
        if (decisionPendienteRef.current) return
        // El candado NO se suelta acá: sigue puesto hasta que el cajero decida.
        // Si se soltara al abrir, un segundo clic pendiente volvía a abrir el
        // aviso que el cajero ya había resuelto.
        decisionPendienteRef.current = true
        setElsewhere({ generation,product,selection, atPos, rows: otras })
        return
      }
    } catch(error) {
      if(additionIsCurrent(generation)&&(error as Error).name!=='AbortError')toast({title:'No se pudo comprobar el producto',description:(error as Error).message,variant:'destructive'})
      return
    }
    if(additionIsCurrent(generation))cart.addToCart(product,selection)
    }
    const previous=addingRef.current.get(queueKey)??Promise.resolve()
    const next=trackAddition(generation,async()=>{await previous;await run()})
    addingRef.current.set(queueKey,next)
    void next.then(()=>{if(addingRef.current.get(queueKey)===next)addingRef.current.delete(queueKey)},()=>{if(addingRef.current.get(queueKey)===next)addingRef.current.delete(queueKey)})
    return next
  }

  /**
   * Cierra el aviso y suelta los candados. Se limpian todos, no solo el del
   * producto mostrado: si dos productos quedaron en vuelo, el segundo aviso pisa
   * al primero y el candado del primero se quedaría puesto para siempre.
   */
  const cerrarElsewhere = () => {
    addingRef.current.clear()
    decisionPendienteRef.current = false
    setElsewhere(null)
  }

  const repriceCartRef = useRef(cart.repriceCartLines)
  repriceCartRef.current = cart.repriceCartLines
  const promotionCartItems = useMemo(
    () =>
      cart.cartItems.map((item) => ({
        product_id: item.id,
        price: item.unitSelection?.unitPrice??item.price,
        qty: item.qty,
        ...selectedUnitPayload(item.unitSelection),
        kind:item.kind,
      })),
    [cart.cartItems]
  )
  const canPickSavedCustomer = hasPermission('contacts.clients.view')
  const canCreateClientContact = hasPermission('contacts.clients.create')

  const promotions = usePromotions({
    contextKey:JSON.stringify([company?.id,branch?.id,salesChannel,pickedCustomerId]),
    cartItems: promotionCartItems,
    cartTotal: cart.cartTotal,
    locale,
    currencyCode,
  })

  const priceIdsKey=JSON.stringify([...new Set([...pageProducts.map(p=>p.id),...cart.cartItems.map(p=>p.id)])].sort())
  const pricingProducts=useMemo(()=>{const ids=new Set<string>(JSON.parse(priceIdsKey));return availableProducts.filter(product=>ids.has(product.id))},[availableProducts,priceIdsKey])
  const pricingContext=JSON.stringify([pricingProducts.map(product=>product.unitConfiguration?[product.id,exactProductValues(product),product.unitConfiguration]:[product.id,product.price,product.priceWholesale,product.pricePromotion,product.promotionValidUntil]),salesChannel,customerContactIdForPricing])
  const pricingReadyRef=useRef<string|null>(null)
  useEffect(() => {
    let cancelled = false
    const controller=new AbortController()
    if(loadedOrder)return
    const ids = pricingProducts.map((p) => p.id)
    pricingReadyRef.current=null
    setUnitPricesById({})
    if (ids.length === 0) {
      setUnitPricesById({})
      return
    }
    void (async () => {
      try {
        const r = await preparePosPrices(checkoutScope,ids,salesChannel,customerContactIdForPricing??null,controller.signal)
        if (!cancelled) {pricingReadyRef.current=ids.every(id=>Object.prototype.hasOwnProperty.call(r.unit_prices ?? {},id)) ? pricingContext : null;setUnitPriceTier(r.price_tier_used);setUnitPricesById(r.unit_prices ?? {})}
      } catch {
        if (!cancelled) setUnitPricesById({})
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [pricingProducts,salesChannel,customerContactIdForPricing,pricingContext,unitOwner,loadedOrder])

  useEffect(() => {
    repriceCartRef.current()
  }, [unitPricesById,unitPriceTier])

  const isProductSearchActive = productSearch.trim().length > 0
  const categorySummaries=productsQuery.categories.data?.items.map(category=>({...category,imageUrl:category.image_url}))??[]

  useEffect(() => {
    writeProductBrowseLayout(productLayout)
  }, [productLayout])

  useEffect(() => {
    setProductPage(1)
  }, [productSearch, productLayout, selectedCategoryName])

  const posAvailability=usePosAvailability(checkoutScope,posLocationId,[...pageProducts.map(p=>p.id),...cart.cartItems.map(item=>item.id)],hasPermission('sales.create')&&checkoutScope.branchId!=='all')
  const availabilityById=posAvailability.availability
  availabilityRef.current=availabilityById

  const displayLineTotals=loadedOrder ? Object.fromEntries(cart.cartItems.map(item=>{
    if(item.unitSelection?.sourceLineId)return[item.lineKey??item.id,cart.lineTotals[item.lineKey??item.id]]
    const original=loadedOrder.lines.find(line=>line.product_id===item.id)
    try {return [item.id,original ? previewPartialLineTotal(String(original.qty),String(original.line_total),item.qty,String(original.qty_fulfilled || 0)) : null]} catch {return [item.id,null]}
  })) : cart.lineTotals
  const displayTotal = loadedOrder ? Number(Object.values(displayLineTotals).reduce((sum,total)=>sum+(total ? BigInt(total.replace('.','')) : 0n),0n))/100 : !promotionsEnabled
    ? cart.cartTotal
    : (promotions.finalTotal ?? cart.cartTotal)
  const changeAmount =
    isCashMethod(currentPaymentMethod,name=>name.toLowerCase()==='efectivo') && amountReceived
      ? Math.max(0, parseFloat(amountReceived) - displayTotal)
      : 0

  const canCreate = hasPermission('sales.create')

  // A payment choice belongs to the cashier, never to the ordering of this list.
  useEffect(() => {
    if (paymentMethod && !visiblePaymentMethods.some(method => method.id === paymentMethod.id)) {
      setPaymentMethod(null)
      setAmountReceived('')
      setInitialCreditPayment('')
      setInitialCreditMethod('')
    }
  }, [paymentMethod, salesAllowCredit, visiblePaymentMethods])

  useEffect(() => {
    if (!salesShowChannels && salesChannel !== 'POS') setSalesChannel('POS')
  }, [salesShowChannels, salesChannel])


  /**
   * ¿Puede el cliente llevarse este total al crédito? Se consulta al servidor
   * porque el saldo depende de todas sus facturas abiertas, no solo de esta venta.
   */
  const creditCheck = useQuery({
    queryKey: ['credit-check', customerContactIdForPricing, displayTotal, initialCreditPayment],
    queryFn: () => checkCustomerCredit(customerContactIdForPricing!, Math.max(0, displayTotal - Number(initialCreditPayment || 0))),
    enabled: isCreditSale && Boolean(customerContactIdForPricing) && displayTotal > 0,
    staleTime: 15 * 1000,
  })

  // El plazo del cliente se aplicaba solo en el servidor: el cajero no veía qué
  // fecha iba a quedar, y un cliente sin plazo generaba una venta sin
  // vencimiento en silencio. Ahora la sugerencia se muestra y se puede editar.
  const sugerida = creditCheck.data?.due_date_sugerida
  useEffect(() => {
    if (!isCreditSale) return
    let suggestion = sugerida
    if (loadedOrder?.payment_condition === 'CREDIT' && loadedOrder.credit_days != null) {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
      const part = (type: string) => Number(parts.find(item => item.type === type)?.value)
      suggestion = new Date(Date.UTC(part('year'), part('month') - 1, part('day') + loadedOrder.credit_days)).toISOString().slice(0, 10)
    }
    if (suggestion) setCreditDueDate((actual) => actual || suggestion.slice(0, 10))
  }, [isCreditSale, sugerida, loadedOrder, timezone])

  // La ayuda del campo decía "Sugerido por su plazo" pasara lo que pasara, así
  // que prometía una fecha que muchas veces no llegaba: sin productos todavía
  // no se consulta, el término puede no tener días definidos (net_days es
  // opcional en el catálogo) y la consulta puede fallar. Cada caso se dice.
  const term = creditCheck.data?.payment_term
  const dueDateHint: { text: string; bad: boolean } = creditCheck.isError
    ? { text: 'No se pudo consultar el plazo del cliente: elegí la fecha a mano.', bad: true }
    : creditCheck.isFetching
      ? { text: 'Consultando el plazo del cliente…', bad: false }
      : !creditCheck.data
        ? { text: 'El vencimiento sugerido aparece al agregar productos.', bad: false }
        : !term
          ? {
              text: 'Este cliente no tiene término de pago: elegí la fecha a mano, o asignáselo en su ficha de contacto.',
              bad: true,
            }
          : term.net_days == null
            ? {
                text: `Su término «${term.name}» no tiene días definidos, así que no hay fecha que sugerir: elegila a mano, o ponéle los días en Catálogos → Términos de pago.`,
                bad: true,
              }
            : {
                text: `Sugerido por su plazo (${term.name}, ${term.net_days} días). Se puede cambiar.`,
                bad: false,
              }

  // Caja elegida en el selector previo; null = aún no se ha elegido (se muestra el picker)
  const [selectedRegisterId, setSelectedRegisterId] = useState<string | null>(null)
  const [cashCheckDone, setCashCheckDone] = useState(false)
  const [cashCheckError, setCashCheckError] = useState<string | null>(null)
  const [cashSessionOpen, setCashSessionOpen] = useState(false)
  const [cashRegisterMeta, setCashRegisterMeta] = useState<{ id: string; name: string } | null>(null)
  const [activeCashSession, setActiveCashSession] = useState<CashRegisterSessionDto | null>(null)
  // La caja resuelta ya tiene un turno abierto, pero de otra persona: no es "mi" turno
  // aunque el backend haya encontrado uno abierto — hay que bloquear, no dejar vender.
  const [openedByOther, setOpenedByOther] = useState<{ id: string; name: string | null } | null>(null)
  const [showCloseCashDialog, setShowCloseCashDialog] = useState(false)
  const [isClosingCashSession, setIsClosingCashSession] = useState(false)

  const isAdminUser = String(user?.role?.name ?? '').toLowerCase() === 'admin'

  /**
   * `/cash-sessions/current` devuelve el turno abierto en la caja resuelta sin
   * importar quién lo abrió (otras pantallas, como el cierre de caja, sí
   * necesitan verlo así). Acá hay que decidir "¿puedo vender con este turno?" —
   * un no-admin solo puede si es el suyo; si es de otra persona, se trata como
   * si no hubiera turno, pero guardando de quién es para bloquear con el
   * mensaje correcto en vez de mandarlo a "Abrir caja" (que fallaría igual,
   * la caja ya tiene turno).
   */
  const applyCashCheckResult = useCallback(
    (r: Extract<CashSessionCurrentResult, { ok: true }>) => {
      const session = r.session ?? null
      const belongsToOther = Boolean(
        session && !isAdminUser && String(session.opened_by_id) !== String(user?.id)
      )
      setCashRegisterMeta(
        r.register?.id ? { id: r.register.id, name: r.register.name } : null
      )
      setCashSessionOpen(Boolean(session) && !belongsToOther)
      setActiveCashSession(session)
      setOpenedByOther(
        belongsToOther && session
          ? { id: session.opened_by_id, name: session.openedBy?.name ?? null }
          : null
      )
    },
    [isAdminUser, user?.id]
  )

  const runCashCheck = useCallback(async (registerId: string) => {
    setCashCheckError(null)
    setCashCheckDone(false)
    const r = await fetchCashSessionCurrent(registerId)
    setCashCheckDone(true)
    if (r.ok === false) {
      setCashCheckError(r.message)
      setCashSessionOpen(false)
      setCashRegisterMeta(null)
      setActiveCashSession(null)
      setOpenedByOther(null)
      return
    }
    applyCashCheckResult(r)
  }, [applyCashCheckResult])

  useEffect(() => {
    if (selectedRegisterId) void runCashCheck(selectedRegisterId)
  }, [selectedRegisterId, runCashCheck])

  const handleCashSessionOpened = useCallback(async () => {
    const r = await fetchCashSessionCurrent(selectedRegisterId ?? undefined)
    setCashCheckDone(true)
    setCashCheckError(null)
    if (r.ok === false) {
      setCashCheckError(r.message)
      setCashSessionOpen(false)
      setCashRegisterMeta(null)
      setActiveCashSession(null)
      setOpenedByOther(null)
      return
    }
    applyCashCheckResult(r)
    if (!r.session) {
      toast({
        title: 'Sesión no detectada',
        description: 'Abra de nuevo o contacte a un supervisor.',
        variant: 'destructive',
      })
    }
  }, [applyCashCheckResult, toast])

  const canUserCloseCashTurn = useMemo(() => {
    if (!activeCashSession || !user) return false
    const roleName = String(user.role?.name ?? '').toLowerCase()
    if (roleName === 'admin') return true
    if (String(activeCashSession.opened_by_id) === String(user.id)) return true
    return hasPermission('cashclosure.create') || hasPermission('cashclosure.create_day')
  }, [activeCashSession, user, hasPermission])

  const confirmCloseCashSession = useCallback(async () => {
    setIsClosingCashSession(true)
    try {
      await closeCashSession(
        cashRegisterMeta?.id ? { cash_register_id: cashRegisterMeta.id } : {}
      )
      await queryClient.invalidateQueries({ queryKey: CASH_SESSION_CURRENT_QUERY_KEY })
      setShowCloseCashDialog(false)
      setCashSessionOpen(false)
      setActiveCashSession(null)
      toast({
        title: 'Turno cerrado',
        description:
          'Ya puede abrir otro turno si lo necesita. El arqueo y cierre contable siguen en «Cierre de caja».',
      })
    } catch (e) {
      toast({
        title: 'No se pudo cerrar el turno',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setIsClosingCashSession(false)
    }
  }, [cashRegisterMeta?.id, toast, queryClient])
  const [hasStoredDraft, setHasStoredDraft] = useState(false)
  useEffect(() => {
    setHasStoredDraft(userId ? hasNewSaleDraft(userId,checkoutScope) : false)
  }, [userId, checkoutScope, storedDraftRevision])

  const applyDraftToForm = useCallback(
    (draft: NewSaleDraft,resolvedProducts?:Product[]) => {
      restoredDraftId.current=draft.draftId??draft.savedAt
      setSaleStep('products');setQuantityDraft(null);setSelectedLineKey(null)
      promotions.clearPromotions()
      setCustomer(draft.customer ?? '')
      setCustomerNit(draft.customerNit ?? '')
      setPickedCustomerId(
        draft.pickedCustomerId && String(draft.pickedCustomerId).trim()
          ? String(draft.pickedCustomerId)
          : '__none__'
      )
      setIsFinalConsumer(Boolean(draft.isFinalConsumer))
      const ch = draft.salesChannel
      if (ch === 'WHOLESALE' || ch === 'ONLINE' || ch === 'POS') {
        setSalesChannel(ch)
      } else {
        setSalesChannel('POS')
      }
      setAmountReceived(draft.amountReceived ?? '')
      setCreditDueDate(draft.creditDueDate ?? '')
      setInitialCreditPayment(draft.initialCreditPayment ?? '')
      setInitialCreditMethod(draft.initialCreditMethod ?? '')
      if (draft.productPageSize && [9, 18, 36, 54].includes(draft.productPageSize)) {
        setProductPageSize(draft.productPageSize)
      }

      if (draft.paymentMethodId != null) {
        const pm = paymentMethods.find((p) => p.id === draft.paymentMethodId)
        setPaymentMethod(pm && (salesAllowCredit || !pm.is_credit) ? pm : null)
      } else {
        setPaymentMethod(null)
      }

      const lines = draft.lines ?? []
      if (lines.length > 0) {
        const { missingProductIds, qtyAdjustedIds,unitReviewIds } = cart.hydrateFromLines(
          lines,
          draft.adminAuthorizedProductIds ?? [],resolvedProducts??availableProducts
        )
        if(unitReviewIds.length)toast({title:'Revisa las unidades del borrador',description:'Confirma la presentación guardada antes de cobrar.',variant:'destructive'})
        const promos = (draft.promotionCodes ?? []).filter((c) => String(c).trim().length > 0)
        if (promos.length) setPromoCodesToRestore(promos)

        if (missingProductIds.length > 0) {
          toast({
            title: 'Venta recuperada',
            description: `${missingProductIds.length} producto(s) ya no están en el catálogo o sin stock.`,
          })
        } else {
          toast({
            title: 'Venta recuperada',
            description: 'Continúa con el registro o pagos.',
          })
        }
        if (qtyAdjustedIds.length > 0) {
          toast({
            title: 'Cantidades ajustadas',
            description: 'Algunas líneas se ajustaron al stock disponible (sin autorización admin).',
          })
        }
      } else {
        cart.clearCart()
        toast({
          title: 'Venta recuperada',
          description: 'Se restauraron datos del cliente y pago.',
        })
      }
    },
    [cart, paymentMethods, promotions, toast, salesAllowCredit]
  )

  const recoverDraftIfReady = useCallback(
    async(draft: NewSaleDraft): Promise<boolean> => {
      const lines = draft.lines ?? []
      if(isProcessing||unitPrepareOwner.current||!unitOwner.active||currentScope.current!==scopeKey)return false
      if (draft.paymentMethodId != null && paymentMethods.length === 0) {
        toast({
          title: 'Espera un momento',
          description: 'Aún se cargan los métodos de pago.',
          variant: 'destructive',
        })
        return false
      }
      const generation=cart.getGeneration()
      const current=()=>unitOwner.active&&currentScope.current===scopeKey&&cart.getGeneration()===generation
      let restored=false
      await hydrateCart(async()=>{
        try{
          const resolved=await productsQuery.ensureProducts([...new Set(lines.map(line=>line.productId))])
          if(!current())return
          applyDraftToForm(draft,resolved.items)
          restored=true
        }catch(error){if(current()&&(error as Error).name!=='AbortError')toast({title:'No se pudo recuperar la venta',description:(error as Error).message,variant:'destructive'})}
        return restored
      })
      return restored
    },
    [
      productsQuery.ensureProducts,
      paymentMethods.length,
      applyDraftToForm,
      toast,
      unitOwner,scopeKey,isProcessing,cart,
    ]
  )

  const handleRecoverSavedSale = useCallback(() => {
    if (!userId) {
      toast({ title: 'Inicia sesión', variant: 'destructive' })
      return
    }
    const draft = loadNewSaleDraft(userId,checkoutScope)
    if (!draft) {
      toast({
        title: 'No hay venta guardada',
        variant: 'destructive',
      })
      setStoredDraftRevision((r) => r + 1)
      return
    }
    void recoverDraftIfReady(draft)
  }, [userId, checkoutScope, recoverDraftIfReady, toast])

  const recuperarQueryHandledRef = useRef(false)
  const applyDraftRef = useRef(recoverDraftIfReady)
  applyDraftRef.current = recoverDraftIfReady
  useEffect(()=>{recuperarQueryHandledRef.current=false},[scopeKey])

  useEffect(() => {
    if (searchParams.get('recuperar') !== '1') {
      recuperarQueryHandledRef.current = false
      return
    }
    if (!userId) return
    if (recuperarQueryHandledRef.current) return

    const draft = loadNewSaleDraft(userId,checkoutScope)
    if (!draft) {
      toast({
        title: 'No hay venta guardada',
        description: 'Primero guarda una venta con «Continuar después».',
        variant: 'destructive',
      })
      setSearchParams({}, { replace: true })
      return
    }

    if (draft.paymentMethodId != null && paymentMethods.length === 0) return
    recuperarQueryHandledRef.current = true
    void applyDraftRef.current(draft).then(restored=>{
      if(!unitOwner.active||currentScope.current!==scopeKey)return
      if(restored)setSearchParams({}, { replace: true })
      else recuperarQueryHandledRef.current=false
    })
  }, [
    searchParams,
    userId,
    checkoutScope,
    paymentMethods.length,
    setSearchParams,
    toast,
    scopeKey,unitOwner,
  ])

  useEffect(() => {
    if (!promotionsEnabled) return
    if (!promoCodesToRestore?.length) return
    if (cart.cartItems.length === 0) {
      setPromoCodesToRestore(null)
      return
    }
    const codes = [...promoCodesToRestore]
    setPromoCodesToRestore(null)
    let cancelled = false
    void (async () => {
      for (const code of codes) {
        if (cancelled) break
        await promotions.applyCode(code)
      }
    })()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- applyCode al restaurar códigos del borrador
  }, [promoCodesToRestore, cart.cartItems.length, promotionsEnabled])

  const handleSaveForLater = () => {
    if(loadedOrder){toast({title:'Pedido conservado',description:'Este pedido ya está guardado. Puedes volver a cargarlo por su referencia para completar el cobro.'});return}
    if (!userId) {
      toast({
        title: 'No se puede guardar',
        description: 'Debes iniciar sesión.',
        variant: 'destructive',
      })
      return
    }
    const hasCart = cart.cartItems.length > 0
    const hasCustomer = !isFinalConsumer && customer.trim().length > 0
    if (!hasCart && !hasCustomer) {
      toast({
        title: 'Nada que guardar',
        description: 'Agrega productos o al menos el nombre del cliente.',
        variant: 'destructive',
      })
      return
    }
    saveNewSaleDraft(userId, {
      customer,
      customerNit,
      pickedCustomerId: pickedCustomerId === '__none__' ? undefined : pickedCustomerId,
      isFinalConsumer,
      salesChannel,
      paymentMethodId: paymentMethod?.id ?? null,
      amountReceived,
      creditDueDate,
      initialCreditPayment,
      initialCreditMethod,
      lines: cart.cartItems.map((item) => ({ productId: item.id, qty: item.qty,unitSelection:item.unitSelection,lineKey:item.lineKey })),
      adminAuthorizedProductIds: [...cart.adminAuthorizedProducts],
      promotionCodes: promotions.promotionCodes,
      productPageSize,
    },checkoutScope)
    restoredDraftId.current=undefined
    cart.clearCart()
    promotions.clearPromotions()
    setCustomer('Consumidor final')
    setCustomerNit('')
    setPickedCustomerId('__none__')
    setSalesChannel('POS')
    setIsFinalConsumer(true)
    setCreditDueDate('')
    setInitialCreditPayment('')
    setInitialCreditMethod('')
    setAmountReceived('')
    setProductSearch('')
    setProductPage(1)
    setPromoCodesToRestore(null)
    setStoredDraftRevision((r) => r + 1)
    toast({
      title: 'Venta guardada',
      description:
        'Puedes empezar otra venta aquí. Recupera la guardada con «Recuperar venta guardada» o desde el listado de Ventas.',
    })
  }

  const applyOrderToPos = useCallback(
    async(order: Order,generation=cart.getGeneration()) => {
      const current=()=>unitOwner.active&&currentScope.current===scopeKey&&cart.getGeneration()===generation
      if(!current())return false
      if (!['CONFIRMED', 'PARTIALLY_FULFILLED'].includes(order.status)) {
        toast({
          title: 'Pedido no disponible',
          description: 'Solo pedidos confirmados o parciales se cargan en POS.',
          variant: 'destructive',
        })
        return
      }
      if (order.fulfillment_mode === 'SEPARATE') {
        toast({ title: 'Pedido con entregas independientes', description: 'Registra las entregas y factura sus cantidades desde el detalle del pedido.' })
        return
      }
      const prices: Record<string, number> = {}
      const lines: { productId: string; qty: number|string }[] = []
      const map = new Map<string, string>()
      for (const line of order.lines) {
        const pending = isUnitDocumentLine(line)?remainingDocumentQuantity(line):String(pendingOrderLineQty(line))
        if (compareUnitQuantities(pending,'0')<=0) continue
        lines.push({ productId: line.product_id, qty: pending })
        prices[line.product_id] = Number(line.unit_price)
        map.set(line.product_id, line.id)
      }
      if (lines.length === 0) {
        toast({ title: 'Sin líneas pendientes', variant: 'destructive' })
        return
      }
      const resolved=await productsQuery.ensureProducts([...new Set(lines.map(line=>line.productId))])
      if(!current())return false
      if(order.lines.some(line=>resolved.missingIds.includes(line.product_id)&&line.item_kind!=='SERVICE'&&!isUnitDocumentLine(line)))throw Error('No se pudieron cargar todos los productos pendientes del pedido. Revisa su disponibilidad en esta sucursal.')
      orderLineIdByProductRef.current = map
      setUnitPricesById(prices)
      setLoadedOrder(order)
      setPaymentMethod(null)
      setAmountReceived('')
      setSaleStep('products')
      setQuantityDraft(null)
      setSelectedLineKey(null)
      setInitialCreditPayment('')
      setCreditDueDate('')
      setCustomer(order.customer || order.customerContact?.name || '')
      setCustomerNit(order.is_final_consumer ? '' : order.customer_nit || '')
      setIsFinalConsumer(order.is_final_consumer)
      if (order.customer_contact_id) setPickedCustomerId(order.customer_contact_id)
      setSalesChannel(order.sales_channel === 'POS' ? 'POS' : order.sales_channel === 'ONLINE' ? 'ONLINE' : 'WHOLESALE')
      promotions.clearPromotions()
      toast({ title: 'Pedido cargado', description: order.reference ?? order.id })
      return true
    },
    [promotions,toast,paymentMethods,productsQuery.ensureProducts,unitOwner,scopeKey,cart]
  )

  const handleLoadOrder = useCallback(async () => {
    const ref = loadOrderRef.trim()
    if (!ref) return
    if(isProcessing||hasPendingAdditions())return
    await hydrateCart(async generation=>{try {
      const order = await fetchOrderById(ref)
      if(!unitOwner.active||currentScope.current!==scopeKey||cart.getGeneration()!==generation)return false
      if(await applyOrderToPos(order,generation)){setLoadOrderOpen(false);setLoadOrderRef('');return true}
    } catch (e) {
      if(!unitOwner.active||currentScope.current!==scopeKey||cart.getGeneration()!==generation)return false
      toast({
        title: 'No se encontró el pedido',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    }return false})
  }, [loadOrderRef,applyOrderToPos,toast,isProcessing,cart,scopeKey,unitOwner])

  useEffect(() => {
    const pedidoRef = searchParams.get('pedido')?.trim()
    if (!canLoadOrders || !pedidoRef || pedidoLoadedRef.current === pedidoRef || !productsQuery.isSuccess) return
    pedidoLoadedRef.current = pedidoRef
    void hydrateCart(async generation=>{
      try{return Boolean(await applyOrderToPos(await fetchOrderById(pedidoRef),generation))}
      catch(error){if(unitOwner.active&&currentScope.current===scopeKey&&cart.getGeneration()===generation)toast({title:'Pedido',description:(error as Error).message,variant:'destructive'});return false}
    })
  }, [searchParams, productsQuery.isSuccess, applyOrderToPos, toast, canLoadOrders])

  const clearLoadedOrder = () => {
    setLoadedOrder(null)
    setPaymentMethod(null)
    setAmountReceived('')
    setInitialCreditPayment('')
    setInitialCreditMethod('')
    setCreditDueDate('')
    setCreditOverride(false)
    setSaleStep('products')
    setQuantityDraft(null)
    setSelectedLineKey(null)
    orderLineIdByProductRef.current = new Map()
    cart.clearCart()
    pedidoLoadedRef.current = null
    setSearchParams((prev) => {
      prev.delete('pedido')
      return prev
    })
  }

  useEffect(() => {
    if (canLoadOrders || !loadedOrder) return
    clearLoadedOrder()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- descarta un pedido si desaparece su capacidad
  }, [canLoadOrders, loadedOrder])

  const printDestination=usePrintDestination(checkoutScope,'RECEIPT',selectedRegisterId||undefined)
  const [lastCheckout,setLastCheckout]=useState<{saleId:string;scopeKey:string;ticketFailed:boolean;ticketPending:boolean}|null>(null)
  const ticketFor=async(saleId:string)=>{
    const owner=checkout.isCurrent
    setLastCheckout({saleId,scopeKey,ticketFailed:false,ticketPending:true})
    try{await downloadSavedSaleTicket(saleId,{companyName,logoUrl:companyLogoUrl||undefined,locale,currencyCode},owner,{headers:{'X-Company-Id':checkoutScope.companyId,'X-Branch-Id':checkoutScope.branchId}},{scope:checkoutScope,options:printDestination.options,notice:message=>{if(owner())toast({title:'Ticket de venta',description:message,duration:5000})}})}
    catch(error){if(owner()&&(error as Error).name!=='AbortError'){setLastCheckout(current=>current?.saleId===saleId?{...current,ticketFailed:true}:current);toast({title:'Venta registrada; ticket pendiente',description:'Descarga el ticket nuevamente o abre el detalle de la venta.'})}}
    finally{if(owner())setLastCheckout(current=>current?.saleId===saleId?{...current,ticketPending:false}:current)}
  }
  const [unitPreparing,setUnitPreparing]=useState(false)
  const unitPrepareOwner=useRef<object|null>(null)
  const checkout=useCheckoutFlow(checkoutScope,canCreate,(attempt,ownsCart)=>{
    if(attempt.draftId&&consumeNewSaleDraft(userId,checkoutScope,attempt.draftId))setStoredDraftRevision(r=>r+1)
    if(ownsCart){
      restoredDraftId.current=undefined
      cart.clearCart();promotions.clearPromotions()
      setPaymentMethod(null);setSaleStep('products');setMobileView('catalog');setQuantityDraft(null);setSelectedLineKey(null);setActionPanel(null)
      if(loadedOrder)clearLoadedOrder()
      setCustomer('Consumidor final');setCustomerNit('');setPickedCustomerId('__none__');setSalesChannel('POS');setIsFinalConsumer(true);setAmountReceived('');setProductSearch('');setInitialCreditPayment('');setInitialCreditMethod('');setCreditDueDate('')
    }
    toast({title:isCreditSale?'Venta a crédito registrada':'Venta registrada correctamente',duration:4000})
    void Promise.resolve().then(()=>Promise.all([queryClient.invalidateQueries({queryKey:SALES_QUERY_KEY,refetchType:'none'}),queryClient.invalidateQueries({queryKey:PRODUCTS_QUERY_KEY}),queryClient.invalidateQueries({queryKey:['receivables']}),queryClient.invalidateQueries({queryKey:['credit-check']})])).catch(()=>{ /* The saved sale does not depend on refreshing the catalog. */ })
    void ticketFor(attempt.saleId!)
  },JSON.stringify(user?.permissions??[]),restoredDraftId.current)
  useEffect(()=>setIsProcessing(unitPreparing||checkout.pending||!!checkout.attempt||checkout.blocked),[unitPreparing,checkout.pending,checkout.attempt,checkout.blocked])
  const reviewContextValue=JSON.stringify([scopeKey,cart.cartItems.map(item=>[item.id,item.qty,item.unitSelection]),unitPriceTier,customer,customerNit,isFinalConsumer,pickedCustomerId,salesChannel,paymentMethod?.id,amountReceived,initialCreditPayment,initialCreditMethod,creditDueDate,creditOverride,promotions.promotionCodes])
  const reviewContext=useRef('');reviewContext.current=reviewContextValue
  const visibleCheckout=lastCheckout?.scopeKey===scopeKey?lastCheckout:null
  const checkoutNotice=<CheckoutRecoveryNotice attempt={checkout.attempt} pending={checkout.pending} hasProcessingButton={saleStep==='payment'&&Boolean(selectedRegisterId)&&cashSessionOpen&&cashCheckDone&&!cashCheckError&&!isHydrating} error={checkout.error} lastSaleId={visibleCheckout?.saleId??checkout.attempt?.saleId} ticketFailed={visibleCheckout?.ticketFailed} ticketPending={visibleCheckout?.ticketPending} onCheck={()=>void checkout.reconcile()} canRetry={checkout.canRetry} onRetry={()=>void checkout.retry()} productNames={Object.fromEntries(availableProducts.map(product=>[product.id,product.name]))} onTicket={()=>void ticketFor(visibleCheckout?.saleId??checkout.attempt!.saleId!)} onDetail={()=>navigate(`/ventas/${visibleCheckout?.saleId??checkout.attempt?.saleId}/factura`)}/>


  const changedUnitLine = unitChange?.scope === scopeKey && unitChange.from === selectedLineKey
    ? cart.cartItems.find(item => (item.lineKey ?? item.id) === unitChange.to) : null
  const selectedLine = cart.cartItems.find(item => (item.lineKey ?? item.id) === selectedLineKey) ?? changedUnitLine ?? cart.cartItems[cart.cartItems.length - 1] ?? null
  useEffect(() => {
    if (!unitChange) return
    // The cart may reject the request; follow its resulting line, not the requested key.
    if (unitChange.scope === scopeKey && selectedLineKey === unitChange.from &&
      !cart.cartItems.some(item => (item.lineKey ?? item.id) === unitChange.from) && changedUnitLine) {
      setSelectedLineKey(unitChange.to)
      setQuantityDraft(null)
    }
    setUnitChange(null)
  }, [unitChange, scopeKey, selectedLineKey, cart.cartItems, changedUnitLine])
  const selectedKey = selectedLine ? selectedLine.lineKey ?? selectedLine.id : null
  const quantityOwner = JSON.stringify([scopeKey, selectedKey, selectedLine?.qty, selectedLine?.unitSelection])
  const quantityText = quantityDraft?.owner === quantityOwner ? quantityDraft.value : selectedLine?.qty ?? ''
  const quantityPending = Boolean(selectedLine && quantityDraft?.owner === quantityOwner && quantityText !== selectedLine.qty)
  const quantityDecimals = selectedLine?.unitSelection
    ? selectedLine.unitSelection.snapshot.presentation?.decimals ?? selectedLine.unitSelection.snapshot.baseUnit.decimals
    : selectedLine?.kind === 'SERVICE' ? selectedLine.quantityDecimals ?? 0 : 0
  let normalizedQuantity: string | null = null
  try {
    if (selectedLine) normalizedQuantity = selectedLine.unitSelection
      ? selectedQuantity(quantityText, selectedLine.unitSelection)
      : normalizeQuantityInput(quantityText, {kind: selectedLine.kind ?? 'STANDARD', quantityDecimals}, locale)
    if (normalizedQuantity && compareUnitQuantities(normalizedQuantity, '0') <= 0) normalizedQuantity = null
  } catch { /* Keep the draft visible until the cashier fixes it. */ }
  const checkoutLocked = isProcessing || isHydrating || unitPreparing || checkout.pending || Boolean(checkout.attempt) || checkout.blocked
  const presentationChoice=pendingPresentation?.scope===scopeKey&&pendingPresentation.generation===cartGeneration()&&saleStep==='products'&&!checkoutLocked&&!loadedOrder&&checkout.isCurrent()?pendingPresentation:null
  cartAcceptsAdditions.current=saleStep==='products'&&!checkoutLocked
  const availabilityPending = Boolean(cart.availabilityDialog?.open || cart.adminAuthDialog?.open || elsewhere)
  const paymentReviewBlocked = !cart.cartItems.length || cart.hasInvalidQuantities || hasPendingAdditions() || quantityPending || availabilityPending || Boolean(presentationChoice) ||
    promotions.isValidating || (pricingReadyRef.current !== pricingContext && !loadedOrder) || checkoutLocked
  const goToPayment = () => {
    if (paymentReviewBlocked || hasPendingAdditions() || !canCreate || !cashSessionOpen || !unitOwner.active || currentScope.current !== scopeKey) return
    cartAcceptsAdditions.current=false
    stepFocusRequest.current = {step: 'payment', scope: scopeKey}
    setSaleStep('payment')
    setActionPanel(null)
  }
  const choosePaymentMethod = (method: PaymentMethodType) => {
    if (checkoutLocked || !visiblePaymentMethods.some(row => row.id === method.id)) return
    if (currentPaymentMethod?.id !== method.id) {
      setAmountReceived('');setInitialCreditPayment('');setInitialCreditMethod('');setCreditOverride(false)
    }
    setPaymentMethod(method)
  }
  const applyQuantity = () => {
    if (checkoutLocked || !selectedKey || !normalizedQuantity || !unitOwner.active || currentScope.current !== scopeKey) return
    cart.updateQuantity(selectedKey, normalizedQuantity)
    if (normalizedQuantity === selectedLine?.qty) setQuantityDraft(null)
  }
  const selectLine = (key: string) => {
    if (checkoutLocked) return
    setSelectedLineKey(key);setQuantityDraft(null);setUnitChange(null)
  }
  const addFromTile = (product: Product,presentationId?:string|null) => {
    if (checkoutLocked||!canCreate||!unitOwner.active||currentScope.current!==scopeKey) return
    if(!loadedOrder&&presentationId===undefined&&product.unitConfiguration?.presentations.some(p=>p.active&&p.sale_enabled)){
      setPendingPresentation({product,scope:scopeKey,generation:cartGeneration()});return
    }
    try {
      const key = unitCartKey(product.id, selectProductUnit(product, presentationId, unitPriceTier))
      setSelectedLineKey(key);setQuantityDraft(null)
    } catch { setSelectedLineKey(null) }
    void addProduct(product,presentationId===undefined?undefined:{presentationId,priceContext:unitPriceTier})
  }
  const cashValue = Number(amountReceived)
  const cashAmountValid = /^\d+(?:\.\d{1,2})?$/.test(amountReceived) && Number.isFinite(cashValue) && cashValue >= displayTotal

  const handleSubmit = async () => {
    if(checkoutLocked || hasPendingAdditions() || quantityPending || availabilityPending || presentationChoice)return
    if(unitPrepareOwner.current||isProcessing||checkout.attempt)return
    if(reviewContext.current!==reviewContextValue)return
    if (cart.hasInvalidQuantities) {toast({title:'Revisa las cantidades',description:'Cada partida debe tener una cantidad válida para su unidad de cobro.',variant:'destructive'});return}
    if (pricingReadyRef.current!==pricingContext && !loadedOrder) {toast({title:'Precios pendientes',description:'Espera a que se actualicen los precios antes de cobrar.',variant:'destructive'});return}
    if (!canCreate) {
      toast({ title: 'Sin permiso para crear ventas', variant: 'destructive' })
      return
    }
    if (!cashSessionOpen) {
      toast({
        title: 'Caja cerrada',
        description: 'Abra la caja antes de registrar la venta.',
        variant: 'destructive',
      })
      return
    }
    if (!currentPaymentMethod) {
      toast({ title: 'Selecciona un método de pago', variant: 'destructive' })
      return
    }
    if (cart.cartItems.length === 0) {
      toast({ title: 'Agrega al menos un producto', variant: 'destructive' })
      return
    }
    if (isCreditSale) {
      const initial = Number(initialCreditPayment || 0)
      if (!Number.isFinite(initial) || initial < 0 || initial >= displayTotal || (initial > 0 && !initialCreditMethod)) {
        toast({ title: 'Revisa el abono inicial', description: 'Debe ser menor al total y tener un medio de cobro. Para cobrar todo, selecciona contado.', variant: 'destructive' })
        return
      }
      if (!customerContactIdForPricing) {
        toast({
          title: 'Falta el cliente',
          description: 'Una venta al crédito debe ir a nombre de un cliente del maestro.',
          variant: 'destructive',
        })
        return
      }
      if (!creditDueDate) {
        toast({
          title: 'Falta el vencimiento',
          description:
            'Una venta al crédito sin fecha de vencimiento nunca aparece como vencida. ' +
            'Indicá la fecha o configurá un término de pago para este cliente.',
          variant: 'destructive',
        })
        return
      }
      // El servidor vuelve a validar; esto solo evita el viaje perdido.
      if (creditCheck.data && !creditCheck.data.ok && !(canOverrideCredit && creditOverride)) {
        toast({
          title: 'Crédito no disponible',
          description: creditCheck.data.motivo ?? 'El cliente no puede llevar esta venta al crédito.',
          variant: 'destructive',
        })
        return
      }
    }
    const isCash = isCashMethod(currentPaymentMethod,name=>name.toLowerCase()==='efectivo')
    if (isCash) {
      const received = parseFloat(amountReceived || '0')
      if (!cashAmountValid) {
        toast({
          title: 'Monto insuficiente',
          description: `El monto en efectivo (${fmt(received)}) no puede ser menor al total a pagar (${fmt(displayTotal)}).`,
          variant: 'destructive',
        })
        return
      }
    }
    const payload = {
      customer,
      customer_nit: customerNit,
      is_final_consumer: isFinalConsumer,
      payment_method_id: currentPaymentMethod.id,
      status_id: 0,
      customer_contact_id: pickedCustomerId !== '__none__' ? pickedCustomerId : undefined,
      sales_channel: salesChannel,
      cash_register_id: cashRegisterMeta?.id ?? selectedRegisterId ?? undefined,
      items: cart.cartItems.map((item: CartProduct) => ({
        product_id: item.id,
        price: item.unitSelection?.unitPrice??item.price,
        qty: item.qty,
        ...selectedUnitPayload(item.unitSelection),
      })),
      amount_received: isCash && amountReceived ? Number(amountReceived) : undefined,
      change: isCash ? changeAmount : undefined,
      admin_authorized_products: Array.from(cart.adminAuthorizedProducts),
      promotion_codes: promotionsEnabled ? promotions.promotionCodes : [],
      ...(isCreditSale
        ? {
            due_date: creditDueDate || undefined,
            initial_payment: Number(initialCreditPayment) > 0 ? { amount: Number(initialCreditPayment), payment_method_id: Number(initialCreditMethod) } : undefined,
            credit_override: canOverrideCredit && creditOverride ? true : undefined,
          }
        : {}),
    }
    if(loadedOrder){
      const lines=cart.cartItems.map(item=>({line_id:item.unitSelection?.sourceLineId??orderLineIdByProductRef.current.get(item.id)??'',qty:item.qty,...(item.unitSelection?.sourceBasis==='BASE'?{presentation_id:null}:{})})).filter(x=>x.line_id&&compareUnitQuantities(x.qty,'0')>0)
      await checkout.submit('ORDER',{
        due_date:isCreditSale?creditDueDate:undefined,
        initial_payment:isCreditSale&&Number(initialCreditPayment)>0?{amount:Number(initialCreditPayment),payment_method_id:Number(initialCreditMethod)}:undefined,
        payment_method_id:currentPaymentMethod.id,amount_received:payload.amount_received,change:payload.change,lines,cash_register_id:payload.cash_register_id,
      },loadedOrder.id)
    }else {
      const prepare={};unitPrepareOwner.current=prepare;setUnitPreparing(true);const reviewed=reviewContext.current
      try{
        const selected=cart.cartItems.filter(item=>item.unitSelection)
        if(selected.length>200)throw Error('Esta revisión admite hasta 200 líneas con presentaciones. Reduce las líneas antes de cobrar.')
        const result=selected.length?await previewUnitLines(checkoutScope,selected.map(item=>({client_line_key:item.lineKey??item.id,product_id:item.id,qty:selectedQuantity(item.qty,item.unitSelection!),...selectedUnitPayload(item.unitSelection),unit_revision:item.unitSelection!.revision,price_tier:unitPriceTier as 'LIST'|'WHOLESALE'|'PROMOTION'})),unitOwner.controller.signal):{items:[]}
        const expected=new Set(selected.map(item=>item.lineKey??item.id)),seen=new Set<string>()
        if(!Array.isArray(result?.items)||result.items.length!==selected.length)throw Error('La revisión de productos llegó incompleta. Vuelve a intentarlo antes de cobrar.')
        for(const row of result.items){
          if(!row||!expected.has(row.client_line_key)||seen.has(row.client_line_key)||!row.preview)throw Error('La revisión de productos llegó incompleta. Vuelve a intentarlo antes de cobrar.')
          seen.add(row.client_line_key)
        }
        if(reviewed!==reviewContext.current)throw Error('La venta cambió durante la revisión. Revisa el importe y vuelve a cobrar.')
        if(currentScope.current!==unitOwner.key||!unitOwner.active)return
        let changed=false
        for(const {client_line_key,preview}of result.items)if(cart.reconcileUnitPreparation(client_line_key,preview))changed=true
        if(changed)throw Error('Se actualizaron cantidades o precios autorizados. Revisa el carrito y vuelve a cobrar.')
        if(currentScope.current===unitOwner.key&&unitOwner.active)await checkout.submit('SALE',payload)
      }catch(error){if(currentScope.current===unitOwner.key&&unitOwner.active)toast({title:'Revisa la unidad seleccionada',description:(error as Error).message,variant:'destructive'})}
      finally{if(unitPrepareOwner.current===prepare){unitPrepareOwner.current=null;if(currentScope.current===unitOwner.key&&unitOwner.active)setUnitPreparing(false)}}
    }
  }

  if(checkout.attempt&&(!selectedRegisterId||!cashSessionOpen))return <div className="p-4 sm:p-8">{checkoutNotice}</div>

  if (!selectedRegisterId) {
    return (
      <>{checkoutNotice}<CashRegisterPicker
        onSelect={(id) => setSelectedRegisterId(id)}
        onBack={() => navigate('/ventas')}
      /></>
    )
  }

  if (!cashCheckDone) {
    return (
      <div className="px-4 sm:px-8 lg:px-14 py-16 w-full flex flex-col items-center justify-center gap-4 min-h-[50vh]">
        <LoadingState variant="detail" message="Comprobando turno de caja…" />
        <Button variant="outline" size="sm" onClick={() => setSelectedRegisterId(null)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Cambiar de caja
        </Button>
      </div>
    )
  }

  if (cashCheckError) {
    return (
      <div className="px-4 sm:px-8 lg:px-14 py-8 w-full max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedRegisterId(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Punto de venta</h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>No se pudo verificar la caja</AlertTitle>
          <AlertDescription className="mt-2">{cashCheckError}</AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void runCashCheck(selectedRegisterId)}>
            Reintentar
          </Button>
          <Button type="button" variant="outline" onClick={() => setSelectedRegisterId(null)}>
            Cambiar de caja
          </Button>
        </div>
      </div>
    )
  }

  if (openedByOther) {
    return (
      <div className="px-4 sm:px-8 lg:px-14 py-8 w-full max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedRegisterId(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Punto de venta</h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Caja en uso</AlertTitle>
          <AlertDescription className="mt-2">
            {cashRegisterMeta?.name ? `La caja "${cashRegisterMeta.name}"` : 'Esta caja'} ya tiene un
            turno abierto por {openedByOther.name ?? 'otro usuario'}. Debe cerrar ese turno o utilizar
            una caja asignada.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void runCashCheck(selectedRegisterId as string)}>
            Reintentar
          </Button>
          <Button type="button" variant="outline" onClick={() => setSelectedRegisterId(null)}>
            Cambiar de caja
          </Button>
        </div>
      </div>
    )
  }

  if (!cashSessionOpen) {
    return (
        <OpenCashRegisterPrompt
          registerName={cashRegisterMeta?.name}
          registerId={cashRegisterMeta?.id}
          onOpened={handleCashSessionOpened}
          onBack={() => setSelectedRegisterId(null)}
        />
    )
  }

  return (
    <div className="pos-page auna-page-fluid pos-live" data-step={saleStep}>
      {draftGuard.dialog}
      <div className="pos-toolbar">
        <Button type="button" variant="ghost" size="sm" aria-label="Volver a ventas" onClick={() => navigate('/ventas')}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Ventas</Button>
        <h1 className="sr-only">Punto de venta</h1>
        <span className="text-xs text-muted-foreground">{loadedOrder ? `Pedido ${loadedOrder.reference ?? loadedOrder.id.slice(0,8)}` : 'Punto de venta'}</span>
        <span className="pos-toolbar-context">{cashRegisterMeta?.name ?? 'Caja'}{activeCashSession ? ' · Turno abierto' : ''}</span>
      </div>
      {checkoutNotice}
      {loadedOrder && <div className="pos-order-notice"><span><Package className="h-4 w-4" aria-hidden="true" /> Pedido {loadedOrder.reference ?? loadedOrder.id.slice(0,8)} · Precios acordados{loadedOrder.payment_condition === 'CREDIT' ? ' · Condición acordada: crédito' : ''}</span><Button type="button" size="sm" variant="ghost" onClick={() => {clearLoadedOrder();setSaleStep('products');setQuantityDraft(null)}} disabled={checkoutLocked}>Quitar pedido</Button></div>}
      {hasStoredDraft && <div className="pos-order-notice"><span><RotateCcw className="h-4 w-4" aria-hidden="true" /> Tenés una venta guardada para continuar.</span><Button type="button" size="sm" variant="outline" onClick={handleRecoverSavedSale} disabled={checkoutLocked}>Recuperar venta guardada</Button></div>}
      {saleStep === 'products' && <nav className="pos-mobile-switch" aria-label="Secciones de la venta">
        <Button type="button" variant={mobileView === 'catalog' ? 'default' : 'outline'} aria-pressed={mobileView === 'catalog'} onClick={() => setMobileView('catalog')}>Productos</Button>
        <Button type="button" variant={mobileView === 'sale' ? 'default' : 'outline'} aria-pressed={mobileView === 'sale'} onClick={() => setMobileView('sale')}>Venta ({cart.cartItems.length})</Button>
      </nav>}
      {isHydrating&&<LoadingIndicator message="Recuperando productos de la venta…" />}
      <fieldset className="pos-workspace min-w-0" data-step={saleStep} disabled={checkoutLocked}>
        <div className="pos-sale-column" data-mobile-active={mobileView === 'sale' || saleStep === 'payment'}>
          <header className="pos-sale-heading"><div><h2>Venta actual</h2><span>{cart.cartItems.length} {cart.cartItems.length === 1 ? 'producto' : 'productos'}</span></div>
            <Button type="button" variant="ghost" className="pos-turn-button" onClick={() => setActionPanel('turn')}><span className="pos-turn-dot" />{cashRegisterMeta?.name ?? 'Caja'} · {activeCashSession ? 'Turno abierto' : 'Ver caja'}<span className="ml-auto">Ver turno ↗</span></Button>
          </header>
          <Button type="button" variant="ghost" className="pos-customer-button" onClick={() => setActionPanel('customer')}><UserRound className="h-4 w-4" aria-hidden="true" /><span><strong>{isFinalConsumer ? 'Consumidor final' : customer || 'Seleccionar cliente'}</strong><small>{customerNit ? `ID fiscal: ${customerNit}` : 'Cliente y datos fiscales'}</small></span><ChevronDown className="ml-auto h-4 w-4" aria-hidden="true" /></Button>
          <section className="pos-cart" aria-label="Productos en la venta">
            {!cart.cartItems.length ? <CollectionEmptyState compact title="¿Qué llevamos hoy?" description="Tocá un producto o escaneá su código para comenzar la venta." /> :
              <ul className="pos-cart-lines">{cart.cartItems.map(item => {const key=item.lineKey??item.id;const label=item.unitSelection?.snapshot.presentation?.label??item.unitSelection?.snapshot.baseUnit.label??item.serviceUnitLabel??'unidad';return <li key={key} className={`pos-cart-line ${selectedKey===key?'is-selected':''}`}>
                <button type="button" className="pos-line-select" aria-label={`Seleccionar ${item.name}, ${label}`} aria-pressed={selectedKey===key} onClick={() => selectLine(key)}>
                  <span><strong>{item.qty} × {item.name}</strong><small>{item.unitSelection?.snapshot.presentation?.name??label} · {item.unitSelection ? `${currencyCode} ${formatUnitDecimal(item.unitSelection.unitPrice,locale)}` : fmt(item.price)} / {label}</small>{item.unitSelection?.snapshot.presentation&&<small>{presentationEquivalence(item.qty,item.unitSelection,locale)}</small>}</span>
                  <b>{displayLineTotals[key] != null ? fmt(Number(displayLineTotals[key])) : '—'}</b>
                </button>
                {saleStep === 'products' && <Button type="button" variant="ghost" size="icon" className="pos-remove-line" data-line-key={key} aria-label={`Quitar ${item.name}`} disabled={checkoutLocked} onClick={() => {if(checkoutLocked)return;cart.removeFromCart(key);if(key===selectedKey){setQuantityDraft(null);setUnitChange(null)}}}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>}
              </li>})}</ul>}
          </section>
          {saleStep === 'products' && <div className="pos-touch-board">
            <div className="pos-quantity-heading"><div><strong>{selectedLine?.name ?? 'Seleccioná un producto'}</strong><span className="pos-selected-presentation">{selectedLine?.unitSelection?.snapshot.presentation?.name ?? selectedLine?.unitSelection?.snapshot.baseUnit.name ?? selectedLine?.serviceUnitLabel ?? 'Unidad'}</span></div>
              <div className="pos-quantity-value"><Label htmlFor="pos-quantity">Cantidad</Label><Input id="pos-quantity" type="text" inputMode={quantityDecimals ? 'decimal' : 'numeric'} aria-label={`Cantidad de ${selectedLine?.name ?? 'producto seleccionado'}`} value={quantityText} disabled={!selectedLine || checkoutLocked} aria-invalid={Boolean(quantityText && !normalizedQuantity)} onChange={event => setQuantityDraft({owner:quantityOwner,value:event.target.value,replace:false})}/></div>
            </div>
            {selectedLine?.unitSelection&&<Button type="button" variant="outline" className="pos-presentation-button" aria-label={`Cambiar presentación de ${selectedLine.name}`} disabled={checkoutLocked||Boolean(loadedOrder)||quantityPending||Boolean(selectedLine.unitSelection.sourceLineId)} onClick={()=>setActionPanel('unit')}><Package className="h-4 w-4" aria-hidden="true"/>Cambiar presentación<ChevronDown className="ml-auto h-4 w-4" aria-hidden="true"/></Button>}
            <div className="pos-touch-controls"><PosNumericKeypad disabled={!selectedLine || checkoutLocked} decimalEnabled={quantityDecimals>0} onKey={key => {
              if(checkoutLocked||!selectedLine)return
              const replace=quantityDraft?.owner!==quantityOwner||quantityDraft.replace
              setQuantityDraft({owner:quantityOwner,value:applyPosKey(quantityText,key,quantityDecimals,replace),replace:false})
            }}/>
              <div className="pos-quick-actions">
                <Button type="button" variant="outline" aria-label="Aplicar cantidad" disabled={!selectedLine || !normalizedQuantity || checkoutLocked} onClick={applyQuantity}>Aplicar cantidad</Button>
                {promotionsEnabled && !loadedOrder && <Button type="button" variant="outline" onClick={() => setActionPanel('promotions')}><Receipt className="h-4 w-4" aria-hidden="true" />Promoción</Button>}
                {canLoadOrders && !loadedOrder && <Button type="button" variant="outline" onClick={() => setLoadOrderOpen(true)}><Package className="h-4 w-4" aria-hidden="true" />Pedido</Button>}
                <Button type="button" variant="outline" onClick={() => setActionPanel('options')}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Más acciones</Button>
              </div>
            </div>
            <div className="pos-quantity-feedback" role="status">{quantityPending ? <><span>{normalizedQuantity ? 'Aplicá la cantidad antes de continuar al pago.' : 'Revisá la cantidad y los decimales permitidos.'}</span><Button type="button" variant="ghost" onClick={() => setQuantityDraft(null)}>Descartar edición</Button></> : <span>Tocá una línea para cambiar su cantidad o presentación.</span>}</div>
          </div>}
          <section className="pos-checkout" aria-label="Total y registro de la venta">
            {promotionsEnabled && Boolean(promotions.appliedPromotions?.length) && <div className="pos-total-detail"><span>Promociones aplicadas</span><span>−{fmt(promotions.totalDiscount ?? 0)}</span></div>}
            <div className="pos-total"><span>Total</span><strong>{fmt(displayTotal)}</strong></div>
            <p className="pos-tax-note">{vatRegime === 'general' && displayTotal>0 ? `IVA incluido (${ivaRate}%): ${fmt(displayTotal-displayTotal/(1+ivaRate/100))}` : 'Según la configuración fiscal de tu empresa'}</p>
            {saleStep === 'products' ? <Button ref={paymentReviewButtonRef} type="button" className="pos-pay-button" aria-label="Ir al pago" disabled={Boolean(paymentReviewBlocked) || !canCreate || !cashSessionOpen} onClick={goToPayment}><span>Ir al pago</span><span>{fmt(displayTotal)}</span><ChevronDown className="h-5 w-5 -rotate-90" aria-hidden="true" /></Button> :
              <Button type="button" className="pos-pay-button" onClick={handleSubmit} aria-busy={unitPreparing || checkout.pending} disabled={Boolean(paymentReviewBlocked) || !currentPaymentMethod || !canCreate ||
                (isCashMethod(currentPaymentMethod,name=>name.toLowerCase()==='efectivo') && !cashAmountValid) ||
                (isCreditSale && (!customerContactIdForPricing || !creditDueDate || Number(initialCreditPayment)<0 || !Number.isFinite(Number(initialCreditPayment)) || Number(initialCreditPayment)>=displayTotal || (Number(initialCreditPayment)>0&&!initialCreditMethod) ||
                (creditCheck.data != null && !creditCheck.data.ok && !(canOverrideCredit&&creditOverride))))}>
                <span role="status" aria-live="polite">{isProcessing || unitPreparing || checkout.pending ? 'Procesando…' : isCreditSale ? 'Registrar venta a crédito' : 'Confirmar pago'}</span><span>{fmt(displayTotal)}</span>
              </Button>}
            {saleStep === 'products' && <Button type="button" variant="ghost" className="pos-save-button" onClick={() => {handleSaveForLater();setPaymentMethod(null);setAmountReceived('');setQuantityDraft(null)}} disabled={checkoutLocked || (!cart.cartItems.length && (isFinalConsumer || !customer.trim()))}><PauseCircle className="h-4 w-4" aria-hidden="true" />Guardar y continuar después</Button>}
          </section>
        </div>
        <section className="pos-payment-panel" aria-labelledby="pos-payment-title" hidden={saleStep !== 'payment'}>
          <Button type="button" variant="ghost" className="pos-payment-back" onClick={() => {if(checkoutLocked)return;stepFocusRequest.current={step:'products',scope:scopeKey};setSaleStep('products');setMobileView('sale')}}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Volver a los productos</Button>
          <h2 id="pos-payment-title" ref={paymentTitleRef} tabIndex={-1} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Vamos a cobrar</h2><p className="pos-payment-intro">Elegí cómo paga el cliente. Tu venta sigue a la derecha.</p>
          <div className="pos-payment-layout">
            <div className="pos-payment-methods"><Label>Método de pago</Label>
              {!visiblePaymentMethods.length ? <p role="status" className="text-sm text-destructive">No hay métodos de pago disponibles para esta empresa.</p> : visiblePaymentMethods.map(method => <Button key={method.id} type="button" variant="outline" className="pos-method-button" aria-pressed={currentPaymentMethod?.id===method.id} onClick={() => choosePaymentMethod(method)}>
                {method.is_credit ? <UserRound className="h-5 w-5" aria-hidden="true" /> : isCashMethod(method,name=>name.toLowerCase()==='efectivo') ? <Landmark className="h-5 w-5" aria-hidden="true" /> : <CreditCard className="h-5 w-5" aria-hidden="true" />}
                <span>{method.name}</span><span className="pos-method-radio" aria-hidden="true" />
              </Button>)}
            </div>
            <div className="pos-payment-entry"><div className="pos-amount-due"><span>Total de la venta</span><strong>{fmt(displayTotal)}</strong></div>
              {!currentPaymentMethod && <p className="pos-payment-placeholder" role="status">Seleccioná un método de pago para continuar.</p>}
                                {isCreditSale && (
                    <div className="space-y-2 border-t pt-3">
                  {!customerContactIdForPricing ? (
                    <p className="text-xs text-destructive">
                      Una venta al crédito necesita un cliente del maestro: seleccionalo arriba.
                    </p>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="due-date">Vence el</Label>
                        <Input
                          id="due-date"
                          type="date"
                          value={creditDueDate}
                          onChange={(e) => setCreditDueDate(e.target.value)}
                        />
                        <p
                          className={`mt-1 text-xs ${
                            dueDateHint.bad ? 'text-destructive' : 'text-muted-foreground'
                          }`}
                        >
                          {dueDateHint.text}
                        </p>
                      </div>
                      {creditCheck.data && !creditCheck.data.ok && (
                        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
                          <p className="font-medium text-destructive">{creditCheck.data.motivo}</p>
                          <p className="mt-1 text-muted-foreground">
                            Saldo actual {fmt(creditCheck.data.saldo_actual)}
                            {creditCheck.data.credito_disponible > 0 &&
                              ` (a favor ${fmt(creditCheck.data.credito_disponible)} · neto ${fmt(creditCheck.data.saldo_neto)})`}
                            {creditCheck.data.limite != null &&
                              ` · Límite ${fmt(creditCheck.data.limite)}`}
                          </p>
                          {canOverrideCredit ? (
                            <label className="mt-2 flex items-center gap-2 text-foreground">
                              <input
                                type="checkbox"
                                checked={creditOverride}
                                onChange={(e) => setCreditOverride(e.target.checked)}
                                className="auna-checkbox w-3.5"
                              />
                              Autorizar de todas formas
                            </label>
                          ) : (
                            <p className="mt-1 text-muted-foreground">
                              Requiere permiso para autorizarla.
                            </p>
                          )}
                        </div>
                      )}
                      {creditCheck.data?.ok && creditCheck.data.limite != null && (
                        <p className="text-xs text-muted-foreground">
                          Disponible tras esta venta:{' '}
                          {fmt(creditCheck.data.limite - creditCheck.data.saldo_resultante)}
                        </p>
                      )}
                    </>
                  )}
                    </div>
                  )}

                            {isCreditSale && (
                <Alert className="py-3">
                  <UserRound className="h-4 w-4" />
                  <AlertTitle>Venta al crédito</AlertTitle>
                  <AlertDescription>
                    Selecciona un cliente registrado y confirma su vencimiento.
                    <div className="mt-3 space-y-2"><Label htmlFor="credit-initial-payment">Abono recibido hoy (opcional)</Label><Input id="credit-initial-payment" type="number" min={0} step="0.01" value={initialCreditPayment} placeholder="0.00" onChange={event => setInitialCreditPayment(event.target.value)} />
                    {Number(initialCreditPayment) > 0 && <><Label htmlFor="credit-initial-method">Medio de cobro del abono</Label><select id="credit-initial-method" className="auna-control auna-control-select w-full px-3" value={initialCreditMethod} onChange={event => setInitialCreditMethod(event.target.value)}><option value="">Selecciona el medio de cobro</option>{paymentMethods.filter(method => !method.is_credit).map(method => <option key={method.id} value={method.id}>{method.name}</option>)}</select></>}
                    <p className="font-semibold">Saldo pendiente: {fmt(Math.max(0, displayTotal - Number(initialCreditPayment || 0)))}</p></div>
                  </AlertDescription>
                </Alert>
              )}

                            {isCashMethod(currentPaymentMethod,name=>name.toLowerCase()==='efectivo') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="amount">Monto recibido</Label>
                    {displayTotal > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setAmountReceived(displayTotal.toFixed(2))}
                      >
                        Monto exacto
                      </Button>
                    )}
                  </div>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    min={displayTotal}
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value.replace(',', '.'))}
                    step="0.01"
                    className="font-semibold"
                  />
                  {amountReceived && parseFloat(amountReceived) >= displayTotal && (
                    <p className="text-sm font-medium text-primary">Vuelto: {fmt(changeAmount)}</p>
                  )}
                  {amountReceived && !Number.isNaN(parseFloat(amountReceived)) && parseFloat(amountReceived) < displayTotal && (
                    <p className="text-sm text-destructive">
                      Faltan {fmt(displayTotal - parseFloat(amountReceived))}.
                    </p>
                  )}
                  <div className="pos-cash-shortcuts">{[50,100,200].map(value => <Button key={value} type="button" variant="outline" onClick={() => setAmountReceived(value.toFixed(2))} disabled={checkoutLocked}>{fmt(value)}</Button>)}</div>
                  <PosNumericKeypad disabled={checkoutLocked} onKey={key => setAmountReceived(value => applyPosKey(value, key, 2, false))} />
                </div>
              )}
              {currentPaymentMethod && !isCreditSale && !isCashMethod(currentPaymentMethod,name=>name.toLowerCase()==='efectivo') && <p className="text-sm text-muted-foreground">Verificá que el pago por {currentPaymentMethod.name.toLowerCase()} se haya recibido antes de confirmar. Esta pantalla no procesa el cobro en una terminal externa.</p>}
            </div>
          </div>
          <div className="pos-payment-print"><span><Printer className="h-4 w-4" aria-hidden="true" />Ticket de esta venta</span><Button type="button" variant="outline" size="sm" onClick={() => setActionPanel('print')}>{printDestination.destinationId ? 'Destino configurado' : 'PDF sin equipo'} · Cambiar</Button></div>
        </section>
                {/* Catálogo: misma búsqueda, disponibilidad y escáner. */}
        <div className="pos-catalog-column" hidden={saleStep !== 'products'} data-mobile-active={mobileView === 'catalog'}>
          <aside className="pos-catalog" aria-labelledby="pos-catalog-title">
            <header className="pos-catalog-heading">
              <h2 id="pos-catalog-title" className="text-base font-semibold">Buscar productos</h2>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    aria-label="Buscar productos"
                    ref={productSearchRef}
                    placeholder="Buscar por nombre o código de barras..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      setProductPage(1)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      if(presentationChoice){event.preventDefault();return}
                      const term = productSearch.trim().toLowerCase()
                      if (!term) return
                      if(inventoryUnitsEnabled){
                        event.preventDefault()
                        const generation=cartGeneration()
                        void trackAddition(generation,async()=>{
                          try{
                            if(!additionIsCurrent(generation))return
                            const result=await lookupScannedUnitProduct({...checkoutScope,canViewProducts:hasPermission('products.view'),inventoryEnabled:isEnabled('inventory')},productSearch.trim(),{signal:unitOwner.controller.signal})
                            if(!additionIsCurrent(generation))return
                            const product=adaptApiProduct(result.product)
                            setScannedProducts(previous=>[...previous.filter(p=>p.id!==product.id),product])
                            await addProduct(product,{presentationId:result.presentationId,priceContext:unitPriceTier})
                            if(additionIsCurrent(generation))setProductSearch('')
                          }catch(error){
                            if(additionIsCurrent(generation))toast({title:'No se pudo leer el producto',description:(error as Error).message,variant:'destructive'})
                          }
                        })
                        return
                      }
                      event.preventDefault()
                      const generation=cartGeneration()
                      void trackAddition(generation,async()=>{
                        try{
                          if(!additionIsCurrent(generation))return
                          const result=await resolvePosCatalogCode(checkoutScope,productSearch.trim(),catalogType,unitOwner.controller.signal)
                          if(!additionIsCurrent(generation)||!result.item)return
                          const product=adaptApiProduct(result.item)
                          setScannedProducts(previous=>[...previous.filter(p=>p.id!==product.id),product])
                          await addProduct(product)
                          if(additionIsCurrent(generation))setProductSearch('')
                        }catch(error){if(additionIsCurrent(generation)&&(error as Error).name!=='AbortError')toast({title:'No se pudo leer el producto',description:(error as Error).message,variant:'destructive'})}
                      })
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
              <ScannerField compact scopeKey={`${scopeKey}:${cartGeneration()}:${saleStep}`} enabled={saleStep==='products'&&!checkoutLocked&&!loadedOrder&&!decisionPendienteRef.current&&!presentationChoice} label="Agregar por código" onScan={async(code,signal)=>{
                const generation=cartGeneration();if(!additionIsCurrent(generation)||saleStep!=='products'||checkoutLocked||loadedOrder||presentationChoice)return
                await trackAddition(generation,async()=>{
                  const result=await resolveContextScan(code,'SALE',signal);if(signal.aborted||!additionIsCurrent(generation))return
                  const product=adaptApiProduct(result.product);setScannedProducts(previous=>[...previous.filter(p=>p.id!==product.id),product]);await addProduct(product,{presentationId:result.presentationId,priceContext:unitPriceTier})
                })
              }}/>
              <nav className="pos-category-rail" aria-label="Categorías de productos">
                <button type="button" className="pos-category-row pos-all-category" aria-pressed={!selectedCategoryName} onClick={() => {setSelectedCategoryName(null);setProductLayout('flat');setProductPage(1)}}><Package className="h-5 w-5" aria-hidden="true" /><span>Todos</span></button>
                {categorySummaries.map(category => <CategoryBrowseCard key={category.name} name={category.name} count={category.count} imageUrl={category.imageUrl} disabled={checkoutLocked} selected={selectedCategoryName===category.name} onSelect={() => {setSelectedCategoryName(category.name);setProductLayout('byCategory');setProductPage(1)}} />)}
              </nav>
              {productsQuery.categories.isError&&<div role="status" className="flex flex-wrap items-center gap-2 text-sm"><p>No se pudieron cargar las categorías.</p><Button type="button" variant="outline" size="sm" disabled={productsQuery.categories.isFetching} onClick={()=>void productsQuery.categories.refetch()}>Reintentar categorías</Button></div>}
            </header>
            <div className="pos-catalog-body" aria-busy={productsQuery.isFetching||productsQuery.isLoading}>
              <p className="text-xs text-muted-foreground mb-3">{isProductSearchActive ? 'La búsqueda incluye todas las categorías.' : 'Tocá un producto o escaneá su código para agregarlo.'}</p>
              {posSinConfigurar ? (
                <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="font-medium">Falta configurar el punto de venta</p>
                  <p className="text-xs mt-0.5">
                    Esta sucursal no tiene una ubicación de venta marcada, así que las
                    existencias que se ven suman todos los almacenes y no reflejan lo que hay
                    en el mostrador. Marcá la ubicación en Sucursales → Almacenes para poder vender.
                  </p>
                </div>
              ) : null}
              {productsQuery.isFetching && !productsQuery.isLoading && <LoadingIndicator message="Actualizando productos…" className="mb-3" />}
              {productsQuery.isError && pageProducts.length > 0 && (
                <div role="status" className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <p className="text-muted-foreground">No se pudieron actualizar los productos. Últimos datos disponibles.</p>
                  <Button variant="outline" size="sm" disabled={productsQuery.isFetching} onClick={() => void productsQuery.refetch()}>Reintentar</Button>
                </div>
              )}
              {productsQuery.isLoading ? (
                <LoadingState variant="cards" message="Cargando productos…" />
              ) : productsQuery.isError && pageProducts.length === 0 ? (
                <div role="alert" className="py-8 text-center"><p>No se pudieron cargar los productos.</p><Button variant="outline" className="mt-3" onClick={() => void productsQuery.refetch()}>Reintentar</Button></div>
              ) : pageProducts.length === 0 ? (
                <CollectionEmptyState compact title="El catálogo espera sus productos" description="Los productos disponibles para esta venta aparecerán aquí." filtered={isProductSearchActive || Boolean(selectedCategoryName)} onReset={() => {setProductSearch('');setSelectedCategoryName(null);setProductPage(1)}} />
              ) : (
                <>
                  {productLayout === 'byCategory' && selectedCategoryName && !isProductSearchActive ? (
                    <p className="text-sm font-medium text-foreground mb-3">{selectedCategoryName}</p>
                  ) : null}
                  <div className="pos-product-list" ref={productPagination.containerRef} style={{ gridTemplateColumns: `repeat(${productPagination.columns}, minmax(0, 1fr))` }}>
                    {pageProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAdd={() => addFromTile(product)}
                        disabled={checkoutLocked}
                        formatPrice={fmt}
                        displayUnitPrice={getUnitPrice(product)}
                        availableQty={availabilityById[product.id]?.available ?? product.stock}
                        physicalStock={availabilityById[product.id]?.stock ?? product.stock}
                        posQty={posLocationId ? availabilityById[product.id]?.location_stock ?? null : null}
                        posMode={Boolean(posLocationId)}
                      />
                    ))}
                  </div>

                </>
              )}
            </div>
          </aside>
          {!productsQuery.isLoading && pageProducts.length > 0 && <div className="auna-pagination-outside">
            <div className="flex items-center justify-end gap-2"><Label htmlFor="pos-page-size">Productos por página</Label><Select value={String(pageSize)} onValueChange={v => { productPagination.setCardPageSize(Number(v)); setProductPageSize(Number(v)); setProductPage(1) }}><SelectTrigger id="pos-page-size" className="w-20"><SelectValue /></SelectTrigger><SelectContent>{productPagination.pageSizeOptions.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div>
            <Pagination currentPage={safePage} totalPages={totalPages} totalItems={productsQuery.data?.totalItems??0} pageSize={pageSize} count={pageProducts.length} itemLabel="productos" onPageChange={setProductPage} loading={productsQuery.isFetching} />
          </div>}
        </div>
      </fieldset>
      <SalePresentationDialog product={presentationChoice?.product??null} priceContext={unitPriceTier} locale={locale} currencyCode={currencyCode} onCancel={()=>{handledPresentation.current=pendingPresentation;setPendingPresentation(null)}} onSelect={presentationId=>{
        const request=pendingPresentation
        if(!request||handledPresentation.current===request||!presentationChoice||!additionIsCurrent(request.generation)||checkoutLocked||!checkout.isCurrent())return
        handledPresentation.current=request;setPendingPresentation(null);addFromTile(request.product,presentationId)
      }}/>
      <Dialog open={actionPanel !== null} onOpenChange={open => {if(!open)setActionPanel(null)}}>
        <DialogContent variant="auna" className="pos-action-dialog">
          <DialogHeader><DialogTitle>{actionPanel === 'customer' ? 'Cliente y datos fiscales' : actionPanel === 'promotions' ? 'Promociones de la venta' : actionPanel === 'unit' ? 'Presentación y equivalencias' : actionPanel === 'print' ? 'Ticket e impresión' : actionPanel === 'turn' ? 'Turno de caja' : 'Acciones de la venta'}</DialogTitle><DialogDescription>Se aplica a esta venta en la caja actual.</DialogDescription></DialogHeader>
          <fieldset disabled={checkoutLocked} className="min-w-0 space-y-4">
            {actionPanel === 'customer' && <div className="space-y-3">                  {canPickSavedCustomer && (
                    <SavedCustomerMany2One
                      valueId={pickedCustomerId}
                      linkedDisplayName={customer}
                      onPick={(row) => {
                        if (String(row.id) !== pickedCustomerId) setCreditDueDate('')
                        setPickedCustomerId(String(row.id))
                        setCustomer(row.name)
                        setCustomerNit(row.taxId ?? '')
                        setIsFinalConsumer(false)
                      }}
                      onClear={() => { setPickedCustomerId('__none__'); setCreditDueDate('') }}
                      canCreateContact={canCreateClientContact}
                    />
                  )}
                  <div>
                    <Label htmlFor="customer">Nombre o razón social</Label>
                    <Input
                      id="customer"
                      placeholder="Consumidor final"
                      value={customer}
                      onChange={(e) => {
                        setCustomer(e.target.value)
                        setPickedCustomerId('__none__')
                        if (salesShowFiscalFields && e.target.value.trim() !== 'Consumidor final') {
                          setIsFinalConsumer(false)
                        }
                      }}
                    />
                  </div>
                  {salesShowFiscalFields && (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="cf"
                          checked={isFinalConsumer}
                          onChange={(e) => {
                            setIsFinalConsumer(e.target.checked)
                            if (e.target.checked) {
                              setCustomer('Consumidor final')
                              setCustomerNit('')
                              setPickedCustomerId('__none__')
                            }
                          }}
                          className="auna-checkbox"
                        />
                        <Label htmlFor="cf">Consumidor final (CF)</Label>
                      </div>
                      {!isFinalConsumer && (
                        <div>
                          <Label htmlFor="nit">ID fiscal</Label>
                          <Input
                            id="nit"
                            placeholder="NIT, VAT, RFC, etc."
                            value={customerNit}
                            onChange={(e) => {
                              setCustomerNit(e.target.value)
                              setPickedCustomerId('__none__')
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
</div>}
            {actionPanel === 'promotions' && promotionsEnabled && !loadedOrder && <PromotionCodeInput appliedPromotions={promotions.appliedPromotions ?? []} totalDiscount={promotions.totalDiscount ?? 0} isValidating={promotions.isValidating ?? false} onApplyCode={promotions.applyCode} onRemovePromotion={promotions.removePromotion} />}
            {actionPanel === 'unit' && selectedLine?.unitSelection && <UnitLineFields product={selectedLine} selection={selectedLine.unitSelection} quantity={selectedLine.qty} disabled={checkoutLocked || Boolean(loadedOrder)} onSelect={id => {
              if(checkoutLocked||!selectedKey)return
              try {const selection=selectProductUnit(selectedLine,id,selectedLine.unitSelection!.priceContext);setSelectedLineKey(selectedKey);setUnitChange({from:selectedKey,to:unitCartKey(selectedLine.id,selection),scope:scopeKey});cart.selectCartUnit(selectedKey,id)} catch(error){toast({title:'Revisá la presentación',description:(error as Error).message,variant:'destructive'})}
            }} onAcceptRounding={accepted => {if(!checkoutLocked&&selectedKey)cart.acceptCartRounding(selectedKey,accepted)}} />}
            {actionPanel === 'print' && <PrintDestination route={printDestination.route} value={printDestination.destinationId} onChange={printDestination.onChange} disabled={checkoutLocked}/>}
            {actionPanel === 'turn' && <div className="space-y-3"><p className="font-medium">{cashRegisterMeta?.name ?? 'Caja'}</p>{activeCashSession && <dl className="pos-turn-details"><dt>Abierto por</dt><dd>{activeCashSession.openedBy?.name ?? '—'}</dd><dt>Fondo inicial</dt><dd>{fmt(Number(activeCashSession.opening_float))}</dd><dt>Inicio</dt><dd>{new Date(activeCashSession.opened_at).toLocaleString(locale || 'es-GT')}</dd></dl>}{canUserCloseCashTurn ? <Button type="button" variant="outline" className="text-destructive" disabled={checkoutLocked || isClosingCashSession} onClick={() => {setActionPanel(null);setShowCloseCashDialog(true)}}>Cerrar caja (fin de turno)</Button> : <p className="text-xs text-muted-foreground">Solo quien abrió el turno o un supervisor puede cerrarlo.</p>}</div>}
            {actionPanel === 'options' && <div className="pos-options">
              <Button type="button" variant="outline" onClick={() => setActionPanel('customer')}><UserRound className="h-4 w-4" aria-hidden="true" />Cliente y datos fiscales</Button>
              <Button type="button" variant="outline" onClick={() => setActionPanel('print')}><Printer className="h-4 w-4" aria-hidden="true" />Ticket e impresión</Button>
              <Button type="button" variant="outline" onClick={() => setActionPanel('turn')}><Landmark className="h-4 w-4" aria-hidden="true" />Ver turno de caja</Button>
              {salesShowChannels && <div><Label>Canal de venta</Label><Select value={salesChannel} onValueChange={value => {if(value==='POS'||value==='WHOLESALE'||value==='ONLINE')setSalesChannel(value)}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="POS">Mostrador (POS)</SelectItem><SelectItem value="WHOLESALE">Mayoreo / ruta</SelectItem><SelectItem value="ONLINE">En línea</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">El canal puede cambiar precios y promociones aplicables.</p></div>}
            </div>}
          </fieldset>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setActionPanel(null)}>Listo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={elsewhere !== null} onOpenChange={(o) => !o && cerrarElsewhere()}>
        <AlertDialogContent variant="auna">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {/* El nombre va en las dos ramas: sin él, dos avisos seguidos de
                  productos distintos se ven idénticos. */}
              {elsewhereView == null
                ? ''
                : compareUnitQuantities(String(elsewhereView.atPos),'0')===0
                  ? `No queda ${elsewhereView.product.name} en el mostrador`
                  : `Solo quedan ${elsewhereView.atPos} de ${elsewhereView.product.name} en el mostrador`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Pero sí hay en:</p>
                <ul className="mt-2 space-y-1">
                  {elsewhereView?.rows.map((r) => (
                    <li key={r.label} className="text-foreground">
                      <span className="font-mono">{r.label}</span>
                      <span className="text-muted-foreground"> — {r.stock} unidad(es)</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3">
                  Si continúas, la venta saldrá de ahí. Conviene traerlo al mostrador con un
                  movimiento interno para que las existencias digan la verdad.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (elsewhere&&additionIsCurrent(elsewhere.generation)) cart.addToCart(elsewhere.product,elsewhere.selection)
                cerrarElsewhere()
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AvailabilityDialog
        state={cart.availabilityDialog}
        additionalQty={cart.additionalQty}
        onAdditionalQtyChange={cart.setAdditionalQty}
        onConfirm={cart.handleConfirmAdditionalQty}
        onCancel={cart.handleCancelAvailability}
      />
      <AdminAuthDialog
        state={cart.adminAuthDialog}
        username={cart.adminUsername}
        password={cart.adminPassword}
        isAuthenticating={cart.isAuthenticating}
        onUsernameChange={cart.setAdminUsername}
        onPasswordChange={cart.setAdminPassword}
        onConfirm={cart.handleAdminAuth}
        onCancel={cart.closeAdminAuthDialog}
      />

      <AlertDialog open={showCloseCashDialog} onOpenChange={setShowCloseCashDialog}>
        <AlertDialogContent variant="auna">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar el turno de caja?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                Cierra el turno en el sistema <strong>sin</strong> generar un cierre contable ni arqueo. Para cuadrar
                efectivo y dejar constancia oficial use la pantalla <strong>Cierre de caja</strong>.
              </span>
              {cart.cartItems.length > 0 ? (
                <span className="block text-amber-800 dark:text-amber-200">
                  Hay {cart.cartItems.length} línea(s) en el carrito: puede vaciarlas antes o cerrar igual; no se
                  registrará ninguna venta hasta abrir un turno nuevo.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosingCashSession}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isClosingCashSession}
              onClick={(e) => {
                e.preventDefault()
                void confirmCloseCashSession()
              }}
            >
              {isClosingCashSession ? 'Cerrando…' : 'Sí, cerrar turno'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={canLoadOrders && loadOrderOpen} onOpenChange={setLoadOrderOpen}>
        <DialogContent variant="auna">
          <DialogHeader>
            <DialogTitle>Cargar pedido en POS</DialogTitle>
            <DialogDescription>
              Trae al carrito las líneas de un pedido ya confirmado, buscándolo por su referencia
              o su identificador interno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="load-order-ref">Referencia P- o UUID</Label>
            <Input
              id="load-order-ref"
              placeholder="P-000001"
              value={loadOrderRef}
              onChange={(e) => setLoadOrderRef(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleLoadOrder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadOrderOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleLoadOrder()} disabled={!loadOrderRef.trim()}>
              Cargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
