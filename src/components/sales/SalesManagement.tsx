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
import { Plus, Calendar, Calculator, PauseCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
    onSectionChange?: (section: string) => void;
}

const SalesManagement = ({ onSectionChange }: SalesManagementProps) => {
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
        <div className='p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in'>
            {/* Header */}
            <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between'>
                <div className='min-w-0'>
                    <h2 className='text-lg sm:text-2xl font-bold text-foreground'>Ventas</h2>
                    <p className='text-xs sm:text-sm text-muted-foreground'>Control de transacciones</p>
                </div>
                <div className='flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible'>
                    <div className='flex items-center gap-2 shrink-0'>
                        <span className='text-sm text-muted-foreground hidden sm:inline'>Items por página:</span>
                        <Select
                            value={String(salesData.pageSize)}
                            onValueChange={(v) => {
                                salesData.setPageSize(Number(v))
                                salesData.setPageFor('completed', 1)
                                salesData.setPageFor('cancelled', 1)
                            }}
                        >
                            <SelectTrigger className='w-[72px] h-9'><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[5, 10, 25, 50].map((n) => (
                                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Select value={salesData.filters.period} onValueChange={salesData.setPeriod}>
                        <SelectTrigger className='w-28 sm:w-36 shrink-0'><Calendar className='w-4 h-4 mr-1 sm:mr-2' /><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value='today'>Hoy</SelectItem>
                            <SelectItem value='week'>Semana</SelectItem>
                            <SelectItem value='month'>Mes</SelectItem>
                        </SelectContent>
                    </Select>
                    {canAccessCashClosure && (
                        <Button
                            variant='outline'
                            onClick={handleCashClosure}
                            disabled={isValidatingClosure}
                            className='border-green-600 text-green-600 whitespace-nowrap shrink-0 text-xs sm:text-sm'
                        >
                            <Calculator className='w-4 h-4 sm:mr-2' />
                            <span className='hidden sm:inline'>
                                {isValidatingClosure ? 'Validando...' : 'Cierre de Caja'}
                            </span>
                        </Button>
                    )}
                    {canCreateSale && (
                        <Button
                            className='bg-primary hover:bg-primary/90 whitespace-nowrap shrink-0 text-xs sm:text-sm'
                            onClick={() => navigate('/ventas/nueva')}
                        >
                            <Plus className='w-4 h-4 sm:mr-2' />
                            <span className='hidden sm:inline'>Nueva Venta</span>
                        </Button>
                    )}
                </div>
            </div>

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

            {/* KPI Cards */}
            <SalesKPICards
                totalSalesToday={salesData.totalSalesToday}
                transactionCountToday={salesData.transactionCountToday}
                averageTicketToday={salesData.averageTicketToday}
                preferredPaymentMethod={salesData.preferredPaymentMethod}
                locale={locale}
                currencyCode={currencyCode}
            />

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
            />

            {/* Sales Tables (solo Completadas y Canceladas) */}
            <div className='space-y-6'>
                {(['completed', 'cancelled'] as const).map(key => (
                    <SalesStatusTable
                        key={key}
                        statusKey={key}
                        sales={salesData.salesByStatus[key]}
                        pageInfo={salesData.pageInfoByStatus[key]}
                        isLoading={salesData.isLoadingByStatus[key]}
                        updatingSaleIds={updatingSaleIds}
                        onPageChange={(page) => salesData.setPageFor(key, page)}
                        canChangeStatus={canChangeSaleStatus}
                        onStatusChange={updateSaleStatus}
                        onViewSale={handleViewSale}
                        onViewInvoice={(sale) => navigate(`/ventas/${sale.reference ?? sale.id}/factura`)}
                        canViewDetail={canViewDetail}
                        canViewInvoice={canViewInvoice}
                        locale={locale}
                        currencyCode={currencyCode}
                    />
                ))}
            </div>

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
