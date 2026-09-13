/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Calendar,
  Package,
  Boxes,
  Truck,
  ShoppingCart,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { useAnalytics, useAnalyticsFirstSaleYear } from "../hooks/useAnalytics";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// Paleta para series categóricas (pastel/donut)
const PALETTE = ["#f59e0b", "#0ea5e9", "#10b981", "#8b5cf6", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

const KpiCard = ({ label, value, hint, icon: Icon, accent = "text-primary", loading }: {
  label: string; value: string; hint?: React.ReactNode; icon: React.ComponentType<{ className?: string }>; accent?: string; loading?: boolean;
}) => (
  <Card className="animate-slide-up">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className={`text-2xl font-bold ${accent}`}>{value}</p>}
          {!loading && hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className="w-10 h-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const Analytics = () => {
  const { locale, currencyCode } = useSystemSettings();
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat(locale || "es-GT", { style: "currency", currency: currencyCode || "GTQ", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  const fmtCurrencyShort = (n: number) =>
    new Intl.NumberFormat(locale || "es-GT", { style: "currency", currency: currencyCode || "GTQ", maximumFractionDigits: 0, notation: "compact" }).format(n || 0);
  const fmtNumber = (n: number) => (n ?? 0).toLocaleString(locale || "es-GT");

  const currentYear = new Date().getFullYear();
  const { data: yearMeta } = useAnalyticsFirstSaleYear();
  const minYear = yearMeta?.firstSaleYear ?? currentYear;
  const [selectedYear, setSelectedYear] = useState<number | "all">(currentYear);
  const years = useMemo(() => {
    const list: number[] = [];
    const from = Math.min(minYear, currentYear);
    const to = Math.max(minYear, currentYear);
    for (let y = from; y <= to; y++) list.push(y);
    return list;
  }, [minYear, currentYear]);

  useEffect(() => {
    if (typeof selectedYear !== "number") return;
    if (selectedYear < minYear || selectedYear > currentYear) {
      setSelectedYear(Math.min(Math.max(selectedYear, minYear), currentYear));
    }
  }, [minYear, currentYear, selectedYear]);

  const { data, isLoading } = useAnalytics(selectedYear);

  const monthlyChart = useMemo(() => (data?.monthly ?? []).map((m) => ({
    month: MONTHS[m.month - 1],
    netas: m.ventasNetas ?? (m.ventas - (m.devoluciones || 0)),
    costo: m.costo,
    utilidad: (m.ventasNetas ?? (m.ventas - (m.devoluciones || 0))) - m.costo,
  })), [data]);

  const purchasesChart = useMemo(() => (data?.purchases?.monthly ?? []).map((m) => ({
    month: MONTHS[m.month - 1],
    monto: m.amount,
  })), [data]);

  const marginPct = (() => {
    const sales = data?.totals.totalSales || 0;
    const profit = data?.totals.totalProfit || 0;
    return sales > 0 ? ((profit / sales) * 100).toFixed(1) : "0.0";
  })();

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Análisis y Estadísticas</h2>
          <p className="text-muted-foreground">Tablero de inteligencia de negocio</p>
        </div>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(v === "all" ? "all" : Number(v))}>
          <SelectTrigger className="w-44">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los años</SelectItem>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="ventas" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid sm:grid-cols-4">
          <TabsTrigger value="ventas"><TrendingUp className="w-4 h-4 mr-2" />Ventas</TabsTrigger>
          <TabsTrigger value="productos"><Package className="w-4 h-4 mr-2" />Productos</TabsTrigger>
          <TabsTrigger value="inventario"><Boxes className="w-4 h-4 mr-2" />Inventario</TabsTrigger>
          <TabsTrigger value="compras"><Truck className="w-4 h-4 mr-2" />Compras</TabsTrigger>
        </TabsList>

        {/* ============ VENTAS ============ */}
        <TabsContent value="ventas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard label="Ventas Netas" value={fmtCurrency(data?.totals.totalSales ?? 0)} icon={ShoppingCart} accent="text-green-700" loading={isLoading}
              hint={data?.totals.totalReturns ? <span className="text-orange-600">Devoluciones: {fmtCurrency(data.totals.totalReturns)}</span> : undefined} />
            <KpiCard label="Utilidad Neta" value={fmtCurrency(data?.totals.totalProfit ?? 0)} icon={Wallet} accent="text-foreground" loading={isLoading}
              hint={<>Margen {marginPct}%</>} />
            <KpiCard label="Productos Vendidos" value={fmtNumber(data?.totals.productsCount ?? 0)} icon={Package} loading={isLoading}
              hint={<>{fmtNumber(data?.totals.stockRotation ?? 0)} unidades</>} />
            <KpiCard label="Costo de Ventas" value={fmtCurrency(data?.totals.totalCost ?? 0)} icon={TrendingUp} loading={isLoading} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Ventas</CardTitle>
              <CardDescription>Ventas netas, costo y utilidad por mes</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-72 w-full" /> : (
                <ChartContainer config={{
                  netas: { label: "Ventas netas", color: "#10b981" },
                  costo: { label: "Costo", color: "#f59e0b" },
                  utilidad: { label: "Utilidad", color: "#0ea5e9" },
                } satisfies ChartConfig} className="h-72 w-full aspect-auto">
                  <ComposedChart data={monthlyChart}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => fmtCurrencyShort(Number(v))} tickLine={false} axisLine={false} width={56} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
                      <div className="flex w-full justify-between gap-3"><span className="text-muted-foreground capitalize">{name}</span><span className="font-mono font-medium">{fmtCurrency(Number(value))}</span></div>
                    )} />} />
                    <Bar dataKey="netas" fill="var(--color-netas)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="costo" fill="var(--color-costo)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Line dataKey="utilidad" stroke="var(--color-utilidad)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Método de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-64 w-full" /> : (data?.paymentMethods?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">Sin datos en el período.</p>
                ) : (
                  <ChartContainer config={{}} className="h-64 w-full aspect-auto">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="method" formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-3"><span className="text-muted-foreground">{name}</span><span className="font-mono font-medium">{fmtCurrency(Number(value))}</span></div>
                      )} />} />
                      <Pie data={data?.paymentMethods} dataKey="total" nameKey="method" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {(data?.paymentMethods ?? []).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                )}
                <div className="mt-4 space-y-2">
                  {(data?.paymentMethods ?? []).map((pm, i) => (
                    <div key={pm.method} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />{pm.method}</span>
                      <span className="font-medium">{fmtCurrency(pm.total)} <span className="text-muted-foreground">· {pm.count}</span></span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ventas por Canal</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-64 w-full" /> : (data?.channels?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">Sin datos en el período.</p>
                ) : (
                  <ChartContainer config={{}} className="h-64 w-full aspect-auto">
                    <BarChart data={data?.channels} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => fmtCurrencyShort(Number(v))} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" width={110} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent nameKey="label" formatter={(value) => <span className="font-mono font-medium">{fmtCurrency(Number(value))}</span>} />} />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={40}>
                        {(data?.channels ?? []).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ PRODUCTOS ============ */}
        <TabsContent value="productos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Productos Más Vendidos</CardTitle>
                <CardDescription>Por ingresos generados</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-72 w-full" /> : (data?.topProducts?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">Sin ventas en el período.</p>
                ) : (
                  <ChartContainer config={{}} className="h-72 w-full aspect-auto">
                    <BarChart data={data?.topProducts} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => fmtCurrencyShort(Number(v))} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + "…" : v} />
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" formatter={(value) => <span className="font-mono font-medium">{fmtCurrency(Number(value))}</span>} />} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {(data?.topProducts ?? []).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Participación por Categoría</CardTitle>
                <CardDescription>% de los ingresos</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-72 w-full" /> : (data?.categoryPerformance?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">Sin datos en el período.</p>
                ) : (
                  <>
                    <ChartContainer config={{}} className="h-56 w-full aspect-auto">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="category" formatter={(value, name, item) => (
                          <div className="flex w-full justify-between gap-3"><span className="text-muted-foreground">{name}</span><span className="font-mono font-medium">{fmtCurrency(Number(value))} · {item?.payload?.percentage ?? 0}%</span></div>
                        )} />} />
                        <Pie data={data?.categoryPerformance} dataKey="revenue" nameKey="category" innerRadius={50} outerRadius={90} paddingAngle={1}>
                          {(data?.categoryPerformance ?? []).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 max-h-44 overflow-y-auto">
                      {(data?.categoryPerformance ?? []).map((cat, i) => (
                        <div key={cat.category} className="flex items-center justify-between text-sm gap-2">
                          <span className="flex items-center gap-2 min-w-0"><span className="w-3 h-3 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate" title={cat.category}>{cat.category}</span></span>
                          <span className="font-medium shrink-0 text-muted-foreground">{cat.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Rentabilidad por Categoría</CardTitle>
              <CardDescription>Ingresos, costo y margen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(data?.categoryPerformance ?? []).map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{cat.category}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-muted-foreground">{fmtCurrency(cat.revenue)}</span>
                        <Badge variant={cat.margin >= 30 ? "default" : cat.margin >= 15 ? "secondary" : "destructive"}>{cat.margin}% margen</Badge>
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, cat.percentage))}%` }} />
                    </div>
                  </div>
                ))}
                {!isLoading && (data?.categoryPerformance?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sin datos en el período.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ INVENTARIO ============ */}
        <TabsContent value="inventario" className="space-y-6">
          <p className="text-xs text-muted-foreground -mt-2">Estado actual del inventario (no depende del año seleccionado).</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard label="Valor en Inventario" value={fmtCurrency(data?.inventory.stockValue ?? 0)} icon={Boxes} loading={isLoading} hint="A costo" />
            <KpiCard label="Valor a Precio Venta" value={fmtCurrency(data?.inventory.retailValue ?? 0)} icon={Wallet} accent="text-green-700" loading={isLoading}
              hint={<>Utilidad potencial: {fmtCurrency(data?.inventory.potentialProfit ?? 0)}</>} />
            <KpiCard label="Stock Bajo" value={fmtNumber(data?.inventory.lowStockCount ?? 0)} icon={AlertTriangle} accent="text-orange-600" loading={isLoading} hint="≤ mínimo" />
            <KpiCard label="Agotados" value={fmtNumber(data?.inventory.outOfStockCount ?? 0)} icon={AlertTriangle} accent="text-red-600" loading={isLoading} hint={<>de {fmtNumber(data?.inventory.productsCount ?? 0)} productos</>} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Valor de Inventario por Categoría</CardTitle>
              <CardDescription>Capital inmovilizado a costo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-72 w-full" /> : (data?.inventory.byCategory.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sin productos en inventario.</p>
              ) : (
                <ChartContainer config={{}} className="h-72 w-full aspect-auto">
                  <BarChart data={data?.inventory.byCategory} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => fmtCurrencyShort(Number(v))} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="category" width={130} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + "…" : v} />
                    <ChartTooltip content={<ChartTooltipContent nameKey="category" formatter={(value, _name, item) => (
                      <div className="flex w-full justify-between gap-3"><span className="font-mono font-medium">{fmtCurrency(Number(value))}</span><span className="text-muted-foreground">{fmtNumber(Number(item?.payload?.units ?? 0))} u</span></div>
                    )} />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {(data?.inventory.byCategory ?? []).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ COMPRAS ============ */}
        <TabsContent value="compras" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard label="Compras del Período" value={fmtCurrency(data?.purchases.total ?? 0)} icon={Truck} loading={isLoading} />
            <KpiCard label="Cuentas por Pagar" value={fmtCurrency(data?.purchases.payablePending ?? 0)} icon={Wallet} accent="text-red-600" loading={isLoading} hint="Saldo pendiente a proveedores" />
            <KpiCard label="Ingresos Pendientes" value={fmtNumber(data?.purchases.payableCount ?? 0)} icon={AlertTriangle} accent="text-orange-600" loading={isLoading} hint="Registros sin liquidar" />
            <KpiCard label="Inventario Inicial" value={fmtCurrency(data?.initialInventory.total ?? 0)} icon={Boxes} accent="text-muted-foreground" loading={isLoading} hint="Saldo de apertura, no es compra del período" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Compras por Mes</CardTitle>
              <CardDescription>Ingresos de mercancía valorizados a costo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <ChartContainer config={{ monto: { label: "Compras", color: "#8b5cf6" } } satisfies ChartConfig} className="h-64 w-full aspect-auto">
                  <BarChart data={purchasesChart}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => fmtCurrencyShort(Number(v))} tickLine={false} axisLine={false} width={56} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span className="font-mono font-medium">{fmtCurrency(Number(value))}</span>} />} />
                    <Bar dataKey="monto" fill="var(--color-monto)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Principales Proveedores</CardTitle>
              <CardDescription>Por monto de compra en el período</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-56 w-full" /> : (data?.purchases.topSuppliers.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sin compras en el período.</p>
              ) : (
                <ChartContainer config={{}} className="h-56 w-full aspect-auto">
                  <BarChart data={data?.purchases.topSuppliers} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => fmtCurrencyShort(Number(v))} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + "…" : v} />
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" formatter={(value) => <span className="font-mono font-medium">{fmtCurrency(Number(value))}</span>} />} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {(data?.purchases.topSuppliers ?? []).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
