/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Search,
  Package,
  Calendar,
  User,
  Building2,
  LayoutGrid,
  List,
  Download,
  Plus,
  Filter,
  X,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useIncomingMerchandise } from '@/hooks/useIncomingMerchandise'
import { useSuppliers } from '@/hooks/useSuppliers'
import { SUPPLIERS_DROPDOWN_PARAMS } from '@/services/supplierService'
import { Pagination } from '@/components/shared/Pagination'
import { generateMerchandiseReport } from '@/services/incomingMerchandiseService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import type { IncomingMerchandise, MerchandisePaymentStatus } from '@/services/incomingMerchandiseService'

function PaymentStatusBadge({ status }: { status?: MerchandisePaymentStatus }) {
  const s = status ?? 'PENDING'
  if (s === 'PAID') {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Pagado</Badge>
  }
  if (s === 'PARTIAL') {
    return <Badge className="bg-amber-600 hover:bg-amber-600">Parcial</Badge>
  }
  return <Badge variant="secondary">Pendiente</Badge>
}

const IncomingMerchandiseManagement = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const { currencyCode, locale, timezone } = useSystemSettings()

  const [searchTerm, setSearchTerm] = useState('')
  const {
    page: currentPage,
    setPage: setCurrentPage,
    pageSize,
    setPageSize,
    viewMode,
    setViewMode,
  } = usePersistedListUiState('mercancia/lista', { defaultPageSize: 18, defaultView: 'cards' })
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | MerchandisePaymentStatus>('all')

  const canView = hasPermission('merchandise.view')
  const canRegister = hasPermission('products.register_incoming')
  const canDetails = hasPermission('merchandise.details')
  const canReports = hasPermission('merchandise.reports')

  const { data: recordsData, isLoading } = useIncomingMerchandise({
    page: currentPage,
    pageSize,
    search: searchTerm || undefined,
    supplier_id: selectedSupplierId !== 'all' ? selectedSupplierId : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    payment_status: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
  })

  const { data: suppliersData } = useSuppliers(SUPPLIERS_DROPDOWN_PARAMS)
  const suppliers = useMemo(() => suppliersData?.items ?? [], [suppliersData])

  const records: IncomingMerchandise[] = recordsData?.items ?? []
  const totalItems = recordsData?.totalItems ?? 0
  const totalPages = recordsData?.totalPages ?? 1

  useResetPageOnFilterChange(setCurrentPage, [
    searchTerm,
    selectedSupplierId,
    startDate,
    endDate,
    pageSize,
    paymentStatusFilter,
  ])

  const handleViewDetails = (id: string) => {
    navigate(`/mercancia/${id}`)
  }

  const handleGenerateReport = async () => {
    try {
      const blob = await generateMerchandiseReport({
        supplier_id: selectedSupplierId !== 'all' ? selectedSupplierId : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        payment_status: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
      })

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-mercancia-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

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
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedSupplierId('all')
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

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">Registros de Mercancía</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Gestiona los ingresos de mercancía.
            {canDetails
              ? ' Haz clic en una fila o tarjeta para abrir el detalle en una nueva vista.'
              : ''}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible">
          {canReports && (
            <Button variant="outline" onClick={handleGenerateReport} size="sm" className="shrink-0">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Reporte</span>
            </Button>
          )}
          {canRegister && (
            <Button
              size="sm"
              onClick={() => navigate('/inventario/registrar-ingreso')}
              className="shrink-0"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Nuevo Registro</span>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filtros</CardTitle>
            <div className="flex items-center gap-2">
              {(searchTerm ||
                selectedSupplierId !== 'all' ||
                startDate ||
                endDate ||
                paymentStatusFilter !== 'all') && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Limpiar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                <Filter className="w-4 h-4 mr-1" />
                {isFilterOpen ? 'Ocultar' : 'Filtros'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {isFilterOpen && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Búsqueda</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Proveedor</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger id="supplier">
                    <SelectValue placeholder="Todos los proveedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los proveedores</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-filter">Estado de pago</Label>
                <Select
                  value={paymentStatusFilter}
                  onValueChange={(v) =>
                    setPaymentStatusFilter(v as 'all' | MerchandisePaymentStatus)
                  }
                >
                  <SelectTrigger id="pay-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDING">Pendiente</SelectItem>
                    <SelectItem value="PARTIAL">Pago parcial</SelectItem>
                    <SelectItem value="PAID">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Registros ({totalItems})</CardTitle>
          <div className="flex items-center border rounded-md bg-background/80">
            <Button
              type="button"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setViewMode('table')}
              aria-label="Vista de lista"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setViewMode('cards')}
              aria-label="Vista de cuadros"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Cargando registros...</div>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-16 h-16 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No hay registros</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ||
                selectedSupplierId !== 'all' ||
                startDate ||
                endDate ||
                paymentStatusFilter !== 'all'
                  ? 'No se encontraron registros con los filtros aplicados'
                  : 'Aún no hay registros de mercancía'}
              </p>
              {canRegister && (
                <Button onClick={() => navigate('/inventario/registrar-ingreso')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Mercancía
                </Button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Fecha</th>
                    <th className="text-left p-2 font-semibold">Proveedor</th>
                    <th className="text-left p-2 font-semibold">Término</th>
                    <th className="text-left p-2 font-semibold">Pago</th>
                    <th className="text-left p-2 font-semibold">Registrado por</th>
                    <th className="text-left p-2 font-semibold">Productos</th>
                    <th className="text-right p-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      role={canDetails ? 'button' : undefined}
                      tabIndex={canDetails ? 0 : undefined}
                      className={
                        canDetails
                          ? 'border-b hover:bg-muted/50 cursor-pointer transition-colors'
                          : 'border-b hover:bg-muted/50'
                      }
                      onClick={canDetails ? () => handleViewDetails(record.id) : undefined}
                      onKeyDown={
                        canDetails
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleViewDetails(record.id)
                              }
                            }
                          : undefined
                      }
                    >
                      <td className="p-2 text-sm">{formatDate(record.date)}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{record.supplier.name}</span>
                        </div>
                      </td>
                      <td className="p-2 text-sm max-w-[140px] truncate" title={record.payment_term?.name}>
                        {record.payment_term?.name ?? '—'}
                      </td>
                      <td className="p-2">
                        <PaymentStatusBadge status={record.payment_status} />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{record.registeredBy.name}</span>
                        </div>
                      </td>
                      <td className="p-2">
                        <Badge variant="secondary">{record.itemsCount} productos</Badge>
                      </td>
                      <td className="p-2 text-right font-semibold">
                        {formatCurrency(record.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {records.map((record) => (
                <Card
                  key={record.id}
                  role={canDetails ? 'button' : undefined}
                  tabIndex={canDetails ? 0 : undefined}
                  className={
                    canDetails
                      ? 'hover:shadow-md transition-shadow cursor-pointer'
                      : 'hover:shadow-md transition-shadow'
                  }
                  onClick={canDetails ? () => handleViewDetails(record.id) : undefined}
                  onKeyDown={
                    canDetails
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleViewDetails(record.id)
                          }
                        }
                      : undefined
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold">{record.supplier.name}</CardTitle>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(record.date)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>{record.registeredBy.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {record.itemsCount} {record.itemsCount === 1 ? 'producto' : 'productos'}
                      </Badge>
                      <PaymentStatusBadge status={record.payment_status} />
                    </div>
                    {record.payment_term?.name && (
                      <p className="text-xs text-muted-foreground truncate" title={record.payment_term.name}>
                        Término: {record.payment_term.name}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(record.totalValue)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items por página:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[72px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[18, 27, 36].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default IncomingMerchandiseManagement
