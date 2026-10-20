import { TABLE_PAGE_SIZES } from '@/utils/pagination'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { SupplierPicker } from '@/components/shared/SupplierPicker'
import { ModuleTabBar } from '@/components/shared/ModuleTabs'
import { Pagination } from '@/components/shared/Pagination'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import { Input } from '@/components/ui/input'
import { PaymentStatusBadge } from '../components/PaymentStatusBadge'
import { Download, Plus, Eye, Package, LayoutGrid, List, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useIncomingMerchandise } from '../hooks/useIncomingMerchandise'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { generateMerchandiseReport } from '../api/incomingMerchandiseService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { useCardPagination } from '@/hooks/useCardPagination'
import { recordCardNavigation } from '@/components/shared/recordCardNavigation'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import type { IncomingMerchandise, MerchandisePaymentStatus } from '../api/incomingMerchandiseService'
import '../merchandise.css'

const IncomingMerchandiseManagement = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const { currencyCode, locale, timezone } = useSystemSettings()

  const [searchTerm, setSearchTerm] = useState('')
  const [search, setSearch] = useState('')
  const [supplierLabel, setSupplierLabel] = useState('Todos los proveedores')
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchTerm.trim()), 280)
    return () => window.clearTimeout(timer)
  }, [searchTerm])
  const {
    page: currentPage,
    setPage: setCurrentPage,
    pageSize: tablePageSize,
    setPageSize,
    viewMode,
    setViewMode,
  } = usePersistedListUiState('mercancia/lista', { defaultPageSize: 50, defaultView: 'table' })
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | MerchandisePaymentStatus>('all')

  const canView = hasPermission('merchandise.view')
  const canRegister = hasPermission('products.register_incoming')
  const canDetails = hasPermission('merchandise.details')
  const canReports = hasPermission('merchandise.reports')
  const cardPagination = useCardPagination({ enabled: viewMode === 'cards', tablePageSize, onPageChange: setCurrentPage, storageKey: "mercancia/lista" })
  const pageSize = cardPagination.pageSize

  const { data: recordsData, isLoading, isFetching, isError, refetch } = useIncomingMerchandise({
    includeSummary: true,
    page: currentPage,
    pageSize,
    search: search || undefined,
    enabled: canView,
    supplier_id: selectedSupplierId !== 'all' ? selectedSupplierId : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    payment_status: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
  })

  const records: IncomingMerchandise[] = recordsData?.items ?? []
  const totalItems = recordsData?.totalItems ?? 0
  const totalPages = recordsData?.totalPages ?? 1

  useResetPageOnFilterChange(setCurrentPage, [
    search,
    selectedSupplierId,
    startDate,
    endDate,
    pageSize,
    paymentStatusFilter,
  ])

  const handleViewDetails = (id: string) => {
    navigate(`/mercancia/${id}`)
  }

  const handleGenerateReport = async (fileName?: string) => {
    setExporting(true)
    try {
      const blob = await generateMerchandiseReport({
        search: search || undefined,
        supplier_id: selectedSupplierId !== 'all' ? selectedSupplierId : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        payment_status: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
      })

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || `reporte-mercancia-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setExportOpen(false)

      toast({
        title: 'Reporte generado',
        description: 'El reporte PDF se descargó correctamente',
      })
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'No se pudo generar el reporte'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedSupplierId('all')
    setSupplierLabel('Todos los proveedores')
    setStartDate('')
    setEndDate('')
    setPaymentStatusFilter('all')
    setCurrentPage(1)
  }

  const loc = locale || 'es-GT'
  const formatCurrency = (value: number|string) => {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: currencyCode || 'GTQ',
    }).format(Number(value))
  }

  const formatDate = (dateString: string) => {
    // Sin `timeZone`, esto usa la del navegador — que no tiene por qué coincidir
    // con la configurada en Configuración → General.
    return new Date(dateString).toLocaleDateString(loc, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    })
  }

  if (!canView) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Sin acceso</h3>
            <p className="text-muted-foreground">
              No tienes permisos para ver los registros de mercancía.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <div className="merchandise-page min-h-full bg-brand-surface dark:bg-brand-navy"><div className="auna-page-fluid mx-auto w-full space-y-5 p-4 sm:p-8">
    <h1 className="sr-only">Entradas de mercadería</h1>
    <MetricStrip label="Resumen entradas consultadas" loading={isLoading} items={[
      { label: 'Entradas', value: isError ? '—' : recordsData?.summary?.total ?? '—' },
      { label: 'Pagadas', value: isError ? '—' : recordsData?.summary?.paid ?? '—' },
      { label: 'Pago parcial', value: isError ? '—' : recordsData?.summary?.partial ?? '—' },
      { label: 'Pendientes', value: isError ? '—' : recordsData?.summary?.pending ?? '—' },
    ]} />

    <CompactFilterPanel actions={<><div className="flex flex-wrap gap-2">{canReports && <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="mr-2 h-4 w-4" />Exportar</Button>}{canRegister && <Button onClick={() => navigate('/inventario/registrar-ingreso')} className="bg-brand-orange text-white hover:bg-brand-orange/90"><Plus className="mr-2 h-4 w-4" />Nueva entrada</Button>}</div></>} title="Filtros de mercancía" activeCount={Number(Boolean(search.trim())) + Number(selectedSupplierId !== 'all') + Number(paymentStatusFilter !== 'all') + Number(Boolean(startDate)) + Number(Boolean(endDate))} onClear={() => {clearFilters();setSearch('')}} appliedFilters={[...(search ? [{label: `Búsqueda: ${search}`,onRemove: () => {setSearchTerm('');setSearch('');setCurrentPage(1)}}] : []),...(selectedSupplierId !== 'all' ? [{label: `Proveedor: ${supplierLabel}`,onRemove: () => {setSelectedSupplierId('all');setSupplierLabel('Todos los proveedores');setCurrentPage(1)}}] : []),...(paymentStatusFilter !== 'all' ? [{label: `Pago: ${({PENDING:'Pendiente',PARTIAL:'Parcial',PAID:'Pagado'} as Record<string,string>)[paymentStatusFilter]}`,onRemove: () => {setPaymentStatusFilter('all');setCurrentPage(1)}}] : []),...(startDate ? [{label: `Desde: ${startDate}`,onRemove: () => {setStartDate('');setCurrentPage(1)}}] : []),...(endDate ? [{label: `Hasta: ${endDate}`,onRemove: () => {setEndDate('');setCurrentPage(1)}}] : [])]} search={<div className="space-y-2"><label htmlFor="merch-search" className="text-xs font-medium">Buscar</label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="merch-search" className="pl-9" placeholder="Proveedor, notas o responsable…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>}>
        <div className="space-y-2"><p className="text-xs font-medium">Proveedor</p><SupplierPicker allowAll label={supplierLabel} onSelect={supplier => { setSelectedSupplierId(supplier?.id || 'all'); setSupplierLabel(supplier?.name || 'Todos los proveedores') }} /></div>
        <div className="space-y-2"><label htmlFor="merch-state" className="text-xs font-medium">Estado de pago</label><select id="merch-state" className="auna-control auna-control-select auna-receipt-select" value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value as typeof paymentStatusFilter)}><option value="all">Todos</option><option value="PENDING">Pendiente</option><option value="PARTIAL">Parcial</option><option value="PAID">Pagado</option></select></div>
        <div className="space-y-2"><label htmlFor="merch-from" className="text-xs font-medium">Desde</label><Input id="merch-from" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div className="space-y-2"><label htmlFor="merch-to" className="text-xs font-medium">Hasta</label><Input id="merch-to" type="date" min={startDate || undefined} value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </CompactFilterPanel>
    <section ref={cardPagination.containerRef} className="auna-surface-flat" aria-busy={isFetching}>
      {isFetching && !isLoading && <LoadingIndicator message="Actualizando entradas…" className="px-4 py-2" />}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3"><h2 className="font-semibold">Entradas ({totalItems})</h2><div className="flex items-center gap-2"><label className="flex items-center gap-2 text-xs text-muted-foreground">Por página<select className="auna-control auna-control-select auna-receipt-select !w-20" value={pageSize} onChange={e => { if (viewMode === 'cards') cardPagination.setCardPageSize(Number(e.target.value)); else setPageSize(Number(e.target.value)); setCurrentPage(1) }}>{(viewMode === 'cards' ? cardPagination.pageSizeOptions : TABLE_PAGE_SIZES).map(size => <option key={size} value={size}>{size}</option>)}</select></label><ModuleTabBar items={[{ value: 'table', label: '', ariaLabel: 'Tabla', icon: List }, { value: 'cards', label: '', ariaLabel: 'Tarjetas', icon: LayoutGrid }]} value={viewMode} ariaLabel="Vista de entradas" onValueChange={setViewMode} /></div></div>
      {isLoading ? <LoadingState variant={viewMode === 'table' ? 'table' : 'cards'} columns={['Registro', 'Fecha', 'Proveedor', 'Productos', 'Condición de pago', 'Estado de pago', 'Total', 'Acciones']} message="Cargando entradas…" /> : isError ? <div role="alert" className="p-10 text-center"><p>No se pudieron cargar las entradas.</p><Button variant="outline" className="mt-3" onClick={() => refetch()}>Reintentar</Button></div> : !records.length ? <CollectionEmptyState title="La próxima entrega tiene su lugar aquí" description="No hay entradas registradas en esta vista. Registra la mercancía recibida para consultar sus productos, costos y condiciones de pago." filtered={Boolean(searchTerm.trim() || search) || selectedSupplierId !== 'all' || paymentStatusFilter !== 'all' || Boolean(startDate || endDate)} onReset={() => { clearFilters(); setSearch('') }} action={canRegister ? <Button onClick={() => navigate('/inventario/registrar-ingreso')}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Nueva entrada</Button> : undefined} /> : viewMode === 'table' ? <div className="auna-data-table-shell overflow-x-auto"><table className="w-full min-w-[900px]"><thead><tr><th>Registro</th><th>Fecha</th><th>Proveedor</th><th>Productos</th><th>Condición de pago</th><th>Estado de pago</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td className="font-medium">{record.id.slice(0,8).toUpperCase()}</td><td>{formatDate(record.date)}</td><td><strong className="font-medium">{record.supplier.name}</strong><small className="block text-muted-foreground">{record.supplier.contact}</small></td><td>{record.itemsCount} productos</td><td>{record.payment_term?.name || 'Sin término'}</td><td><PaymentStatusBadge status={record.payment_status} /></td><td className="whitespace-nowrap font-medium">{formatCurrency(record.totalValue)}</td><td>{canDetails && <Button variant="outline" size="icon" aria-label={`Ver entrada ${record.id.slice(0,8)}`} onClick={() => handleViewDetails(record.id)}><Eye className="h-4 w-4" /></Button>}</td></tr>)}</tbody></table></div> : <div className="auna-record-grid">{records.map(record => <Card key={record.id} className="auna-surface auna-record-interactive" {...recordCardNavigation(canDetails ? () => handleViewDetails(record.id) : undefined)}><CardContent className="auna-record-card">
        <div className="auna-record-content space-y-1">
          <strong>{record.supplier.name}</strong>
          <div className="auna-record-meta text-muted-foreground"><span>{formatDate(record.date)}</span><span>{record.itemsCount} productos</span></div>
          <p className="text-sm text-muted-foreground">{record.payment_term?.name || 'Sin término de pago'}</p>
        </div>
        <div className="auna-record-side text-right">
          <PaymentStatusBadge status={record.payment_status} />
          <p className="font-semibold tabular-nums">{formatCurrency(record.totalValue)}</p>
        </div>
      </CardContent></Card>)}</div>}
      {!isError && <Pagination currentPage={recordsData?.page ?? currentPage} totalPages={totalPages} onPageChange={setCurrentPage} loading={isFetching} totalItems={totalItems} pageSize={pageSize} count={records.length} itemLabel="entradas" />}
    </section>
    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} title="Exportar reporte de mercancía" summary="El PDF contiene las entradas de la sucursal con la búsqueda y los filtros aplicados." formats={['pdf']} fileName="reporte-mercancia" pending={exporting} onExport={({ fileName }) => void handleGenerateReport(fileName)} />
  </div></div>
}

export default IncomingMerchandiseManagement
