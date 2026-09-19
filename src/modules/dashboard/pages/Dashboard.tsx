import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Package,
  ReceiptText,
  ShoppingCart,
  WalletCards,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth } from '@/context/useAuth'
import { useModules } from '@/context/useModules'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useExperienceProfile } from '@/hooks/useExperienceProfile'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useOverdueReceivablesCount } from '@/modules/receivables/hooks/useOverdueReceivablesCount'
import useCriticalProducts from '../hooks/useCriticalProducts'
import useDashboardStats from '../hooks/useDashboardStats'

type PeriodKey = 'today' | 'week' | 'month'

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const { enabledModuleCodes, isEnabled } = useModules()
  const { showAdvancedByDefault } = useExperienceProfile()
  const { companyName, currencyCode, locale } = useSystemSettings()
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [advancedOpen, setAdvancedOpen] = useState(showAdvancedByDefault)

  const canViewAnalytics = hasPermission('analytics.view')
  const canViewReports = isEnabled('reports') && hasPermission('reports.view')
  const canCreateSales = isEnabled('sales') && hasPermission('sales.create')
  const canViewInventory = isEnabled('inventory') && hasPermission('products.view')
  const canViewCriticalProducts = isEnabled('inventory') && hasPermission('products.view', 'alerts.view')
  const canViewAlerts = isEnabled('alerts') && hasPermission('alerts.view', 'alerts.manage')
  const canViewCashClosures = isEnabled('cash-closure') && hasPermission('cashclosure.view')
  const canViewReceivables = isEnabled('receivables') && hasPermission('receivables.view')
  const modulesReady = enabledModuleCodes !== null

  const { data: statsData, isLoading: statsLoading, isError: statsError } = useDashboardStats(canViewAnalytics)
  const { data: criticalProducts = [], isLoading: criticalLoading } = useCriticalProducts(
    modulesReady && canViewCriticalProducts,
  )
  const { data: overdueReceivables } = useOverdueReceivablesCount()

  const loc = locale || 'es-GT'
  const formatCurrency = (value: number | null | undefined) => new Intl.NumberFormat(loc, {
    style: 'currency',
    currency: currencyCode || 'GTQ',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0)
  const formatNumber = (value: number | null | undefined) => (value ?? 0).toLocaleString(loc)
  const selected = statsData?.periods?.[period]

  const comparison = (value: number | null | undefined) => {
    if (value == null) return 'Sin referencia anterior'
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}% vs período anterior`
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  if (!canViewAnalytics) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sin acceso al tablero</CardTitle>
            <CardDescription>Tu perfil no tiene permiso para consultar indicadores del negocio.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const attentionSections = [canViewCriticalProducts, canViewCashClosures, canViewReceivables].filter(Boolean).length

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{companyName}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting}, {user?.name || 'Usuario'}
          </h1>
          <p className="mt-1 text-muted-foreground">Lo importante del negocio, sin llenar la pantalla de datos.</p>
        </div>
        <div className="flex w-full rounded-lg border bg-muted/40 p-1 sm:w-auto" aria-label="Período del resumen">
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={period === key ? 'default' : 'ghost'}
              className="flex-1 sm:flex-none"
              onClick={() => setPeriod(key)}
            >
              {PERIOD_LABELS[key]}
            </Button>
          ))}
        </div>
      </header>

      {statsError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            No se pudo actualizar el resumen. Intenta recargar la página.
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={`Resumen de ${PERIOD_LABELS[period].toLowerCase()}`}>
        {[
          {
            title: 'Ventas',
            value: formatCurrency(selected?.sales),
            detail: comparison(selected?.salesChange),
            icon: CircleDollarSign,
          },
          {
            title: 'Ganancia bruta estimada',
            value: formatCurrency(selected?.estimatedGrossProfit),
            detail: comparison(selected?.profitChange),
            icon: BarChart3,
          },
          {
            title: 'Ventas realizadas',
            value: formatNumber(selected?.transactions),
            detail: selected?.transactions === 1 ? 'ticket cobrado' : 'tickets cobrados',
            icon: ReceiptText,
          },
          {
            title: 'Ticket promedio',
            value: formatCurrency(selected?.averageTicket),
            detail: `Promedio de ${PERIOD_LABELS[period].toLowerCase()}`,
            icon: WalletCards,
          },
        ].map(({ title, value, detail, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-2">
                  <div className="h-8 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {attentionSections > 0 && (
        <section className="space-y-3" aria-labelledby="attention-title">
          <div>
            <h2 id="attention-title" className="text-lg font-semibold">Necesita atención</h2>
            <p className="text-sm text-muted-foreground">Solo aparecen pendientes de módulos que tienes activos.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {canViewCriticalProducts && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-amber-600" /> Productos por agotarse
                  </CardTitle>
                  <CardDescription>{criticalLoading ? 'Actualizando…' : `${criticalProducts.length} productos bajo el mínimo`}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {criticalProducts.slice(0, 4).map((product) => (
                    <button
                      type="button"
                      key={product.id}
                      disabled={!canViewInventory}
                      onClick={() => canViewInventory && navigate(`/inventario/${product.id}`)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm enabled:hover:bg-muted"
                    >
                      <span className="truncate pr-3">{product.name}</span>
                      <Badge variant="outline">{product.stock} / {product.minStock}</Badge>
                    </button>
                  ))}
                  {!criticalLoading && criticalProducts.length === 0 && (
                    <p className="py-3 text-sm text-muted-foreground">El inventario está por encima de sus mínimos.</p>
                  )}
                  {(canViewInventory || canViewAlerts) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(canViewInventory ? '/inventario' : '/alertas')}
                    >
                      {canViewInventory ? 'Ver inventario' : 'Ver alertas'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {canViewCashClosures && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <WalletCards className="h-4 w-4 text-rose-600" /> Diferencias de caja
                  </CardTitle>
                  <CardDescription>Cierres pendientes que no cuadraron.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{statsData?.pendingCashDifferences?.count ?? 0}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Diferencia acumulada: {formatCurrency(statsData?.pendingCashDifferences?.amount)}
                  </p>
                  <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => navigate('/cierre-caja')}>
                    Revisar cierres
                  </Button>
                </CardContent>
              </Card>
            )}

            {canViewReceivables && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ReceiptText className="h-4 w-4 text-sky-600" /> Cobros vencidos
                  </CardTitle>
                  <CardDescription>Ventas al crédito que ya pasaron su fecha.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{overdueReceivables?.count ?? 0}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pendiente: {formatCurrency(overdueReceivables?.monto)}
                  </p>
                  <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => navigate('/cartera')}>
                    Ver cartera
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acciones frecuentes</CardTitle>
          <CardDescription>Atajos según tus permisos y módulos contratados.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canCreateSales && (
            <Button onClick={() => navigate('/ventas/nueva')}>
              <ShoppingCart className="mr-2 h-4 w-4" /> Nueva venta
            </Button>
          )}
          {canViewInventory && (
            <Button variant="outline" onClick={() => navigate('/inventario')}>
              <Package className="mr-2 h-4 w-4" /> Inventario
            </Button>
          )}
          {canViewAlerts && (
            <Button variant="outline" onClick={() => navigate('/alertas')}>
              <AlertTriangle className="mr-2 h-4 w-4" /> Alertas
            </Button>
          )}
          {canViewReports && (
            <Button variant="outline" onClick={() => navigate('/reportes')}>
              <FileText className="mr-2 h-4 w-4" /> Reportes
            </Button>
          )}
        </CardContent>
      </Card>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-between p-0 text-left">
                <span>
                  <span className="block text-base font-semibold">Información avanzada</span>
                  <span className="block text-sm font-normal text-muted-foreground">Inventario valorizado y acceso al análisis detallado.</span>
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
              {canViewInventory && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Productos con existencia</p>
                    <p className="text-xl font-semibold">{formatNumber(statsData?.productosEnStock.cantidad)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Inventario a costo</p>
                    <p className="text-xl font-semibold">{formatCurrency(statsData?.valorInventario.valor)}</p>
                  </div>
                </>
              )}
              {canViewAlerts && (
                <div>
                  <p className="text-sm text-muted-foreground">Alertas críticas</p>
                  <p className="text-xl font-semibold">{formatNumber(statsData?.alertasCriticas.cantidad)}</p>
                </div>
              )}
              {canViewReports && (
                <Button variant="secondary" className="self-center" onClick={() => navigate('/reportes')}>
                  Abrir análisis y exportaciones
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}

export default Dashboard
