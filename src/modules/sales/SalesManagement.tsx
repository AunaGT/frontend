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
 * SalesManagement - Refactored main component
 * 
 * This component orchestrates the sales management feature.
 * All UI components and business logic are extracted to sub-modules.
 */
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Plus, Calculator, PauseCircle, Table2, LayoutGrid } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { ModuleTabBar } from '@/components/shared/ModuleTabs'
import { usePaymentMethods } from '@/hooks/usePaymentMethods'
import { useToast } from '@/hooks/use-toast'
import { Sale, SaleStatus } from '@/types'
import { updateSaleStatus as apiUpdateSaleStatus } from '@/services/salesService'
import { useRealtimeSales } from '@/hooks/useRealtimeSales'
import { useAuth } from '@/context/useAuth'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useModules } from '@/context/useModules'

// Feature imports
import { useSalesData, normalizeRawSale } from './hooks'
import {
    SalesKPICards,
    SalesFilters,
    NegativeStockDialog,
    SalesStatusTable,
    SaleDetailDialog,
} from './components'
import { STATUS_DB_NAMES, NegativeStockDialogState, SaleStatusKey } from './types'
import { useNavigate, useLocation } from 'react-router-dom'
import { getApiBaseUrl, getAuthToken } from '@/services/api'
import { fetchSaleById } from '@/services/saleService'
import { hasNewSaleDraft } from '@/services/saleDraftStorage'

const API_URL = getApiBaseUrl()

interface SalesManagementProps {
    onSectionChange?: (section: string) => void
}

const SalesManagement = (_props: SalesManagementProps) => {
    const navigate = useNavigate()
    const location = useLocation()
    const { isAuthenticated, user } = useAuth()
    const [hasPendingSaleDraft, setHasPendingSaleDraft] = useState(false)

    useEffect(() => {
        const uid = user?.id
        if (!uid) {
            setHasPendingSaleDraft(false)
            return
        }
        setHasPendingSaleDraft(hasNewSaleDraft(uid))
    }, [user?.id, location.pathname])
    const { toast } = useToast()
    const { hasPermission } = useAuthPermissions()
    const { isEnabled } = useModules()
    const { locale, currencyCode } = useSystemSettings()

    const salesData = useSalesData()
    const paymentMethods = usePaymentMethods()

    // UI state
    const [isViewSaleOpen, setIsViewSaleOpen] = useState(false)
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
    const [updatingSaleIds, setUpdatingSaleIds] = useState<Set<string>>(new Set())
    const [isValidatingClosure, setIsValidatingClosure] = useState(false)
    const [negativeStockDialog, setNegativeStockDialog] = useState<NegativeStockDialogState>({ open: false, products: [] })

    // Permission-based capabilities
    const canCreateSale = hasPermission('sales.create')
    const canChangeSaleStatus = hasPermission('sales.cancel', 'sales.create')
    const canAccessCashClosure = isEnabled('cash-closure') && hasPermission('cashclosure.view', 'cashclosure.create')
    const canViewDetail = hasPermission('sales.view_detail')
    const canViewInvoice = hasPermission('sales.view_invoice')

    // Realtime updates
    useRealtimeSales((newSale: { id: string; customer?: string | null; total?: number | string }) => {
        if (!isAuthenticated) return
        toast({ title: 'Nueva venta registrada', description: `Cliente: ${newSale.customer || 'Consumidor Final'}` })
        salesData.refreshSales()
    }, {
        onUpdate: () => {
            if (!isAuthenticated) return
            salesData.refreshSales()
        }
    })

    // Status update
    const updateSaleStatus = async (saleId: string, newStatus: SaleStatus) => {
        if (!canChangeSaleStatus) {
            toast({ title: 'Sin permiso para cambiar estado de ventas', variant: 'destructive' })
            return
        }
        setUpdatingSaleIds(prev => new Set(prev).add(saleId))
        try {
            await apiUpdateSaleStatus(saleId, { status_name: STATUS_DB_NAMES[newStatus as SaleStatusKey] })
            salesData.refreshSales()
        } catch (e) {
            toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
        } finally {
            setUpdatingSaleIds(prev => { const n = new Set(prev); n.delete(saleId); return n })
        }
    }

    const handleViewSale = async (sale: Sale) => {
        setSelectedSale(sale)
        setIsViewSaleOpen(true)
        try {
            const raw = await fetchSaleById(sale.reference ?? sale.id)
            setSelectedSale(normalizeRawSale(raw))
        } catch (e) {
            toast({
                title: 'Error',
                description: (e as Error).message || 'No se pudo cargar el detalle de la venta',
                variant: 'destructive',
            })
        }
    }

    // Cash closure validation
    const handleCashClosure = async () => {
        setIsValidatingClosure(true)
        try {
            const token = getAuthToken()
            if (!token) {
                toast({ title: 'Sesión', description: 'No hay token de acceso. Vuelve a iniciar sesión.', variant: 'destructive' })
                return
            }
            const response = await fetch(`${API_URL}/cash-closures/validate-stocks`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!response.ok) throw new Error('No se pudo validar el inventario')
            const data = await response.json()
            if (!data.valid && Array.isArray(data.products) && data.products.length > 0) {
                setNegativeStockDialog({ open: true, products: data.products })
            } else {
                navigate('/cierre-caja')
            }
        } catch {
            toast({ title: 'Error', description: 'No se pudo validar el inventario', variant: 'destructive' })
        } finally {
            setIsValidatingClosure(false)
        }
    }

    return (
        <div className="mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-8">
            {/* Header */}
            <header className="auna-module-heading">
                <div className='min-w-0'>
                    <p className="auna-module-eyebrow">Ventas</p>
                    <h1>Ventas</h1>
                    <p className="auna-module-description">Consulta las ventas, sus pagos y devoluciones desde un solo lugar.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canAccessCashClosure && (
                        <Button
                            variant='outline'
                            onClick={handleCashClosure}
                            disabled={isValidatingClosure}
                            className="h-12 rounded-xl px-4"
                        >
                            <Calculator className="h-4 w-4" aria-hidden="true" />
                            <span>
                                {isValidatingClosure ? 'Validando...' : 'Cierre de Caja'}
                            </span>
                        </Button>
                    )}
                    {canCreateSale && (
                        <Button
                            className="h-12 rounded-xl bg-brand-orange px-6 text-white hover:bg-brand-orange/90"
                            onClick={() => navigate('/ventas/nueva')}
                        >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Nueva venta
                        </Button>
                    )}
                </div>
            </header>

            {canCreateSale && hasPendingSaleDraft && (
                <Alert className="border-amber-500/50 bg-amber-500/5">
                    <PauseCircle className="h-4 w-4 text-amber-700" />
                    <AlertTitle className="text-amber-900 dark:text-amber-100">
                        Venta pendiente
                    </AlertTitle>
                    <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <span>
                            Tienes una venta guardada para continuar después. Ábrela desde Nueva venta.
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-700 text-amber-900 shrink-0"
                            onClick={() => navigate('/ventas/nueva?recuperar=1')}
                        >
                            Continuar venta
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Resumen compacto del período completo */}
            <p className="text-xs text-muted-foreground">Ventas completadas · {({ today: 'Hoy', week: 'Esta semana', month: 'Este mes', year: 'Este año', all: 'Todo el historial' } as Record<string, string>)[salesData.filters.period]}</p>
            <SalesKPICards
                totalSalesToday={salesData.totalSalesToday}
                transactionCountToday={salesData.transactionCountToday}
                averageTicketToday={salesData.averageTicketToday}
                preferredPaymentMethod={salesData.preferredPaymentMethod}
                locale={locale}
                currencyCode={currencyCode}
                loading={salesData.summaryLoading}
                error={salesData.summaryError}
            />
            {salesData.summaryError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">No se pudo cargar el resumen del período.<Button variant="outline" size="sm" onClick={salesData.refreshSales}>Reintentar</Button></div>}

            {/* Filters */}
            <SalesFilters
                searchTerm={salesData.filters.searchTerm}
                onSearchChange={salesData.setSearchTerm}
                statusFilter={salesData.filters.statusFilter}
                onStatusChange={salesData.setStatusFilter}
                paymentFilter={salesData.filters.paymentFilter}
                onPaymentChange={salesData.setPaymentFilter}
                isGlobalSearch={salesData.filters.isGlobalSearch}
                searchHint={salesData.filters.searchHint}
                period={salesData.filters.period}
                onPeriodChange={salesData.setPeriod}
                paymentMethods={paymentMethods.data ?? []}
                paymentMethodsLoading={paymentMethods.isLoading}
                showStatusFilter={false}
            />
            {paymentMethods.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">No se pudieron cargar los métodos de pago.<Button variant="outline" size="sm" onClick={() => void paymentMethods.refetch()}>Reintentar</Button></div>}

            <Tabs value={salesData.filters.statusFilter} onValueChange={(value) => salesData.setStatusFilter(value as SaleStatusKey | 'all')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="max-w-full overflow-x-auto"><TabsList variant="detail" aria-label="Estado de las ventas"><TabsTrigger value="all">Todas</TabsTrigger><TabsTrigger value="completed">Completadas</TabsTrigger><TabsTrigger value="cancelled">Canceladas</TabsTrigger></TabsList></div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2"><Label className="text-xs text-muted-foreground">Filas por página</Label><Select value={String(salesData.pageSize)} onValueChange={(value) => salesData.setPageSize(Number(value))}><SelectTrigger className="w-20" aria-label="Filas por página"><SelectValue /></SelectTrigger><SelectContent>{[5, 10, 25, 50].map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select></div>
                        <div className="hidden md:block"><ModuleTabBar<'table' | 'cards'> value={salesData.viewMode ?? 'table'} onValueChange={salesData.setViewMode!} ariaLabel="Vista de ventas" items={[{value: 'table', label: '', icon: Table2}, {value: 'cards', label: '', icon: LayoutGrid}]} /></div>
                    </div>
                </div>
                <TabsContent value={salesData.filters.statusFilter} className="mt-4">
                    <SalesStatusTable
                        statusKey={salesData.filters.statusFilter === 'all' ? undefined : salesData.filters.statusFilter}
                        viewMode={salesData.viewMode ?? 'table'}
                        pageSize={salesData.pageSize}
                        sales={salesData.sales}
                        pageInfo={salesData.pageInfo}
                        isLoading={salesData.isLoading}
                        isFetching={salesData.isFetching}
                        error={salesData.error}
                        emptyMessage={salesData.filters.searchHint}
                        onRetry={salesData.refreshSales}
                        updatingSaleIds={updatingSaleIds}
                        onPageChange={salesData.setPage}
                        canChangeStatus={canChangeSaleStatus}
                        onStatusChange={updateSaleStatus}
                        onViewSale={handleViewSale}
                        onViewInvoice={(sale) => navigate(`/ventas/${sale.reference ?? sale.id}/factura`)}
                        canViewDetail={canViewDetail}
                        canViewInvoice={canViewInvoice}
                        locale={locale}
                        currencyCode={currencyCode}
                    />
                </TabsContent>
            </Tabs>

            <SaleDetailDialog
                open={isViewSaleOpen}
                onOpenChange={setIsViewSaleOpen}
                sale={selectedSale}
                locale={locale}
                currencyCode={currencyCode}
            />

            <NegativeStockDialog
                state={negativeStockDialog}
                onClose={() => setNegativeStockDialog({ open: false, products: [] })}
                onGoToInventory={() => {
                    setNegativeStockDialog({ open: false, products: [] })
                    navigate('/inventario')
                }}
            />
        </div>
    )
}

export default SalesManagement
