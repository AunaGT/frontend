/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Detalle de cotización — acciones según estado.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Link2, Loader2, Mail, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useModules } from "@/context/useModules";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { formatMoney, formatDateTime } from "@/utils/formatters";
import { getCompanyNamePublic } from "@/services/settingsService";
import { resolvePdfLogoDataUrl } from "@/utils/pdfBranding";
import {
  convertQuoteToOrder,
  fetchQuoteById,
  fetchQuoteShareLink,
  buildQuoteMailto,
  num,
  quoteStatusLabel,
  updateQuoteStatus,
  type QuoteStatus,
} from "@/services/quoteService";
import { generateQuotePDF } from "./documents/generateQuotePDF";

function statusBadgeVariant(status: QuoteStatus): "default" | "secondary" | "outline" {
  if (status === "ACCEPTED") return "default";
  if (status === "SENT") return "outline";
  return "secondary";
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthPermissions();
  const { isEnabled } = useModules();
  const { locale, currencyCode, companyName, companyLogoUrl } = useSystemSettings();
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);

  const canManage = hasPermission("quotes.manage");
  const canEdit = hasPermission("quotes.create");
  const ordersEnabled = isEnabled("orders");

  const { data: quote, isLoading, isError } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => fetchQuoteById(id!),
    enabled: Boolean(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: QuoteStatus) => updateQuoteStatus(id!, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(["quote", id], updated);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Estado actualizado", description: quoteStatusLabel(updated.status) });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => convertQuoteToOrder(id!),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({
        title: "Pedido creado",
        description: order.reference ?? order.id,
      });
      navigate(`/pedidos/${order.id}`);
    },
    onError: (e: Error) => {
      toast({ title: "No se pudo convertir", description: e.message, variant: "destructive" });
    },
  });

  const handlePdf = async () => {
    if (!quote) return;
    try {
      const branding = await getCompanyNamePublic().catch(() => ({
        company_name: companyName,
        company_logo_url: companyLogoUrl,
      }));
      const logoDataUrl = await resolvePdfLogoDataUrl(branding.company_logo_url || companyLogoUrl);
      generateQuotePDF(quote, {
        companyName: branding.company_name || companyName,
        logoDataUrl,
        locale,
        currencyCode,
      });
    } catch {
      generateQuotePDF(quote, { companyName, locale, currencyCode });
    }
  };

  const handleCopyLink = async () => {
    try {
      const { public_url } = await fetchQuoteShareLink(id!);
      const fullUrl = public_url.startsWith("http")
        ? public_url
        : `${window.location.origin}${public_url.startsWith("/") ? public_url : `/${public_url}`}`;
      await navigator.clipboard.writeText(fullUrl);
      toast({ title: "Enlace copiado", description: fullUrl });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo copiar",
        variant: "destructive",
      });
    }
  };

  const handleEmailLink = async () => {
    try {
      const { public_url } = await fetchQuoteShareLink(id!);
      const fullUrl = public_url.startsWith("http")
        ? public_url
        : `${window.location.origin}${public_url.startsWith("/") ? public_url : `/${public_url}`}`;
      const mailto = buildQuoteMailto(fullUrl, quote?.reference, quote?.customerContact?.email);
      window.location.href = mailto;
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo abrir correo",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Cargando cotización…</p>;
  }
  if (isError || !quote) {
    return <p className="p-6 text-destructive">Cotización no encontrada.</p>;
  }

  const linkedOrder = quote.convertedChildren?.find((c) => c.doc_type === "ORDER");
  const canConvert =
    ordersEnabled &&
    canManage &&
    !linkedOrder &&
    quote.status === "ACCEPTED";

  return (
    <div className="p-3 sm:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cotizaciones")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold">
                {quote.reference ?? quote.id.slice(0, 8)}
              </h1>
              <Badge variant={statusBadgeVariant(quote.status)}>{quoteStatusLabel(quote.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {quote.customer || quote.customerContact?.name || "Sin cliente"} ·{" "}
              {formatDateTime(quote.created_at, undefined, locale)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handlePdf()}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
          {["SENT", "ACCEPTED"].includes(quote.status) && (
            <>
              <Button variant="outline" onClick={() => void handleCopyLink()}>
                <Link2 className="h-4 w-4 mr-2" />
                Copiar enlace
              </Button>
              <Button variant="outline" onClick={() => void handleEmailLink()}>
                <Mail className="h-4 w-4 mr-2" />
                Enviar por correo
              </Button>
            </>
          )}
          {quote.status === "DRAFT" && canEdit && (
            <Button variant="outline" onClick={() => statusMutation.mutate("SENT")} disabled={statusMutation.isPending}>
              Marcar enviada
            </Button>
          )}
          {quote.status === "SENT" && canManage && (
            <>
              <Button onClick={() => statusMutation.mutate("ACCEPTED")} disabled={statusMutation.isPending}>
                Aceptar
              </Button>
              <Button variant="secondary" onClick={() => statusMutation.mutate("REJECTED")} disabled={statusMutation.isPending}>
                Rechazar
              </Button>
            </>
          )}
          {canConvert && (
            <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
              {convertMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PackagePlus className="h-4 w-4 mr-2" />
              )}
              Crear pedido
            </Button>
          )}
        </div>
      </div>

      {quote.stock_reservations && quote.stock_reservations.length > 0 && (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Apartado blando activo: {quote.stock_reservations.reduce((a, r) => a + r.qty, 0)} unidad(es)
            {quote.stock_reservations[0]?.expires_at && (
              <> · vence {formatDateTime(quote.stock_reservations[0].expires_at!, undefined, locale)}</>
            )}
          </CardContent>
        </Card>
      )}

      {linkedOrder && (
        <Card>
          <CardContent className="pt-4 text-sm">
            Pedido vinculado:{" "}
            {ordersEnabled ? (
              <button
                type="button"
                className="text-primary underline"
                onClick={() => navigate(`/pedidos/${linkedOrder.id}`)}
              >
                {linkedOrder.reference ?? linkedOrder.id.slice(0, 8)}
              </button>
            ) : (
              <span>{linkedOrder.reference ?? linkedOrder.id.slice(0, 8)}</span>
            )}{" "}
            ({linkedOrder.status})
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Nombre:</span>{" "}
              {quote.customer || quote.customerContact?.name || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">NIT:</span>{" "}
              {quote.is_final_consumer ? "Consumidor final" : quote.customer_nit || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Vigencia:</span>{" "}
              {quote.valid_until ? formatDateTime(quote.valid_until, undefined, locale) : "—"}
            </p>
            {quote.notes && (
              <p>
                <span className="text-muted-foreground">Notas:</span> {quote.notes}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Elaborada por:</span> {quote.createdBy?.name ?? "—"}
            </p>
            <p className="text-lg font-semibold pt-2">Total: {fmt(num(quote.total))}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Líneas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">P. unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.product?.name ?? line.product_id}</TableCell>
                    <TableCell className="text-right">{line.qty}</TableCell>
                    <TableCell className="text-right">{fmt(num(line.unit_price))}</TableCell>
                    <TableCell className="text-right">{fmt(num(line.line_total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
