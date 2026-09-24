/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Detalle de pedido — confirmar, cancelar, entrega parcial, venta.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Check,
  ClipboardCopy,
  Clock3,
  DollarSign,
  Edit3,
  FileDown,
  Link2,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Receipt,
  Share2,
  ShoppingCart,
  Truck,
  UserRound,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/Pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useTenant } from "@/context/useTenant";
import { useAuth } from "@/context/useAuth";
import { listCashRegisters } from "@/services/cashSessionsService";
import { formatMoney, formatDateTime } from "@/utils/formatters";
import { resolvePdfLogoDataUrl } from "@/utils/pdfBranding";
import {
  cancelOrder,
  changeOrderBranch,
  confirmOrder,
  convertOrderToSale,
  fetchOrderById,
  fetchOrderShareLink,
  num,
  pendingOrderLineQty,
  updateOrderAdminDetails,
  reverseOrderDelivery,
} from "@/services/orderService";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { OrderOperations } from "../components/OrderOperations";
import { generateOrderPDF } from "../documents/generateOrderPDF";
import { buildOrderMailto, orderPaymentSummary, orderProgressStep, orderVisualState, paginateOrderLines } from "../ordersViewModel";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthPermissions();
  const { user } = useAuth();
  const { locale, currencyCode, companyName, companyLogoUrl } = useSystemSettings();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);

  const canManage = hasPermission("orders.manage");
  const canSell = hasPermission("sales.create");
  const isAdmin = String(user?.role?.name ?? "").toLowerCase() === "admin";
  const { branches } = useTenant();

  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [amountReceived, setAmountReceived] = useState("");
  const [saleQtys, setSaleQtys] = useState<Record<string, string>>({});
  const [cashRegisterId, setCashRegisterId] = useState<string>("");
  const [shareAction, setShareAction] = useState<"copy" | "share" | "email" | null>(null);
  const [linePage, setLinePage] = useState(1);
  const [deliveryToReverse, setDeliveryToReverse] = useState<string | null>(null);
  const [linePageSize, setLinePageSize] = useState(10);
  const [adminDetailsOpen, setAdminDetailsOpen] = useState(false);
  const [adminDraft, setAdminDraft] = useState({
    delivery_carrier: "",
    delivery_tracking_number: "",
    delivery_address: "",
    delivery_dispatched_at: "",
    delivery_estimated_at: "",
    notes: "",
  });

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrderById(id!),
    enabled: Boolean(id),
  });

  const hasSales = (order?.documentSales?.length ?? 0) > 0;
  const canRegisterSale =
    order && order.fulfillment_mode !== 'SEPARATE' && ["CONFIRMED", "PARTIALLY_FULFILLED"].includes(order.status) && order.lines.some((l) => pendingOrderLineQty(l) > 0);

  // Este botón vende directo desde el pedido, sin pasar por el selector de
  // caja de "Abrir en POS" — necesita saber solas cuáles cajas puede usar
  // este cajero, si no, adivina la predeterminada de la sucursal y falla en
  // silencio cuando el turno del cajero está abierto en otra caja distinta.
  const { data: cashRegisters = [], isLoading: cashRegistersLoading } = useQuery({
    queryKey: ["cash-registers", "for-order-sale", order?.branch_id],
    queryFn: () => listCashRegisters(),
    enabled: Boolean(canRegisterSale && canSell),
    staleTime: 15_000,
  });

  const usableCashRegisters = useMemo(() => {
    // listCashRegisters() ya devuelve solo cajas activas de la sucursal activa: un
    // admin puede usar cualquiera; un cajero solo aquella donde tiene turno propio.
    if (isAdmin) return cashRegisters;
    return cashRegisters.filter(
      (r) => r.open_session && String(r.open_session.opened_by_id) === String(user?.id)
    );
  }, [cashRegisters, isAdmin, user?.id]);

  const noUsableCashRegister =
    canRegisterSale && canSell && !cashRegistersLoading && usableCashRegisters.length === 0;

  const saleTotal = useMemo(() => {
    if (!order) return 0;
    return order.lines.reduce((acc, line) => {
      const q = Number(saleQtys[line.id] || 0);
      if (!Number.isFinite(q) || q <= 0) return acc;
      return acc + q * num(line.unit_price);
    }, 0);
  }, [order, saleQtys]);

  // Respaldo del recorte en el onChange: si el pedido se refrescó mientras el diálogo
  // estaba abierto (otra entrega en paralelo bajó lo pendiente), no dejar confirmar
  // con una cantidad que ya no cabe.
  const hasQtyOverPending = useMemo(() => {
    if (!order) return false;
    return order.lines.some((line) => {
      const q = Number(saleQtys[line.id] || 0);
      return Number.isFinite(q) && q > pendingOrderLineQty(line);
    });
  }, [order, saleQtys]);

  const paginatedLines = useMemo(
    () => paginateOrderLines(order?.lines ?? [], linePage, linePageSize),
    [linePage, linePageSize, order?.lines],
  );
  const paymentSummary = useMemo(
    () => orderPaymentSummary(num(order?.total), order?.documentSales ?? []),
    [order?.documentSales, order?.total],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const openSaleDialog = () => {
    if (!order) return;
    const init: Record<string, string> = {};
    for (const line of order.lines) {
      const pending = pendingOrderLineQty(line);
      if (pending > 0) init[line.id] = String(pending);
    }
    setSaleQtys(init);
    setCashRegisterId(usableCashRegisters.length === 1 ? usableCashRegisters[0].id : "");
    setSaleDialogOpen(true);
  };

  // Con una sola caja usable no hace falta preguntar; con varias, elegir es obligatorio.
  const effectiveCashRegisterId =
    cashRegisterId || (usableCashRegisters.length === 1 ? usableCashRegisters[0].id : "");

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrder(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", id], updated);
      invalidate();
      toast({ title: "Pedido confirmado", description: "Stock reservado." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const branchMutation = useMutation({
    mutationFn: (branchId: string) => changeOrderBranch(id!, branchId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", id], updated);
      invalidate();
      // La referencia se regenera con la serie de la sucursal nueva
      toast({ title: "Pedido movido de sucursal", description: updated.reference ?? undefined });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", id], updated);
      invalidate();
      toast({ title: "Pedido cancelado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const adminDetailsMutation = useMutation({
    mutationFn: () => updateOrderAdminDetails(id!, {
      delivery_carrier: adminDraft.delivery_carrier || null,
      delivery_tracking_number: adminDraft.delivery_tracking_number || null,
      delivery_address: adminDraft.delivery_address || null,
      delivery_dispatched_at: adminDraft.delivery_dispatched_at ? new Date(adminDraft.delivery_dispatched_at).toISOString() : null,
      delivery_estimated_at: adminDraft.delivery_estimated_at ? new Date(adminDraft.delivery_estimated_at).toISOString() : null,
      notes: adminDraft.notes || null,
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", id], updated);
      invalidate();
      setAdminDetailsOpen(false);
      toast({ title: "Información del pedido actualizada" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: () => {
      const lines = Object.entries(saleQtys)
        .map(([line_id, raw]) => ({ line_id, qty: Number(raw) }))
        .filter((x) => Number.isFinite(x.qty) && x.qty > 0);
      return convertOrderToSale(id!, {
        payment_method_id: Number(paymentMethodId),
        amount_received: amountReceived ? Number(amountReceived) : undefined,
        lines,
        cash_register_id: effectiveCashRegisterId || undefined,
      });
    },
    onSuccess: (result) => {
      invalidate();
      setSaleDialogOpen(false);
      const saleRef = (result.sale as { reference?: string; id?: string })?.reference;
      toast({ title: "Venta registrada", description: saleRef ?? "OK" });
      const saleId = (result.sale as { id?: string })?.id;
      if (saleId) navigate(`/ventas/${saleId}/factura`);
      else queryClient.setQueryData(["order", id], result.order);
    },
    onError: (e: Error) => toast({ title: "Error al vender", description: e.message, variant: "destructive" }),
  });

  const reverseDeliveryMutation = useMutation({
    mutationFn: () => reverseOrderDelivery(order!.id, deliveryToReverse!),
    onSuccess: () => { invalidate(); setDeliveryToReverse(null); toast({ title: 'Entrega revertida', description: 'Las existencias y cantidades pendientes fueron restauradas.' }); },
    onError: (error: Error) => toast({ title: 'No se pudo revertir la entrega', description: error.message, variant: 'destructive' }),
  });

  if (isLoading) return <p className="p-6 text-muted-foreground">Cargando pedido…</p>;
  if (isError || !order) return <p className="p-6 text-destructive">Pedido no encontrado.</p>;

  const isCash =
    paymentMethods.find((p) => String(p.id) === paymentMethodId)?.name?.toLowerCase() === "efectivo";
  const total = num(order.total);
  const totalOrdered = order.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
  const totalFulfilled = order.lines.reduce((sum, line) => sum + Number(line.qty_fulfilled || 0), 0);
  const progressStep = orderProgressStep(order.status);
  const progress = ["Creado", "Confirmado", "Preparación", "Entrega", "Completado"];
  const progressShort = ["Creado", "Conf.", "Prepar.", "Entrega", "Completo"];
  const visualState = orderVisualState(order.status);
  const deliveryLabel = visualState.delivery === "delivered" ? "Entregado" : visualState.delivery === "transit" ? "En tránsito" : visualState.delivery === "cancelled" ? "Cancelado" : "Pendiente";
  const statusOptions = order.status === "DRAFT"
    ? ["DRAFT", "CONFIRMED", "CANCELLED"] as const
    : order.status === "CONFIRMED" && !hasSales
      ? ["CONFIRMED", "CANCELLED"] as const
      : [order.status] as const;

  const openAdminDetails = () => {
    const inputDate = (value?: string | null) => value ? format(new Date(value), "yyyy-MM-dd'T'HH:mm") : "";
    setAdminDraft({
      delivery_carrier: order.delivery_carrier || "",
      delivery_tracking_number: order.delivery_tracking_number || "",
      delivery_address: order.delivery_address || order.customerContact?.address || "",
      delivery_dispatched_at: inputDate(order.delivery_dispatched_at),
      delivery_estimated_at: inputDate(order.delivery_estimated_at),
      notes: order.notes || "",
    });
    setAdminDetailsOpen(true);
  };

  const changeStatus = (status: string) => {
    if (status === order.status) return;
    if (status === "CONFIRMED") confirmMutation.mutate();
    if (status === "CANCELLED" && window.confirm("¿Cancelar este pedido? Esta acción liberará sus reservas activas.")) cancelMutation.mutate();
  };

  const getPublicUrl = async () => {
    const { public_url } = await fetchOrderShareLink(order.id);
    return new URL(public_url, window.location.origin).toString();
  };

  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const field = document.createElement("textarea");
    field.value = value;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  };

  const handlePublicAction = async (action: "copy" | "share" | "email") => {
    try {
      setShareAction(action);
      const publicUrl = await getPublicUrl();
      if (action === "email") {
        window.location.href = buildOrderMailto(publicUrl, order.reference, order.customerContact?.email);
        return;
      }
      if (action === "share" && navigator.share) {
        await navigator.share({ title: `Pedido ${order.reference ?? ""}`.trim(), url: publicUrl });
        return;
      }
      await copyText(publicUrl);
      toast({ title: action === "share" ? "Enlace listo para compartir" : "Enlace copiado", description: publicUrl });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "No se pudo compartir", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setShareAction(null);
    }
  };

  const handlePdf = async () => {
    try {
      const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl);
      generateOrderPDF(order, { companyName, logoDataUrl, locale, currencyCode });
    } catch {
      generateOrderPDF(order, { companyName, locale, currencyCode });
    }
  };

  return (
    <div className="min-h-full bg-brand-surface/70 dark:bg-brand-navy">
      <div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="space-y-4">
          <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground" onClick={() => navigate("/pedidos")}>
            <ArrowLeft className="h-4 w-4" /> Pedidos
          </button>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-brand-navy dark:text-white sm:text-4xl">Pedido {order.reference ?? order.id.slice(0, 8)}</h1>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Creado {formatDateTime(order.created_at, undefined, locale)} · Actualizado {formatDateTime(order.updated_at, undefined, locale)}
                {order.convertedFrom?.reference ? ` · Cotización ${order.convertedFrom.reference}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="outline" className="rounded-xl" onClick={() => void handlePdf()}><FileDown className="mr-2 h-4 w-4" />PDF</Button>
              <Button variant="outline" className="rounded-xl" disabled={shareAction !== null} onClick={() => void handlePublicAction("copy")}><ClipboardCopy className="mr-2 h-4 w-4" />Copiar enlace</Button>
              <Button variant="outline" className="rounded-xl" disabled={shareAction !== null} onClick={() => void handlePublicAction("email")}><Mail className="mr-2 h-4 w-4" />Correo</Button>
              <Button className="rounded-xl bg-brand-orange text-white shadow-lg shadow-orange-500/20 hover:bg-brand-orange-strong" disabled={shareAction !== null} onClick={() => void handlePublicAction("share")}>
                {shareAction === "share" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}Compartir con cliente
              </Button>
            </div>
          </div>
        </header>

        <section className="flex flex-wrap items-end gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm dark:bg-[#101f34] print:hidden">
          {canManage ? <div className="min-w-[210px] space-y-1"><Label htmlFor="order-status">Estado del pedido</Label><Select value={order.status} onValueChange={changeStatus} disabled={confirmMutation.isPending || cancelMutation.isPending || statusOptions.length === 1}><SelectTrigger id="order-status" className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((status) => <SelectItem key={status} value={status}>{status === "DRAFT" ? "Borrador" : status === "CONFIRMED" ? "Confirmado" : status === "CANCELLED" ? "Cancelado" : status}</SelectItem>)}</SelectContent></Select></div> : null}
          {order.fulfillment_mode === 'SEPARATE' && <OrderOperations order={order} />}
          {canRegisterSale && canManage && canSell ? <>
            <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/ventas/nueva?pedido=${encodeURIComponent(order.reference ?? order.id)}`)}><ShoppingCart className="mr-2 h-4 w-4" />Abrir en POS</Button>
            <Button className="rounded-xl bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={openSaleDialog} disabled={noUsableCashRegister} title={noUsableCashRegister ? "No tenés un turno de caja abierto. Abrí caja desde Abrir en POS primero." : undefined}><Receipt className="mr-2 h-4 w-4" />Registrar venta</Button>
          </> : null}
          {confirmMutation.isPending || cancelMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(500px,1.55fr)_minmax(280px,0.9fr)]">
          <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
            <CardHeader><CardTitle className="text-lg">Cliente</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Building2 className="h-6 w-6" /></span><div><strong className="text-base">{order.customer || order.customerContact?.name || "Sin cliente"}</strong><p className="text-muted-foreground">{order.is_final_consumer ? "Consumidor final" : `NIT ${order.customer_nit || order.customerContact?.tax_id || "—"}`}</p></div></div>
              {order.customerContact?.contact ? <p className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" /><span>{order.customerContact.contact}</span></p> : null}
              {order.customerContact?.email ? <p className="flex gap-3 break-all"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{order.customerContact.email}</span></p> : null}
              {order.customerContact?.phone ? <p className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 text-muted-foreground" /><span>{order.customerContact.phone}</span></p> : null}
              {order.customerContact?.address ? <p className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{order.customerContact.address}</span></p> : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
            <CardHeader><CardTitle className="text-lg">Cumplimiento del pedido</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-1">
                {progress.map((label, index) => {
                  const complete = progressStep > index;
                  const current = progressStep === index + 1;
                  return <div key={label} className="relative text-center">
                    {index > 0 ? <span className={`absolute right-1/2 top-5 h-0.5 w-full ${complete || current ? "bg-emerald-500" : "bg-border"}`} /> : null}
                    <span className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 ${complete ? "border-emerald-500 bg-emerald-500 text-white" : current ? "border-brand-orange bg-brand-orange text-white shadow-lg shadow-orange-500/30" : "border-border bg-card text-muted-foreground"}`}>{complete ? <Check className="h-5 w-5" /> : index === 3 ? <Warehouse className="h-5 w-5" /> : index === 4 ? <PackageCheck className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span>
                    <span className="mt-2 block px-0.5 text-[10px] font-medium leading-tight sm:text-xs"><span className="sm:hidden">{progressShort[index]}</span><span className="hidden sm:inline">{label}</span></span>
                  </div>;
                })}
              </div>
              <div className="mt-7 grid grid-cols-3 gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 text-center">
                <div><strong className="block text-xl">{totalOrdered}</strong><span className="text-xs text-muted-foreground">Solicitado</span></div>
                <div><strong className="block text-xl text-emerald-600">{totalFulfilled}</strong><span className="text-xs text-muted-foreground">Entregado</span></div>
                <div><strong className="block text-xl text-brand-orange">{Math.max(0, totalOrdered - totalFulfilled)}</strong><span className="text-xs text-muted-foreground">Pendiente</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
            <CardHeader><CardTitle className="text-lg">Información del pedido</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Folio" value={order.reference ?? order.id.slice(0, 8)} />
              <InfoRow label="Canal" value={order.sales_channel || "—"} />
              <InfoRow label="Moneda" value={currencyCode} />
              <InfoRow label="Creado por" value={order.createdBy?.name || "—"} />
              <InfoRow label="Vigencia" value={order.valid_until ? formatDateTime(order.valid_until, undefined, locale) : "—"} />
              {order.confirmed_at ? <InfoRow label="Confirmado" value={formatDateTime(order.confirmed_at, undefined, locale)} /> : null}
              {order.status === "DRAFT" && canManage && branches.length > 1 ? <div className="space-y-2 pt-2"><Label htmlFor="order-branch">Sucursal</Label><Select value={order.branch?.id ?? ""} onValueChange={(value) => branchMutation.mutate(value)} disabled={branchMutation.isPending}><SelectTrigger id="order-branch" className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Moverlo cambia su correlativo.</p></div> : <InfoRow label="Sucursal" value={order.branch?.name || "—"} />}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.72fr)]">
          <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-lg">Partidas ({order.lines.length})</CardTitle><Button variant="outline" size="sm" className="rounded-lg print:hidden" onClick={() => void handlePdf()}><FileDown className="mr-2 h-4 w-4" />Descargar</Button></CardHeader>
            <CardContent className="p-0">
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader><TableRow className="bg-muted/45"><TableHead className="pl-6">Código</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Pedido</TableHead><TableHead className="text-right">Entregado</TableHead><TableHead className="text-right">Pendiente</TableHead><TableHead className="text-right">P. unitario</TableHead><TableHead className="pr-6 text-right">Importe</TableHead></TableRow></TableHeader>
                  <TableBody>{paginatedLines.items.map((line) => <TableRow key={line.id}><TableCell className="pl-6 text-muted-foreground">{line.product?.barcode || "—"}</TableCell><TableCell className="font-medium">{line.product?.name ?? line.product_id}</TableCell><TableCell className="text-right">{line.qty}</TableCell><TableCell className="text-right text-emerald-600">{Number(line.qty_fulfilled || 0)}</TableCell><TableCell className="text-right text-brand-orange">{pendingOrderLineQty(line)}</TableCell><TableCell className="text-right">{fmt(num(line.unit_price))}</TableCell><TableCell className="pr-6 text-right font-semibold">{fmt(num(line.line_total))}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
              <div className="space-y-3 p-4 sm:hidden">{paginatedLines.items.map((line) => <article key={line.id} className="rounded-xl border border-border/70 p-4"><div className="flex justify-between gap-3"><div><strong>{line.product?.name ?? line.product_id}</strong><p className="text-xs text-muted-foreground">{line.product?.barcode || "Sin código"}</p></div><strong>{fmt(num(line.line_total))}</strong></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded-lg bg-muted p-2">Pedido<strong className="block text-sm">{line.qty}</strong></span><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">Entregado<strong className="block text-sm">{Number(line.qty_fulfilled || 0)}</strong></span><span className="rounded-lg bg-orange-500/10 p-2 text-brand-orange">Pendiente<strong className="block text-sm">{pendingOrderLineQty(line)}</strong></span></div></article>)}</div>
              {paginatedLines.totalItems > 10 ? <div className="flex flex-col gap-3 border-t border-border/70 px-5 pb-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground"><span>Mostrar</span><Select value={String(linePageSize)} onValueChange={(value) => { setLinePageSize(Number(value)); setLinePage(1); }}><SelectTrigger className="h-9 w-20" aria-label="Partidas por página"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select><span>de {paginatedLines.totalItems}</span></div><Pagination currentPage={paginatedLines.page} totalPages={paginatedLines.totalPages} onPageChange={setLinePage} /></div> : null}
              <div className="ml-auto w-full max-w-sm space-y-2 border-t border-border/70 p-5 text-sm"><InfoRow label="Subtotal" value={fmt(num(order.subtotal))} />{num(order.discount_total) > 0 ? <InfoRow label="Descuento" value={`-${fmt(num(order.discount_total))}`} /> : null}<div className="flex items-center justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{fmt(total)}</span></div></div>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]"><CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-lg"><Truck className="h-5 w-5 text-brand-orange" />Despacho y entrega</CardTitle>{canManage ? <Button variant="link" size="sm" className="h-auto p-0 text-brand-orange" onClick={openAdminDetails}><Edit3 className="mr-1 h-3.5 w-3.5" />Editar</Button> : null}</CardHeader><CardContent className="space-y-3 text-sm"><InfoRow label="Transportista" value={order.delivery_carrier || "—"} /><InfoRow label="Guía de envío" value={order.delivery_tracking_number || "—"} /><InfoRow label="Salida" value={order.delivery_dispatched_at ? formatDateTime(order.delivery_dispatched_at, undefined, locale) : "—"} /><InfoRow label="Entrega estimada" value={order.delivery_estimated_at ? formatDateTime(order.delivery_estimated_at, undefined, locale) : "—"} /><InfoRow label="Dirección" value={order.delivery_address || order.customerContact?.address || "—"} /><InfoRow label="Estado" value={deliveryLabel} /></CardContent></Card>
            <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="h-5 w-5 text-emerald-500" />Facturación y cartera</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Total del pedido" value={fmt(total)} />
                <InfoRow label="Ventas vigentes (neto)" value={fmt(paymentSummary.invoiced)} />
                <InfoRow label="Pagado / aplicado" value={fmt(paymentSummary.paid)} />
                <div className="flex items-center justify-between text-base font-bold"><span>Saldo por cobrar</span><span>{fmt(paymentSummary.balance)}</span></div>
                <p className="text-xs text-muted-foreground">El saldo corresponde únicamente a ventas emitidas. Los importes del pedido todavía sin facturar no son deuda.</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${paymentSummary.percentage}%` }} /></div>
                <p className="text-right text-xs text-muted-foreground">{paymentSummary.percentage}% aplicado a ventas vigentes</p>
                {order.documentSales?.length ? <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">{order.documentSales.map(link => link.sale?.id ? <Button key={link.id} variant="outline" size="sm" className="rounded-lg" onClick={() => navigate(`/ventas/${link.sale!.id}/factura`)}>{link.sale.reference ?? link.sale.id.slice(0, 8)}</Button> : null)}</div> : <p className="text-muted-foreground">Sin ventas emitidas. No hay saldo por cobrar.</p>}
              </CardContent>
            </Card>
            {order.fulfillment_mode === 'SEPARATE' && <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Truck className="h-5 w-5 text-brand-orange" />Entregas registradas</CardTitle></CardHeader>
              <CardContent className="max-h-72 space-y-3 overflow-y-auto text-sm">{order.deliveries?.length ? order.deliveries.map((delivery, index) => <div key={delivery.id} className="rounded-xl border border-border/70 p-3">
                <p className="font-medium">Entrega {order.deliveries!.length - index}{delivery.reversed_at ? ' · Revertida' : ''}</p><p className="text-xs text-muted-foreground">{formatDateTime(delivery.created_at, undefined, locale)}</p>
                {delivery.lines.map(line => <p key={line.document_line_id}>{order.lines.find(item => item.id === line.document_line_id)?.product?.name || 'Producto'}: {line.qty}</p>)}
                {canManage && !delivery.reversed_at && delivery.lines.every(line => line.qty_invoiced === 0) && <Button variant="outline" size="sm" className="mt-2" onClick={() => setDeliveryToReverse(delivery.id)}>Revertir entrega</Button>}
              </div>) : <p className="text-muted-foreground">Todavía no se han registrado entregas.</p>}</CardContent>
            </Card>}
            <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Link2 className="h-5 w-5 text-brand-orange" />Seguimiento del cliente</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Comparte una vista de solo lectura con el estado y las partidas del pedido.</p><Button variant="outline" className="w-full rounded-xl" disabled={shareAction !== null} onClick={() => void handlePublicAction("copy")}><ClipboardCopy className="mr-2 h-4 w-4" />Copiar enlace público</Button></CardContent></Card>
            <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]"><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-lg">Notas</CardTitle>{canManage ? <Button variant="link" size="sm" className="h-auto p-0 text-brand-orange" onClick={openAdminDetails}><Edit3 className="mr-1 h-3.5 w-3.5" />Editar</Button> : null}</CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.notes || "Sin notas para este pedido."}</p></CardContent></Card>
          </aside>
        </div>

      <Dialog open={deliveryToReverse !== null} onOpenChange={open => { if (!open && !reverseDeliveryMutation.isPending) setDeliveryToReverse(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Revertir entrega</DialogTitle><DialogDescription>Confirma que los productos permanecen en bodega o ya fueron recibidos de vuelta. Se restaurará el inventario y quedarán pendientes de entregar en el pedido.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={reverseDeliveryMutation.isPending} onClick={() => setDeliveryToReverse(null)}>Cancelar</Button><Button disabled={reverseDeliveryMutation.isPending} onClick={() => reverseDeliveryMutation.mutate()}>Confirmar reversión</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={adminDetailsOpen} onOpenChange={setAdminDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Despacho y notas del pedido</DialogTitle><DialogDescription>Actualiza la información operativa visible para administración.</DialogDescription></DialogHeader>
          <div className="grid max-h-[65vh] gap-4 overflow-y-auto py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="delivery-carrier">Transportista</Label><Input id="delivery-carrier" maxLength={150} value={adminDraft.delivery_carrier} onChange={(event) => setAdminDraft((current) => ({ ...current, delivery_carrier: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="delivery-tracking">Guía de envío</Label><Input id="delivery-tracking" maxLength={100} value={adminDraft.delivery_tracking_number} onChange={(event) => setAdminDraft((current) => ({ ...current, delivery_tracking_number: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="delivery-dispatched">Fecha de salida</Label><Input id="delivery-dispatched" type="datetime-local" value={adminDraft.delivery_dispatched_at} onChange={(event) => setAdminDraft((current) => ({ ...current, delivery_dispatched_at: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="delivery-estimated">Entrega estimada</Label><Input id="delivery-estimated" type="datetime-local" value={adminDraft.delivery_estimated_at} onChange={(event) => setAdminDraft((current) => ({ ...current, delivery_estimated_at: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="delivery-address">Dirección de entrega</Label><Input id="delivery-address" maxLength={500} value={adminDraft.delivery_address} onChange={(event) => setAdminDraft((current) => ({ ...current, delivery_address: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="order-admin-notes">Notas</Label><textarea id="order-admin-notes" rows={4} maxLength={5000} className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" value={adminDraft.notes} onChange={(event) => setAdminDraft((current) => ({ ...current, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdminDetailsOpen(false)}>Cancelar</Button><Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={adminDetailsMutation.isPending} onClick={() => adminDetailsMutation.mutate()}>{adminDetailsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-2 h-4 w-4" />}Guardar cambios</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar venta (entrega parcial)</DialogTitle>
            <DialogDescription>
              Indica cuántas unidades entregar en esta venta. Total parcial: <strong>{fmt(saleTotal)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[50vh] overflow-y-auto">
            {order.lines
              .filter((l) => pendingOrderLineQty(l) > 0)
              .map((line) => {
                const pending = pendingOrderLineQty(line);
                return (
                  <div key={line.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{line.product?.name ?? line.product_id}</span>
                    <Input
                      type="number"
                      min={0}
                      max={pending}
                      className="w-20"
                      value={saleQtys[line.id] ?? ""}
                      onChange={(e) => {
                        // `max` en un <input type="number"> es cosmético — no bloquea lo que
                        // se escribe, solo el paso de las flechas. Sin este recorte se podía
                        // pedir más de lo pendiente (2 de 1) y el backend recién lo rechazaba
                        // al confirmar.
                        const raw = e.target.value
                        if (raw === "") {
                          setSaleQtys((s) => ({ ...s, [line.id]: "" }))
                          return
                        }
                        const n = Number(raw)
                        if (!Number.isFinite(n)) return
                        const clamped = Math.max(0, Math.min(Math.floor(n), pending))
                        setSaleQtys((s) => ({ ...s, [line.id]: String(clamped) }))
                      }}
                    />
                    <span className="text-muted-foreground w-16 text-right">/ {pending}</span>
                  </div>
                );
              })}
            {usableCashRegisters.length > 1 && (
              <div className="space-y-2 pt-2">
                <Label>Caja</Label>
                <Select value={effectiveCashRegisterId} onValueChange={setCashRegisterId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
                  <SelectContent>
                    {usableCashRegisters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 pt-2">
              <Label>Método de pago</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={String(pm.id)}>{pm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isCash && (
              <div className="space-y-2">
                <Label htmlFor="received">Monto recibido</Label>
                <Input id="received" type="number" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleDialogOpen(false)}>Cerrar</Button>
            <Button
              disabled={
                !paymentMethodId ||
                !effectiveCashRegisterId ||
                convertMutation.isPending ||
                saleTotal <= 0 ||
                hasQtyOverPending
              }
              onClick={() => convertMutation.mutate()}
            >
              {convertMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}
