import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  ChartNoAxesCombined,
  CreditCard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchAging, fetchReceivables } from '@/modules/receivables/api/receivablesService'
import type { AnalyticsResponse } from '../api/analyticsService'
import { buildAnalyticsTabs } from '../analyticsViewModel'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const COLORS = ['#f97316', '#2563eb', '#22c55e', '#8b5cf6', '#ef4444', '#0ea5e9']

const TAB_META = {
  resumen: { label: 'Resumen', icon: ChartNoAxesCombined },
  ventas: { label: 'Ventas', icon: ShoppingCart },
  productos: { label: 'Productos', icon: Package },
  inventario: { label: 'Inventario', icon: Boxes },
  compras: { label: 'Compras y CxP', icon: Truck },
  cartera: { label: 'Cartera / CxC', icon: CreditCard },
} as const

type Props = {
  data?: AnalyticsResponse
  isLoading: boolean
  receivablesEnabled: boolean
  canViewReceivables: boolean
  formatCurrency: (value: number) => string
  formatCompactCurrency: (value: number) => string
  formatNumber: (value: number) => string
  children: ReactNode
}

function AnalyticsCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Card className={`rounded-2xl border-border/70 bg-card shadow-sm dark:bg-[#101f34] ${className}`}>{children}</Card>
}

function MetricCard({ label, value, hint, icon: Icon, loading, alert = false }: {
  label: string
  value: string
  hint?: string
  icon: typeof Wallet
  loading: boolean
  alert?: boolean
}) {
  return (
    <AnalyticsCard>
      <CardContent className="flex items-start gap-4 p-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${alert ? 'bg-red-500/15 text-red-500' : 'bg-brand-orange/15 text-brand-orange'}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-2 h-8 w-28" /> : <p className={`mt-1 truncate text-2xl font-bold tabular-nums ${alert ? 'text-red-500' : ''}`}>{value}</p>}
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </AnalyticsCard>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">{children}</p>
}

export function AnalyticsDetailTabs({
  data,
  isLoading,
  receivablesEnabled,
  canViewReceivables,
  formatCurrency,
  formatCompactCurrency,
  formatNumber,
  children,
}: Props) {
  const navigate = useNavigate()
  const tabs = buildAnalyticsTabs(receivablesEnabled, canViewReceivables)
  const showReceivables = tabs.includes('cartera')
  const receivables = useQuery({
    queryKey: ['analytics', 'receivables'],
    queryFn: fetchReceivables,
    enabled: showReceivables,
  })
  const aging = useQuery({
    queryKey: ['analytics', 'receivables', 'aging'],
    queryFn: fetchAging,
    enabled: showReceivables,
  })

  const monthly = (data?.monthly ?? []).map((item) => ({
    month: MONTHS[item.month - 1],
    ventas: item.ventasNetas ?? item.ventas - (item.devoluciones ?? 0),
    costo: item.costo,
    utilidad: (item.ventasNetas ?? item.ventas - (item.devoluciones ?? 0)) - item.costo,
  }))
  const purchases = (data?.purchases.monthly ?? []).map((item) => ({ month: MONTHS[item.month - 1], amount: item.amount }))
  const margin = data?.totals.totalSales ? (data.totals.totalProfit / data.totals.totalSales) * 100 : 0

  return (
    <Tabs defaultValue="resumen" className="space-y-5">
      <div className="overflow-x-auto pb-1" aria-label="Secciones de análisis">
        <TabsList className="inline-flex h-12 min-w-max rounded-xl border border-border/70 bg-card p-1 shadow-sm dark:bg-[#101f34]">
          {tabs.map((tab) => {
            const meta = TAB_META[tab as keyof typeof TAB_META]
            const Icon = meta.icon
            return (
              <TabsTrigger key={tab} value={tab} className="h-10 rounded-lg px-3 text-xs data-[state=active]:bg-brand-orange data-[state=active]:text-white sm:px-4 sm:text-sm">
                <Icon className="mr-2 h-4 w-4" aria-hidden />{meta.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>

      <TabsContent value="resumen" className="mt-0 space-y-5">{children}</TabsContent>

      <TabsContent value="ventas" className="mt-0 space-y-4">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Ventas netas" value={formatCurrency(data?.totals.totalSales ?? 0)} hint={`Devoluciones: ${formatCurrency(data?.totals.totalReturns ?? 0)}`} icon={ShoppingCart} loading={isLoading} />
          <MetricCard label="Utilidad" value={formatCurrency(data?.totals.totalProfit ?? 0)} hint={`Margen ${margin.toFixed(1)}%`} icon={Wallet} loading={isLoading} />
          <MetricCard label="Unidades vendidas" value={formatNumber(data?.totals.stockRotation ?? 0)} hint={`${formatNumber(data?.totals.productsCount ?? 0)} productos`} icon={Package} loading={isLoading} />
          <MetricCard label="Costo de ventas" value={formatCurrency(data?.totals.totalCost ?? 0)} icon={ChartNoAxesCombined} loading={isLoading} />
        </section>
        <AnalyticsCard>
          <CardHeader><CardTitle className="text-base">Ventas, costo y utilidad por mes</CardTitle></CardHeader>
          <CardContent className="h-80">
            {isLoading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={58} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="ventas" name="Ventas" fill="#f97316" radius={[5, 5, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="costo" name="Costo" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="utilidad" name="Utilidad" fill="#22c55e" radius={[5, 5, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </AnalyticsCard>
        <section className="grid gap-4 xl:grid-cols-2">
          <AnalyticsCard>
            <CardHeader><CardTitle className="text-base">Métodos de pago</CardTitle></CardHeader>
            <CardContent className="h-72">
              {!isLoading && !data?.paymentMethods.length ? <Empty>Sin datos en el período.</Empty> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={data?.paymentMethods ?? []} dataKey="total" nameKey="method" innerRadius={58} outerRadius={92}>{(data?.paymentMethods ?? []).map((item, index) => <Cell key={item.method} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </AnalyticsCard>
          <AnalyticsCard>
            <CardHeader><CardTitle className="text-base">Ventas por canal</CardTitle></CardHeader>
            <CardContent className="h-72">
              {!isLoading && !data?.channels.length ? <Empty>Sin datos en el período.</Empty> : (
                <ResponsiveContainer width="100%" height="100%"><BarChart data={data?.channels ?? []} layout="vertical"><CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => formatCompactCurrency(Number(value))} /><YAxis type="category" dataKey="label" width={105} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="total" name="Ventas" fill="#f97316" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
              )}
            </CardContent>
          </AnalyticsCard>
        </section>
      </TabsContent>

      <TabsContent value="productos" className="mt-0 space-y-4">
        <section className="grid gap-4 xl:grid-cols-2">
          <AnalyticsCard>
            <CardHeader><CardTitle className="text-base">Productos más vendidos</CardTitle></CardHeader>
            <CardContent className="h-80">
              {!isLoading && !data?.topProducts.length ? <Empty>Sin ventas en el período.</Empty> : (
                <ResponsiveContainer width="100%" height="100%"><BarChart data={data?.topProducts ?? []} layout="vertical"><CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => formatCompactCurrency(Number(value))} /><YAxis type="category" dataKey="name" width={125} tickFormatter={(value: string) => value.length > 18 ? `${value.slice(0, 17)}…` : value} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="revenue" name="Ingresos" fill="#f97316" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
              )}
            </CardContent>
          </AnalyticsCard>
          <AnalyticsCard>
            <CardHeader><CardTitle className="text-base">Participación por categoría</CardTitle></CardHeader>
            <CardContent className="h-80">
              {!isLoading && !data?.categoryPerformance.length ? <Empty>Sin datos en el período.</Empty> : (
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data?.categoryPerformance ?? []} dataKey="revenue" nameKey="category" innerRadius={62} outerRadius={100}>{(data?.categoryPerformance ?? []).map((item, index) => <Cell key={item.category} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart></ResponsiveContainer>
              )}
            </CardContent>
          </AnalyticsCard>
        </section>
        <AnalyticsCard>
          <CardHeader><CardTitle className="text-base">Rentabilidad por categoría</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.categoryPerformance ?? []).map((category) => (
              <div key={category.category} className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <span className="truncate font-medium">{category.category}</span>
                <span className="text-sm text-muted-foreground">{formatCurrency(category.revenue)} de ingresos</span>
                <strong className={category.margin < 15 ? 'text-red-500' : 'text-brand-orange'}>{category.margin.toFixed(1)}%</strong>
              </div>
            ))}
            {!isLoading && !data?.categoryPerformance.length ? <Empty>Sin datos en el período.</Empty> : null}
          </CardContent>
        </AnalyticsCard>
      </TabsContent>

      <TabsContent value="inventario" className="mt-0 space-y-4">
        <p className="text-xs text-muted-foreground">Estado actual; no depende del año seleccionado.</p>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Valor a costo" value={formatCurrency(data?.inventory.stockValue ?? 0)} icon={Boxes} loading={isLoading} />
          <MetricCard label="Valor de venta" value={formatCurrency(data?.inventory.retailValue ?? 0)} hint={`Utilidad potencial: ${formatCurrency(data?.inventory.potentialProfit ?? 0)}`} icon={Wallet} loading={isLoading} />
          <MetricCard label="Stock bajo" value={formatNumber(data?.inventory.lowStockCount ?? 0)} icon={AlertTriangle} loading={isLoading} alert />
          <MetricCard label="Agotados" value={formatNumber(data?.inventory.outOfStockCount ?? 0)} hint={`${formatNumber(data?.inventory.productsCount ?? 0)} productos`} icon={AlertTriangle} loading={isLoading} alert />
        </section>
        <AnalyticsCard>
          <CardHeader><CardTitle className="text-base">Valor de inventario por categoría</CardTitle></CardHeader>
          <CardContent className="h-80">
            {!isLoading && !data?.inventory.byCategory.length ? <Empty>Sin productos en inventario.</Empty> : (
              <ResponsiveContainer width="100%" height="100%"><BarChart data={data?.inventory.byCategory ?? []} layout="vertical"><CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => formatCompactCurrency(Number(value))} /><YAxis type="category" dataKey="category" width={130} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="value" name="Valor" fill="#f97316" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
            )}
          </CardContent>
        </AnalyticsCard>
      </TabsContent>

      <TabsContent value="compras" className="mt-0 space-y-4">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Compras del período" value={formatCurrency(data?.purchases.total ?? 0)} icon={Truck} loading={isLoading} />
          <MetricCard label="Cuentas por pagar" value={formatCurrency(data?.purchases.payablePending ?? 0)} hint="Saldo pendiente a proveedores" icon={Wallet} loading={isLoading} alert />
          <MetricCard label="Ingresos pendientes" value={formatNumber(data?.purchases.payableCount ?? 0)} icon={AlertTriangle} loading={isLoading} alert />
          <MetricCard label="Inventario inicial" value={formatCurrency(data?.initialInventory.total ?? 0)} hint="Saldo de apertura" icon={Boxes} loading={isLoading} />
        </section>
        <section className="grid gap-4 xl:grid-cols-2">
          <AnalyticsCard>
            <CardHeader><CardTitle className="text-base">Compras por mes</CardTitle></CardHeader>
            <CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={purchases}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="amount" name="Compras" fill="#f97316" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></CardContent>
          </AnalyticsCard>
          <AnalyticsCard>
            <CardHeader><CardTitle className="text-base">Principales proveedores</CardTitle></CardHeader>
            <CardContent className="h-72">
              {!isLoading && !data?.purchases.topSuppliers.length ? <Empty>Sin compras en el período.</Empty> : (
                <ResponsiveContainer width="100%" height="100%"><BarChart data={data?.purchases.topSuppliers ?? []} layout="vertical"><CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => formatCompactCurrency(Number(value))} /><YAxis type="category" dataKey="name" width={125} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="amount" name="Compras" fill="#2563eb" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
              )}
            </CardContent>
          </AnalyticsCard>
        </section>
      </TabsContent>

      {showReceivables ? (
        <TabsContent value="cartera" className="mt-0 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Estado actual de cuentas por cobrar; no depende del año seleccionado.</p>
            <Button variant="outline" className="rounded-xl border-brand-orange/50 text-brand-orange hover:text-brand-orange" onClick={() => navigate('/cartera')}>Gestionar cartera</Button>
          </div>
          {receivables.isError || aging.isError ? (
            <AnalyticsCard><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><AlertTriangle className="h-8 w-8 text-red-500" /><p>No pudimos cargar la cartera.</p><Button onClick={() => { void receivables.refetch(); void aging.refetch() }}>Reintentar</Button></CardContent></AnalyticsCard>
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total por cobrar" value={formatCurrency(receivables.data?.total_por_cobrar ?? 0)} icon={CreditCard} loading={receivables.isLoading} />
                <MetricCard label="Saldo vencido" value={formatCurrency(receivables.data?.total_vencido ?? 0)} icon={AlertTriangle} loading={receivables.isLoading} alert />
                <MetricCard label="Saldo a favor" value={formatCurrency(receivables.data?.total_credito ?? 0)} icon={Wallet} loading={receivables.isLoading} />
                <MetricCard label="Clientes con saldo" value={formatNumber(receivables.data?.items.length ?? 0)} icon={Users} loading={receivables.isLoading} />
              </section>
              <section className="grid gap-4 xl:grid-cols-2">
                <AnalyticsCard>
                  <CardHeader><CardTitle className="text-base">Antigüedad de saldos</CardTitle></CardHeader>
                  <CardContent className="h-72">
                    {aging.isLoading ? <Skeleton className="h-full w-full" /> : (
                      <ResponsiveContainer width="100%" height="100%"><BarChart data={[
                        { label: 'Corriente', value: aging.data?.totales.corriente ?? 0 },
                        { label: '1-30 días', value: aging.data?.totales.d1_30 ?? 0 },
                        { label: '31-60 días', value: aging.data?.totales.d31_60 ?? 0 },
                        { label: '61-90 días', value: aging.data?.totales.d61_90 ?? 0 },
                        { label: '+90 días', value: aging.data?.totales.d90_mas ?? 0 },
                      ]}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="value" name="Saldo" fill="#f97316" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
                    )}
                  </CardContent>
                </AnalyticsCard>
                <AnalyticsCard>
                  <CardHeader><CardTitle className="text-base">Mayores saldos de clientes</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {(receivables.data?.items ?? []).slice().sort((a, b) => b.saldo - a.saldo).slice(0, 8).map((customer) => (
                      <div key={customer.customer_id} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-3">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{customer.customer_name}</p><p className="text-xs text-muted-foreground">{customer.facturas} facturas</p></div>
                        <div className="text-right"><p className="text-sm font-semibold">{formatCurrency(customer.saldo)}</p>{customer.vencido > 0 ? <p className="text-xs text-red-500">{formatCurrency(customer.vencido)} vencido</p> : null}</div>
                      </div>
                    ))}
                    {!receivables.isLoading && !receivables.data?.items.length ? <Empty>Sin saldos pendientes.</Empty> : null}
                  </CardContent>
                </AnalyticsCard>
              </section>
            </>
          )}
        </TabsContent>
      ) : null}
    </Tabs>
  )
}
