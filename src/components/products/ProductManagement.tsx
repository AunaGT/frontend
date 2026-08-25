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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Plus, Search, Filter, ScanLine, Download,
    QrCode, Upload, LayoutGrid, List, Package,
    ClipboardList, ChevronDown, RotateCcw, CalendarClock, MoveRight, Store,
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
import { ExportDialog } from '@/components/shared/ExportDialog'

// Feature imports
import { ImportDialog } from './components'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from '@/utils'

/** Dónde está lo que hay de un producto. Se consulta al abrir, no antes. */
const StockBreakdownRow = ({ productId }: { productId: string }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['stock-by-location', productId],
        queryFn: () => fetchStockByLocation(productId),
        staleTime: 30_000,
    })
    return (
        <tr className="border-b border-border bg-muted/40">
            <td colSpan={6} className="px-3 py-2">
                {isLoading ? (
                    <span className="text-xs text-muted-foreground">Cargando ubicaciones…</span>
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
    const { branches } = useTenant()
    const { hasPermission } = useAuthPermissions()
    const { locale, currencyCode } = useSystemSettings()
    const fmt = (n: number) => formatMoney(n, locale, currencyCode)

    // Filter state
    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')

    const {
        page: currentPage,
        setPage: setCurrentPage,
        pageSize,
        setPageSize,
        viewMode,
        setViewMode,
    } = usePersistedListUiState('inventario/productos', { defaultPageSize: 18, defaultView: 'cards' })

    // Dialog states
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
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
    ]
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

    // Data hooks
    const { data: productsData, isLoading, isError } = useProducts({
        page: currentPage,
        pageSize: pageSize,
        search: searchTerm || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        branchId: scopeBranch,
        warehouseId: scopeWarehouse !== 'all' ? scopeWarehouse : undefined,
        locationId: scopeLocation !== 'all' ? scopeLocation : undefined,
        inBranchOnly: scopeBranch !== 'all' && inBranchOnly ? true : undefined,
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
        searchTerm, categoryFilter, pageSize, inBranchOnly, scopeBranch, scopeWarehouse, scopeLocation,
    ])

    // Almacenes del alcance elegido (y sus ubicaciones, ya en plano).
    const { data: scopeWarehouses = [] } = useQuery({
        queryKey: ['warehouses', 'scope', scopeBranch],
        queryFn: () => fetchWarehouses(scopeBranch),
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
            const all = await fetchAllProducts()
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
    const hasStockActions = canRegisterIncoming || canInventoryCount

    /**
     * Exporta lo que se está viendo: mismo alcance y mismos filtros que la
     * lista. Con productos seleccionados manda la selección.
     */
    const handleExport = async (
        fields?: string[],
        ids?: string[],
        includeSummary?: boolean,
        format: 'pdf' | 'csv' = 'pdf',
    ) => {
        if (!canExport) return
        try {
            const svc = await import('@/services/productService')
            await svc.exportProducts({
                format,
                ...(fields?.length ? { fields } : {}),
                ...(ids?.length ? { ids } : {}),
                ...(includeSummary === false ? { includeSummary: false } : {}),
                scope: {
                    branchId: scopeBranch,
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
        if (product.stock === 0 || product.status === 'out_of_stock') {
            return <Badge variant="destructive">Sin Stock</Badge>
        } else if (product.stock <= product.minStock || product.status === 'low_stock') {
            return <Badge className="bg-liquor-amber text-liquor-bronze">Stock Bajo</Badge>
        }
        return <Badge className="bg-liquor-gold text-liquor-bronze">Disponible</Badge>
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

    return (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-2xl font-bold text-foreground">Inventario</h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
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
                                        <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
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
                                    <DropdownMenuItem onClick={() => navigate('/inventario/eliminados')}>
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Productos eliminados
                                    </DropdownMenuItem>
                                </>
                            )}
                            {(hasFileActions || hasStockActions || canDelete) && <DropdownMenuSeparator />}
                            <DropdownMenuItem onClick={() => navigate('/inventario/lotes')}>
                                <CalendarClock className="mr-2 h-4 w-4" />
                                Lotes y caducidades
                            </DropdownMenuItem>
                            {canSeeStockMoves && (
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
                        <Button size="sm" className="shrink-0 gap-1.5" onClick={() => navigate('/inventario/nuevo')}>
                            <Plus className="h-4 w-4 shrink-0" />
                            <span className="sm:hidden">Nuevo</span>
                            <span className="hidden sm:inline">Nuevo producto</span>
                        </Button>
                    )}
                </div>
            </div>

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

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, marca o código..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-48">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(category => (
                                    <SelectItem key={category} value={category}>
                                        {category === 'all' ? 'Todas las categorías' : category}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={scopeBranch}
                            onValueChange={(v) => { setScopeBranch(v); setScopeWarehouse('all'); setScopeLocation('all') }}
                        >
                            <SelectTrigger className="w-48">
                                <Store className="w-4 h-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las sucursales</SelectItem>
                                {branches.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {scopeWarehouses.length > 1 && (
                            <Select
                                value={scopeWarehouse}
                                onValueChange={(v) => { setScopeWarehouse(v); setScopeLocation('all') }}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Almacén" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los almacenes</SelectItem>
                                    {scopeWarehouses.map((w) => (
                                        <SelectItem key={w.id} value={w.id}>
                                            {scopeBranch === 'all' && w.branch ? `${w.branch.name} · ` : ''}{w.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {scopeLocations.length > 1 && (
                            <Select value={scopeLocation} onValueChange={setScopeLocation}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Ubicación" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las ubicaciones</SelectItem>
                                    {scopeLocations.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>
                                            {scopeWarehouse === 'all' ? `${l.warehouse} · ` : ''}{l.code}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {scopeBranch !== 'all' && (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <Switch
                                    id="in-branch-only"
                                    checked={inBranchOnly}
                                    onCheckedChange={setInBranchOnly}
                                />
                                <Label htmlFor="in-branch-only" className="text-sm font-normal">
                                    Solo lo que maneja
                                </Label>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Products View (table or cards) */}
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle>Productos ({totalItems})</CardTitle>
                    {/* View mode toggle (solo iconos, igual que /mercancia) */}
                    <div className="flex items-center border rounded-md bg-background/80">
                        <Button
                            type="button"
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8 rounded-r-none"
                            onClick={() => setViewMode('table')}
                            aria-label="Vista de tabla"
                        >
                            <List className="w-4 h-4" />
                        </Button>
                        <Button
                            type="button"
                            variant={viewMode === 'cards' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8 rounded-l-none"
                            onClick={() => { setViewMode('cards'); setSelectedIds([]) }}
                            aria-label="Vista de cuadros"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading && <div className="p-6 text-muted-foreground">Cargando productos...</div>}
                    {isError && !isLoading && <div className="p-6 text-destructive">Error al cargar productos.</div>}
                    {!isLoading && !isError && (
                        <div className="space-y-4">
                            {viewMode === 'table' && selectedIds.length > 0 && (
                                <div className="flex flex-wrap items-center gap-3 py-2 px-3 rounded-md bg-muted/60 border border-border">
                                    <span className="text-sm font-medium text-foreground">{selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}</span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSelectAllPages}
                                        disabled={selectingAllPages}
                                    >
                                        {selectingAllPages ? 'Cargando...' : 'Seleccionar todos (todas las páginas)'}
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                                        Limpiar selección
                                    </Button>
                                </div>
                            )}
                            {paginatedProducts.length === 0 ? (
                                <div className="p-6 text-center text-muted-foreground">
                                    No hay productos para mostrar.
                                </div>
                            ) : viewMode === 'table' ? (
                                // Vista de lista (tabla)
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="w-10 p-3 text-left">
                                                    <Checkbox
                                                        checked={allOnPageSelected}
                                                        onCheckedChange={toggleSelectAllOnPage}
                                                        aria-label="Seleccionar todos de esta página"
                                                    />
                                                </th>
                                                <th className="text-left p-3 font-medium text-muted-foreground">Producto</th>
                                                <th className="text-left p-3 font-medium text-muted-foreground">Categoría</th>
                                                <th className="text-center p-3 font-medium text-muted-foreground">Stock</th>
                                                <th className="text-right p-3 font-medium text-muted-foreground">Precio</th>
                                                <th className="text-center p-3 font-medium text-muted-foreground">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedProducts.map((product, index) => (
                                              <Fragment key={product.id}>
                                                <tr
                                                    role="button"
                                                    tabIndex={0}
                                                    className="border-b border-border hover:bg-muted transition-colors animate-slide-up cursor-pointer"
                                                    style={{ animationDelay: `${index * 50}ms` }}
                                                    onClick={() => viewProduct(product)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault()
                                                            viewProduct(product)
                                                        }
                                                    }}
                                                >
                                                    <td
                                                        className="p-3 w-10"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => e.stopPropagation()}
                                                    >
                                                        <Checkbox
                                                            checked={selectedSet.has(product.id)}
                                                            onCheckedChange={() => toggleSelection(product.id)}
                                                            aria-label={`Seleccionar ${product.name}`}
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-medium text-foreground flex flex-wrap items-center gap-2">
                                                            {product.name}
                                                            {product.availableForSale === false && (
                                                                <Badge variant="secondary" className="text-[10px] font-normal">
                                                                    Solo inventario
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">{product.brand} • {product.size}</div>
                                                        <div className="text-xs text-muted-foreground">Código: {product.id}</div>
                                                    </td>
                                                    <td className="p-3"><Badge variant="outline">{String(product.category)}</Badge></td>
                                                    <td className="p-3 text-center">
                                                        {product.inBranch === false ? (
                                                            <div
                                                                onClick={(e) => e.stopPropagation()}
                                                                onKeyDown={(e) => e.stopPropagation()}
                                                            >
                                                                <p className="text-xs text-muted-foreground">No se maneja aquí</p>
                                                                {canEdit && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="mt-1 h-7 text-xs"
                                                                        disabled={addToBranchMutation.isPending}
                                                                        onClick={() => addToBranchMutation.mutate(product)}
                                                                    >
                                                                        <Store className="mr-1 h-3 w-3" /> Manejar aquí
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="mx-auto flex items-center gap-1 rounded px-1 hover:bg-muted"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setExpandedId((id) => (id === product.id ? null : product.id))
                                                                }}
                                                                title="Ver en qué ubicaciones está"
                                                            >
                                                                <div>
                                                                    <div className="font-medium text-foreground">{product.stock}</div>
                                                                    <div className="text-xs text-muted-foreground">Min: {product.minStock}</div>
                                                                </div>
                                                                <ChevronDown
                                                                    className={`h-3 w-3 text-muted-foreground transition-transform ${expandedId === product.id ? 'rotate-180' : ''}`}
                                                                />
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="font-medium text-foreground">{fmt(product.price)}</div>
                                                        {canCreate && (
                                                            <div className="text-xs text-muted-foreground">Costo: {fmt(product.cost)}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">{getStatusBadge(product)}</td>
                                                </tr>
                                                {expandedId === product.id && (
                                                    <StockBreakdownRow productId={product.id} />
                                                )}
                                              </Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                // Vista de cuadros: miniatura con alto/ancho máximos fijos (imágenes muy altas se recortan)
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {paginatedProducts.map((product, index) => (
                                        <div
                                            key={product.id}
                                            role="button"
                                            tabIndex={0}
                                            className="border border-border rounded-xl p-3 sm:p-3.5 bg-card/95 shadow-sm hover:shadow-md hover:border-border/80 transition-all animate-slide-up cursor-pointer text-left flex flex-col min-h-0"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                            onClick={() => viewProduct(product)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    viewProduct(product)
                                                }
                                            }}
                                        >
                                            <div className="flex gap-3 sm:gap-3.5 items-start flex-1">
                                                {/* Imagen: caja de tamaño fijo (max alto) — imágenes grandes se recortan con object-cover */}
                                                <div className="shrink-0 w-[7.25rem] h-[8.5rem] sm:w-[7.75rem] sm:h-[9rem] max-h-[9rem] rounded-xl overflow-hidden bg-muted border border-border flex items-center justify-center">
                                                    {product.imageUrl ? (
                                                        <img
                                                            src={product.imageUrl}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover object-center"
                                                        />
                                                    ) : (
                                                        <Package className="w-12 h-12 sm:w-14 sm:h-14 text-muted-foreground/40" aria-hidden />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col gap-0.5 py-0.5">
                                                    <h3 className="font-bold text-foreground leading-tight line-clamp-2 flex flex-wrap items-center gap-2">
                                                        {product.name}
                                                        {product.availableForSale === false && (
                                                            <Badge variant="secondary" className="text-[9px] font-normal shrink-0">
                                                                Sin venta
                                                            </Badge>
                                                        )}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground truncate">
                                                        {product.brand} • {product.size}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                        Categoría:{' '}
                                                        <span className="font-medium text-foreground/90">{String(product.category)}</span>
                                                    </p>
                                                    <div className="mt-auto pt-2 border-t border-border/60">
                                                        <div className="text-[11px] text-muted-foreground">Precio</div>
                                                        <div className="text-xl font-bold text-primary tabular-nums leading-none">
                                                            {fmt(product.price)}
                                                        </div>
                                                        {canCreate && (
                                                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                                                Costo: {fmt(product.cost)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Estado arriba + stock abajo: evita pt-11 y huecos */}
                                                <div className="shrink-0 w-[4.75rem] sm:w-[5rem] flex flex-col items-end justify-between text-right border-l border-border/50 pl-2.5 sm:pl-3">
                                                    <div className="shrink-0">{getStatusBadge(product)}</div>
                                                    {product.inBranch === false ? (
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <div className="text-[11px] text-muted-foreground">No se maneja aquí</div>
                                                            {canEdit && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="mt-1 h-7 px-2 text-[11px]"
                                                                    disabled={addToBranchMutation.isPending}
                                                                    onClick={() => addToBranchMutation.mutate(product)}
                                                                >
                                                                    <Store className="mr-1 h-3 w-3" /> Manejar
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="text-[11px] text-muted-foreground">Stock</div>
                                                            <div className="text-xl font-bold text-foreground tabular-nums leading-none">
                                                                {product.stock}
                                                            </div>
                                                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                                                Min: {product.minStock}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pagination + page size */}
                            <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Items por página:</span>
                                    <Select
                                        value={String(pageSize)}
                                        onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}
                                    >
                                        <SelectTrigger className="w-[72px] h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[18, 27, 36].map((n) => (
                                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {productsData && productsData.totalPages > 1 && (
                                    <Pagination
                                        currentPage={productsData.page}
                                        totalPages={productsData.totalPages}
                                        onPageChange={setCurrentPage}
                                        hasNextPage={productsData.nextPage !== null}
                                        hasPrevPage={productsData.prevPage !== null}
                                        loading={isLoading}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Import Dialog */}
            <ImportDialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onImportSuccess={() => {
                    // Trigger refetch by invalidating query
                    window.location.reload()
                }}
            />

            {/* Export PDF Dialog — columnas del reporte de inventario */}
            <ExportDialog
                open={isExportDialogOpen}
                onOpenChange={setIsExportDialogOpen}
                title="Exportar inventario"
                summary={
                    selectedIds.length > 0
                        ? `Se exportan los ${selectedIds.length} producto(s) seleccionados.`
                        : `Se exporta lo que estás viendo: ${scopeLabel}${searchTerm ? `, buscando "${searchTerm}"` : ''}${categoryFilter !== 'all' ? `, categoría ${categoryFilter}` : ''} (${totalItems} producto(s)).`
                }
                columns={EXPORT_COLUMNS}
                defaultColumns={DEFAULT_EXPORT_COLUMNS}
                presets={[
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
                            Incluir resumen (productos registrados, unidades, valor del inventario)
                        </span>
                    </label>
                }
                secondaryAction={{
                    label: 'Vista de tarjetas (PDF completo)',
                    onClick: () =>
                        handleExport(undefined, selectedIds.length ? selectedIds : undefined, exportIncludeSummary),
                }}
                onExport={({ format, columns }) => {
                    if (format === 'xlsx') return // este diálogo ofrece PDF y CSV
                    handleExport(
                        columns?.length ? columns : undefined,
                        selectedIds.length ? selectedIds : undefined,
                        exportIncludeSummary,
                        format,
                    )
                }}
            />
        </div>
    )
}

export default ProductManagement
