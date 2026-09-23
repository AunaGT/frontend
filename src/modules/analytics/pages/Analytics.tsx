import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  Package,
  Percent,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useModules } from '@/context/useModules'
import { useAnalytics, useAnalyticsFirstSaleYear } from '@/modules/analytics/hooks/useAnalytics'
import { AnalyticsDetailTabs } from '../components/AnalyticsDetailTabs'
import { buildInventorySegments, calculateMargin } from '../analyticsViewModel'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const CATEGORY_COLORS = ['#f97316', '#2563eb', '#60a5fa', '#22c55e', '#8b5cf6', '#94a3b8']
const INVENTORY_COLORS = ['#22c55e', '#f97316', '#ef4444']

function DashboardCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Card className={`rounded-2xl border-border/70 bg-card shadow-sm dark:bg-[#101f34] ${className}`}>{children}</Card>
}

function DashboardTooltip({ active, payload, label, currency }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  currency: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border/70 bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-6 py-0.5">
          <span style={{ color: item.color }}>{item.name}</span>
          <span className="font-medium text-foreground">{currency(Number(item.value))}</span>
        </div>
      ))}
    </div>
  )
}

const Analytics = () => {
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const { enabledModuleCodes, isEnabled } = useModules()
  const { locale, currencyCode } = useSystemSettings()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear)
  const canViewAnalytics = hasPermission('analytics.view')
  const receivablesEnabled = enabledModuleCodes !== null && isEnabled('receivables')
  const canViewReceivables = hasPermission('receivables.view')
  const { data: yearMeta } = useAnalyticsFirstSaleYear()
  const { data, isLoading, isError, refetch } = useAnalytics(selectedYear)

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

  const sales = data?.totals.totalSales ?? 0
  const cost = data?.totals.totalCost ?? 0
  const margin = calculateMargin(sales, cost)
  const monthly = useMemo(() => (data?.monthly ?? []).map((item) => {
    const netSales = item.ventasNetas ?? item.ventas - (item.devoluciones ?? 0)
    return {
      month: MONTHS[item.month - 1],
      ventas: netSales,
      utilidad: netSales - item.costo,
      margen: calculateMargin(netSales, item.costo),
    }
  }), [data])
  const categories = useMemo(() => (data?.categoryPerformance ?? []).slice(0, 6), [data])
  const inventory = useMemo(
    () => buildInventorySegments(data?.inventory ?? { productsCount: 0, lowStockCount: 0, outOfStockCount: 0 }),
    [data],
  )
  const hasSalesData = sales > 0 || monthly.some((item) => item.ventas > 0)

  if (!canViewAnalytics) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center p-6">
        <DashboardCard className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <ChartNoAxesCombined className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Sin acceso al tablero</h1>
            <p className="mt-2 text-sm text-muted-foreground">Tu perfil no tiene permiso para consultar indicadores.</p>
          </CardContent>
        </DashboardCard>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-brand-surface/70 dark:bg-brand-navy">
      <div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-orange">Analítica</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-brand-navy dark:text-white sm:text-4xl">Dashboard analítico</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">Visión completa de tu negocio con información real.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(value === 'all' ? 'all' : Number(value))}>
              <SelectTrigger className="h-12 min-w-56 rounded-xl bg-card">
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
        </header>

        {isError ? (
          <DashboardCard>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <TrendingDown className="h-9 w-9 text-destructive" />
              <div>
                <p className="font-semibold">No pudimos cargar los indicadores</p>
                <p className="mt-1 text-sm text-muted-foreground">Comprueba la conexión e inténtalo nuevamente.</p>
              </div>
              <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => refetch()}>Reintentar</Button>
            </CardContent>
          </DashboardCard>
        ) : (
          <AnalyticsDetailTabs
            data={data}
            isLoading={isLoading}
            receivablesEnabled={receivablesEnabled}
            canViewReceivables={canViewReceivables}
            formatCurrency={formatCurrency}
            formatCompactCurrency={formatCompactCurrency}
            formatNumber={formatNumber}
          >
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principales">
              {[
                { label: 'Ventas totales', value: formatCurrency(sales), hint: selectedYear === 'all' ? 'Histórico acumulado' : `Año ${selectedYear}`, icon: ChartNoAxesCombined },
                { label: 'Unidades vendidas', value: formatNumber(data?.totals.stockRotation ?? 0), hint: `${formatNumber(data?.totals.productsCount ?? 0)} productos vendidos`, icon: Package },
                { label: 'Rentabilidad (margen)', value: `${margin.toFixed(1)}%`, hint: `Utilidad ${formatCurrency(data?.totals.totalProfit ?? 0)}`, icon: Percent },
                { label: 'Valor del inventario', value: formatCurrency(data?.inventory.stockValue ?? 0), hint: `${formatNumber(data?.inventory.productsCount ?? 0)} productos`, icon: Boxes },
              ].map(({ label, value, hint, icon: Icon }) => (
                <DashboardCard key={label}>
                  <CardContent className="flex items-start gap-4 p-5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
                      <Icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
                      {isLoading ? <Skeleton className="mt-2 h-8 w-32" /> : <p className="mt-1 truncate text-2xl font-bold tabular-nums">{value}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                    </div>
                  </CardContent>
                </DashboardCard>
              ))}
            </section>

            {!isLoading && !hasSalesData ? (
              <DashboardCard>
                <CardContent className="px-6 py-14 text-center">
                  <ChartNoAxesCombined className="mx-auto h-11 w-11 text-muted-foreground/60" />
                  <h2 className="mt-4 text-lg font-semibold">Aún no hay ventas en este período</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Cuando registres ventas aparecerán aquí los gráficos y tendencias.</p>
                </CardContent>
              </DashboardCard>
            ) : (
              <>
                <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                  <DashboardCard>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-5 w-5 text-brand-orange" /> Evolución de ventas</CardTitle>
                      <span className="text-xs text-muted-foreground">Mensual</span>
                    </CardHeader>
                    <CardContent className="h-[330px] pt-3">
                      {isLoading ? <Skeleton className="h-full w-full" /> : (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={monthly} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} width={58} tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <Tooltip content={<DashboardTooltip currency={formatCurrency} />} />
                            <Bar dataKey="ventas" name="Ventas" fill="#f97316" radius={[5, 5, 0, 0]} maxBarSize={30} />
                            <Line type="monotone" dataKey="utilidad" name="Utilidad" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: '#2563eb' }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </DashboardCard>

                  <DashboardCard>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Ventas por categoría</CardTitle></CardHeader>
                    <CardContent className="grid min-h-[330px] gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {isLoading ? <Skeleton className="h-64 w-full" /> : (
                        <div className="relative h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={categories} dataKey="revenue" nameKey="category" innerRadius={58} outerRadius={88} paddingAngle={1}>
                                {categories.map((item, index) => <Cell key={item.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                            <strong className="text-lg">{formatCompactCurrency(sales)}</strong>
                            <span className="text-xs text-muted-foreground">Total</span>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2 self-center">
                        {categories.map((item, index) => (
                          <div key={item.category} className="flex items-center justify-between gap-3 text-xs">
                            <span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} /><span className="truncate">{item.category}</span></span>
                            <strong>{item.percentage.toFixed(1)}%</strong>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </DashboardCard>
                </section>

                <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <DashboardCard>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-5 w-5 text-brand-orange" /> Estado del inventario</CardTitle>
                      <Button variant="outline" size="sm" className="rounded-lg border-brand-orange/50 text-brand-orange hover:text-brand-orange" onClick={() => navigate('/inventario')}>Ver inventario <ArrowRight className="ml-2 h-4 w-4" /></Button>
                    </CardHeader>
                    <CardContent className="grid min-h-[270px] grid-cols-1 items-center gap-2 sm:grid-cols-2">
                      <div className="relative h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={inventory} dataKey="value" nameKey="label" innerRadius={55} outerRadius={82}>
                              {inventory.map((item, index) => <Cell key={item.key} fill={INVENTORY_COLORS[index]} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <strong className="text-xl">{formatNumber(data?.inventory.productsCount ?? 0)}</strong>
                          <span className="text-xs text-muted-foreground">Productos</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {inventory.map((item, index) => (
                          <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full" style={{ backgroundColor: INVENTORY_COLORS[index] }} />{item.label}</span>
                            <strong>{formatNumber(item.value)}</strong>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </DashboardCard>

                  <DashboardCard>
                    <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Percent className="h-5 w-5 text-brand-orange" /> Rentabilidad por categoría</CardTitle></CardHeader>
                    <CardContent className="h-[280px] pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categories} layout="vertical" margin={{ left: 8, right: 22 }}>
                          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                          <XAxis type="number" unit="%" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <YAxis type="category" dataKey="category" width={90} axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                          <Bar dataKey="margin" name="Margen" fill="#f97316" radius={[0, 5, 5, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </DashboardCard>

                  <DashboardCard className="lg:col-span-2 2xl:col-span-1">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="h-5 w-5 text-brand-orange" /> Tendencia de rentabilidad</CardTitle>
                      <div className="text-right"><p className="text-xs text-muted-foreground">Margen promedio</p><p className="text-xl font-bold">{margin.toFixed(1)}%</p></div>
                    </CardHeader>
                    <CardContent className="h-[250px] pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthly}>
                          <defs><linearGradient id="marginFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.35} /><stop offset="100%" stopColor="#f97316" stopOpacity={0.02} /></linearGradient></defs>
                          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <YAxis unit="%" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                          <Area type="monotone" dataKey="margen" name="Margen" stroke="#f97316" strokeWidth={2.5} fill="url(#marginFill)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </DashboardCard>
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
