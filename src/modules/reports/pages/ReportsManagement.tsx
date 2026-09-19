import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, ChevronDown, Download, FileSpreadsheet, SlidersHorizontal } from 'lucide-react'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertasIcon,
  AnalyticsIcon,
  InventariadoIcon,
  InventarioIcon,
  MercanciaIcon,
  ProveedoresIcon,
  ReporteFinancieroIcon,
  VentasIcon,
  type ModuleIconComponent,
} from '@/components/icons/CustomIcons'
import { useTenant } from '@/context/useTenant'
import { useModules } from '@/context/useModules'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useExperienceProfile } from '@/hooks/useExperienceProfile'
import { toast } from '@/hooks/use-toast'
import { downloadFile } from '@/services/api'
import { fetchWarehouses } from '@/services/warehouseService'

type Period = 'week' | 'month' | 'quarter' | 'semester' | 'year' | 'all'
type ReportDefinition = {
  id: string
  name: string
  description: string
  icon: ModuleIconComponent
  color: string
  bgColor: string
  requiredModules: string[]
  everyday?: boolean
}

const REPORT_TYPES: ReportDefinition[] = [
  {
    id: 'sales',
    name: 'Ventas',
    description: 'Ventas, métodos de pago, cajeros y productos vendidos.',
    icon: VentasIcon,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    requiredModules: ['sales'],
    everyday: true,
  },
  {
    id: 'inventory',
    name: 'Inventario actual',
    description: 'Existencias, costos y productos que requieren reposición.',
    icon: InventarioIcon,
    color: 'text-violet-700',
    bgColor: 'bg-violet-100',
    requiredModules: ['inventory'],
    everyday: true,
  },
  {
    id: 'financial',
    name: 'Resultado del negocio',
    description: 'Ventas, costo, compras y margen del período.',
    icon: ReporteFinancieroIcon,
    color: 'text-sky-700',
    bgColor: 'bg-sky-100',
    requiredModules: ['sales', 'inventory'],
    everyday: true,
  },
  {
    id: 'alerts',
    name: 'Pendientes y alertas',
    description: 'Reposición priorizada y alertas que siguen abiertas.',
    icon: AlertasIcon,
    color: 'text-rose-700',
    bgColor: 'bg-rose-100',
    requiredModules: ['alerts'],
    everyday: true,
  },
  {
    id: 'merchandise',
    name: 'Ingresos de mercadería',
    description: 'Compras recibidas, pagos y desglose por proveedor.',
    icon: MercanciaIcon,
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    requiredModules: ['merchandise'],
  },
  {
    id: 'suppliers',
    name: 'Proveedores',
    description: 'Volumen comprado y desempeño de proveedores.',
    icon: ProveedoresIcon,
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    requiredModules: ['contacts'],
  },
  {
    id: 'products',
    name: 'Análisis de productos',
    description: 'Márgenes, categorías, proveedores y rankings de valor.',
    icon: AnalyticsIcon,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    requiredModules: ['inventory'],
  },
  {
    id: 'inventory-counts',
    name: 'Historial de inventariados',
    description: 'Conteos físicos, diferencias y mermas por sesión.',
    icon: InventariadoIcon,
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
    requiredModules: ['inventory-count'],
  },
  {
    id: 'stock-by-location',
    name: 'Existencias por almacén',
    description: 'Unidades y valor por almacén y ubicación.',
    icon: InventarioIcon,
    color: 'text-violet-700',
    bgColor: 'bg-violet-100',
    requiredModules: ['inventory'],
  },
  {
    id: 'kardex',
    name: 'Kardex por ubicación',
    description: 'Entradas, salidas y saldo por ubicación en el período.',
    icon: InventariadoIcon,
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
    requiredModules: ['inventory'],
  },
  {
    id: 'internal-moves',
    name: 'Movimientos internos',
    description: 'Traslados entre anaqueles y responsable del movimiento.',
    icon: MercanciaIcon,
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    requiredModules: ['inventory'],
  },
  {
    id: 'replenishment',
    name: 'Reposición interna',
    description: 'Ubicaciones bajo mínimo y origen sugerido para reponer.',
    icon: AlertasIcon,
    color: 'text-rose-700',
    bgColor: 'bg-rose-100',
    requiredModules: ['inventory'],
  },
  {
    id: 'occupancy',
    name: 'Ocupación de ubicaciones',
    description: 'Ubicaciones vacías, llenas y cantidad de SKU almacenados.',
    icon: AnalyticsIcon,
    color: 'text-sky-700',
    bgColor: 'bg-sky-100',
    requiredModules: ['inventory'],
  },
]

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Esta semana',
  month: 'Mes',
  quarter: 'Trimestre',
  semester: 'Semestre',
  year: 'Año',
  all: 'Todo el histórico',
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const ReportCard = ({ report, onGenerate }: { report: ReportDefinition; onGenerate: () => void }) => {
  const Icon = report.icon
  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2.5 ${report.bgColor}`}>
            <Icon className={`h-6 w-6 ${report.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{report.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
          </div>
        </div>
        <Button className="mt-5 w-full" variant="outline" onClick={onGenerate}>
          <Download className="mr-2 h-4 w-4" /> Preparar descarga
        </Button>
      </CardContent>
    </Card>
  )
}

const ReportsManagement = () => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const initialYear = Math.max(2025, currentYear)
  const { branch, branches, isConsolidated } = useTenant()
  const { hasPermission } = useAuthPermissions()
  const { enabledModuleCodes, isEnabled } = useModules()
  const { showAdvancedByDefault } = useExperienceProfile()

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [pendingReport, setPendingReport] = useState<ReportDefinition | null>(null)
  const [period, setPeriod] = useState<Period>('month')
  const [year, setYear] = useState<number | 'all'>(initialYear)
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1)
  const [semester, setSemester] = useState<1 | 2>(now.getMonth() < 6 ? 1 : 2)
  const [branchId, setBranchId] = useState<string>(branch?.id || '')
  const [warehouseId, setWarehouseId] = useState('all')
  const [isGenerating, setIsGenerating] = useState(false)
  const [specializedOpen, setSpecializedOpen] = useState(showAdvancedByDefault)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(showAdvancedByDefault)

  useEffect(() => {
    setBranchId(isConsolidated ? 'all' : branch?.id || '')
    setWarehouseId('all')
  }, [branch?.id, isConsolidated])

  const canViewAll = hasPermission('branches.view_all')
  const showBranchPicker = branches.length > 1 || canViewAll
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', branch?.id],
    queryFn: fetchWarehouses,
    enabled: filtersOpen,
  })
  const showWarehousePicker = (warehouses?.length ?? 0) > 1 && (!branchId || branchId === branch?.id)

  const visibleReports = useMemo(
    () => enabledModuleCodes === null
      ? []
      : REPORT_TYPES.filter((report) => report.requiredModules.every(isEnabled)),
    [enabledModuleCodes, isEnabled],
  )
  const everydayReports = visibleReports.filter((report) => report.everyday)
  const specializedReports = visibleReports.filter((report) => !report.everyday)

  const selectedBranch = branchId || (isConsolidated ? 'all' : branch?.id || '')
  const scopeLabel = selectedBranch === 'all'
    ? 'Todas las sucursales'
    : branches.find((candidate) => candidate.id === selectedBranch)?.name || 'Sucursal activa'
  const warehouseLabel = showWarehousePicker && warehouseId !== 'all'
    ? warehouses?.find((warehouse) => warehouse.id === warehouseId)?.name
    : null

  const periodDetail = period === 'month' && month
    ? MONTH_NAMES[month - 1]
    : period === 'quarter' && month
      ? `trimestre ${Math.ceil(month / 3)}`
      : period === 'semester'
        ? `semestre ${semester}`
        : PERIOD_LABELS[period]
  const periodLabel = `${periodDetail}${year === 'all' || period === 'all' ? '' : ` de ${year}`}`
  const exportSummary = `${scopeLabel}${warehouseLabel ? ` · ${warehouseLabel}` : ''}. ${periodLabel}.`

  const choosePreset = (nextPeriod: 'week' | 'month' | 'year') => {
    setPeriod(nextPeriod)
    setYear(currentYear)
    setMonth(nextPeriod === 'month' ? now.getMonth() + 1 : null)
  }

  const openReport = (report: ReportDefinition) => {
    setPendingReport(report)
    setFiltersOpen(true)
  }

  const generateReport = async (format: 'pdf' | 'csv') => {
    if (!pendingReport) return
    setIsGenerating(true)
    try {
      const params = new URLSearchParams({ period, format })
      if (year !== 'all') params.set('year', String(year))
      if (period === 'month' && month) params.set('month', String(month))
      if (period === 'quarter' && month) params.set('quarter', String(Math.ceil(month / 3)))
      if (period === 'semester') params.set('semester', String(semester))
      if (showWarehousePicker && warehouseId !== 'all') params.set('warehouse_id', warehouseId)
      await downloadFile(
        `/reports/${pendingReport.id}?${params.toString()}`,
        `${pendingReport.id}-${period}.${format}`,
        selectedBranch ? { 'X-Branch-Id': selectedBranch } : undefined,
      )
      toast({ title: 'Reporte listo', description: `${pendingReport.name} descargado.` })
      setFiltersOpen(false)
      setPendingReport(null)
    } catch (error) {
      toast({
        title: 'No se pudo generar el reporte',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <ExportDialog
        open={filtersOpen}
        onOpenChange={(open) => {
          setFiltersOpen(open)
          if (!open) setPendingReport(null)
        }}
        title={`Descargar ${pendingReport?.name || 'reporte'}`}
        summary={exportSummary}
        pending={isGenerating}
        onExport={({ format }) => {
          if (format !== 'xlsx') void generateReport(format)
        }}
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">¿Qué período necesitas?</p>
            <p className="text-sm text-muted-foreground">Elige una opción rápida o abre los filtros avanzados.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['week', 'Semana'],
              ['month', 'Mes'],
              ['year', 'Año'],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={period === value ? 'default' : 'outline'}
                onClick={() => choosePreset(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <Collapsible open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="w-full justify-between px-0">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Filtros avanzados
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedFiltersOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 border-t pt-4">
            {showBranchPicker && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Sucursal</p>
                <Select value={selectedBranch} onValueChange={(value) => { setBranchId(value); setWarehouseId('all') }}>
                  <SelectTrigger><SelectValue placeholder="Selecciona sucursal" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
                    ))}
                    {canViewAll && <SelectItem value="all">Toda la empresa</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showWarehousePicker && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Almacén</p>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los almacenes</SelectItem>
                    {(warehouses ?? []).map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Período</p>
                <Select value={period} onValueChange={(value) => {
                  const next = value as Period
                  setPeriod(next)
                  if (next !== 'month' && next !== 'quarter') setMonth(null)
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="month">Mes</SelectItem>
                    <SelectItem value="quarter">Trimestre</SelectItem>
                    <SelectItem value="semester">Semestre</SelectItem>
                    <SelectItem value="year">Año</SelectItem>
                    <SelectItem value="all">Todo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Año</p>
                <Select value={String(year)} onValueChange={(value) => setYear(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Array.from({ length: currentYear - 2025 + 1 }, (_, index) => 2025 + index).map((candidate) => (
                      <SelectItem key={candidate} value={String(candidate)}>{candidate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {period === 'month' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Mes</p>
                  <Select value={month ? String(month) : ''} onValueChange={(value) => setMonth(Number(value))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, index) => (
                        <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {period === 'quarter' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Trimestre</p>
                  <Select
                    value={String(Math.ceil((month || now.getMonth() + 1) / 3))}
                    onValueChange={(value) => setMonth((Number(value) - 1) * 3 + 1)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((candidate) => (
                        <SelectItem key={candidate} value={String(candidate)}>Q{candidate}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {period === 'semester' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Semestre</p>
                  <Select value={String(semester)} onValueChange={(value) => setSemester(value === '2' ? 2 : 1)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Primero</SelectItem>
                      <SelectItem value="2">Segundo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </ExportDialog>

      <header>
        <p className="text-sm text-muted-foreground">Decide primero; exporta el detalle cuando lo necesites.</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reportes</h1>
      </header>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CalendarRange className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Flujo simple de descarga</p>
              <p className="text-sm text-muted-foreground">Elige un reporte, selecciona semana/mes/año y descarga PDF o CSV.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" /> CSV se abre en Excel o Google Sheets
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="everyday-reports">
        <div>
          <h2 id="everyday-reports" className="text-lg font-semibold">Reportes principales</h2>
          <p className="text-sm text-muted-foreground">Los que un dueño o encargado consulta con más frecuencia.</p>
        </div>
        {enabledModuleCodes === null ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Card key={index}><CardContent className="h-44 animate-pulse bg-muted/40" /></Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {everydayReports.map((report) => (
              <ReportCard key={report.id} report={report} onGenerate={() => openReport(report)} />
            ))}
          </div>
        )}
      </section>

      {specializedReports.length > 0 && (
        <Collapsible open={specializedOpen} onOpenChange={setSpecializedOpen}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="h-auto w-full justify-between p-0 text-left">
                  <span>
                    <CardTitle className="text-lg">Reportes especializados</CardTitle>
                    <CardDescription className="mt-1">Inventariados, proveedores, kardex y operación de almacén.</CardDescription>
                  </span>
                  <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    {specializedReports.length} disponibles
                    <ChevronDown className={`h-4 w-4 transition-transform ${specializedOpen ? 'rotate-180' : ''}`} />
                  </span>
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
                {specializedReports.map((report) => (
                  <ReportCard key={report.id} report={report} onGenerate={() => openReport(report)} />
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  )
}

export default ReportsManagement
