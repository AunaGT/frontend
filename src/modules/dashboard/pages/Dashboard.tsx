/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  AlertTriangle,
  Eye,
  Zap,
  FileText
} from "lucide-react";
import heroImage from "@/assets/hero-liquor.jpg";
import { DashboardStat, RecentProduct } from "@/types";
import useCriticalProducts from "../hooks/useCriticalProducts";
import useDashboardStats from "../hooks/useDashboardStats";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface DashboardProps {
  onSectionChange?: (section: string) => void;
}

const Dashboard = ({ onSectionChange }: DashboardProps) => {
  const navigate = useNavigate();
  const { data: statsData, isLoading: statsLoading } = useDashboardStats();
  const { hasPermission } = useAuthPermissions();
  const { companyName, currencyCode, locale } = useSystemSettings();

  const canViewAnalytics = hasPermission("analytics.view");
  const canViewReports = hasPermission("reports.view");
  const canManageProducts = hasPermission("products.create", "products.edit");
  const canCreateSales = hasPermission("sales.create");
  const canViewAlerts = hasPermission("alerts.view", "alerts.manage");

  const loc = locale || 'es-GT'
  const formatStatCurrency = (n: number) => new Intl.NumberFormat(loc, { style: 'currency', currency: currencyCode || 'GTQ', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const formatStatNumber = (n: number) => n.toLocaleString(loc)

  // Formatear estadísticas desde la API
  const stats: DashboardStat[] = [
    {
      title: "Ventas Hoy",
      value: statsData ? formatStatCurrency(statsData.ventasHoy.valor) : formatStatCurrency(0),
      change: statsData ? `${statsData.ventasHoy.cambio > 0 ? '+' : ''}${statsData.ventasHoy.cambio}%` : "+0%",
      trending: statsData && statsData.ventasHoy.cambio >= 0 ? "up" : "down",
      icon: DollarSign,
      color: "text-liquor-gold"
    },
    {
      title: "Productos en Stock",
      value: statsData ? formatStatNumber(statsData.productosEnStock.cantidad) : "0",
      change: statsData ? `${statsData.productosEnStock.cambio > 0 ? '+' : ''}${statsData.productosEnStock.cambio}%` : "0%",
      trending: statsData && statsData.productosEnStock.cambio >= 0 ? "up" : "down",
      icon: Package,
      color: "text-primary"
    },
    {
      title: "Valor Inventario",
      value: statsData ? formatStatCurrency(statsData.valorInventario.valor) : formatStatCurrency(0),
      change: statsData ? `${statsData.valorInventario.cambio > 0 ? '+' : ''}${statsData.valorInventario.cambio}%` : "+0%",
      trending: statsData && statsData.valorInventario.cambio >= 0 ? "up" : "down",
      icon: TrendingUp,
      color: "text-accent"
    },
    {
      title: "Alertas Críticas",
      value: statsData ? String(statsData.alertasCriticas.cantidad) : "0",
      change: statsData ? `${statsData.alertasCriticas.cambio > 0 ? '+' : ''}${statsData.alertasCriticas.cambio}` : "+0",
      trending: statsData && statsData.alertasCriticas.cambio <= 0 ? "up" : "down",
      icon: AlertTriangle,
      color: "text-destructive"
    }
  ];

  const { data: criticalData, isLoading: criticalLoading } = useCriticalProducts();
  const recentProducts: RecentProduct[] = (criticalData ?? []).map((p) => ({ name: p.name, category: String(p.category), stock: p.stock, status: p.stock < p.minStock ? 'critical' : p.stock <= p.minStock ? 'low' : 'good' }));

  // Calcular tiempo desde última actualización
  const getTimeSinceUpdate = () => {
    if (!statsData?.timestamp) return 'hace un momento';
    const now = new Date();
    const updateTime = new Date(statsData.timestamp);
    const diffMs = now.getTime() - updateTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'hace un momento';
    if (diffMins === 1) return 'hace 1 min';
    if (diffMins < 60) return `hace ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return 'hace 1 hora';
    return `hace ${diffHours} horas`;
  };

  // Si el usuario no tiene permiso de analíticas, mostrar mensaje de acceso restringido
  if (!canViewAnalytics) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Sin acceso al Dashboard</CardTitle>
            <CardDescription>
              No tienes permisos para ver las analíticas del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Si consideras que deberías tener acceso a esta vista, por favor contacta con un
              administrador para que revise tus permisos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Hero Section */}
      <div
        className="relative h-48 rounded-xl overflow-hidden shadow-elegant"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-between p-8">
          <div className="text-white">
            <h2 className="text-3xl font-bold mb-2">Bienvenido a {companyName}</h2>
            <p className="text-lg opacity-90">Control total de tu inventario de licores</p>
            <div className="flex items-center mt-4 space-x-4">
              <Badge variant="secondary" className="bg-liquor-gold text-liquor-bronze">
                <Zap className="w-3 h-3 mr-1" />
                Sistema Activo
              </Badge>
              <span className="text-sm opacity-75">
                {statsLoading ? 'Actualizando...' : `Última sincronización: ${getTimeSinceUpdate()}`}
              </span>
            </div>
          </div>
          {canViewReports && (
            <Button
              variant="secondary"
              size="lg"
              className="shadow-glow"
              onClick={() => navigate('/reportes')}
            >
              <Eye className="w-4 h-4 mr-2" />
              Ver Reportes
            </Button>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-card transition-all duration-300 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-2">
                    <div className="h-8 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="flex items-center mt-1">
                      {stat.trending === "up" ? (
                        <TrendingUp className="w-3 h-3 text-liquor-gold mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-accent mr-1" />
                      )}
                      <span className={`text-xs ${stat.trending === "up" ? "text-liquor-gold" : "text-accent"}`}>
                        {stat.change}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">vs ayer</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Contenido Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productos con Stock Bajo */}
        <Card className="lg:col-span-2 animate-bounce-in">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-destructive mr-2" />
              Productos Críticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-secondary transition-colors">
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{product.name}</h4>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-foreground">{product.stock} unidades</span>
                    <Badge
                      variant={product.status === "critical" ? "destructive" : product.status === "low" ? "secondary" : "default"}
                      className={
                        product.status === "critical" ? "bg-destructive" :
                          product.status === "low" ? "bg-liquor-amber text-liquor-bronze" :
                            "bg-liquor-gold text-liquor-bronze"
                      }
                    >
                      {product.status === "critical" ? "Crítico" : product.status === "low" ? "Bajo" : "Normal"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Acciones Rápidas */}
        <Card className="animate-bounce-in" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canManageProducts && (
              <Button
                className="w-full bg-primary hover:bg-primary/90 transition-colors"
                onClick={() => navigate('/productos')}
              >
                <Package className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
            )}
            {canCreateSales && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/ventas')}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Registrar Venta
              </Button>
            )}
            {canViewAlerts && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/alertas')}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Ver Alertas
              </Button>
            )}
            {canViewReports && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/reportes')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Generar Reporte
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
