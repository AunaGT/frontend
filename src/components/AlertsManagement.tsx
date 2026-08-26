/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Package,
  Clock,
  Bell,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Settings,
  Zap,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertStats, AlertType, AlertPriority, Status } from "@/types";
import {
  apiFetch,
  reassignAlert,
  resolveAlert,
  fetchAssignableAlertUsers,
  fetchAlertTypes,
  fetchAlertPriorities,
  createAlert,
  type AlertLookup,
} from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { fetchProducts } from "@/services/productService";

type RawAlert = {
  id?: string | number
  type?: { name?: string } | null
  priority?: { name?: string } | null
  title?: string
  message?: string
  product?: { name?: string; category?: { name?: string } | null } | null
  current_stock?: number
  min_stock?: number
  timestamp?: string
  status?: { name?: string } | null
  assignedTo?: { id?: string | number; name?: string } | null
}

const mapPriority = (name?: string): AlertPriority => {
  const n = (name || '').toLowerCase();
  if (n === 'baja') return 'low';
  if (n === 'media') return 'medium';
  if (n === 'alta') return 'high';
  if (n === 'crítica' || n === 'critica') return 'critical';
  return 'medium';
};

const mapStatus = (name?: string): Status => {
  const n = (name || '').toLowerCase();
  if (n === 'activa') return 'active';
  if (n === 'pendiente') return 'pending';
  if (n === 'resuelta') return 'resolved';
  return 'active';
};

/** Traduce una alerta tal como la manda la API al tipo que usa esta pantalla. */
const adaptAlert = (raw: Record<string, unknown>): Alert & { assignedToId?: string } => {
  const a = raw as RawAlert;
  return {
    id: String(a.id ?? ''),
    type: a.type?.name === 'Sin Stock'
      ? 'stock_out'
      : a.type?.name === 'Vencimiento'
        ? 'expiry_soon'
        : 'stock_low',
    priority: mapPriority(a.priority?.name),
    title: a.title || 'Alerta',
    message: a.message || '',
    product: a.product?.name || '',
    category: a.product?.category?.name || '',
    currentStock: a.current_stock ?? 0,
    minStock: a.min_stock ?? 0,
    timestamp: a.timestamp || '',
    status: mapStatus(a.status?.name),
    assignedTo: a.assignedTo?.name || '',
    assignedToId: a.assignedTo?.id ? String(a.assignedTo.id) : undefined,
  };
};

const AlertsManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [reassigningAlertId, setReassigningAlertId] = useState<string | null>(null);
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [alertTypes, setAlertTypes] = useState<AlertLookup[]>([]);
  const [alertPriorities, setAlertPriorities] = useState<AlertLookup[]>([]);
  const [newTypeId, setNewTypeId] = useState('');
  const [newPriorityId, setNewPriorityId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<{ id: string; name: string }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [creatingAlert, setCreatingAlert] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuthPermissions();

  const canManageAlerts = hasPermission("alerts.manage");

  const loadAlerts = useCallback(async () => {
    try {
      // all=true: sin esto, list() del backend solo trae resueltas=0 y el
      // filtro "Resueltas" de acá abajo nunca tiene nada que mostrar, y
      // "Total" nunca cuenta lo ya resuelto.
      const data = await apiFetch("/api/alerts?all=true", { method: "GET" }) as Array<Record<string, unknown>>;
      setAlerts((data || []).map(adaptAlert));
    } catch (e) { /* noop */ }
  }, []);

  useEffect(() => {
    void loadAlerts();
    (async () => {
      try {
        setUsers(await fetchAssignableAlertUsers());
      } catch (e) { /* noop */ }
    })();
  }, [loadAlerts]);

  const alertStats: AlertStats = useMemo(() => ({
    total: alerts.length,
    active: alerts.filter(a => a.status === "active").length,
    critical: alerts.filter(a => a.priority === "critical").length,
    resolved: alerts.filter(a => a.status === "resolved").length
  }), [alerts]);

  const getPriorityBadge = (priority: AlertPriority) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive">Crítica</Badge>;
      case "high":
        return <Badge className="bg-liquor-amber text-liquor-bronze">Alta</Badge>;
      case "medium":
        return <Badge className="bg-liquor-gold text-liquor-bronze">Media</Badge>;
      case "low":
        return <Badge variant="outline">Baja</Badge>;
      default:
        return <Badge variant="outline">Desconocida</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-accent text-accent-foreground">Activa</Badge>;
      case "pending":
        return <Badge className="bg-liquor-burgundy text-primary-foreground">Pendiente</Badge>;
      case "resolved":
        return <Badge className="bg-liquor-gold text-liquor-bronze">Resuelta</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const getTypeIcon = (type: AlertType) => {
    switch (type) {
      case "stock_low":
      case "stock_out":
        return <Package className="w-5 h-5" />;
      case "expiry_soon":
        return <Clock className="w-5 h-5" />;
      case "system":
        return <Zap className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    if (!canManageAlerts) return;
    setResolvingAlertId(alertId);
    try {
      const updated = await resolveAlert(alertId) as Record<string, unknown>;
      // Resolver cambia el estado, no borra la alerta — antes se sacaba del
      // arreglo y "Resueltas" nunca podía mostrar nada, ni el total contarla.
      setAlerts(prev => prev.map(a => a.id === alertId ? adaptAlert(updated) : a));
      toast({
        title: "Alerta resuelta",
        description: "La alerta ha sido marcada como resuelta exitosamente.",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "No se pudo resolver la alerta. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setResolvingAlertId(null);
    }
  };

  // Catálogos del formulario, cargados solo cuando el diálogo se abre.
  useEffect(() => {
    if (!newAlertOpen) return;
    (async () => {
      try {
        const [types, priorities] = await Promise.all([fetchAlertTypes(), fetchAlertPriorities()]);
        setAlertTypes(types);
        setAlertPriorities(priorities);
      } catch (e) { /* noop */ }
    })();
  }, [newAlertOpen]);

  // Búsqueda de producto con un pequeño debounce; sin esto es una petición por tecla.
  useEffect(() => {
    if (!newAlertOpen || productSearch.trim().length < 2) {
      setProductResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetchProducts({ search: productSearch, pageSize: 8 });
        setProductResults(res.items.map((p) => ({ id: String(p.id), name: p.name })));
      } catch (e) { /* noop */ }
    }, 300);
    return () => clearTimeout(t);
  }, [newAlertOpen, productSearch]);

  const resetNewAlertForm = () => {
    setNewTypeId('');
    setNewPriorityId('');
    setNewTitle('');
    setNewMessage('');
    setProductSearch('');
    setProductResults([]);
    setSelectedProduct(null);
  };

  const handleCreateAlert = async () => {
    if (!newTypeId || !newPriorityId || !newTitle.trim() || !selectedProduct) return;
    setCreatingAlert(true);
    try {
      const created = await createAlert({
        type_id: Number(newTypeId),
        priority_id: Number(newPriorityId),
        title: newTitle.trim(),
        message: newMessage.trim() || undefined,
        product_id: selectedProduct.id,
      }) as Record<string, unknown>;
      setAlerts((prev) => [adaptAlert(created), ...prev]);
      toast({ title: "Alerta creada" });
      resetNewAlertForm();
      setNewAlertOpen(false);
    } catch (e) {
      toast({
        title: "No se pudo crear la alerta",
        description: e instanceof Error ? e.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setCreatingAlert(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.product.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === "all" || alert.priority === priorityFilter;
    const matchesStatus = statusFilter === "all" || alert.status === statusFilter;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Centro de Alertas</h2>
          <p className="text-muted-foreground">Monitoreo y gestión de alertas del sistema</p>
        </div>
        <div className="flex space-x-2">
          {canManageAlerts && (
            <>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Configurar
              </Button>
              <Button className="bg-primary hover:opacity-90" onClick={() => setNewAlertOpen(true)}>
                <Bell className="w-4 h-4 mr-2" />
                Nueva Alerta
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Estadísticas de Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="animate-slide-up">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Alertas</p>
                <p className="text-2xl font-bold text-foreground">{alertStats.total}</p>
              </div>
              <Bell className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertas Activas</p>
                <p className="text-2xl font-bold text-foreground">{alertStats.active}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Críticas</p>
                <p className="text-2xl font-bold text-foreground">{alertStats.critical}</p>
              </div>
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resueltas</p>
                <p className="text-2xl font-bold text-foreground">{alertStats.resolved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-liquor-gold" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar alertas por título o producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="resolved">Resueltas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Alertas */}
      <div className="space-y-4">
        {filteredAlerts.map((alert, index) => (
          <Card 
            key={alert.id} 
            className="animate-slide-up hover:shadow-card transition-all duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`p-2 rounded-lg ${
                    alert.priority === "critical" ? "bg-destructive/10" :
                    alert.priority === "high" ? "bg-liquor-amber/10" :
                    alert.priority === "medium" ? "bg-liquor-gold/10" :
                    "bg-muted"
                  }`}>
                    <div className={
                      alert.priority === "critical" ? "text-destructive" :
                      alert.priority === "high" ? "text-liquor-amber" :
                      alert.priority === "medium" ? "text-liquor-gold" :
                      "text-muted-foreground"
                    }>
                      {getTypeIcon(alert.type)}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-semibold text-foreground">{alert.title}</h4>
                      {getPriorityBadge(alert.priority)}
                      {getStatusBadge(alert.status)}
                    </div>
                    
                    <p className="text-muted-foreground mb-3">{alert.message}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Producto:</span>
                        <p className="font-medium text-foreground">{alert.product}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Categoría:</span>
                        <p className="font-medium text-foreground">{alert.category}</p>
                      </div>
                      {alert.type !== "expiry_soon" && (
                        <div>
                          <span className="text-muted-foreground">Stock Actual:</span>
                          <p className="font-medium text-foreground">{alert.currentStock}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Asignado a:</span>
                        <div className="font-medium text-foreground">
                          <Select
                            value={(alert as Alert & { assignedToId?: string }).assignedToId || ''}
                            disabled={reassigningAlertId === alert.id}
                            onValueChange={async (val) => {
                              setReassigningAlertId(alert.id);
                              try {
                                await reassignAlert(alert.id, val);
                                setAlerts(prev => prev.map(a => a.id === alert.id ? {
                                  ...a,
                                  assignedTo: users.find(u => u.id === val)?.name || a.assignedTo,
                                  assignedToId: val
                                } : a));
                              } catch (e) {
                                toast({
                                  title: "No se pudo reasignar",
                                  description: e instanceof Error ? e.message : "Intenta nuevamente.",
                                  variant: "destructive",
                                });
                              } finally {
                                setReassigningAlertId(null);
                              }
                            }}
                          >
                            <SelectTrigger className="w-56">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {users.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {alert.timestamp}
                      </span>
                      <div className="flex space-x-2">
                        {alert.status === "active" && (
                          <Button 
                            size="sm" 
                            className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
                            onClick={() => handleResolveAlert(alert.id)}
                            disabled={resolvingAlertId === alert.id}
                          >
                            {resolvingAlertId === alert.id ? (
                              <>
                                <svg className="animate-spin w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                </svg>
                                Procesando...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Marcar Resuelta
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={newAlertOpen}
        onOpenChange={(open) => {
          setNewAlertOpen(open);
          if (!open) resetNewAlertForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Alerta</DialogTitle>
            <DialogDescription>
              Crea una alerta manual sobre un producto, para que alguien le dé seguimiento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Producto *</Label>
              {selectedProduct ? (
                <div className="mt-1 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="font-medium">{selectedProduct.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    className="mt-1"
                    placeholder="Buscar por nombre o código..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {productResults.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-md border">
                      {productResults.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setSelectedProduct(p);
                            setProductSearch('');
                            setProductResults([]);
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo *</Label>
                <Select value={newTypeId} onValueChange={setNewTypeId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {alertTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad *</Label>
                <Select value={newPriorityId} onValueChange={setNewPriorityId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {alertPriorities.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Título *</Label>
              <Input className="mt-1" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            <div>
              <Label>Mensaje (opcional)</Label>
              <Textarea className="mt-1" rows={3} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAlertOpen(false)} disabled={creatingAlert}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateAlert}
              disabled={creatingAlert || !newTypeId || !newPriorityId || !newTitle.trim() || !selectedProduct}
            >
              {creatingAlert && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear alerta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlertsManagement;