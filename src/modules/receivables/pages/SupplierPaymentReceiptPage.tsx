import { useEffect, useRef, useState } from "react";
import { usePageTrail } from "@/components/layout/PageNavigation";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { PdfDocumentPreview } from "@/components/shared/pdf/PdfDocumentPreview";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { resolvePdfLogoDataUrl } from "@/utils/pdfBranding";
import {
  fetchSupplierReceipt,
  cancelSupplierPayment,
} from "../api/payablesService";
import { useCarteraAccess, useInvalidatePayables } from "../hooks/usePayables";
import {
  generateSupplierPaymentPdf,
  downloadReportBlob,
} from "../documents/payablesDocuments";
export default function SupplierPaymentReceiptPage() {
  const { id = "" } = useParams(),
    access = useCarteraAccess(),
    navigate = useNavigate(),
    settings = useSystemSettings(),
    invalidate = useInvalidatePayables(),
    [reason, setReason] = useState(""),
    [cancelling, setCancelling] = useState(false),
    [showCancel, setShowCancel] = useState(false),
    [pendingPdf, setPendingPdf] = useState(false),
    [error, setError] = useState(""),
    [pdf, setPdf] = useState<{ key: string; blob: Blob } | null>(null);
  const query = useQuery({
      queryKey: ["payables", ...access.key, "receipt", id],
      queryFn: () => fetchSupplierReceipt(id),
      enabled: access.ready && access.payable && !!id,
    }),
    r = query.data,
    key = JSON.stringify([access.key, id, r?.status]),
    current = useRef(key),
    generation = useRef(0);
  current.current = key;
  usePageTrail([
    { label: "Cartera", to: "/cartera?seccion=pagar" },
    {
      label: r?.supplierName || "Proveedor",
      to: r ? "/cartera/proveedores/" + r.supplierId : undefined,
    },
    { label: "Comprobante " + id.slice(0, 8).toUpperCase() },
  ]);
  useEffect(() => {
    setPdf(null);
    setError("");
    setShowCancel(false);
    setReason("");
    setPendingPdf(false);
    setCancelling(false);
    generation.current++;
  }, [key]);
  useEffect(
    () => () => {
      current.current = "unmounted";
      generation.current++;
    },
    [],
  );
  if (query.isLoading)
    return (
      <p role="status" className="p-6">
        Cargando comprobante…
      </p>
    );
  if (query.isError || !r)
    return (
      <div role="alert" className="p-6">
        {query.error?.message || "Comprobante no disponible"}
        <Button onClick={() => query.refetch()}>Reintentar</Button>
      </div>
    );
  const money = (v: string) =>
      new Intl.NumberFormat(settings.locale || "es-GT", {
        style: "currency",
        currency: r.currencyCode,
      }).format(Number(v)),
    date = (v: string) =>
      new Date(v).toLocaleString(settings.locale || "es-GT", {
        timeZone: settings.timezone,
      }),
    writable =
      access.hasPermission("merchandise.mark_paid") &&
      !access.tenant.isConsolidated &&
      r.status === "POSTED";
  const prepare = async () => {
    const scope = key,
      n = ++generation.current;
    setPendingPdf(true);
    setError("");
    try {
      const logo = await resolvePdfLogoDataUrl(settings.companyLogoUrl);
      const blob = await generateSupplierPaymentPdf(r, {
        companyName: r.companyName,
        logoDataUrl: logo,
        timezone: settings.timezone || "America/Guatemala",
        locale: settings.locale || "es-GT",
      });
      if (current.current === scope && generation.current === n)
        setPdf({ key, blob });
    } catch (e) {
      if (current.current === scope && generation.current === n)
        setError((e as Error).message);
    } finally {
      if (current.current === scope && generation.current === n)
        setPendingPdf(false);
    }
  };
  const cancel = async () => {
    if (cancelling || reason.trim().length < 3) return;
    const scope = key;
    generation.current++;
    setPdf(null);
    setCancelling(true);
    setError("");
    try {
      await cancelSupplierPayment(r.id, reason.trim());
      await invalidate();
      if (current.current === scope) {
        await query.refetch();
        setShowCancel(false);
      }
    } catch (e) {
      if (current.current === scope) setError((e as Error).message);
    } finally {
      if (current.current === scope) setCancelling(false);
    }
  };
  return (
    <main className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="sr-only">Comprobante de pago</h1>
          <p className="mt-2 text-sm text-muted-foreground">{r.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/cartera/proveedores/" + r.supplierId)}
          >
            <ArrowLeft size={16} className="mr-2" />
            Estado de cuenta
          </Button>
          {access.hasPermission("merchandise.reports") && (
            <Button
              variant="outline"
              disabled={pendingPdf || cancelling}
              onClick={() => void prepare()}
            >
              <FileText size={16} className="mr-2" />
              {pendingPdf ? "Preparando…" : "Vista previa / PDF"}
            </Button>
          )}
          {writable && (
            <Button
              variant="destructive"
              disabled={cancelling}
              onClick={() => setShowCancel(true)}
            >
              Anular pago completo
            </Button>
          )}
        </div>
      </header>
      {r.status === "CANCELLED" && (
        <div
          role="status"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive"
        >
          <strong>ANULADO · Sin efecto sobre los saldos</strong>
          <p className="mt-1 text-sm">
            {r.cancelReason} · {r.cancelledBy?.name}
            {r.cancelledAt ? " · " + date(r.cancelledAt) : ""}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Card className="auna-surface">
        <CardHeader>
          <CardTitle>Pago registrado a {r.supplierName}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Empresa", r.companyName],
            ["Sucursal", r.branchName],
            ["Monto", money(r.amount)],
            ["Fecha del pago", date(r.paidAt)],
            ["Medio", r.paymentMethod?.name || "No registrado"],
            ["Referencia", r.reference || "Sin referencia"],
            ["Registró", r.registeredBy.name],
            ["Registro", date(r.createdAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-muted-foreground">{label}</p>
              <p className="mt-1 font-semibold break-words">{value}</p>
            </div>
          ))}
          {r.notes && <p className="sm:col-span-2 lg:col-span-4">{r.notes}</p>}
        </CardContent>
      </Card>
      <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
        Comprobante interno. No es una factura, no ejecuta transferencias
        bancarias ni modifica caja o contabilidad.
      </p>
      {showCancel && writable && (
        <Card className="auna-surface">
          <CardHeader>
            <CardTitle>Anular el comprobante completo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Se reabrirán los importes de las {r.applications.length} entradas
              aplicadas. El pago permanecerá en el historial.
            </p>
            <Label htmlFor="supplier-cancel-reason">Motivo de anulación</Label>
            <textarea
              id="supplier-cancel-reason"
              className="w-full rounded-md border border-input bg-background p-3"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={cancelling}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={cancelling}
                onClick={() => setShowCancel(false)}
              >
                Conservar pago
              </Button>
              <Button
                variant="destructive"
                disabled={cancelling || reason.trim().length < 3}
                onClick={() => void cancel()}
              >
                {cancelling ? "Anulando…" : "Confirmar anulación completa"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Aplicaciones del pago</h2>
        <div className="auna-data-table-shell">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entrada de mercancía</TableHead>
                <TableHead>Importe aplicado</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.applications.map((a) => (
                <TableRow key={a.incomingId}>
                  <TableCell>
                    <button
                      className="font-semibold text-brand-orange hover:underline"
                      onClick={() => navigate("/mercancia/" + a.incomingId)}
                    >
                      {a.reference}
                    </button>
                  </TableCell>
                  <TableCell>{money(a.amount)}</TableCell>
                  <TableCell>{a.cancelledAt ? "Anulada" : "Vigente"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      {pdf?.key === key && (
        <PdfDocumentPreview
          pdf={pdf.blob}
          onDownload={() =>
            downloadReportBlob(
              pdf.blob,
              "pago-proveedor-" + r.id.slice(0, 8) + ".pdf",
            )
          }
        />
      )}
    </main>
  );
}
