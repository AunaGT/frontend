/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Detalle de cotización — acciones según estado.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ExternalLink, FileDown, FileText, Link2, Loader2, Mail, PackagePlus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState, LoadingIndicator } from "@/components/shared/LoadingState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CommercialPaymentFields, type CommercialPaymentTerms } from "@/components/shared/CommercialPaymentFields";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { QuoteLines, QuoteStatusBadge, QuoteSummary } from "./QuotePresentation";
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
  quoteStatusLabel,
  updateQuoteStatus,
  updateQuote,
  type QuoteStatus,
} from "@/services/quoteService";
import { generateQuotePDF } from "./documents/generateQuotePDF";

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
  const [pendingStatus, setPendingStatus] = useState<QuoteStatus | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState<CommercialPaymentTerms>({ payment_condition: 'CASH', credit_days: null });
  const location = useLocation();
  useEffect(() => { if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" }); }, [location.hash]);
  const ordersEnabled = isEnabled("orders");

  const { data: quote, isLoading, isFetching, isError } = useQuery({
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
  useEffect(() => { if (quote) setPaymentTerms({ payment_condition: quote.payment_condition ?? 'CASH', credit_days: quote.credit_days ?? null }); }, [quote]);
  const paymentMutation = useMutation({
    mutationFn: () => updateQuote(id!, paymentTerms),
    onSuccess: updated => { queryClient.setQueryData(['quote', id], updated); void queryClient.invalidateQueries({ queryKey: ['quotes'] }); toast({ title: 'Condición de pago actualizada' }); },
    onError: (error: Error) => toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' }),
  });

  const handlePdf = async () => {
    if (!quote || pdfBusy) return;
    setPdfBusy(true);
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
    } finally { setPdfBusy(false); }
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
    return <div className="mx-auto max-w-[1560px] space-y-5 p-4 sm:p-8"><Button variant="link" onClick={() => navigate("/cotizaciones")}><ArrowLeft className="mr-2 h-4 w-4" />Cotizaciones</Button><LoadingState variant="detail" message="Cargando cotización…" /></div>;
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

  const publicUrl = quote.public_token ? `${window.location.origin}/q/${quote.public_token}` : "";
  const shareable = ["SENT", "ACCEPTED"].includes(quote.status);
  return <div className="quotes-page mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-8">
    {isFetching && <LoadingIndicator message="Actualizando cotización…" />}
    <header className="auna-module-heading"><div><Button variant="link" className="mb-3 h-auto p-0 text-muted-foreground" onClick={() => navigate("/cotizaciones")}><ArrowLeft className="mr-2 h-4 w-4" />Cotizaciones</Button><p className="auna-module-eyebrow">Ventas</p><div className="flex flex-wrap items-center gap-3"><h1>{quote.reference || quote.id.slice(0, 8)}</h1><QuoteStatusBadge status={quote.status} /></div><p className="auna-module-description">Creada el {formatDateTime(quote.created_at, undefined, locale)} por {quote.createdBy?.name || "usuario del sistema"}</p></div>
      <div className="flex flex-wrap gap-2">{shareable && <Button variant="outline" onClick={() => void handleEmailLink()}><Mail className="mr-2 h-4 w-4" />Enviar por correo</Button>}{canConvert && <Button className="bg-brand-orange text-white hover:bg-brand-orange/90" disabled={convertMutation.isPending} onClick={() => convertMutation.mutate()}>{convertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}Convertir a pedido</Button>}</div>
    </header>
    <section className="grid gap-4 rounded-2xl border bg-card p-5 text-sm sm:grid-cols-3">
      <div><p className="text-muted-foreground">Cotización creada</p><p className="mt-1 font-semibold">{formatDateTime(quote.created_at, undefined, locale)}</p></div><div><p className="text-muted-foreground">Estado actual</p><div className="mt-1"><QuoteStatusBadge status={quote.status} /></div></div><div><p className="text-muted-foreground">Pedido vinculado</p>{linkedOrder ? <Button variant="link" className="h-auto p-0" disabled={!ordersEnabled} onClick={() => navigate(`/pedidos/${linkedOrder.id}`)}>{linkedOrder.reference || linkedOrder.id.slice(0, 8)}</Button> : <p className="mt-1">Todavía no convertida</p>}</div>
    </section>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5"><div className="grid gap-5 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5 text-brand-orange" />Cliente</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><strong className="block text-base">{quote.customer || quote.customerContact?.name || "Consumidor final"}</strong><p className="text-muted-foreground">NIT: {quote.is_final_consumer ? "CF" : quote.customer_nit || quote.customerContact?.tax_id || "No registrado"}</p>{quote.customerContact?.email && <p className="break-all">{quote.customerContact.email}</p>}{quote.customerContact?.phone && <p>{quote.customerContact.phone}</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-brand-orange" />Condiciones</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Válida hasta</span><strong>{quote.valid_until ? formatDateTime(quote.valid_until, undefined, locale) : "Sin fecha"}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Moneda</span><strong>{currencyCode}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Sucursal</span><strong>{quote.branch?.name || "—"}</strong></div></CardContent></Card>
      </div>
      <QuoteLines key={quote.id} lines={quote.lines.map((line) => ({ ...line, name: line.product?.name || line.product_id, code: line.product?.barcode, image: line.product?.image_url }))} money={fmt} />
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-brand-orange" />Notas</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{quote.notes || "Sin notas adicionales."}</CardContent></Card>
      {Boolean(quote.stock_reservations?.length) && <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">Apartado temporal activo: {quote.stock_reservations!.reduce((sum, r) => sum + r.qty, 0)} unidades{quote.stock_reservations![0].expires_at ? ` · vence ${formatDateTime(quote.stock_reservations![0].expires_at!, undefined, locale)}` : ""}.</div>}
      </div>
      <aside className="space-y-5">
        <Card><CardHeader><CardTitle className="text-lg">Condición de pago</CardTitle></CardHeader><CardContent className="space-y-3">{quote.status === 'DRAFT' && hasPermission('quotes.create') ? <><CommercialPaymentFields customerId={quote.customer_contact_id} value={paymentTerms} onChange={setPaymentTerms} /><Button variant="outline" disabled={paymentMutation.isPending} onClick={() => paymentMutation.mutate()}>Guardar condición de pago</Button></> : <p>{quote.payment_condition === 'CREDIT' ? `A crédito · ${quote.credit_days} días desde la venta` : 'Al contado'}</p>}</CardContent></Card>
        <QuoteSummary subtotal={quote.subtotal} discount={quote.discount_total} total={quote.total} money={fmt} />
        <Card id="enlace-publico"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Link2 className="h-5 w-5 text-brand-orange" />Enlace público</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="text-muted-foreground">Comparte esta cotización para que tu cliente pueda revisarla en línea.</p>{shareable ? <><Input readOnly aria-label="Enlace público de cotización" value={publicUrl} /><Button variant="outline" className="w-full" onClick={() => void handleCopyLink()}><Link2 className="mr-2 h-4 w-4" />Copiar enlace</Button>{publicUrl && <Button asChild variant="outline" className="w-full"><a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Vista previa pública</a></Button>}</> : <p className="rounded-xl bg-muted/40 p-3">Disponible al generar la cotización. Los borradores no se comparten desde esta vista.</p>}</CardContent></Card>
        <Card id="documentos"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-brand-orange" />Documentos</CardTitle></CardHeader><CardContent><Button variant="outline" className="w-full" disabled={pdfBusy} onClick={() => void handlePdf()}>{pdfBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Descargar PDF</Button></CardContent></Card>
        {canManage && ["DRAFT", "SENT", "ACCEPTED"].includes(quote.status) && <Card><CardHeader><CardTitle className="text-lg">Gestionar cotización</CardTitle></CardHeader><CardContent className="space-y-3">
          {quote.status === "DRAFT" && <Button className="w-full bg-brand-orange text-white" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("SENT")}>Generar cotización</Button>}
          {quote.status === "SENT" && <><Button className="w-full" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("ACCEPTED")}>Registrar aceptación</Button><Button className="w-full" variant="outline" disabled={statusMutation.isPending} onClick={() => setPendingStatus("REJECTED")}>Registrar rechazo</Button></>}
          {!linkedOrder && <Button variant="outline" className="w-full text-destructive" disabled={statusMutation.isPending} onClick={() => setPendingStatus("CANCELLED")}>Cancelar cotización</Button>}
        </CardContent></Card>}
      </aside>
    </div>
    <AlertDialog open={Boolean(pendingStatus)} onOpenChange={(open) => { if (!open) setPendingStatus(null) }}><AlertDialogContent variant="auna"><AlertDialogHeader><AlertDialogTitle>{pendingStatus === "REJECTED" ? "¿Registrar rechazo?" : "¿Cancelar cotización?"}</AlertDialogTitle><AlertDialogDescription>Se liberarán los apartados temporales y esta cotización dejará de estar disponible para el cliente. Esta acción no se puede revertir.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Volver</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingStatus) statusMutation.mutate(pendingStatus) }}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
