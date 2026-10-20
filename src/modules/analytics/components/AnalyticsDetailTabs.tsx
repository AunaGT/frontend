import {formatUnitDecimal} from '@/modules/inventory/units/public'
import { useState, type ReactNode } from 'react'
import { usePageTrail } from '@/components/layout/PageNavigation'
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
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingState } from '@/components/shared/LoadingState'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ModuleTabsList, ModuleTabsTrigger } from '@/components/shared/ModuleTabs'
import { fetchAging, fetchReceivables } from '@/modules/receivables/api/receivablesService'
import type { AnalyticsResponse } from '../api/analyticsService'
import { MONTHS, buildAnalyticsTabs, buildInventorySegments, buildMonthlySeries, calculateMargin, toRanking, type AnalyticsSectionAccess } from '../analyticsViewModel'
import { ChartCard, ChartLegend, ChartTooltip, Empty, ExpandableTable, RankedBars, ShareBar, StockHealth } from './AnalyticsCharts'
import { SERIES, chart } from './chartTheme'

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
  sectionAccess: AnalyticsSectionAccess
  formatCurrency: (value: number) => string
  formatCompactCurrency: (value: number) => string
  formatNumber: (value: number) => string
  locale?: string
  children: ReactNode
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`
const maxOf = (values: number[]) => Math.max(0, ...values)

export function AnalyticsDetailTabs({
  data,
  isLoading,
  sectionAccess,
  formatCurrency,
  formatCompactCurrency,
  formatNumber,
  locale='es-GT',
  children,
}: Props) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('resumen')
  usePageTrail([{ label: ({resumen:'Resumen',ventas:'Ventas',productos:'Productos',inventario:'Inventario',compras:'Compras',cartera:'Cartera'} as Record<string,string>)[activeTab] || 'Resumen' }])
  const tabs = buildAnalyticsTabs(sectionAccess)
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

  const monthly = buildMonthlySeries(data?.monthly ?? [])
  const purchases = (data?.purchases.monthly ?? []).map((item) => ({ month: MONTHS[item.month - 1], amount: item.amount }))
  const margin = calculateMargin(data?.totals.totalSales ?? 0, data?.totals.totalCost ?? 0)
  const categories = data?.categoryPerformance ?? []
  const categoryTotal = categories.reduce((sum, item) => sum + item.revenue, 0)
  const categoryMax = maxOf(categories.map((item) => item.revenue))
  const inventory = data?.inventory
  const stockByCategory = inventory?.byCategory ?? []
  const stockTotal = stockByCategory.reduce((sum, item) => sum + item.value, 0)
  const stockMax = maxOf(stockByCategory.map((item) => item.value))
  const needsAttention = (inventory?.lowStockCount ?? 0) + (inventory?.outOfStockCount ?? 0)
  const agingRows = [
    { label: 'Corriente', value: aging.data?.totales.corriente ?? 0 },
    { label: '1-30 días', value: aging.data?.totales.d1_30 ?? 0 },
    { label: '31-60 días', value: aging.data?.totales.d31_60 ?? 0 },
    { label: '61-90 días', value: aging.data?.totales.d61_90 ?? 0 },
    { label: '+90 días', value: aging.data?.totales.d90_mas ?? 0 },
  ]
  const chartOrLoading = (loading: boolean, node: ReactNode) => loading ? <LoadingState variant="chart" message="Cargando gráfico…" /> : node

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
      <div className="overflow-x-auto pb-1" aria-label="Secciones de análisis">
        <ModuleTabsList>
          {tabs.map((tab) => {
            const meta = TAB_META[tab as keyof typeof TAB_META]
            const Icon = meta.icon
            return (
              <ModuleTabsTrigger key={tab} value={tab}>
                <Icon className="mr-2 h-4 w-4" aria-hidden />{meta.label}
              </ModuleTabsTrigger>
            )
          })}
        </ModuleTabsList>
      </div>

      <TabsContent value="resumen" className="mt-0 space-y-5">{children}</TabsContent>

      <TabsContent value="ventas" className="mt-0 space-y-5">
        <MetricStrip label="Resumen de ventas" loading={isLoading} items={[
          { label: 'Ventas netas', value: formatCurrency(data?.totals.totalSales ?? 0), hint: `Devoluciones ${formatCurrency(data?.totals.totalReturns ?? 0)}` },
          { label: 'Utilidad', value: formatCurrency(data?.totals.totalProfit ?? 0), hint: `Margen ${formatPercent(margin)}` },
          { label: 'Partidas vendidas', value: formatNumber(data?.totals.stockRotation ?? 0), hint: `${formatNumber(data?.totals.productsCount ?? 0)} productos` },
          { label: 'Costo de ventas', value: formatCurrency(data?.totals.totalCost ?? 0) },
        ]} />
        <ChartCard
          title="Ventas, costo y utilidad"
          description="Comparativo mensual del período"
          aside={<ChartLegend items={[{ label: 'Ventas', color: SERIES.sales }, { label: 'Costo', color: SERIES.cost }, { label: 'Utilidad', color: SERIES.profit }]} />}
        >
          <div className="h-80" role="img" aria-label="Ventas, costo y utilidad por mes">
            {chartOrLoading(isLoading, (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} barGap={2} barCategoryGap="20%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chart.grid} />
                  <XAxis dataKey="month" {...chart.axis} />
                  <YAxis {...chart.axis} width={64} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
                  <Tooltip cursor={chart.barCursor} content={<ChartTooltip format={formatCurrency} />} />
                  <Bar dataKey="ventas" name="Ventas" fill={SERIES.sales} radius={[4, 4, 0, 0]} maxBarSize={16} {...chart.motion} />
                  <Bar dataKey="costo" name="Costo" fill={SERIES.cost} radius={[4, 4, 0, 0]} maxBarSize={16} {...chart.motion} />
                  <Bar dataKey="utilidad" name="Utilidad" fill={SERIES.profit} radius={[4, 4, 0, 0]} maxBarSize={16} {...chart.motion} />
                </BarChart>
              </ResponsiveContainer>
            ))}
          </div>
        </ChartCard>
        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Métodos de pago" description="Ventas netas por método de pago">
            {chartOrLoading(isLoading, (
              <RankedBars
                label="Métodos de pago"
                format={formatCurrency}
                rows={toRanking((data?.paymentMethods ?? []).map((item) => ({ label: item.method, value: item.total, detail: `${formatNumber(item.count)} ventas` })), 6, (count) => `Otros ${count} métodos`)}
              />
            ))}
          </ChartCard>
          <ChartCard title="Ventas por canal" description="Ventas netas por canal de venta">
            {chartOrLoading(isLoading, (
              <RankedBars
                label="Ventas por canal"
                format={formatCurrency}
                rows={toRanking((data?.channels ?? []).map((item) => ({ label: item.label, value: item.total, detail: `${formatNumber(item.count)} ventas` })), 6, (count) => `Otros ${count} canales`)}
              />
            ))}
          </ChartCard>
        </section>
      </TabsContent>

      <TabsContent value="productos" className="mt-0 space-y-5">
        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Productos más vendidos" description="Por ingresos del período">
            {chartOrLoading(isLoading, (
              <RankedBars
                label="Productos más vendidos"
                format={formatCurrency}
                rows={(data?.topProducts ?? []).map((item) => ({ label: item.name, value: item.revenue, detail: `${item.category} · ${formatUnitDecimal(String(item.ventas),locale)} ${item.unit??'unidades'}` }))}
              />
            ))}
          </ChartCard>
          <ChartCard title="Participación por categoría" description="Ventas del período por categoría">
            {chartOrLoading(isLoading, (
              <RankedBars
                label="Participación por categoría"
                format={formatCurrency}
                rows={toRanking(categories.map((item) => ({ label: item.category, value: item.revenue })), 6, (count) => `Otras ${count} categorías`)}
              />
            ))}
          </ChartCard>
        </section>
        <ChartCard title="Rentabilidad por categoría" description="Ordenadas por ingresos" className="overflow-hidden" bodyClassName="px-0 pb-0">
          {chartOrLoading(isLoading, (
            <ExpandableTable
              label="Rentabilidad por categoría"
              columns={[{ label: 'Categoría' }, { label: 'Ingresos', numeric: true }, { label: 'Utilidad', numeric: true }, { label: 'Margen', numeric: true }, { label: 'Participación', numeric: true }]}
              rows={categories.map((item) => {
                const itemMargin = calculateMargin(item.revenue, item.cost)
                return {
                  key: item.category,
                  cells: [
                    <span className="font-medium">{item.category}</span>,
                    formatCurrency(item.revenue),
                    formatCurrency(item.revenue - item.cost),
                    <span className={itemMargin < 15 ? 'font-medium text-red-600 dark:text-red-400' : undefined}>{formatPercent(itemMargin)}</span>,
                    <ShareBar ratio={categoryTotal ? item.revenue / categoryTotal : 0} scale={categoryMax ? item.revenue / categoryMax : 0} />,
                  ],
                }
              })}
            />
          ))}
        </ChartCard>
      </TabsContent>

      <TabsContent value="inventario" className="mt-0 space-y-5">
        <p className="text-xs text-muted-foreground">Estado actual; no depende del año seleccionado.</p>
        <MetricStrip label="Resumen de inventario" loading={isLoading} items={[
          { label: 'Valor a costo', value: formatCurrency(inventory?.stockValue ?? 0) },
          { label: 'Valor de venta', value: formatCurrency(inventory?.retailValue ?? 0) },
          { label: 'Utilidad potencial', value: formatCurrency(inventory?.potentialProfit ?? 0), hint: `Margen ${formatPercent(calculateMargin(inventory?.retailValue ?? 0, inventory?.stockValue ?? 0))}` },
          { label: 'Productos', value: formatNumber(inventory?.productsCount ?? 0), hint: `${formatNumber(needsAttention)} con stock bajo o agotado` },
        ]} />
        <ChartCard title="Salud del inventario" description="Productos según su nivel de stock">
          {chartOrLoading(isLoading, (
            <StockHealth inline segments={buildInventorySegments(inventory ?? { productsCount: 0, lowStockCount: 0, outOfStockCount: 0 })} formatNumber={formatNumber} />
          ))}
        </ChartCard>
        <ChartCard title="Valor por categoría" description="Inventario valuado a costo" className="overflow-hidden" bodyClassName="px-0 pb-0">
          {chartOrLoading(isLoading, (
            <ExpandableTable
              label="Valor por categoría"
              columns={[{ label: 'Categoría' }, { label: 'Productos', numeric: true }, { label: 'Valor a costo', numeric: true }, { label: 'Del total', numeric: true }]}
              rows={stockByCategory.map((item) => ({
                key: item.category,
                cells: [
                  <span className="font-medium">{item.category}</span>,
                  formatNumber(item.units),
                  formatCurrency(item.value),
                  <ShareBar ratio={stockTotal ? item.value / stockTotal : 0} scale={stockMax ? item.value / stockMax : 0} />,
                ],
              }))}
            />
          ))}
        </ChartCard>
      </TabsContent>

      <TabsContent value="compras" className="mt-0 space-y-5">
        <MetricStrip label="Resumen de compras" loading={isLoading} items={[
          { label: 'Compras del período', value: formatCurrency(data?.purchases.total ?? 0) },
          { label: 'Cuentas por pagar', value: formatCurrency(data?.purchases.payablePending ?? 0), hint: 'Saldo pendiente a proveedores', alert: (data?.purchases.payablePending ?? 0) > 0 },
          { label: 'Ingresos pendientes', value: formatNumber(data?.purchases.payableCount ?? 0), hint: 'Ingresos de mercadería sin pagar', alert: (data?.purchases.payableCount ?? 0) > 0 },
          { label: 'Inventario inicial', value: formatCurrency(data?.initialInventory.total ?? 0), hint: 'Saldo de apertura' },
        ]} />
        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Compras por mes" description="Ingresos de mercadería valuados a costo">
            <div className="h-full min-h-72" role="img" aria-label="Compras por mes">
              {chartOrLoading(isLoading, (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={purchases} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid {...chart.grid} />
                    <XAxis dataKey="month" {...chart.axis} />
                    <YAxis {...chart.axis} width={64} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
                    <Tooltip cursor={chart.barCursor} content={<ChartTooltip format={formatCurrency} />} />
                    <Bar dataKey="amount" name="Compras" fill={SERIES.cost} radius={[4, 4, 0, 0]} maxBarSize={24} {...chart.motion} />
                  </BarChart>
                </ResponsiveContainer>
              ))}
            </div>
          </ChartCard>
          <ChartCard title="Principales proveedores" description="Compras del período por proveedor">
            {chartOrLoading(isLoading, (
              <RankedBars
                label="Principales proveedores"
                format={formatCurrency}
                color={SERIES.cost}
                rows={toRanking((data?.purchases.topSuppliers ?? []).map((item) => ({ label: item.name, value: item.amount })), 6, (count) => `Otros ${count} proveedores`)}
              />
            ))}
          </ChartCard>
        </section>
      </TabsContent>

      {showReceivables ? (
        <TabsContent value="cartera" className="mt-0 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Estado actual de cuentas por cobrar; no depende del año seleccionado.</p>
            <Button variant="outline" className="rounded-xl border-brand-orange/50 text-brand-orange hover:text-brand-orange" onClick={() => navigate('/cartera')}>Gestionar cartera</Button>
          </div>
          {receivables.isError || aging.isError ? (
            <Card className="auna-surface rounded-2xl"><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><AlertTriangle className="h-8 w-8 text-red-500" /><p>No pudimos cargar la cartera.</p><Button onClick={() => { void receivables.refetch(); void aging.refetch() }}>Reintentar</Button></CardContent></Card>
          ) : (
            <>
              <MetricStrip label="Resumen de cartera" loading={receivables.isLoading} items={[
                { label: 'Total por cobrar', value: formatCurrency(receivables.data?.total_por_cobrar ?? 0) },
                { label: 'Saldo vencido', value: formatCurrency(receivables.data?.total_vencido ?? 0), alert: (receivables.data?.total_vencido ?? 0) > 0 },
                { label: 'Saldo a favor', value: formatCurrency(receivables.data?.total_credito ?? 0) },
                { label: 'Clientes con saldo', value: formatNumber(receivables.data?.items.length ?? 0) },
              ]} />
              <section className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Antigüedad de saldos" description="Saldo según días de vencimiento">
                  <div className="h-full min-h-72" role="img" aria-label="Saldo según días de vencimiento">
                    {chartOrLoading(aging.isLoading, (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={agingRows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid {...chart.grid} />
                          <XAxis dataKey="label" {...chart.axis} />
                          <YAxis {...chart.axis} width={64} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
                          <Tooltip cursor={chart.barCursor} content={<ChartTooltip format={formatCurrency} />} />
                          <Bar dataKey="value" name="Saldo" fill={SERIES.sales} radius={[4, 4, 0, 0]} maxBarSize={24} {...chart.motion}>
                            {agingRows.map((row, index) => <Cell key={row.label} fill={`var(--analytics-age-${index + 1})`} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>
                </ChartCard>
                <ChartCard title="Mayores saldos de clientes" description="Clientes con más saldo pendiente">
                  {receivables.isLoading ? <LoadingState variant="chart" message="Cargando cartera…" /> : receivables.data?.items.length ? (
                    <RankedBars
                      label="Mayores saldos de clientes"
                      format={formatCurrency}
                      rows={receivables.data.items.slice().sort((a, b) => b.saldo - a.saldo).slice(0, 8).map((customer) => ({
                        label: customer.customer_name,
                        value: customer.saldo,
                        detail: `${customer.facturas} facturas${customer.vencido > 0 ? ` · ${formatCurrency(customer.vencido)} vencido` : ''}`,
                      }))}
                    />
                  ) : <Empty>Esta consulta no tiene saldos para mostrar. Los movimientos de cartera aparecerán aquí cuando correspondan.</Empty>}
                </ChartCard>
              </section>
            </>
          )}
        </TabsContent>
      ) : null}
    </Tabs>
  )
}
