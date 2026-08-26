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
 * NewSalePage - Página de nueva venta con layout de dos columnas:
 * Izquierda: información de la venta (cliente, pago, carrito, total, registrar).
 * Derecha: productos en cards con imagen y opción de agregar a la venta.
 * Al registrar, la venta queda en estado Completada y se descuenta stock.
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ArrowLeft, Plus, Receipt, Search, ChevronLeft, ChevronRight, PauseCircle, RotateCcw, Loader2, Landmark, Settings, List, LayoutGrid, ImageIcon, Package } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchWarehouses } from '@/services/warehouseService'
import { fetchStockByLocation } from '@/services/stockMoveService'
import { useAllProducts, PRODUCTS_QUERY_KEY } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { usePaymentMethods, PaymentMethod as PaymentMethodType } from '@/hooks/usePaymentMethods'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { formatMoney } from '@/utils'
import { createSale } from '@/services/saleService'
import {
  convertOrderToSale,
  fetchOrderById,
  pendingOrderLineQty,
  type Order,
} from '@/services/orderService'
import { postPricingPreview, fetchPosAvailability, type ProductAvailability } from '@/services/productService'
import {
  saveNewSaleDraft,
  loadNewSaleDraft,
  clearNewSaleDraft,
  hasNewSaleDraft,
  type NewSaleDraft,
} from '@/services/saleDraftStorage'
import { useAuth } from '@/context/useAuth'
import { getCompanyNamePublic } from '@/services/settingsService'
import { generateSaleTicket } from './documents/generateSaleTicket'
import type { Product } from '@/types/product'

import { useCart, useSalesData } from './hooks'
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
import { CASH_SESSION_CURRENT_QUERY_KEY } from '@/components/cash-closure/hooks/useMineClosureGate'
import type { CashRegisterSessionDto, CashSessionCurrentResult } from '@/services/cashSessionsService'
import type { CartProduct } from './types'

type ProductBrowseLayout = 'flat' | 'byCategory'

const PRODUCT_LAYOUT_STORAGE_KEY = 'deposito:listUi:v1:ventas/nueva/productos-layout'

function readProductBrowseLayout(): ProductBrowseLayout {
  try {
    const v = sessionStorage.getItem(PRODUCT_LAYOUT_STORAGE_KEY)
    if (v === 'flat') return 'flat'
    if (v === 'byCategory') return 'byCategory'
  } catch {
    /* ignore */
  }
  return 'byCategory'
}

function writeProductBrowseLayout(layout: ProductBrowseLayout) {
  try {
    sessionStorage.setItem(PRODUCT_LAYOUT_STORAGE_KEY, layout)
  } catch {
    /* ignore */
  }
}

function getProductCategoryName(product: Product): string {
  const c = product.category
  if (typeof c === 'string' && c.trim()) return c.trim()
  if (c && typeof c === 'object' && 'name' in c && typeof c.name === 'string' && c.name.trim()) {
    return c.name.trim()
  }
  return 'Sin categoría'
}

const ProductCard = ({
  product,
  onAdd,
  disabled,
  formatPrice,
  displayUnitPrice,
  availableQty,
  physicalStock,
  posQty,
  posMode,
}: {
  product: Product
  onAdd: () => void
  disabled?: boolean
  formatPrice: (n: number) => string
  displayUnitPrice: number
  availableQty?: number
  physicalStock?: number
  /** Existencias en la ubicación desde la que despacha la caja. */
  posQty?: number | null
  /** La caja despacha de una ubicación concreta: el total de sucursal no sirve acá. */
  posMode?: boolean
}) => (
  <Card className="overflow-hidden transition-shadow hover:shadow-md">
    <div className="aspect-square bg-muted relative">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
          Sin imagen
        </div>
      )}
    </div>
    <CardContent className="p-3">
      <p className="font-medium text-sm truncate" title={product.name}>
        {product.name}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatPrice(displayUnitPrice)}
        {posMode
          ? // Mientras no llegue el dato de la ubicación no se enseña el total de
            // sucursal: en la caja ese número miente sobre lo que hay a la mano.
            posQty != null
            ? ` · Mostrador: ${posQty}`
            : ' · Mostrador: …'
          : availableQty != null && physicalStock != null && physicalStock !== availableQty
            ? ` · Disp: ${availableQty} (${physicalStock} fís.)`
            : ` · Stock: ${availableQty ?? product.stock ?? 0}`}
      </p>
      {posQty != null && availableQty != null && availableQty > posQty ? (
        <p className="text-xs text-amber-600">
          {availableQty - posQty} en otros almacenes
        </p>
      ) : null}
      <Button
        size="sm"
        className="w-full mt-2"
        onClick={onAdd}
        disabled={disabled}
      >
        <Plus className="w-4 h-4 mr-1" />
        Agregar
      </Button>
    </CardContent>
  </Card>
)

const CategoryBrowseCard = ({
  name,
  count,
  imageUrl,
  onSelect,
  disabled,
}: {
  name: string
  count: number
  imageUrl?: string | null
  onSelect: () => void
  disabled?: boolean
}) => (
  <Card
    className="overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
    role="button"
    tabIndex={disabled ? -1 : 0}
    onClick={() => !disabled && onSelect()}
    onKeyDown={(e) => {
      if (disabled) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect()
      }
    }}
  >
    <div className="aspect-square bg-muted relative">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <ImageIcon className="h-10 w-10" />
        </div>
      )}
    </div>
    <CardContent className="p-3 text-center">
      <p className="font-medium text-sm truncate" title={name}>
        {name}
      </p>
      <p className="text-xs text-muted-foreground">
        {count} {count === 1 ? 'producto' : 'productos'}
      </p>
    </CardContent>
  </Card>
)

export default function NewSalePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const userId = user?.id ?? ''
  const { locale, currencyCode, companyName, companyLogoUrl, vatRegime, ivaRate } = useSystemSettings()
  const fmt = (n: number) => formatMoney(n, locale, currencyCode)
  const salesData = useSalesData()

  const paymentMethodsQuery = usePaymentMethods()
  const paymentMethods = useMemo(() => paymentMethodsQuery.data ?? [], [paymentMethodsQuery.data])
  // Solo lo que maneja esta sucursal: no se puede vender lo que no está aquí.
  const productsQuery = useAllProducts({ forSaleOnly: true, inBranchOnly: true })
  const availableProducts = useMemo(() => productsQuery.data ?? [], [productsQuery.data])
  const categoriesQuery = useCategories()

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
  const [productPage, setProductPage] = useState(1)
  const [productPageSize, setProductPageSize] = useState(9)
  const [productLayout, setProductLayout] = useState<ProductBrowseLayout>(readProductBrowseLayout)
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null)
  const [customer, setCustomer] = useState('')
  const [customerNit, setCustomerNit] = useState('')
  const [pickedCustomerId, setPickedCustomerId] = useState<string>('__none__')
  const [salesChannel, setSalesChannel] = useState<'POS' | 'WHOLESALE' | 'ONLINE'>('POS')
  const [unitPricesById, setUnitPricesById] = useState<Record<string, number>>({})
  const [availabilityById, setAvailabilityById] = useState<Record<string, ProductAvailability>>({})
  const [isFinalConsumer, setIsFinalConsumer] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType | null>(null)
  const [amountReceived, setAmountReceived] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [promoCodesToRestore, setPromoCodesToRestore] = useState<string[] | null>(null)
  /** Fuerza recomputar si hay borrador en localStorage (React no observa el storage). */
  const [storedDraftRevision, setStoredDraftRevision] = useState(0)
  const [loadedOrder, setLoadedOrder] = useState<Order | null>(null)
  /** Producto que el mostrador ya no tiene, pero sí hay en otra ubicación. */
  type ElsewhereState = { product: Product; atPos: number; rows: { label: string; stock: number }[] }
  const [elsewhere, setElsewhere] = useState<ElsewhereState | null>(null)
  // El AlertDialog sigue montado durante la animación de cierre, cuando `elsewhere`
  // ya es null: leerlo directo pintaba "Solo quedan undefined en el mostrador".
  const elsewhereShownRef = useRef<ElsewhereState | null>(null)
  if (elsewhere) elsewhereShownRef.current = elsewhere
  const elsewhereView = elsewhere ?? elsewhereShownRef.current
  const [loadOrderRef, setLoadOrderRef] = useState('')
  const [loadOrderOpen, setLoadOrderOpen] = useState(false)
  const orderLineIdByProductRef = useRef<Map<string, string>>(new Map())
  // Clave del intento de cobro. Sobrevive a un error para que reintentar sea el
  // mismo intento y no una segunda venta; se renueva al terminar uno.
  const intentoDeCobroRef = useRef<string>(crypto.randomUUID())
  const pedidoLoadedRef = useRef<string | null>(null)

  const customerContactIdForPricing =
    pickedCustomerId !== '__none__' && pickedCustomerId.trim() ? pickedCustomerId : undefined

  const getUnitPrice = useCallback(
    (p: Product) => {
      const u = unitPricesById[p.id]
      return u != null && Number.isFinite(u) ? u : Number(p.price ?? 0)
    },
    [unitPricesById]
  )

  const getAvailableQty = useCallback(
    (p: Product) => availabilityById[p.id]?.available ?? Number(p.stock ?? 0),
    [availabilityById]
  )

  const cart = useCart({ availableProducts, getUnitPrice, getAvailableQty })

  /**
   * El mostrador despacha de SU ubicación. Si ahí ya no queda, no se bloquea la
   * venta: se dice en qué anaquel está el producto y el cajero decide. Después
   * sigue el flujo de siempre (cantidad adicional, autorización de admin).
   */
  const addingRef = useRef<Set<string>>(new Set())
  /** Hay un aviso de "está en otro almacén" esperando que el cajero decida. */
  const decisionPendienteRef = useRef(false)

  const addProduct = async (product: Product) => {
    if (posSinConfigurar) {
      toast({
        title: 'Falta configurar el punto de venta',
        description:
          'Esta sucursal no tiene una ubicación de venta marcada, así que la caja no sabe de qué almacén despacha. Configurala en Sucursales → Almacenes antes de vender.',
        variant: 'destructive',
      })
      return
    }
    if (!posLocationId) { cart.addToCart(product); return }
    // Un clic a la vez por producto: la consulta de abajo tarda, y sin esto dos
    // clics seguidos leen el mismo carrito viejo, no ven que el mostrador ya se
    // agotó y se saltan el aviso.
    if (addingRef.current.has(product.id)) return
    addingRef.current.add(product.id)
    let esperaDecision = false
    try {
      const rows = await queryClient.fetchQuery({
        queryKey: ['stock-by-location', product.id],
        queryFn: () => fetchStockByLocation(product.id),
        staleTime: 30_000,
      })
      const enCarrito = cart.cartItems.find((i) => i.id === product.id)?.qty ?? 0
      const atPos = rows.find((r) => r.location.id === posLocationId)?.stock ?? 0
      const otras = rows
        .filter((r) => r.location.id !== posLocationId && r.stock > 0)
        .map((r) => ({ label: `${r.location.warehouse.name} · ${r.location.code}`, stock: r.stock }))
      if (enCarrito + 1 > atPos && otras.length > 0) {
        // Un solo aviso a la vez. Con dos productos en vuelo, el segundo abría su
        // aviso justo después de que el cajero resolvía el primero, y parecía que
        // el mismo diálogo reaparecía. Ese clic se descarta: el cajero lo repite.
        if (decisionPendienteRef.current) return
        // El candado NO se suelta acá: sigue puesto hasta que el cajero decida.
        // Si se soltara al abrir, un segundo clic pendiente volvía a abrir el
        // aviso que el cajero ya había resuelto.
        decisionPendienteRef.current = true
        esperaDecision = true
        setElsewhere({ product, atPos, rows: otras })
        return
      }
    } catch {
      // Si no se pudo consultar, no se estorba la venta: sigue el flujo normal.
    } finally {
      if (!esperaDecision) addingRef.current.delete(product.id)
    }
    cart.addToCart(product)
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
        price: Number(item.price),
        qty: item.qty,
      })),
    [cart.cartItems]
  )
  const canPickSavedCustomer = hasPermission('contacts.clients.view')
  const canCreateClientContact = hasPermission('contacts.clients.create')

  const promotions = usePromotions({
    cartItems: promotionCartItems,
    cartTotal: cart.cartTotal,
    locale,
    currencyCode,
  })

  useEffect(() => {
    let cancelled = false
    const ids = availableProducts.map((p) => p.id)
    if (ids.length === 0) {
      setUnitPricesById({})
      return
    }
    void (async () => {
      try {
        const r = await postPricingPreview({
          product_ids: ids,
          sales_channel: salesChannel,
          customer_contact_id: customerContactIdForPricing ?? null,
        })
        if (!cancelled) setUnitPricesById(r.unit_prices ?? {})
      } catch {
        if (!cancelled) setUnitPricesById({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [availableProducts, salesChannel, customerContactIdForPricing])

  useEffect(() => {
    repriceCartRef.current()
  }, [unitPricesById])

  const filteredProducts = useMemo(
    () =>
      availableProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.barcode ?? '').includes(productSearch)
      ),
    [availableProducts, productSearch]
  )

  const isProductSearchActive = productSearch.trim().length > 0

  const categoryImageByName = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const c of categoriesQuery.data ?? []) {
      map.set(c.name, c.image_url ?? null)
    }
    return map
  }, [categoriesQuery.data])

  const categorySummaries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of filteredProducts) {
      const name = getProductCategoryName(p)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        imageUrl: categoryImageByName.get(name) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [filteredProducts, categoryImageByName])

  const browseProducts = useMemo(() => {
    if (productLayout === 'flat' || isProductSearchActive) return filteredProducts
    if (!selectedCategoryName) return []
    return filteredProducts.filter((p) => getProductCategoryName(p) === selectedCategoryName)
  }, [productLayout, isProductSearchActive, filteredProducts, selectedCategoryName])

  const showCategoryPicker =
    productLayout === 'byCategory' && !isProductSearchActive && selectedCategoryName === null

  useEffect(() => {
    writeProductBrowseLayout(productLayout)
  }, [productLayout])

  useEffect(() => {
    setProductPage(1)
  }, [productSearch, productLayout, selectedCategoryName])

  const pageSize = productPageSize
  const totalPages = Math.max(1, Math.ceil(browseProducts.length / pageSize))
  const safePage = Math.min(productPage, totalPages)
  const pageProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return browseProducts.slice(start, start + pageSize)
  }, [browseProducts, safePage, pageSize])

  useEffect(() => {
    let cancelled = false
    const ids = [
      ...new Set([
        ...pageProducts.map((p) => p.id),
        ...cart.cartItems.map((i) => i.id),
      ]),
    ]
    if (ids.length === 0) {
      setAvailabilityById({})
      return
    }
    void (async () => {
      try {
        const { availability } = await fetchPosAvailability(ids)
        if (!cancelled) setAvailabilityById(availability)
      } catch {
        if (!cancelled) setAvailabilityById({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pageProducts, cart.cartItems])

  const displayTotal = loadedOrder ? cart.cartTotal : (promotions.finalTotal ?? cart.cartTotal)
  const changeAmount =
    paymentMethod?.name?.toLowerCase() === 'efectivo' && amountReceived
      ? Math.max(0, parseFloat(amountReceived) - displayTotal)
      : 0

  const canCreate = hasPermission('sales.create')

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
    if (!r.ok) {
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
    if (!r.ok) {
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
    setHasStoredDraft(userId ? hasNewSaleDraft(userId) : false)
  }, [userId, storedDraftRevision])

  const applyDraftToForm = useCallback(
    (draft: NewSaleDraft) => {
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
      if (draft.productPageSize && [9, 18, 36, 54].includes(draft.productPageSize)) {
        setProductPageSize(draft.productPageSize)
      }

      if (draft.paymentMethodId != null) {
        const pm = paymentMethods.find((p) => p.id === draft.paymentMethodId)
        if (pm) setPaymentMethod(pm)
      } else {
        setPaymentMethod(null)
      }

      const lines = draft.lines ?? []
      if (lines.length > 0) {
        const { missingProductIds, qtyAdjustedIds } = cart.hydrateFromLines(
          lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          draft.adminAuthorizedProductIds ?? []
        )
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
    [cart, paymentMethods, promotions, toast]
  )

  const recoverDraftIfReady = useCallback(
    (draft: NewSaleDraft): boolean => {
      const lines = draft.lines ?? []
      if (!productsQuery.isSuccess) {
        toast({
          title: 'Espera un momento',
          description: 'Aún se cargan los productos.',
          variant: 'destructive',
        })
        return false
      }
      if (lines.length > 0 && availableProducts.length === 0) {
        toast({
          title: 'Sin productos',
          description: 'No hay productos en catálogo para armar el carrito.',
          variant: 'destructive',
        })
        return false
      }
      if (draft.paymentMethodId != null && paymentMethods.length === 0) {
        toast({
          title: 'Espera un momento',
          description: 'Aún se cargan los métodos de pago.',
          variant: 'destructive',
        })
        return false
      }
      applyDraftToForm(draft)
      return true
    },
    [
      productsQuery.isSuccess,
      availableProducts.length,
      paymentMethods.length,
      applyDraftToForm,
      toast,
    ]
  )

  const handleRecoverSavedSale = useCallback(() => {
    if (!userId) {
      toast({ title: 'Inicia sesión', variant: 'destructive' })
      return
    }
    const draft = loadNewSaleDraft(userId)
    if (!draft) {
      toast({
        title: 'No hay venta guardada',
        variant: 'destructive',
      })
      setStoredDraftRevision((r) => r + 1)
      return
    }
    recoverDraftIfReady(draft)
  }, [userId, recoverDraftIfReady, toast])

  const recuperarQueryHandledRef = useRef(false)
  const applyDraftRef = useRef(applyDraftToForm)
  applyDraftRef.current = applyDraftToForm

  useEffect(() => {
    if (searchParams.get('recuperar') !== '1') {
      recuperarQueryHandledRef.current = false
      return
    }
    if (!userId) return
    if (recuperarQueryHandledRef.current) return

    const draft = loadNewSaleDraft(userId)
    if (!draft) {
      toast({
        title: 'No hay venta guardada',
        description: 'Primero guarda una venta con «Continuar después».',
        variant: 'destructive',
      })
      setSearchParams({}, { replace: true })
      return
    }

    const lines = draft.lines ?? []
    if (!productsQuery.isSuccess) return
    if (lines.length > 0 && availableProducts.length === 0) return
    if (draft.paymentMethodId != null && paymentMethods.length === 0) return

    applyDraftRef.current(draft)
    recuperarQueryHandledRef.current = true
    setSearchParams({}, { replace: true })
  }, [
    searchParams,
    userId,
    productsQuery.isSuccess,
    availableProducts.length,
    paymentMethods.length,
    setSearchParams,
    toast,
  ])

  useEffect(() => {
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
  }, [promoCodesToRestore, cart.cartItems.length])

  const handleSaveForLater = () => {
    if (!userId) {
      toast({
        title: 'No se puede guardar',
        description: 'Debes iniciar sesión.',
        variant: 'destructive',
      })
      return
    }
    const hasCart = cart.cartItems.length > 0
    const hasCustomer = customer.trim().length > 0
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
      lines: cart.cartItems.map((item) => ({ productId: item.id, qty: item.qty })),
      adminAuthorizedProductIds: [...cart.adminAuthorizedProducts],
      promotionCodes: promotions.promotionCodes,
      productPageSize,
    })
    cart.clearCart()
    promotions.clearPromotions()
    setCustomer('')
    setCustomerNit('')
    setPickedCustomerId('__none__')
    setSalesChannel('POS')
    setIsFinalConsumer(false)
    setPaymentMethod(null)
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
    (order: Order) => {
      if (!['CONFIRMED', 'PARTIALLY_FULFILLED'].includes(order.status)) {
        toast({
          title: 'Pedido no disponible',
          description: 'Solo pedidos confirmados o parciales se cargan en POS.',
          variant: 'destructive',
        })
        return
      }
      const prices: Record<string, number> = {}
      const lines: { productId: string; qty: number }[] = []
      const map = new Map<string, string>()
      for (const line of order.lines) {
        const pending = pendingOrderLineQty(line)
        if (pending <= 0) continue
        lines.push({ productId: line.product_id, qty: pending })
        prices[line.product_id] = Number(line.unit_price)
        map.set(line.product_id, line.id)
      }
      if (lines.length === 0) {
        toast({ title: 'Sin líneas pendientes', variant: 'destructive' })
        return
      }
      orderLineIdByProductRef.current = map
      setUnitPricesById(prices)
      cart.hydrateFromLines(lines, [])
      setLoadedOrder(order)
      setCustomer(order.customer || order.customerContact?.name || '')
      setCustomerNit(order.is_final_consumer ? '' : order.customer_nit || '')
      setIsFinalConsumer(order.is_final_consumer)
      if (order.customer_contact_id) setPickedCustomerId(order.customer_contact_id)
      setSalesChannel(order.sales_channel === 'POS' ? 'POS' : order.sales_channel === 'ONLINE' ? 'ONLINE' : 'WHOLESALE')
      promotions.clearPromotions()
      toast({ title: 'Pedido cargado', description: order.reference ?? order.id })
    },
    [cart, promotions, toast]
  )

  const handleLoadOrder = useCallback(async () => {
    const ref = loadOrderRef.trim()
    if (!ref) return
    try {
      const order = await fetchOrderById(ref)
      applyOrderToPos(order)
      setLoadOrderOpen(false)
      setLoadOrderRef('')
    } catch (e) {
      toast({
        title: 'No se encontró el pedido',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    }
  }, [loadOrderRef, applyOrderToPos, toast])

  useEffect(() => {
    const pedidoRef = searchParams.get('pedido')?.trim()
    if (!pedidoRef || pedidoLoadedRef.current === pedidoRef || !productsQuery.isSuccess) return
    pedidoLoadedRef.current = pedidoRef
    void fetchOrderById(pedidoRef)
      .then(applyOrderToPos)
      .catch((e: Error) => {
        toast({ title: 'Pedido', description: e.message, variant: 'destructive' })
      })
  }, [searchParams, productsQuery.isSuccess, applyOrderToPos, toast])

  const clearLoadedOrder = () => {
    setLoadedOrder(null)
    orderLineIdByProductRef.current = new Map()
    cart.clearCart()
    pedidoLoadedRef.current = null
    setSearchParams((prev) => {
      prev.delete('pedido')
      return prev
    })
  }

  const handleSubmit = async () => {
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
    if (!paymentMethod) {
      toast({ title: 'Selecciona un método de pago', variant: 'destructive' })
      return
    }
    if (cart.cartItems.length === 0) {
      toast({ title: 'Agrega al menos un producto', variant: 'destructive' })
      return
    }
    const isCash = paymentMethod.name?.toLowerCase() === 'efectivo'
    if (isCash) {
      const received = parseFloat(amountReceived || '0')
      if (Number.isNaN(received) || received < displayTotal) {
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
      payment_method_id: paymentMethod.id,
      status_id: 0,
      customer_contact_id: pickedCustomerId !== '__none__' ? pickedCustomerId : undefined,
      sales_channel: salesChannel,
      cash_register_id: cashRegisterMeta?.id ?? selectedRegisterId ?? undefined,
      items: cart.cartItems.map((item: CartProduct) => ({
        product_id: item.id,
        price: item.price,
        qty: item.qty,
      })),
      amount_received: isCash && amountReceived ? Number(amountReceived) : undefined,
      change: isCash ? changeAmount : undefined,
      admin_authorized_products: Array.from(cart.adminAuthorizedProducts),
      promotion_codes: promotions.promotionCodes,
      idempotency_key: intentoDeCobroRef.current,
    }
    setIsProcessing(true)
    try {
      if (loadedOrder) {
        const lines = cart.cartItems
          .map((item) => ({
            line_id: orderLineIdByProductRef.current.get(item.id) ?? '',
            qty: item.qty,
          }))
          .filter((x) => x.line_id && x.qty > 0)
        const [{ company_name: companyNameFromApi }, result] = await Promise.all([
          getCompanyNamePublic().catch(() => ({ company_name: '' })),
          convertOrderToSale(loadedOrder.id, {
            payment_method_id: paymentMethod.id,
            amount_received: isCash && amountReceived ? Number(amountReceived) : undefined,
            change: isCash ? changeAmount : undefined,
            lines,
            cash_register_id: cashRegisterMeta?.id ?? selectedRegisterId ?? undefined,
          }),
        ])
        const created = result.sale as { id?: string; reference?: string }
        const saleId = created?.id
        if (saleId && created) {
          const nameForTicket = (companyNameFromApi && String(companyNameFromApi).trim()) || companyName
          const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl)
          generateSaleTicket(created as Parameters<typeof generateSaleTicket>[0], {
            companyName: nameForTicket,
            logoDataUrl,
            locale,
            currencyCode,
          })
        }
        toast({ title: 'Venta desde pedido registrada' })
        salesData.refreshSales()
        await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
        clearLoadedOrder()
        setCustomer('')
        setCustomerNit('')
        setPickedCustomerId('__none__')
        setPaymentMethod(null)
        setAmountReceived('')
        if (saleId) navigate(`/ventas/${saleId}/factura`)
        return
      }

      // POST devuelve la venta completa; getCompanyNamePublic en paralelo (antes era secuencial + GET extra)
      const [{ company_name: companyNameFromApi }, created] = await Promise.all([
        getCompanyNamePublic().catch(() => ({ company_name: '' })),
        createSale(payload),
      ])
      const saleId = created?.id
      if (saleId) {
        const nameForTicket = (companyNameFromApi && String(companyNameFromApi).trim()) || companyName
        const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl)
        generateSaleTicket(created, {
          companyName: nameForTicket,
          logoDataUrl,
          locale,
          currencyCode,
        })
      }
      intentoDeCobroRef.current = crypto.randomUUID()
      toast({ title: 'Venta registrada correctamente' })
      salesData.refreshSales()
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
      if (userId) {
        clearNewSaleDraft(userId)
        setStoredDraftRevision((r) => r + 1)
      }
      cart.clearCart()
      promotions.clearPromotions()
      setCustomer('')
      setCustomerNit('')
      setPickedCustomerId('__none__')
      setSalesChannel('POS')
      setPaymentMethod(null)
      setAmountReceived('')
    } catch (e) {
      toast({
        title: 'Error al registrar la venta',
        description: (e as Error)?.message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!selectedRegisterId) {
    return (
      <CashRegisterPicker
        onSelect={(id) => setSelectedRegisterId(id)}
        onBack={() => navigate('/ventas')}
      />
    )
  }

  if (!cashCheckDone) {
    return (
      <div className="px-4 sm:px-8 lg:px-14 py-16 w-full flex flex-col items-center justify-center gap-4 min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Comprobando turno de caja…</p>
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
          <h1 className="text-xl font-bold">Nueva venta</h1>
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
          <h1 className="text-xl font-bold">Nueva venta</h1>
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
      <>
        <div className="px-4 sm:px-8 lg:px-14 py-4 w-full">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={() => setSelectedRegisterId(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-muted-foreground">Nueva venta</h1>
          </div>
        </div>
        <OpenCashRegisterPrompt
          registerName={cashRegisterMeta?.name}
          registerId={cashRegisterMeta?.id}
          onOpened={handleCashSessionOpened}
          onBack={() => setSelectedRegisterId(null)}
        />
      </>
    )
  }

  return (
    <div className="px-4 sm:px-8 lg:px-14 py-4 sm:py-6 w-full animate-fade-in">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate('/ventas')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Nueva Venta</h1>
            <p className="text-sm text-muted-foreground">
              {loadedOrder
                ? `Venta desde pedido ${loadedOrder.reference ?? loadedOrder.id.slice(0, 8)}`
                : 'Completa la información y agrega productos'}
            </p>
          </div>
        </div>
        {!loadedOrder && (
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setLoadOrderOpen(true)}>
            <Package className="h-4 w-4 mr-2" />
            Cargar pedido
          </Button>
        )}

        {activeCashSession && (
          <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-0 sm:justify-end sm:max-w-[min(100%,28rem)] lg:max-w-[32rem]">
            <div
              className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground sm:text-sm"
              title={`${cashRegisterMeta?.name ?? 'Caja principal'} · Fondo Q${Number(activeCashSession.opening_float).toFixed(2)} · ${new Date(activeCashSession.opened_at).toLocaleString(locale || 'es-GT')}${activeCashSession.openedBy?.name ? ` · ${activeCashSession.openedBy.name}` : ''}`}
            >
              <Landmark className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              <span className="truncate">
                <span className="text-foreground/80 font-medium">Turno abierto</span>
                <span className="mx-1.5 text-border">·</span>
                {cashRegisterMeta?.name ?? 'Caja principal'}
                <span className="mx-1.5">·</span>
                Q{Number(activeCashSession.opening_float).toFixed(2)}
                <span className="mx-1.5">·</span>
                {new Date(activeCashSession.opened_at).toLocaleString(locale || 'es-GT', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                {activeCashSession.openedBy?.name ? (
                  <>
                    <span className="mx-1.5">·</span>
                    {activeCashSession.openedBy.name}
                  </>
                ) : null}
              </span>
            </div>
            {canUserCloseCashTurn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 border-border/80 bg-background"
                    disabled={isProcessing || isClosingCashSession}
                    aria-label="Acciones del turno de caja"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-56">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    disabled={isProcessing || isClosingCashSession}
                    onSelect={() => setShowCloseCashDialog(true)}
                  >
                    Cerrar caja (fin de turno)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="text-[11px] leading-tight text-muted-foreground sm:text-xs sm:max-w-[12rem] sm:text-right">
                Solo quien abrió el turno o un supervisor puede cerrarlo.
              </span>
            )}
          </div>
        )}
      </div>

      {loadedOrder && (
        <Alert className="mb-6">
          <Package className="h-4 w-4" />
          <AlertTitle>Pedido {loadedOrder.reference ?? loadedOrder.id.slice(0, 8)}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Registrar venta desde pedido (precios congelados del pedido).</span>
            <Button type="button" size="sm" variant="outline" onClick={clearLoadedOrder}>
              Quitar pedido
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {hasStoredDraft && (
        <Alert className="mb-6 border-amber-500/50 bg-amber-500/5">
          <RotateCcw className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">
            Tienes una venta guardada
          </AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>
              No se carga sola: pulsa recuperar para continuar con esa venta o empieza otra abajo.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-700 text-amber-900 shrink-0"
              onClick={handleRecoverSavedSale}
              disabled={isProcessing}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Recuperar venta guardada
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Columna izquierda: información de la venta */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información de la venta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canPickSavedCustomer && (
                <SavedCustomerMany2One
                  valueId={pickedCustomerId}
                  linkedDisplayName={customer}
                  onPick={(row) => {
                    setPickedCustomerId(String(row.id))
                    setCustomer(row.name)
                    setCustomerNit(row.taxId ?? '')
                    setIsFinalConsumer(false)
                  }}
                  onClear={() => {
                    setPickedCustomerId('__none__')
                  }}
                  canCreateContact={canCreateClientContact}
                />
              )}
              <div>
                <Label htmlFor="customer">Cliente *</Label>
                <Input
                  id="customer"
                  placeholder="Nombre o razón social"
                  value={customer}
                  onChange={(e) => {
                    setCustomer(e.target.value)
                    setPickedCustomerId('__none__')
                  }}
                />
              </div>
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
                  disabled={isFinalConsumer}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cf"
                  checked={isFinalConsumer}
                  onChange={(e) => {
                    setIsFinalConsumer(e.target.checked)
                    if (e.target.checked) setCustomerNit('')
                  }}
                  className="rounded"
                />
                <Label htmlFor="cf">Consumidor final (CF)</Label>
              </div>
              <div>
                <Label>Canal de venta</Label>
                <Select
                  value={salesChannel}
                  onValueChange={(v) => {
                    if (v === 'WHOLESALE' || v === 'ONLINE' || v === 'POS') setSalesChannel(v)
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POS">Mostrador (POS)</SelectItem>
                    <SelectItem value="WHOLESALE">Mayoreo / ruta</SelectItem>
                    <SelectItem value="ONLINE">En línea</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Define lista, mayoreo o promoción según precios del producto y reglas del cliente.
                </p>
              </div>
              <div>
                <Label>Método de pago *</Label>
                <Select
                  value={paymentMethod ? String(paymentMethod.id) : ''}
                  onValueChange={(val) => {
                    const found = paymentMethods.find((pm) => String(pm.id) === val)
                    setPaymentMethod(found ?? null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={String(pm.id)}>
                        {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod?.name?.toLowerCase() === 'efectivo' && (
                <div>
                  <Label htmlFor="amount">Monto recibido</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    min={displayTotal}
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    step="0.01"
                  />
                  {amountReceived && parseFloat(amountReceived) >= displayTotal && (
                    <p className="text-sm text-primary mt-1">
                      Vuelto: {fmt(changeAmount)}
                    </p>
                  )}
                  {amountReceived && !Number.isNaN(parseFloat(amountReceived)) && parseFloat(amountReceived) < displayTotal && (
                    <p className="text-sm text-destructive mt-1">
                      El monto debe ser mayor o igual al total a pagar ({fmt(displayTotal)}).
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carrito y total */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Productos en la venta ({cart.cartItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.cartItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Agrega productos desde la lista de la derecha
                </p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {cart.cartItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between items-center text-sm py-1 border-b border-border/50"
                    >
                      <span className="truncate flex-1">{item.name}</span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => cart.updateQuantity(item.id, item.qty - 1)}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          className="w-14 h-7 px-2 text-center text-sm"
                          value={item.qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || '0', 10)
                            if (!Number.isNaN(val) && val > 0) {
                              cart.updateQuantity(item.id, val)
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => cart.updateQuantity(item.id, item.qty + 1)}
                        >
                          +
                        </Button>
                        <span className="w-24 text-right">
                          {fmt(item.qty * item.price)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => cart.removeFromCart(item.id)}
                        >
                          ×
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {promotions.appliedPromotions?.length ? (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Descuentos aplicados</p>
                  <p className="text-green-600 font-medium">
                    -{fmt(promotions.totalDiscount ?? 0)}
                  </p>
                </div>
              ) : null}
              {vatRegime === 'general' && displayTotal > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground pt-2">
                  <span>IVA incluido ({ivaRate}%)</span>
                  <span>{fmt(displayTotal - displayTotal / (1 + ivaRate / 100))}</span>
                </div>
              )}
              <div className={`flex justify-between font-semibold text-lg ${vatRegime === 'general' ? '' : 'pt-2'}`}>
                <span>Total</span>
                <span>{fmt(displayTotal)}</span>
              </div>
            </CardContent>
          </Card>

          {!loadedOrder && (
          <PromotionCodeInput
            appliedPromotions={promotions.appliedPromotions ?? []}
            totalDiscount={promotions.totalDiscount ?? 0}
            isValidating={promotions.isValidating ?? false}
            onApplyCode={promotions.applyCode}
            onRemovePromotion={promotions.removePromotion}
          />

          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 border-dashed"
              onClick={handleSaveForLater}
              disabled={isProcessing || (!cart.cartItems.length && !customer.trim())}
            >
              <PauseCircle className="w-4 h-4 mr-2" />
              Guardar y continuar después
            </Button>
            <Button
              className="flex-1 bg-primary"
              onClick={handleSubmit}
              disabled={
                cart.cartItems.length === 0 ||
                !paymentMethod ||
                isProcessing ||
                (paymentMethod?.name?.toLowerCase() === 'efectivo' &&
                  (!amountReceived ||
                    Number.isNaN(parseFloat(amountReceived)) ||
                    parseFloat(amountReceived) < displayTotal))
              }
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  Procesando...
                </span>
              ) : (
                <>
                  <Receipt className="w-4 h-4 mr-2" />
                  Registrar venta
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Columna derecha: productos en cards */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o código de barras..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      setProductPage(1)
                    }}
                    className="pl-9"
                  />
                </div>
                <div
                  className="flex items-center border rounded-md bg-background/80 shrink-0 self-end sm:self-auto"
                  role="group"
                  aria-label="Forma de ver productos"
                >
                  <Button
                    type="button"
                    variant={productLayout === 'flat' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-9 rounded-r-none gap-1.5 px-3"
                    onClick={() => {
                      setProductLayout('flat')
                      setSelectedCategoryName(null)
                    }}
                    aria-pressed={productLayout === 'flat'}
                    title="Lista de todos los productos"
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Lista</span>
                  </Button>
                  <Button
                    type="button"
                    variant={productLayout === 'byCategory' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-9 rounded-l-none gap-1.5 px-3"
                    onClick={() => {
                      setProductLayout('byCategory')
                      setSelectedCategoryName(null)
                    }}
                    aria-pressed={productLayout === 'byCategory'}
                    title="Primero elegir categoría"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Categorías</span>
                  </Button>
                </div>
              </div>
              {productLayout === 'byCategory' && selectedCategoryName && !isProductSearchActive ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit h-8 px-2 -ml-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedCategoryName(null)
                    setProductPage(1)
                  }}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Todas las categorías
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Solo se muestran productos marcados como disponibles para la venta. Puedes cambiarlo en el detalle del
                producto en Inventario.
                {productLayout === 'byCategory' && !isProductSearchActive && !selectedCategoryName ? (
                  <span className="block mt-1">
                    Elige una categoría para ver sus productos.
                  </span>
                ) : null}
                {productLayout === 'byCategory' && isProductSearchActive ? (
                  <span className="block mt-1">
                    Con búsqueda activa se muestran coincidencias en todas las categorías.
                  </span>
                ) : null}
              </p>
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
              {productsQuery.isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-8 text-center text-muted-foreground">
                  Cargando productos...
                </div>
              ) : showCategoryPicker ? (
                categorySummaries.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No hay categorías con productos que coincidan
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
                    {categorySummaries.map((cat) => (
                      <CategoryBrowseCard
                        key={cat.name}
                        name={cat.name}
                        count={cat.count}
                        imageUrl={cat.imageUrl}
                        disabled={isProcessing}
                        onSelect={() => {
                          setSelectedCategoryName(cat.name)
                          setProductPage(1)
                        }}
                      />
                    ))}
                  </div>
                )
              ) : browseProducts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No hay productos que coincidan
                </div>
              ) : (
                <>
                  {productLayout === 'byCategory' && selectedCategoryName && !isProductSearchActive ? (
                    <p className="text-sm font-medium text-foreground mb-3">{selectedCategoryName}</p>
                  ) : null}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
                    {pageProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAdd={() => void addProduct(product)}
                        disabled={isProcessing}
                        formatPrice={fmt}
                        displayUnitPrice={getUnitPrice(product)}
                        availableQty={availabilityById[product.id]?.available ?? product.stock}
                        physicalStock={availabilityById[product.id]?.stock ?? product.stock}
                        posQty={posLocationId ? availabilityById[product.id]?.location_stock ?? null : null}
                        posMode={Boolean(posLocationId)}
                      />
                    ))}
                  </div>
                  {!showCategoryPicker ? (
                  <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Productos por página:</span>
                      <Select
                        value={String(productPageSize)}
                        onValueChange={(v) => { setProductPageSize(Number(v)); setProductPage(1); }}
                      >
                        <SelectTrigger className="w-[72px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[9, 18, 36, 54].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Página {safePage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProductPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={elsewhere !== null} onOpenChange={(o) => !o && cerrarElsewhere()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {/* El nombre va en las dos ramas: sin él, dos avisos seguidos de
                  productos distintos se ven idénticos. */}
              {elsewhereView == null
                ? ''
                : elsewhereView.atPos === 0
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
                if (elsewhere) cart.addToCart(elsewhere.product)
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
        <AlertDialogContent>
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

      <Dialog open={loadOrderOpen} onOpenChange={setLoadOrderOpen}>
        <DialogContent>
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
