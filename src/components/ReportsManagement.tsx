/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWarehouses } from "@/services/warehouseService";
import { downloadFile } from '@/services/api';
import { ExportDialog } from '@/components/shared/ExportDialog';
import { useTenant } from '@/context/useTenant';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  VentasIcon,
  InventarioIcon,
  InventariadoIcon,
  ProveedoresIcon,
  ReporteFinancieroIcon,
  AlertasIcon,
  AnalyticsIcon,
  MercanciaIcon,
} from "@/components/icons/CustomIcons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Report, GeneratedReport } from "@/types";

const ReportsManagement = () => {
  // Period is selected via modal filters now
  const currentYear = new Date().getFullYear();
  const initialYear = currentYear < 2025 ? 2025 : currentYear;
  // Modal de filtros
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingReport, setPendingReport] = useState<Report | null>(null);
  const [fPeriod, setFPeriod] = useState<'week' | 'month' | 'quarter' | 'semester' | 'year' | 'all'>('month');
  const [fYear, setFYear] = useState<number | 'all'>(initialYear);
  const [fMonth, setFMonth] = useState<number | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [fSem, setFSem] = useState<1 | 2>(1);
  const [fFormat, setFFormat] = useState<'pdf' | 'csv'>('pdf');
  // Alcance del reporte: una sucursal, o 'all' = toda la empresa (consolidado).
  const { branch, branches } = useTenant();
  const { hasPermission } = useAuthPermissions();
  const canViewAll = hasPermission('branches.view_all');
  const [fBranch, setFBranch] = useState<string>(branch?.id || '');
  const showBranchPicker = branches.length > 1 || canViewAll;
  // Los almacenes son de la sucursal activa: acotar por almacén solo tiene
  // sentido cuando el reporte es de ella, no del consolidado ni de otra.
  const [fWarehouse, setFWarehouse] = useState<string>('all');
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', branch?.id],
    queryFn: () => fetchWarehouses(),
    enabled: filtersOpen,
  });
  const showWarehousePicker =
    (warehouses?.length ?? 0) > 1 && (!fBranch || fBranch === branch?.id);

  const PERIOD_LABELS: Record<string, string> = {
    week: 'Esta semana', month: 'Un mes', quarter: 'Un trimestre',
    semester: 'Un semestre', year: 'Un año', all: 'Todo el histórico',
  }
  const MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]

  /** Qué alcance y qué período se lleva el documento, en texto. */
  const scopeSummary = (() => {
    const suc = fBranch === 'all'
      ? 'Todas las sucursales (consolidado)'
      : branches.find((b) => b.id === (fBranch || branch?.id))?.name ?? 'Sucursal activa'
    const alm = showWarehousePicker && fWarehouse !== 'all'
      ? (warehouses ?? []).find((w) => w.id === fWarehouse)?.name
      : null
    return alm ? `${suc} · ${alm}` : suc
  })()

  // "Un mes" no le decía al usuario CUÁL mes generó el archivo — con el
  // selector abierto se ve, pero una vez cerrado el resumen era la única
  // confirmación visual de qué se estaba por generar.
  const periodDetail =
    fPeriod === 'month' && fMonth ? MONTH_NAMES[fMonth - 1]
    : fPeriod === 'quarter' && fMonth ? `trimestre ${Math.ceil(fMonth / 3)}`
    : fPeriod === 'semester' ? `semestre ${fSem}`
    : null
  const periodSummary = `${periodDetail ?? PERIOD_LABELS[fPeriod] ?? 'Período'}${fYear === 'all' ? '' : ` de ${fYear}`}`

  /** Descarga el reporte con los filtros elegidos. */
  const generateReport = async (format: 'pdf' | 'csv') => {
    if (!pendingReport) return
    setIsGeneratingReport(true)
    try {
      toast({ title: 'Generando...', description: pendingReport.name })
      const params = new URLSearchParams()
      params.set('period', fPeriod)
      if (fYear !== 'all') params.set('year', String(fYear))
      if (fPeriod === 'month' && fMonth) params.set('month', String(fMonth))
      if (fPeriod === 'quarter' && fMonth) params.set('quarter', String(Math.ceil(fMonth / 3)))
      if (fPeriod === 'semester') params.set('semester', String(fSem))
      params.set('format', format)
      if (showWarehousePicker && fWarehouse !== 'all') params.set('warehouse_id', fWarehouse)
      // El alcance de sucursal viaja en el header de tenant ('all' = consolidado).
      const scopeBranch = fBranch || branch?.id || ''
      await downloadFile(
        `/reports/${pendingReport.id}?${params.toString()}`,
        `${pendingReport.name.toLowerCase().replace(/\s+/g, '-')}-${fPeriod}.${format}`,
        scopeBranch ? { 'X-Branch-Id': scopeBranch } : undefined,
      )
      toast({ title: 'Reporte listo', description: `${pendingReport.name} descargado` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo generar el reporte'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setIsGeneratingReport(false)
      setFiltersOpen(false)
      setPendingReport(null)
    }
  }

  // Generadores locales (mock) removidos. Toda la generación ocurre en el backend.


  const reportTypes: Report[] = [
    {
      id: "sales",
      name: "Reporte de Ventas",
      description: "Análisis detallado de ventas por período",
      icon: VentasIcon,
      color: "text-liquor-gold",
      bgColor: "bg-liquor-gold/10",
      lastGenerated: "2024-01-10 09:30",
      size: "2.3 MB"
    },
    {
      id: "inventory",
      name: "Reporte de Inventario",
      description: "Estado actual del stock y movimientos",
      icon: InventarioIcon,
      color: "text-primary",
      bgColor: "bg-primary/10",
      lastGenerated: "2024-01-10 08:15",
      size: "1.8 MB"
    },
    {
      id: "inventory-counts",
      name: "Historial de inventariados",
      description: "Sesiones de conteo físico en el período: diferencias y mermas por sesión",
      icon: InventariadoIcon,
      color: "text-teal-600",
      bgColor: "bg-teal-500/10",
      lastGenerated: "—",
      size: "—"
    },
    {
      id: "suppliers",
      name: "Reporte de Proveedores",
      description: "Análisis de rendimiento de proveedores",
      icon: ProveedoresIcon,
      color: "text-accent",
      bgColor: "bg-accent/10",
      lastGenerated: "2024-01-09 16:45",
      size: "945 KB"
    },
    {
      id: "financial",
      name: "Reporte Financiero",
      description: "P&L del período, inventario actual, compras y margen por categoría",
      icon: ReporteFinancieroIcon,
      color: "text-liquor-burgundy",
      bgColor: "bg-liquor-burgundy/10",
      lastGenerated: "2024-01-10 07:20",
      size: "3.1 MB"
    },
    {
      id: "alerts",
      name: "Reporte de Alertas",
      description: "Reposición priorizada, concentración por categoría y tickets del sistema",
      icon: AlertasIcon,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      lastGenerated: "2024-01-10 10:00",
      size: "524 KB"
    },
    {
      id: "products",
      name: "Análisis de Productos",
      description: "Márgenes, mix por categoría y proveedor, rankings de valor",
      icon: AnalyticsIcon,
      color: "text-liquor-amber",
      bgColor: "bg-liquor-amber/10",
      lastGenerated: "2024-01-09 14:30",
      size: "1.5 MB"
    },
    {
      id: "merchandise",
      name: "Reporte de Mercancía",
      description: "Ingresos de mercancía del período: montos, estado de pago y por proveedor",
      icon: MercanciaIcon,
      color: "text-primary",
      bgColor: "bg-primary/10",
      lastGenerated: "—",
      size: "—"
    },
    {
      id: "stock-by-location",
      name: "Existencias por Almacén",
      description: "Unidades y valor por almacén, con el detalle de cada ubicación",
      icon: InventarioIcon,
      color: "text-primary",
      bgColor: "bg-primary/10",
      lastGenerated: "—",
      size: "—"
    },
    {
      id: "kardex",
      name: "Kardex por Ubicación",
      description: "Entradas, salidas y saldo de cada ubicación en el período",
      icon: InventariadoIcon,
      color: "text-teal-600",
      bgColor: "bg-teal-500/10",
      lastGenerated: "—",
      size: "—"
    },
    {
      id: "internal-moves",
      name: "Movimientos Internos",
      description: "Qué se movió de un anaquel a otro, cuánto y quién lo movió",
      icon: MercanciaIcon,
      color: "text-accent",
      bgColor: "bg-accent/10",
      lastGenerated: "—",
      size: "—"
    },
    {
      id: "replenishment",
      name: "Reposición Interna",
      description: "Anaqueles bajo su mínimo y de qué ubicación traer lo que falta",
      icon: AlertasIcon,
      color: "text-liquor-amber",
      bgColor: "bg-liquor-amber/10",
      lastGenerated: "—",
      size: "—"
    },
    {
      id: "occupancy",
      name: "Ocupación de Ubicaciones",
      description: "SKUs y unidades por ubicación, cuáles están vacías y cuáles con un solo producto",
      icon: AnalyticsIcon,
      color: "text-liquor-burgundy",
      bgColor: "bg-liquor-burgundy/10",
      lastGenerated: "—",
      size: "—"
    }
  ];

  // Eliminados: quickStats, recentReports y getStatusBadge

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <ExportDialog
        open={filtersOpen}
        onOpenChange={(o) => { if (!o) setPendingReport(null); setFiltersOpen(o) }}
        title={`Generar ${pendingReport?.name || 'reporte'}`}
        summary={`${scopeSummary}. ${periodSummary}.`}
        pending={isGeneratingReport}
        // Este diálogo solo ofrece PDF y CSV; 'xlsx' es de contabilidad.
        onExport={({ format }) => { if (format !== 'xlsx') void generateReport(format) }}
      >
        {showBranchPicker && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Sucursal</p>
            <Select value={fBranch || branch?.id || ''} onValueChange={setFBranch}>
              <SelectTrigger><SelectValue placeholder="Selecciona sucursal" /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
                {canViewAll && <SelectItem value="all">Toda la empresa (consolidado)</SelectItem>}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {fBranch === 'all'
                ? 'El reporte suma todas las sucursales y las identifica una por una en su propio desglose.'
                : 'El reporte incluye solo los datos de esta sucursal.'}
            </p>
          </div>
        )}
        {showWarehousePicker && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Almacén</p>
            <Select value={fWarehouse} onValueChange={setFWarehouse}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los almacenes</SelectItem>
                {(warehouses ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Período</p>
            <Select value={fPeriod} onValueChange={(v) => { setFPeriod(v as typeof fPeriod); if (v !== 'month') { setFMonth(null); } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mes</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="semester">Semestre</SelectItem>
                <SelectItem value="year">Año</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Año</p>
            <Select value={String(fYear)} onValueChange={(v) => setFYear(v === 'all' ? 'all' : Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Array.from({ length: currentYear - 2025 + 1 }, (_, i) => 2025 + i).map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {fPeriod === 'month' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Mes</p>
              <Select value={fMonth ? String(fMonth) : ''} onValueChange={(v) => setFMonth(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Selecciona mes" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={String(m)}>{m.toString().padStart(2, '0')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {fPeriod === 'semester' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Semestre</p>
              <Select value={String(fSem)} onValueChange={(v) => setFSem(v === '2' ? 2 : 1)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {fPeriod === 'quarter' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Trimestre</p>
              <Select
                value={String(Math.ceil((fMonth || new Date().getMonth() + 1) / 3))}
                onValueChange={(v) => setFMonth((Number(v) - 1) * 3 + 1)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </ExportDialog>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Centro de Reportes</h2>
          <p className="text-muted-foreground">Genera y gestiona reportes del negocio</p>
        </div>
        <div />
      </div>

      {/* Se removieron estadísticas rápidas */}

      {/* Tipos de Reportes */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Tipos de Reportes Disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportTypes.map((report, index) => {
            const Icon = report.icon;
            return (
              <Card
                key={report.id}
                className="animate-bounce-in hover:shadow-card transition-all duration-300 cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-lg ${report.bgColor}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground mb-1">{report.name}</h4>
                      <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <Button
                      size="sm"
                      className="flex-1 bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                      onClick={() => {
                        setPendingReport(report)
                        setFiltersOpen(true)
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Generar
                    </Button>
                    {/* Botón de vista previa removido */}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Reportes recientes removidos */}
    </div>
  );
};

export default ReportsManagement;