import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, CalendarDays, ChartNoAxesCombined, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useModules } from '@/context/useModules'
import { useAnalytics, useAnalyticsFirstSaleYear } from '@/modules/analytics/hooks/useAnalytics'
import { AnalyticsDetailTabs } from '../components/AnalyticsDetailTabs'
import { ChartCard, ChartLegend, ChartTooltip, RankedBars, StockHealth } from '../components/AnalyticsCharts'
import { SERIES, chart } from '../components/chartTheme'
import { buildInventorySegments, buildMonthlySeries, calculateMargin, toRanking } from '../analyticsViewModel'
import '../analytics.css'

const Analytics = () => {
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const { enabledModuleCodes, isEnabled } = useModules()
  const { locale, currencyCode } = useSystemSettings()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear)
  const canViewAnalytics = hasPermission('analytics.view')
  const { data: yearMeta } = useAnalyticsFirstSaleYear()
  const { data, isLoading, isFetching, isError, refetch } = useAnalytics(selectedYear)
  const modulesReady = enabledModuleCodes !== null
  const sectionAccess = {
    inventory: modulesReady
      && isEnabled('inventory')
      && hasPermission('products.view')
      && (data?.availableSections?.inventory ?? true),
    purchases: modulesReady
      && isEnabled('merchandise')
      && hasPermission('merchandise.view')
      && (data?.availableSections?.purchases ?? true),
    receivables: modulesReady
      && isEnabled('receivables')
      && hasPermission('receivables.view')
      && (data?.availableSections?.receivables ?? true),
  }

  const firstYear = yearMeta?.firstSaleYear ?? currentYear
  const years = useMemo(
    () => Array.from({ length: Math.max(1, currentYear - firstYear + 1) }, (_, index) => currentYear - index),
    [currentYear, firstYear],
  )

  useEffect(() => {
    if (selectedYear !== 'all' && selectedYear < firstYear) setSelectedYear(firstYear)
  }, [firstYear, selectedYear])

  const formatCurrency = (value: number) => new Intl.NumberFormat(locale || 'es-GT', {
    style: 'currency',
    currency: currencyCode || 'GTQ',
    maximumFractionDigits: 0,
  }).format(value || 0)
  const formatCompactCurrency = (value: number) => new Intl.NumberFormat(locale || 'es-GT', {
    style: 'currency',
    currency: currencyCode || 'GTQ',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0)
  const formatNumber = (value: number) => new Intl.NumberFormat(locale || 'es-GT').format(value || 0)
  const formatPercent = (value: number) => `${value.toFixed(1)}%`

  const sales = data?.totals.totalSales ?? 0
  const cost = data?.totals.totalCost ?? 0
  const margin = calculateMargin(sales, cost)
  const monthly = useMemo(() => buildMonthlySeries(data?.monthly ?? []), [data])
  const categoryRanking = useMemo(() => toRanking(
    (data?.categoryPerformance ?? []).map((item) => ({ label: item.category, value: item.revenue })),
    6,
    (count) => `Otras ${count} categorías`,
  ), [data])
  // Las seis categorías con más ventas, ordenadas por su margen real (el backend lo redondea a entero).
  const marginRanking = useMemo(() => (data?.categoryPerformance ?? [])
    .slice(0, 6)
    .map((item) => ({ label: item.category, value: calculateMargin(item.revenue, item.cost) }))
    .sort((a, b) => b.value - a.value), [data])
  const inventory = useMemo(
    () => buildInventorySegments(data?.inventory ?? { productsCount: 0, lowStockCount: 0, outOfStockCount: 0 }),
    [data],
  )
  const hasSalesData = sales > 0 || monthly.some((item) => item.ventas > 0)

  if (!canViewAnalytics) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center p-6">
        <Card className="auna-surface w-full max-w-md rounded-2xl">
          <CardContent className="p-8 text-center">
            <ChartNoAxesCombined className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Sin acceso al tablero</h1>
            <p className="mt-2 text-sm text-muted-foreground">Tu perfil no tiene permiso para consultar indicadores.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="analytics-page min-h-full bg-brand-surface/70 dark:bg-brand-navy">
      <div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        {isFetching && data && <LoadingIndicator message="Actualizando analítica…" />}
        <h1 className="sr-only">Dashboard analítico</h1>
        <div className="auna-page-toolbar">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(value === 'all' ? 'all' : Number(value))}>
              <SelectTrigger className="min-w-56">
                <CalendarDays className="mr-2 h-5 w-5 text-brand-orange" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el historial</SelectItem>
                {years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 rounded-xl border border-border/70 bg-card p-1">
              <Button type="button" size="sm" variant="ghost" className={`rounded-lg ${selectedYear === currentYear ? 'bg-brand-orange text-white hover:bg-brand-orange-strong hover:text-white' : ''}`} onClick={() => setSelectedYear(currentYear)}>Este año</Button>
              <Button type="button" size="sm" variant="ghost" className={`rounded-lg ${selectedYear === 'all' ? 'bg-brand-orange text-white hover:bg-brand-orange-strong hover:text-white' : ''}`} onClick={() => setSelectedYear('all')}>Histórico</Button>
            </div>
          </div>
        </div>

        {isError ? (
          <Card className="auna-surface rounded-2xl">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <TrendingDown className="h-9 w-9 text-destructive" />
              <div>
                <p className="font-semibold">No pudimos cargar los indicadores</p>
                <p className="mt-1 text-sm text-muted-foreground">Comprueba la conexión e inténtalo nuevamente.</p>
              </div>
              <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => refetch()}>Reintentar</Button>
            </CardContent>
          </Card>
        ) : (
          <AnalyticsDetailTabs
            data={data}
            isLoading={isLoading}
            sectionAccess={sectionAccess}
            formatCurrency={formatCurrency}
            formatCompactCurrency={formatCompactCurrency}
            formatNumber={formatNumber}
          >
            <MetricStrip label="Indicadores principales" loading={isLoading} items={[
              { label: 'Ventas totales', value: formatCurrency(sales), hint: selectedYear === 'all' ? 'Histórico acumulado' : `Año ${selectedYear}` },
              { label: 'Unidades vendidas', value: formatNumber(data?.totals.stockRotation ?? 0), hint: `${formatNumber(data?.totals.productsCount ?? 0)} productos vendidos` },
              { label: 'Rentabilidad (margen)', value: formatPercent(margin), hint: `Utilidad ${formatCurrency(data?.totals.totalProfit ?? 0)}` },
              ...(sectionAccess.inventory ? [{ label: 'Valor del inventario', value: formatCurrency(data?.inventory.stockValue ?? 0), hint: `${formatNumber(data?.inventory.productsCount ?? 0)} productos` }] : []),
            ]} />

            {!isLoading && !hasSalesData ? (
              <Card className="auna-surface rounded-2xl">
                <CardContent className="px-6 py-14 text-center">
                  <ChartNoAxesCombined className="mx-auto h-11 w-11 text-muted-foreground/60" />
                  <h2 className="mt-4 text-lg font-semibold">Aún no hay ventas en este período</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Cuando registres ventas aparecerán aquí los gráficos y tendencias.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <ChartCard
                    title="Evolución de ventas"
                    description="Ventas netas y utilidad por mes"
                    aside={<ChartLegend items={[{ label: 'Ventas', color: SERIES.sales }, { label: 'Utilidad', color: SERIES.profit, line: true }]} />}
                  >
                    <div className="h-[300px]" role="img" aria-label="Ventas netas y utilidad por mes">
                      {isLoading ? <LoadingState variant="chart" message="Cargando gráfico…" /> : (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={monthly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid {...chart.grid} />
                            <XAxis dataKey="month" {...chart.axis} />
                            <YAxis {...chart.axis} width={64} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
                            <Tooltip
                              cursor={chart.barCursor}
                              content={<ChartTooltip format={formatCurrency} footer={(row) => row.margen == null ? null : ['Margen', formatPercent(Number(row.margen))]} />}
                            />
                            <Bar dataKey="ventas" name="Ventas" fill={SERIES.sales} radius={[4, 4, 0, 0]} maxBarSize={24} {...chart.motion} />
                            <Line dataKey="utilidad" name="Utilidad" type="monotone" stroke={SERIES.profit} strokeWidth={2} dot={chart.dot(SERIES.profit)} activeDot={chart.dot(SERIES.profit, 5)} {...chart.motion} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </ChartCard>

                  <ChartCard title="Ventas por categoría" description="Participación en las ventas del período">
                    {isLoading ? <LoadingState variant="chart" message="Cargando categorías…" /> : (
                      <RankedBars label="Ventas por categoría" rows={categoryRanking} format={formatCurrency} />
                    )}
                  </ChartCard>
                </section>

                <section className={`grid gap-4 md:grid-cols-2 ${sectionAccess.inventory ? 'xl:grid-cols-3' : ''}`}>
                  {sectionAccess.inventory ? (
                    <ChartCard
                      title="Salud del inventario"
                      description="Productos según su nivel de stock"
                      aside={<Button variant="ghost" size="sm" className="-mr-2 h-8 text-brand-orange hover:text-brand-orange" onClick={() => navigate('/inventario')}>Ver inventario <ArrowRight className="h-4 w-4" /></Button>}
                    >
                      <StockHealth segments={inventory} formatNumber={formatNumber} />
                    </ChartCard>
                  ) : null}

                  <ChartCard title="Rentabilidad por categoría" description="Margen de las categorías con más ventas">
                    {isLoading ? <LoadingState variant="chart" message="Cargando categorías…" /> : (
                      <RankedBars label="Rentabilidad por categoría" rows={marginRanking} format={formatPercent} color={SERIES.profit} />
                    )}
                  </ChartCard>

                  <ChartCard
                    className={sectionAccess.inventory ? 'md:col-span-2 xl:col-span-1' : undefined}
                    title="Tendencia de rentabilidad"
                    description="Margen mensual frente al promedio"
                    aside={<div className="text-right"><p className="text-xs text-muted-foreground">Promedio</p><p className="text-lg font-semibold leading-6">{formatPercent(margin)}</p></div>}
                  >
                    <div className="h-[230px]" role="img" aria-label="Margen mensual frente al promedio">
                      {isLoading ? <LoadingState variant="chart" message="Cargando gráfico…" /> : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid {...chart.grid} />
                            <XAxis dataKey="month" {...chart.axis} />
                            <YAxis {...chart.axis} width={48} tickFormatter={(value) => `${value}%`} />
                            <Tooltip cursor={chart.lineCursor} content={<ChartTooltip format={formatPercent} />} />
                            <ReferenceLine y={margin} stroke="hsl(var(--auna-surface-muted))" strokeOpacity={0.5} strokeDasharray="4 4" />
                            <Area dataKey="margen" name="Margen" type="monotone" stroke={SERIES.profit} strokeWidth={2} fill={SERIES.profit} fillOpacity={0.1} dot={chart.dot(SERIES.profit)} activeDot={chart.dot(SERIES.profit, 5)} {...chart.motion} />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </ChartCard>
                </section>
              </>
            )}
          </AnalyticsDetailTabs>
        )}
      </div>
    </div>
  )
}

export default Analytics
