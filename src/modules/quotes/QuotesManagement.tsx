/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Lista de cotizaciones comerciales.
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { formatMoney, formatDateTime } from "@/utils/formatters";
import {
  fetchQuotes,
  quoteStatusLabel,
  num,
  type Quote,
  type QuoteStatus,
} from "@/services/quoteService";
import {
  commercialDocSearchHint,
  isCommercialDocSearchReady,
} from "./commercialDocumentSearchUtils";

function statusBadgeVariant(status: QuoteStatus): "default" | "secondary" | "outline" | "destructive" {
  if (status === "ACCEPTED") return "default";
  if (status === "SENT") return "outline";
  if (status === "REJECTED" || status === "CANCELLED" || status === "EXPIRED") return "secondary";
  return "secondary";
}

export default function QuotesManagement() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthPermissions();
  const { locale, currencyCode } = useSystemSettings();
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);

  const canCreate = hasPermission("quotes.create");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const searchHint = commercialDocSearchHint(search);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["quotes", statusFilter, debouncedSearch],
    queryFn: () =>
      fetchQuotes({
        page: 1,
        pageSize: 50,
        ...(statusFilter && !debouncedSearch ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    enabled: !debouncedSearch || isCommercialDocSearchReady(debouncedSearch),
  });

  const quotes = data?.items ?? [];

  const goDetail = (row: Quote) => {
    navigate(`/cotizaciones/${row.id}`);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold">Cotizaciones</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Propuestas comerciales sin reserva de stock
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate("/cotizaciones/nueva")} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Nueva cotización
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-col gap-3 space-y-0">
          <CardTitle className="text-base">Listado</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Q-000001, cliente, NIT…"
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
                <SelectItem value="SENT">Enviada</SelectItem>
                <SelectItem value="ACCEPTED">Aceptada</SelectItem>
                <SelectItem value="REJECTED">Rechazada</SelectItem>
                <SelectItem value="CANCELLED">Cancelada</SelectItem>
                <SelectItem value="EXPIRED">Vencida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {searchHint && <p className="text-xs text-muted-foreground">{searchHint}</p>}
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {isError && (
            <p className="text-sm text-destructive">No se pudieron cargar las cotizaciones.</p>
          )}
          {!isLoading && !quotes.length && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No hay cotizaciones. Crea la primera con «Nueva cotización».
            </p>
          )}
          {quotes.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Creada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((row) => (
                    <TableRow
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => goDetail(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goDetail(row);
                        }
                      }}
                    >
                      <TableCell className="font-medium">{row.reference ?? row.id.slice(0, 8)}</TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {row.customer || row.customerContact?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.branch?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>{quoteStatusLabel(row.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmt(num(row.total))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.valid_until ? formatDateTime(row.valid_until, undefined, locale) : "—"}
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
