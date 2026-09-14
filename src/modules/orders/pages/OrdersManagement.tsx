/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Lista de pedidos comerciales.
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { formatMoney, formatDateTime } from "@/utils/formatters";
import {
  fetchOrders,
  orderStatusLabel,
  num,
  type OrderStatus,
} from "@/services/orderService";
import { fetchCommittedStockReport } from "@/services/commercialDocumentsReportService";
import {
  commercialDocSearchHint,
  isCommercialDocSearchReady,
} from "@/modules/quotes";

function statusBadgeVariant(status: OrderStatus): "default" | "secondary" | "outline" {
  if (status === "CONFIRMED") return "outline";
  if (status === "FULFILLED") return "default";
  return "secondary";
}

export default function OrdersManagement() {
  const navigate = useNavigate();
  const { locale, currencyCode } = useSystemSettings();
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const searchHint = commercialDocSearchHint(search);

  const { data: report } = useQuery({
    queryKey: ["committed-stock-report"],
    queryFn: fetchCommittedStockReport,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["orders", statusFilter, debouncedSearch],
    queryFn: () =>
      fetchOrders({
        page: 1,
        pageSize: 50,
        ...(statusFilter && !debouncedSearch ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    enabled: !debouncedSearch || isCommercialDocSearchReady(debouncedSearch),
  });

  const orders = data?.items ?? [];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold">Pedidos</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Reserva stock al confirmar · venta desde pedido confirmado
        </p>
      </div>

      {report && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stock comprometido</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Unidades reservadas</p>
              <p className="text-xl font-semibold">{report.summary.totalReservedQty}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Productos</p>
              <p className="text-xl font-semibold">{report.summary.productsWithReservations}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pedidos abiertos</p>
              <p className="text-xl font-semibold">{report.summary.openOrders}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cotizaciones abiertas</p>
              <p className="text-xl font-semibold">{report.summary.openQuotes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-col gap-3 space-y-0">
          <CardTitle className="text-base">Listado</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="P-000001, cliente, NIT…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="DRAFT">Borrador</SelectItem>
                <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                <SelectItem value="PARTIALLY_FULFILLED">Parcial</SelectItem>
                <SelectItem value="FULFILLED">Completado</SelectItem>
                <SelectItem value="CANCELLED">Cancelado</SelectItem>
                <SelectItem value="EXPIRED">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {searchHint && <p className="text-xs text-muted-foreground">{searchHint}</p>}
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {isError && <p className="text-sm text-destructive">No se pudieron cargar los pedidos.</p>}
          {!isLoading && !orders.length && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No hay pedidos. Convierte una cotización aceptada o enviada.
            </p>
          )}
          {orders.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Reserva</TableHead>
                    <TableHead>Creado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((row) => (
                    <TableRow
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/pedidos/${row.id}`)}
                    >
                      <TableCell className="font-medium">{row.reference ?? row.id.slice(0, 8)}</TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {row.customer || row.customerContact?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.branch?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>{orderStatusLabel(row.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmt(num(row.total))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.status === "CONFIRMED" ? "Activa" : row.status === "FULFILLED" ? "Consumida" : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(row.created_at, undefined, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
