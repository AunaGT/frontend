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
import { Pagination } from '@/components/shared/Pagination'
import { Input } from '@/components/ui/input'
import { PaymentStatusBadge } from '../components/PaymentStatusBadge'
import { Download, Plus, Eye, Package, LayoutGrid, List, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useIncomingMerchandise } from '../hooks/useIncomingMerchandise'
import { generateMerchandiseReport } from '../api/incomingMerchandiseService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
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
    pageSize,
    setPageSize,
    viewMode,
    setViewMode,
  } = usePersistedListUiState('mercancia/lista', { defaultPageSize: 10, defaultView: 'table' })
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

  const { data: recordsData, isLoading, isFetching, isError, refetch } = useIncomingMerchandise({
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
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: currencyCode || 'GTQ',
    }).format(value)
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

  return <div className="merchandise-page min-h-full bg-brand-surface dark:bg-brand-navy"><div className="mx-auto w-full max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <header className="auna-module-heading"><div><p className="auna-module-eyebrow">Inventario</p><h1>Entradas de mercadería</h1><p className="auna-module-description">Consulta las recepciones, sus costos y los pagos a proveedores.</p></div><div className="flex flex-wrap gap-2">{canReports && <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="mr-2 h-4 w-4" />Exportar</Button>}{canRegister && <Button onClick={() => navigate('/inventario/registrar-ingreso')} className="bg-brand-orange text-white hover:bg-brand-orange/90"><Plus className="mr-2 h-4 w-4" />Nueva entrada</Button>}</div></header>
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto]">
      <div className="space-y-2"><label htmlFor="merch-search" className="text-xs font-medium">Buscar</label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="merch-search" className="pl-9" placeholder="Proveedor, notas o responsable…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
      <div className="space-y-2"><p className="text-xs font-medium">Proveedor</p><SupplierPicker allowAll label={supplierLabel} onSelect={supplier => { setSelectedSupplierId(supplier?.id || 'all'); setSupplierLabel(supplier?.name || 'Todos los proveedores') }} /></div>
      <div className="space-y-2"><label htmlFor="merch-state" className="text-xs font-medium">Estado de pago</label><select id="merch-state" className="auna-receipt-select" value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value as typeof paymentStatusFilter)}><option value="all">Todos</option><option value="PENDING">Pendiente</option><option value="PARTIAL">Parcial</option><option value="PAID">Pagado</option></select></div>
      <div className="space-y-2"><label htmlFor="merch-from" className="text-xs font-medium">Desde</label><Input id="merch-from" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
      <div className="space-y-2"><label htmlFor="merch-to" className="text-xs font-medium">Hasta</label><Input id="merch-to" type="date" min={startDate || undefined} value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      <Button variant="outline" className="self-end" onClick={clearFilters}>Limpiar</Button>
    </CardContent></Card>
    <section className="auna-data-table-shell" aria-busy={isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><h2 className="font-semibold">Entradas ({totalItems})</h2><div className="flex items-center gap-2"><label className="flex items-center gap-2 text-xs text-muted-foreground">Por página<select className="auna-receipt-select !w-20" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}>{Array.from(new Set([10, 18, 20, 27, 36, 50, pageSize])).sort((a,b)=>a-b).map(size => <option key={size} value={size}>{size}</option>)}</select></label><Button size="icon" variant="ghost" className={viewMode === 'table' ? 'bg-brand-orange text-white hover:bg-brand-orange/90' : ''} aria-label="Vista de tabla" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><List className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className={viewMode === 'cards' ? 'bg-brand-orange text-white hover:bg-brand-orange/90' : ''} aria-label="Vista de tarjetas" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}><LayoutGrid className="h-4 w-4" /></Button></div></div>
      {isLoading ? <p role="status" className="p-12 text-center text-muted-foreground">Cargando entradas…</p> : isError ? <div role="alert" className="p-10 text-center"><p>No se pudieron cargar las entradas.</p><Button variant="outline" className="mt-3" onClick={() => refetch()}>Reintentar</Button></div> : !records.length ? <div className="p-12 text-center text-muted-foreground"><Package className="mx-auto mb-3 h-9 w-9" /><p>No hay entradas que coincidan con los filtros.</p></div> : viewMode === 'table' ? <div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead><tr><th>Registro</th><th>Fecha</th><th>Proveedor</th><th>Productos</th><th>Condición de pago</th><th>Estado de pago</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td className="font-medium">{record.id.slice(0,8).toUpperCase()}</td><td>{formatDate(record.date)}</td><td><strong className="font-medium">{record.supplier.name}</strong><small className="block text-muted-foreground">{record.supplier.contact}</small></td><td>{record.itemsCount} productos</td><td>{record.payment_term?.name || 'Sin término'}</td><td><PaymentStatusBadge status={record.payment_status} /></td><td className="whitespace-nowrap font-medium">{formatCurrency(record.totalValue)}</td><td>{canDetails && <Button variant="outline" size="icon" aria-label={`Ver entrada ${record.id.slice(0,8)}`} onClick={() => handleViewDetails(record.id)}><Eye className="h-4 w-4" /></Button>}</td></tr>)}</tbody></table></div> : <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{records.map(record => <Card key={record.id}><CardContent className="space-y-3 p-5"><div className="flex items-center justify-between gap-2"><strong>{record.supplier.name}</strong><PaymentStatusBadge status={record.payment_status} /></div><p className="text-sm text-muted-foreground">{formatDate(record.date)} · {record.itemsCount} productos</p><p className="text-xl font-bold">{formatCurrency(record.totalValue)}</p><p className="text-sm text-muted-foreground">{record.payment_term?.name || 'Sin término de pago'}</p>{canDetails && <Button variant="outline" className="w-full" onClick={() => handleViewDetails(record.id)}>Ver detalles</Button>}</CardContent></Card>)}</div>}
      {!isError && <Pagination currentPage={recordsData?.page ?? currentPage} totalPages={totalPages} onPageChange={setCurrentPage} loading={isFetching} totalItems={totalItems} pageSize={pageSize} count={records.length} itemLabel="entradas" />}
    </section>
    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} title="Exportar reporte de mercancía" summary="El PDF contiene las entradas de la sucursal con la búsqueda y los filtros aplicados." formats={['pdf']} fileName="reporte-mercancia" pending={exporting} onExport={({ fileName }) => void handleGenerateReport(fileName)} />
  </div></div>
}

export default IncomingMerchandiseManagement
