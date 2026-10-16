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
 * ProductManagement - Refactored main component
 * 
 * This component orchestrates the product management feature.
 * Logic is extracted into custom hooks, UI into sub-components.
 */
import { Fragment, useState, useMemo, useEffect } from 'react'
import { useModules } from '@/context/useModules'
import { inventoryModule } from '../manifest'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Plus, Search, ScanLine, Download,
    QrCode, Upload, LayoutGrid, Package, Eye, Pencil,
    ClipboardList, ChevronDown, RotateCcw, CalendarClock, MoveRight, Store,
    Table2, Printer,
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import type { Product } from '@/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProducts, PRODUCTS_QUERY_KEY } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { adaptApiProduct, addProductToBranch, fetchAllProducts } from '@/services/productService'
import { fetchWarehouses } from '@/services/warehouseService'
import { fetchStockByLocation } from '@/services/stockMoveService'
import { useTenant } from '@/context/useTenant'
import { Pagination } from '@/components/shared/Pagination'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { ModuleTabBar } from '@/components/shared/ModuleTabs'
import './productList.css'
import { useCardPagination } from '@/hooks/useCardPagination'
import { recordCardNavigation } from '@/components/shared/recordCardNavigation'

function ProductListImage({ product, className }: { product: Product; className?: string }) {
    const [failedSource, setFailedSource] = useState<string | null>(null)
    const imageSource = product.imageUrl && failedSource !== product.imageUrl ? product.imageUrl : '/placeholder.svg'
    return <div className={'flex items-center justify-center overflow-hidden rounded-lg ' + (className || '')}>
        <img src={imageSource} alt={imageSource === '/placeholder.svg' ? 'Sin imagen de ' + product.name : product.name} loading="lazy" className="h-full w-full object-contain" onError={imageSource !== '/placeholder.svg' ? () => setFailedSource(product.imageUrl!) : undefined} />
    </div>
}

// Feature imports
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { formatMoney } from '@/utils'

const PAGE_SIZES = [10, 20, 30, 40]

/** Dónde está lo que hay de un producto. Se consulta al abrir, no antes. */
const StockBreakdownRow = ({ productId }: { productId: string }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['stock-by-location', productId],
        queryFn: () => fetchStockByLocation(productId),
        staleTime: 30_000,
    })
    return (
        <tr id={'stock-locations-' + productId} className="border-b border-border bg-muted/40">
            <td colSpan={7} className="px-3 py-2">
                {isLoading ? (
                    <LoadingIndicator message="Cargando ubicaciones…" />
                ) : !data?.length ? (
                    <span className="text-xs text-muted-foreground">Sin existencias en ninguna ubicación.</span>
                ) : (
                    <div className="space-y-1">
                        {data.map((r) => (
                            <div key={r.location.id} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                    {r.location.warehouse.branch ? `${r.location.warehouse.branch.name} · ` : ''}
                                    {r.location.warehouse.name} · <span className="font-mono">{r.location.code}</span>
                                </span>
                                <span className="font-medium text-foreground">{r.stock}</span>
                            </div>
                        ))}
                    </div>
                )}
            </td>
        </tr>
    )
}

/** Columnas con las que abre el diálogo de exportación. */
const DEFAULT_EXPORT_COLUMNS = [
    'name', 'category', 'brand', 'size', 'price', 'price_wholesale', 'price_promotion', 'stock',
]

const ProductManagement = () => {
    const navigate = useNavigate()
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const { company, branches } = useTenant()
    const { hasPermission } = useAuthPermissions()
    const catalogModules = useModules()
    const { locale, currencyCode, inventoryServicesEnabled } = useSystemSettings()
    const [searchParams, setSearchParams] = useSearchParams()
    const serviceCatalog = inventoryServicesEnabled && searchParams.get('tipo') === 'services'
    const catalogType = serviceCatalog ? 'services' : 'goods'
    usePageTrail(serviceCatalog ? [{label:'Servicios'}] : [])
    const fmt = (n: number) => formatMoney(n, locale, currencyCode)

    // Filter state
    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')

    const {
        page: currentPage,
        setPage: setCurrentPage,
        pageSize: tablePageSize,
        setPageSize,
        viewMode,
        setViewMode,
    } = usePersistedListUiState('inventario/productos', { defaultPageSize: 10, defaultView: 'cards', pageSizeOptions: PAGE_SIZES })

    // Dialog states
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
    const EXPORT_COLUMNS: { id: string; label: string }[] = [
        { id: 'name', label: 'Nombre' },
        { id: 'category', label: 'Categoría' },
        { id: 'brand', label: 'Marca' },
        { id: 'size', label: 'Tamaño' },
        { id: 'barcode', label: 'Código de barras' },
        { id: 'price', label: 'Precio lista' },
        { id: 'price_wholesale', label: 'Precio mayoreo' },
        { id: 'price_promotion', label: 'Promoción (y vigencia)' },
        { id: 'cost', label: 'Costo' },
        { id: 'stock', label: 'Stock' },
        { id: 'min_stock', label: 'Stock mínimo' },
        { id: 'supplier', label: 'Proveedor' },
        { id: 'status', label: 'Estado' },
        { id: 'description', label: 'Descripción' },
        { id:'kind',label:'Tipo' },{ id:'service_unit_label',label:'Unidad de cobro' },{ id:'quantity_decimals',label:'Decimales' },
    ].filter(column=>!serviceCatalog || !['brand','size','cost','stock','min_stock','supplier'].includes(column.id))
    const [exportIncludeSummary, setExportIncludeSummary] = useState(true)

    // Selección para exportar (IDs de productos)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [selectingAllPages, setSelectingAllPages] = useState(false)

    const [scannedCode, setScannedCode] = useState('')
    // Alcance de la pantalla: el inventario es de la empresa y se acota aquí, no
    // con el selector global (que sigue mandando en ventas, caja y traslados).
    const [scopeBranch, setScopeBranch] = useState('all')
    const [scopeWarehouse, setScopeWarehouse] = useState('all')
    const [scopeLocation, setScopeLocation] = useState('all')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    // Con una sucursal elegida: solo lo que esa sucursal maneja, o todo el catálogo.
    const [inBranchOnly, setInBranchOnly] = useState(true)
    const activeAdvancedFilters = [
        categoryFilter !== 'all',
        scopeBranch !== 'all',
        scopeWarehouse !== 'all',
        scopeLocation !== 'all',
    ].filter(Boolean).length

    const resetAdvancedFilters = () => {
        setCategoryFilter('all')
        setScopeBranch('all')
        setScopeWarehouse('all')
        setScopeLocation('all')
        setInBranchOnly(true)
    }

    const cardPagination = useCardPagination({ enabled: viewMode === 'cards', tablePageSize, onPageChange: setCurrentPage })
    const pageSize = cardPagination.pageSize
    const pageSizeOptions = viewMode === 'cards' ? cardPagination.pageSizeOptions : PAGE_SIZES

    // Data hooks
    const { data: productsData, isLoading, isFetching, isError } = useProducts({
        catalogType,
        includeSummary: true,
        page: currentPage,
        pageSize: pageSize,
        search: searchTerm || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        branchId: serviceCatalog ? undefined : scopeBranch,
        warehouseId: !serviceCatalog && scopeWarehouse !== 'all' ? scopeWarehouse : undefined,
        locationId: !serviceCatalog && scopeLocation !== 'all' ? scopeLocation : undefined,
        inBranchOnly: !serviceCatalog && scopeBranch !== 'all' && inBranchOnly ? true : undefined,
    })
    const { data: categoriesData } = useCategories()
    const products = useMemo(() => {
        if (!productsData?.items) return []
        return productsData.items.map(adaptApiProduct)
    }, [productsData])
    // Categories list
    const categories = useMemo(() => {
        const base = ['all'] as string[]
        if (Array.isArray(categoriesData) && categoriesData.length) {
            return base.concat(categoriesData.map(c => String(c.name)))
        }
        return base.concat(['Whisky', 'Vinos', 'Cervezas', 'Rones', 'Vodkas', 'Tequilas', 'Ginebras'])
    }, [categoriesData])

    useResetPageOnFilterChange(setCurrentPage, [
        searchTerm, categoryFilter, pageSize, inBranchOnly, scopeBranch, scopeWarehouse, scopeLocation, catalogType,
    ])

    // Almacenes del alcance elegido (y sus ubicaciones, ya en plano).
    const { data: scopeWarehouses = [] } = useQuery({
        queryKey: ['warehouses', 'scope', scopeBranch],
        queryFn: () => fetchWarehouses(scopeBranch),
        enabled: !serviceCatalog,
    })
    const scopeLocations = useMemo(
        () =>
            scopeWarehouses
                .filter((w) => scopeWarehouse === 'all' || w.id === scopeWarehouse)
                .flatMap((w) => w.locations.map((l) => ({ ...l, warehouse: w.name }))),
        [scopeWarehouses, scopeWarehouse]
    )

    /** Cómo se llama lo que se está viendo; va en el aviso y en el archivo. */
    const scopeLabel = useMemo(() => {
        const partes = [
            scopeBranch === 'all'
                ? 'todas las sucursales'
                : branches.find((b) => b.id === scopeBranch)?.name ?? 'la sucursal',
        ]
        const alm = scopeWarehouses.find((w) => w.id === scopeWarehouse)
        if (alm) partes.push(alm.name)
        const ubi = scopeLocations.find((l) => l.id === scopeLocation)
        if (ubi) partes.push(ubi.code)
        return partes.join(' · ')
    }, [scopeBranch, scopeWarehouse, scopeLocation, branches, scopeWarehouses, scopeLocations])


    // Products are already filtered and paginated by the backend
    const paginatedProducts = products
    const totalPages = productsData?.totalPages || 1
    const totalItems = productsData?.totalItems || 0

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
    const onPageIds = useMemo(() => paginatedProducts.map((p) => p.id), [paginatedProducts])
    const allOnPageSelected = onPageIds.length > 0 && onPageIds.every((id) => selectedSet.has(id))
    const someOnPageSelected = onPageIds.some((id) => selectedSet.has(id))

    const toggleSelection = (id: string) => {
        setSelectedIds((prev) => (selectedSet.has(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    }
    const toggleSelectAllOnPage = () => {
        if (allOnPageSelected) setSelectedIds((prev) => prev.filter((id) => !onPageIds.includes(id)))
        else setSelectedIds((prev) => [...new Set([...prev, ...onPageIds])])
    }
    const handleSelectAllPages = async () => {
        setSelectingAllPages(true)
        try {
            const all = await fetchAllProducts({catalogType})
            setSelectedIds(all.map((p) => p.id))
            toast({ title: 'Seleccionados', description: `${all.length} productos de todas las páginas` })
        } catch {
            toast({ title: 'Error', description: 'No se pudo cargar la lista completa', variant: 'destructive' })
        } finally {
            setSelectingAllPages(false)
        }
    }

    // Permisos
    const canImport = hasPermission('products.import')
    // Exportar usa su permiso dedicado (antes exigía products.import, que es otra cosa)
    const canExport = hasPermission('products.export', 'reports.view')
    const canCreate = hasPermission('products.create')
    const canDelete = hasPermission('products.delete')
    const canRegisterIncoming = hasPermission('products.register_incoming')
    const canEdit = hasPermission('products.edit', 'products.create')
    const canEditProduct = hasPermission('products.edit')

    // Empezar a manejar aquí un producto del catálogo de la empresa.
    const addToBranchMutation = useMutation({
        mutationFn: (product: Product) => addProductToBranch(product.id),
        onSuccess: (_r, product) => {
            toast({
                title: `${product.name} ya se maneja aquí`,
                description: 'Arranca en 0: regístrale un ingreso o muévelo desde otra sucursal.',
            })
            void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
        },
        onError: (e: Error) =>
            toast({ title: 'No se pudo agregar', description: e.message, variant: 'destructive' }),
    })
    const canInventoryCount = hasPermission(
        'inventory_count.view',
        'inventory_count.count',
        'inventory_count.create'
    )
    const canSeeStockMoves = hasPermission('stock_moves.view', 'stock_moves.create')
    const hasFileActions = canExport || canImport
    const hasStockActions = !serviceCatalog && (canRegisterIncoming || canInventoryCount)

    /**
     * Exporta lo que se está viendo: mismo alcance y mismos filtros que la
     * lista. Con productos seleccionados manda la selección.
     */
    const handleExport = async (
        fields?: string[],
        ids?: string[],
        includeSummary?: boolean,
        format: 'pdf' | 'csv' = 'pdf',
        fileName?: string,
    ) => {
        if (!canExport) return
        try {
            const svc = await import('@/services/productService')
            await svc.exportProducts({
                format,
                fileName,
                ...(fields?.length ? { fields } : {}),
                ...(ids?.length ? { ids } : {}),
                ...(includeSummary === false ? { includeSummary: false } : {}),
                scope: {
                    catalogType,
                    branchId: serviceCatalog ? undefined : scopeBranch,
                    warehouseId: scopeWarehouse !== 'all' ? scopeWarehouse : undefined,
                    locationId: scopeLocation !== 'all' ? scopeLocation : undefined,
                    search: searchTerm || undefined,
                    category: categoryFilter,
                    inBranchOnly: scopeBranch !== 'all' && inBranchOnly,
                },
            })
            setIsExportDialogOpen(false)
            toast({
                title: 'Exportado',
                description: `Se descargó ${format === 'csv' ? 'el CSV' : 'el PDF'} de ${scopeLabel}.`,
            })
        } catch (err: unknown) {
            const message = (err as { message?: string })?.message || 'No se pudo descargar el reporte'
            toast({ title: 'Error', description: message, variant: 'destructive' })
        }
    }

    // Status badge helper
    const getStatusBadge = (product: Product) => {
        if (product.kind === 'SERVICE') return <Badge variant="secondary" className={product.availableForSale !== false ? 'border-0 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : undefined}>{product.availableForSale !== false ? 'Disponible para venta' : 'No disponible'}</Badge>
        if (product.inBranch === false) return <Badge variant="outline">No se maneja aquí</Badge>
        if (product.stock === 0 || product.status === 'out_of_stock') {
            return <Badge variant="destructive">Sin Stock</Badge>
        } else if (product.stock <= product.minStock || product.status === 'low_stock') {
            return <Badge className="border-0 bg-amber-500/15 text-amber-800 dark:text-amber-300">Stock Bajo</Badge>
        }
        return <Badge className="border-0 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">Disponible</Badge>
    }

    // View/Edit handlers
    const viewProduct = (product: Product) => {
        navigate(`/inventario/${product.id}`)
    }

    const searchByBarcode = () => {
        if (!scannedCode) return
        const product = products.find(p => p.barcode === scannedCode)
        if (product) {
            viewProduct(product)
            setIsScannerOpen(false)
            setScannedCode('')
        } else {
            toast({ title: 'Producto No Encontrado', description: 'No se encontró un producto con ese código', variant: 'destructive' })
        }
    }

    const productActions = (product: Product) => <div className="flex w-max flex-nowrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="icon" title="Ver detalles" aria-label={'Ver detalles de ' + product.name} onClick={() => viewProduct(product)}><Eye className="h-4 w-4" aria-hidden="true" /></Button>
        {canEditProduct && <Button type="button" variant="outline" size="icon" title="Editar producto" aria-label={'Editar ' + product.name} onClick={() => navigate('/inventario/' + product.id + '?editar=1')}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>}
    </div>

    return (
        <div className="inventory-products-page mx-auto w-full max-w-[1560px] min-w-0 p-4 sm:p-8 space-y-5">
            {/* Header */}
            <h1 className="sr-only">Inventario</h1>
            {inventoryServicesEnabled && <ModuleTabBar items={[{value:'goods',label:'Bienes'},{value:'services',label:'Servicios'}]} value={catalogType} ariaLabel="Tipo de catálogo" onValueChange={value=>{const next=new URLSearchParams(searchParams);next.set('tipo',value);setSearchParams(next);setCurrentPage(1);setSelectedIds([]);resetAdvancedFilters()}} />}

            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Escáner de códigos</DialogTitle>
                        <DialogDescription>Ingrese el código de barras manualmente</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="text-center">
                            <QrCode className="w-24 h-24 mx-auto text-muted-foreground mb-4" />
                        </div>
                        <div>
                            <Label htmlFor="scannedCode">Código de barras</Label>
                            <Input
                                id="scannedCode"
                                placeholder="7501001234567"
                                value={scannedCode}
                                onChange={(e) => setScannedCode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && searchByBarcode()}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setIsScannerOpen(false)}>
                                Cancelar
                            </Button>
                            <Button className="flex-1" onClick={searchByBarcode}>
                                Buscar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <MetricStrip label={serviceCatalog ? 'Resumen de servicios' : 'Resumen de productos'} loading={isLoading} items={(serviceCatalog ? [['total','Servicios'],['forSale','Disponibles para venta'],['notForSale','No disponibles'],['fractional','Con cantidades fraccionadas']] : [['total', 'Productos'], ['forSale', 'Disponibles para venta'], ['kits', 'Kits'], ['tracksExpiry', 'Con caducidad']]).map(([key, label]) => ({ label, value: isError ? '—' : productsData?.summary?.[key] ?? '—' }))} />

            <div className="space-y-3">

                <CompactFilterPanel actions={<div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5 min-w-[7.5rem] sm:min-w-0"
                                aria-label="Menú de acciones del inventario"
                            >
                                Acciones
                                <ChevronDown className="h-4 w-4 opacity-70 shrink-0" aria-hidden />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {!catalogModules.isLoading && !catalogModules.isError && catalogModules.enabledModuleCodes?.has('catalogs') && hasPermission('catalogs.view', 'catalogs.manage') && <DropdownMenuItem onClick={() => navigate(inventoryModule.paths.categories)}>Categorías</DropdownMenuItem>}
                            {!serviceCatalog && canExport && (
                                <DropdownMenuItem onClick={() => navigate('/inventario/codigos-de-barras', { state: { selectedIds, companyId:company?.id, filters:{branchId:scopeBranch!=='all'?scopeBranch:scopeWarehouses.find(w=>w.id===scopeWarehouse)?.branch_id,inBranch:scopeBranch!=='all'&&inBranchOnly,warehouseId:scopeWarehouse!=='all'?scopeWarehouse:undefined,locationId:scopeLocation!=='all'?scopeLocation:undefined} } })}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Imprimir códigos de barras
                                </DropdownMenuItem>
                            )}
                            {!serviceCatalog && canExport && (
                                <DropdownMenuItem onClick={() => navigate('/inventario/etiquetas-de-precio', { state: { selectedIds, companyId:company?.id, filters:{branchId:scopeBranch!=='all'?scopeBranch:scopeWarehouses.find(w=>w.id===scopeWarehouse)?.branch_id,inBranch:scopeBranch!=='all'&&inBranchOnly,warehouseId:scopeWarehouse!=='all'?scopeWarehouse:undefined,locationId:scopeLocation!=='all'?scopeLocation:undefined} } })}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Imprimir etiquetas de precio
                                </DropdownMenuItem>
                            )}
                            {hasFileActions && (
                                <>
                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                        Importar / exportar
                                    </DropdownMenuLabel>
                                    {canExport && (
                                        <DropdownMenuItem onClick={() => setIsExportDialogOpen(true)}>
                                            <Download className="mr-2 h-4 w-4" />
                                            Exportar
                                        </DropdownMenuItem>
                                    )}
                                    {canImport && (
                                        <DropdownMenuItem onClick={() => navigate('/inventario/importar')}>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Importar
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                            {hasFileActions && hasStockActions && <DropdownMenuSeparator />}
                            {hasStockActions && (
                                <>
                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                        Almacén
                                    </DropdownMenuLabel>
                                    {canRegisterIncoming && (
                                        <DropdownMenuItem
                                            onClick={() => navigate('/inventario/registrar-ingreso')}
                                        >
                                            <Package className="mr-2 h-4 w-4" />
                                            Registrar ingreso
                                        </DropdownMenuItem>
                                    )}
                                    {canInventoryCount && (
                                        <DropdownMenuItem onClick={() => navigate('/inventario/inventariado')}>
                                            <ClipboardList className="mr-2 h-4 w-4" />
                                            Inventariado
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                            {canDelete && (
                                <>
                                    {(hasFileActions || hasStockActions) && <DropdownMenuSeparator />}
                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                        Productos
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => navigate(serviceCatalog ? '/inventario/eliminados?tipo=services' : '/inventario/eliminados')}>
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Productos eliminados
                                    </DropdownMenuItem>
                                </>
                            )}
                            {(hasFileActions || hasStockActions || canDelete) && <DropdownMenuSeparator />}
                            {!serviceCatalog && <DropdownMenuItem onClick={() => navigate('/inventario/lotes')}>
                                <CalendarClock className="mr-2 h-4 w-4" />
                                Lotes y caducidades
                            </DropdownMenuItem>}
                            {!serviceCatalog && canSeeStockMoves && (
                                <DropdownMenuItem onClick={() => navigate('/inventario/movimientos')}>
                                    <MoveRight className="mr-2 h-4 w-4" />
                                    Movimientos internos
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setIsScannerOpen(true)}>
                                <ScanLine className="mr-2 h-4 w-4" />
                                Escanear código
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {canCreate && (
                        <Button size="sm" className="shrink-0 gap-1.5" onClick={() => navigate(serviceCatalog ? '/inventario/nuevo?tipo=services' : '/inventario/nuevo')}>
                            <Plus className="h-4 w-4 shrink-0" />
                            <span className="sm:hidden">Nuevo</span>
                            <span className="hidden sm:inline">{serviceCatalog ? 'Nuevo servicio' : 'Nuevo producto'}</span>
                        </Button>
                    )}
                </div>} search={<div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <Input aria-label="Buscar productos" placeholder="Buscar por nombre, marca o código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                        </div>} title="Alcance del inventario" summary="Categoría, sucursal, almacén y ubicación" activeCount={activeAdvancedFilters} onClear={resetAdvancedFilters} appliedFilters={[...(categoryFilter !== 'all' ? [{label: `Categoría: ${categoryFilter}`,onRemove: () => setCategoryFilter('all')}] : []),...(scopeBranch !== 'all' ? [{label: `Sucursal: ${branches.find(b => b.id === scopeBranch)?.name || 'Seleccionada'}`,onRemove: () => {setScopeBranch('all');setScopeWarehouse('all');setScopeLocation('all')}}] : []),...(scopeWarehouse !== 'all' ? [{label: `Almacén: ${scopeWarehouses.find(w => w.id === scopeWarehouse)?.name || 'Seleccionado'}`,onRemove: () => {setScopeWarehouse('all');setScopeLocation('all')}}] : []),...(scopeLocation !== 'all' ? [{label: `Ubicación: ${scopeLocations.find(l => l.id === scopeLocation)?.code || 'Seleccionada'}`,onRemove: () => setScopeLocation('all')}] : [])]} contentClassName="flex flex-wrap items-center gap-3">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="min-w-48 flex-1"><SelectValue placeholder="Categoría" /></SelectTrigger><SelectContent>{categories.map(category => <SelectItem key={category} value={category}>{category === 'all' ? 'Todas las categorías' : category}</SelectItem>)}</SelectContent></Select>
                    {!serviceCatalog && <><Select value={scopeBranch} onValueChange={(v) => { setScopeBranch(v); setScopeWarehouse('all'); setScopeLocation('all') }}><SelectTrigger className="min-w-48 flex-1"><Store className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las sucursales</SelectItem>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select>
                    {scopeWarehouses.length > 1 && <Select value={scopeWarehouse} onValueChange={(v) => { setScopeWarehouse(v); setScopeLocation('all') }}><SelectTrigger className="min-w-48 flex-1"><SelectValue placeholder="Almacén" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los almacenes</SelectItem>{scopeWarehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{scopeBranch === 'all' && warehouse.branch ? `${warehouse.branch.name} · ` : ''}{warehouse.name}</SelectItem>)}</SelectContent></Select>}
                    {scopeLocations.length > 1 && <Select value={scopeLocation} onValueChange={setScopeLocation}><SelectTrigger className="min-w-48 flex-1"><SelectValue placeholder="Ubicación" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las ubicaciones</SelectItem>{scopeLocations.map((location) => <SelectItem key={location.id} value={location.id}>{scopeWarehouse === 'all' ? `${location.warehouse} · ` : ''}{location.code}</SelectItem>)}</SelectContent></Select>}
                    {scopeBranch !== 'all' && <div className="flex min-h-10 items-center gap-2 whitespace-nowrap"><Switch id="in-branch-only" checked={inBranchOnly} onCheckedChange={setInBranchOnly} /><Label htmlFor="in-branch-only" className="text-sm font-normal">Solo lo que maneja</Label></div>}
                    </>}
                </CompactFilterPanel>
            </div>

            <section className="auna-surface-flat min-w-0 space-y-4" aria-labelledby="inventory-results-heading">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="inventory-results-heading" className="text-base font-semibold">{serviceCatalog ? 'Servicios' : 'Productos'} <span className="font-normal text-muted-foreground">({totalItems})</span></h2>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">Filas por página
                            <Select value={String(pageSize)} onValueChange={(value) => { if (viewMode === 'cards') cardPagination.setCardPageSize(Number(value)); else setPageSize(Number(value)); setCurrentPage(1); }}>
                                <SelectTrigger className="w-20" aria-label="Productos por página"><SelectValue /></SelectTrigger>
                                <SelectContent>{pageSizeOptions.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
                            </Select>
                        </label>
                        <ModuleTabBar items={[{ value: 'table', label: '', ariaLabel: 'Tabla', icon: Table2 }, { value: 'cards', label: '', ariaLabel: 'Tarjetas', icon: LayoutGrid }]} value={viewMode} ariaLabel="Vista de productos" onValueChange={(value) => { setViewMode(value); if (value === 'cards') setSelectedIds([]) }} />
                    </div>
                </div>
                {isLoading && <LoadingState variant={viewMode === 'table' ? 'table' : 'cards'} columns={['Selección', 'Producto', 'Categoría', 'Stock', 'Precio', 'Estado', 'Acciones']} message="Cargando productos…" />}
                {isFetching && !isLoading && <LoadingIndicator message="Actualizando productos…" />}
                {isError && !isLoading && <div role="alert" className="py-8 text-center text-destructive">Error al cargar productos.</div>}
                {!isLoading && !isError && <>
                    {viewMode === 'table' && selectedIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 border-y border-border py-3">
                            <span className="text-sm font-medium">{selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}</span>
                            <Button type="button" variant="outline" onClick={handleSelectAllPages} disabled={selectingAllPages}>{selectingAllPages ? 'Cargando…' : 'Seleccionar todos (todas las páginas)'}</Button>
                            <Button type="button" variant="ghost" onClick={() => setSelectedIds([])}>Limpiar selección</Button>
                        </div>
                    )}
                    {paginatedProducts.length === 0 ? (
                        <div role="status" className="py-12 text-center text-sm text-muted-foreground">No hay productos para mostrar.</div>
                    ) : viewMode === 'table' ? (
                        <div className="auna-data-table-shell">
                            <div className="product-results-scroll" role="region" aria-label="Productos del inventario" tabIndex={0}>
                                <table className="auna-data-table product-list-table">
                                    <caption className="sr-only">Productos, precios y existencias del alcance seleccionado</caption>
                                    <thead><tr>
                                        <th scope="col" className="w-10"><Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectAllOnPage} aria-label="Seleccionar todos de esta página" /></th>
                                        <th scope="col">{serviceCatalog ? 'Servicio' : 'Producto'}</th><th scope="col">Categoría</th><th scope="col" className="text-center">{serviceCatalog ? 'Unidad de cobro' : 'Stock'}</th>
                                        <th scope="col" className="text-right">Precio</th><th scope="col">Estado</th><th scope="col" className="text-right">Acciones</th>
                                    </tr></thead>
                                    <tbody>{paginatedProducts.map(product => <Fragment key={product.id}>
                                        <tr>
                                            <td><Checkbox checked={selectedSet.has(product.id)} onCheckedChange={() => toggleSelection(product.id)} aria-label={'Seleccionar ' + product.name} /></td>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <ProductListImage product={product} className="h-10 w-10 shrink-0" />
                                                    <div className="min-w-0">
                                                        <Button variant="link" className="h-auto justify-start whitespace-normal p-0 text-left font-semibold text-foreground" onClick={() => viewProduct(product)}>{product.name}</Button>
                                                        <div className="product-list-metadata mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                                            <span>{product.barcode || 'Sin código'}</span>
                                                            {(product.brand || product.size) && <span>{[product.brand, product.size].filter(Boolean).join(' · ')}</span>}
                                                        </div>
                                                        {product.availableForSale === false && <Badge variant="secondary" className="mt-1">Solo inventario</Badge>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td><Badge variant="outline">{String(product.category)}</Badge></td>
                                            <td className="text-center">
                                                {product.kind === 'SERVICE' ? <span>{product.serviceUnitLabel}</span> : product.inBranch === false ? <div className="space-y-1">
                                                    <p className="text-xs text-muted-foreground">No se maneja aquí</p>
                                                    {canEdit && <Button variant="outline" disabled={addToBranchMutation.isPending} onClick={() => addToBranchMutation.mutate(product)}><Store className="h-4 w-4" aria-hidden="true" />Manejar aquí</Button>}
                                                </div> : <Button type="button" variant="ghost" className="h-auto gap-2" aria-label={'Ver ubicaciones de ' + product.name} aria-expanded={expandedId === product.id} aria-controls={'stock-locations-' + product.id} onClick={() => setExpandedId(id => id === product.id ? null : product.id)}>
                                                    <span className="tabular-nums"><span className="block font-semibold">{product.stock}</span><span className="block text-xs text-muted-foreground">Mín: {product.minStock}</span></span>
                                                    <ChevronDown className={expandedId === product.id ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} aria-hidden="true" />
                                                </Button>}
                                            </td>
                                            <td className="text-right tabular-nums"><strong className="font-semibold">{fmt(product.price)}</strong>{canCreate && product.kind !== 'SERVICE' && <p className="mt-1 text-xs text-muted-foreground">Costo: {fmt(product.cost)}</p>}</td>
                                            <td>{getStatusBadge(product)}</td>
                                            <td>{productActions(product)}</td>
                                        </tr>
                                        {product.kind !== 'SERVICE' && expandedId === product.id && <StockBreakdownRow productId={product.id} />}
                                    </Fragment>)}</tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="product-results-scroll" role="region" aria-label="Tarjetas de productos" tabIndex={0}>
                            <div ref={cardPagination.containerRef} className="auna-record-grid">
                                {paginatedProducts.map(product => (
                                    <Card key={product.id} className="product-card auna-surface auna-record-interactive h-full" {...recordCardNavigation(() => viewProduct(product))}>
                                        <CardContent className="auna-record-card product-card-content">
                                            <ProductListImage product={product} className="auna-record-media" />
                                            <div className="auna-record-content product-card-information">
                                                <div className="product-card-heading">
                                                    <strong className="min-w-0 text-sm font-semibold leading-snug">{product.name}</strong>
                                                    <div className="product-card-status">{getStatusBadge(product)}</div>
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                    <span className="break-all">{product.barcode || 'Sin código'}</span>
                                                    <Badge variant="outline">{String(product.category)}</Badge>
                                                    {product.availableForSale === false && <Badge variant="secondary">Solo inventario</Badge>}
                                                </div>
                                                {(product.brand || product.size) && <p className="mt-1 text-xs text-muted-foreground">{[product.brand, product.size].filter(Boolean).join(' · ')}</p>}
                                                <div className="product-card-numbers mt-2 grid grid-cols-2 items-end gap-2">
                                                    <div className="min-w-0 tabular-nums"><span className="sr-only">Precio</span><strong className="block text-base font-semibold">{fmt(product.price)}</strong>{canCreate && product.kind !== 'SERVICE' && <p className="text-xs text-muted-foreground">Costo: {fmt(product.cost)}</p>}</div>
                                                    <div className="text-right tabular-nums">{product.kind === 'SERVICE' ? <span className="text-xs text-muted-foreground">Por {product.serviceUnitLabel}</span> : product.inBranch === false ? <span className="text-xs text-muted-foreground">No se maneja aquí</span> : <><span className="block text-sm font-semibold">{product.stock} unidades</span><span className="block text-xs text-muted-foreground">Mín: {product.minStock}</span></>}</div>
                                                </div>
                                                {product.inBranch === false && canEdit && <Button variant="outline" className="mt-2 whitespace-normal" disabled={addToBranchMutation.isPending} onClick={() => addToBranchMutation.mutate(product)}><Store className="h-4 w-4 shrink-0" aria-hidden="true" />Manejar aquí</Button>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                    {productsData && <div className="auna-pagination-outside"><Pagination currentPage={productsData.page} totalPages={productsData.totalPages} totalItems={productsData.totalItems} count={paginatedProducts.length} pageSize={pageSize} itemLabel="productos" onPageChange={setCurrentPage} hasNextPage={productsData.nextPage !== null} hasPrevPage={productsData.prevPage !== null} loading={isFetching} /></div>}
                </>}
            </section>

            {/* Export PDF Dialog — columnas del reporte de inventario */}
            <ExportDialog
                open={isExportDialogOpen}
                onOpenChange={setIsExportDialogOpen}
                title="Exportar inventario"
                fileName="inventario"
                summary={
                    selectedIds.length > 0
                        ? `Se exportan los ${selectedIds.length} producto(s) seleccionados.`
                        : `Se exporta lo que estás viendo: ${scopeLabel}${searchTerm ? `, buscando "${searchTerm}"` : ''}${categoryFilter !== 'all' ? `, categoría ${categoryFilter}` : ''} (${totalItems} producto(s)).`
                }
                columns={EXPORT_COLUMNS}
                defaultColumns={serviceCatalog ? ['name','category','service_unit_label','quantity_decimals','price','status'] : DEFAULT_EXPORT_COLUMNS}
                presets={serviceCatalog ? [{label:'Servicios y precios',columns:['name','category','service_unit_label','price','price_wholesale','price_promotion']},{label:'Todas las columnas',columns:EXPORT_COLUMNS.map(column=>column.id)}] : [
                    {
                        label: 'Listado de precios',
                        columns: ['name', 'category', 'brand', 'size', 'price', 'price_wholesale', 'price_promotion', 'stock'],
                    },
                    { label: 'Todas las columnas', columns: EXPORT_COLUMNS.map((c) => c.id) },
                ]}
                extras={
                    <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                            checked={exportIncludeSummary}
                            onCheckedChange={(checked) => setExportIncludeSummary(checked === true)}
                        />
                        <span className="text-sm">
                            {serviceCatalog ? 'Incluir resumen de servicios' : 'Incluir resumen (productos registrados, unidades, valor del inventario)'}
                        </span>
                    </label>
                }
                secondaryAction={{
                    label: 'Vista de tarjetas (PDF completo)',
                    onClick: () =>
                        handleExport(undefined, selectedIds.length ? selectedIds : undefined, exportIncludeSummary),
                }}
                onExport={({ format, columns, fileName }) => {
                    if (format === 'xlsx') return // este diálogo ofrece PDF y CSV
                    handleExport(
                        columns?.length ? columns : undefined,
                        selectedIds.length ? selectedIds : undefined,
                        exportIncludeSummary,
                        format,
                        fileName,
                    )
                }}
            />
        </div>
    )
}

export default ProductManagement
