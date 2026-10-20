import { useEffect } from "react";
import { usePageTrail } from "@/components/layout/PageNavigation";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { useAuth } from "@/context/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useCarteraAccess, useInvalidatePayables } from "../hooks/usePayables";
import {
  useSupplierPaymentDraft,
  type DraftContext,
} from "../hooks/useSupplierPaymentDraft";
import { fetchPayableSelection } from "../api/payablesService";
import { usePayableFormat } from "../components/PayableEntries";
export function SupplierPaymentForm({
  context,
  source = "cartera",
}: {
  context: DraftContext;
  source?: "cartera" | "merchandise";
}) {
  const draft = useSupplierPaymentDraft(context),
    navigate = useNavigate(),
    methods = usePaymentMethods(),
    invalidate = useInvalidatePayables(),
    { money, date } = usePayableFormat();
  usePageTrail([
    {
      label: source === "merchandise" ? "Mercancía" : "Cartera",
      to: source === "merchandise" ? "/mercancia" : "/cartera?seccion=pagar",
    },
    { label: "Registrar pago a proveedor" },
  ]);
  useEffect(() => {
    if (draft.receipt) {
      void invalidate();
      navigate(
        (source === "merchandise" ? "/mercancia/pagos/" : "/cartera/pagos/") +
          draft.receipt.id,
        { replace: true },
      );
    }
  }, [draft.receipt, invalidate, navigate, source]);
  useEffect(() => {
    if (!draft.amount && !draft.busy && !draft.ambiguous) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.amount, draft.busy, draft.ambiguous]);
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        draft.review();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="sr-only">Pago a proveedor</h1>
          <p className="mt-2 text-muted-foreground">
            {draft.selected[0]?.supplierName} · {draft.selected[0]?.branchName}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={draft.locked}
          onClick={() => {
            if (
              !draft.amount ||
              window.confirm("¿Descartar este borrador de pago?")
            )
              navigate(
                source === "merchandise"
                  ? "/mercancia/" + (draft.selected[0]?.id || "")
                  : "/cartera?seccion=pagar",
              );
          }}
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver
        </Button>
      </div>
      <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
        Este comprobante registra un pago administrativo. No ejecuta una
        transferencia bancaria, un movimiento de caja ni un asiento contable.
      </p>
      {draft.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {draft.error}
        </div>
      )}
      {draft.ambiguous && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/50 bg-card p-4 text-sm"
        >
          No se pudo confirmar la respuesta. No registres otro pago: reintenta
          la misma solicitud para recuperar el comprobante sin duplicarlo.
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Card className="auna-surface">
          <CardHeader>
            <CardTitle>1. Datos del pago</CardTitle>
          </CardHeader>
          <CardContent>
            <fieldset
              disabled={draft.locked}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="supplier-amount">
                  Monto total ({context.currencyCode})
                </Label>
                <Input
                  id="supplier-amount"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(e) => draft.setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-method">Medio de pago</Label>
                <select
                  id="supplier-method"
                  className="auna-control auna-control-select"
                  value={draft.method}
                  onChange={(e) => draft.setMethod(e.target.value)}
                  required
                >
                  <option value="">Selecciona un medio</option>
                  {methods.data
                    ?.filter((m) => !m.is_credit)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
                {methods.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    No se pudieron cargar los medios de pago.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-paid-at">
                  Fecha y hora del pago (este dispositivo)
                </Label>
                <Input
                  id="supplier-paid-at"
                  type="datetime-local"
                  value={
                    draft.paidAt
                      ? new Date(
                          new Date(draft.paidAt).getTime() -
                            new Date(draft.paidAt).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value)
                      draft.setPaidAt(new Date(e.target.value).toISOString());
                  }}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  El comprobante usa la zona de la empresa: {context.timezone}.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-reference">
                  Referencia (opcional)
                </Label>
                <Input
                  id="supplier-reference"
                  maxLength={255}
                  value={draft.reference}
                  onChange={(e) => draft.setReference(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="supplier-notes">
                  Notas internas (opcional)
                </Label>
                <textarea
                  id="supplier-notes"
                  rows={2}
                  maxLength={2000}
                  className="auna-control auna-control-textarea"
                  value={draft.notes}
                  onChange={(e) => draft.setNotes(e.target.value)}
                />
              </div>
            </fieldset>
          </CardContent>
        </Card>
        <Card className="auna-surface">
          <CardHeader>
            <CardTitle>Resumen de distribución</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span>Entradas seleccionadas</span>
              <strong>{draft.selected.length}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span>Monto del pago</span>
              <strong>{money(draft.amount || "0")}</strong>
            </div>
            <div className="flex justify-between gap-3 border-t pt-3">
              <span>Sin distribuir</span>
              <strong>
                {draft.difference === null
                  ? "Monto inválido"
                  : money(draft.difference)}
              </strong>
            </div>
            <p className="text-muted-foreground">
              No se admiten anticipos ni excedentes. El pago debe coincidir con
              la suma de los abonos.
            </p>
          </CardContent>
        </Card>
      </div>
      <section className="space-y-3">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-lg font-semibold">
            2. Distribuir entre entradas
          </h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={draft.locked}
              onClick={() => draft.refresh()}
            >
              <RefreshCw size={16} className="mr-2" />
              Actualizar saldos
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={draft.locked}
              onClick={draft.distribute}
            >
              Distribuir por vencimiento
            </Button>
          </div>
        </div>
        <div className="auna-data-table-shell">
          <Table>
            <TableHeader>
              <TableRow>
                {["Entrada", "Vencimiento", "Saldo vigente", "Abono"].map(
                  (h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.selected.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold">{r.reference}</TableCell>
                  <TableCell>{date(r.dueDate)}</TableCell>
                  <TableCell>
                    {r.balance === null ? "Por revisar" : money(r.balance)}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="max-w-40"
                      aria-label={"Abono a " + r.reference}
                      disabled={draft.locked}
                      inputMode="decimal"
                      value={draft.applications[r.id] || ""}
                      onChange={(e) =>
                        draft.setApplication(r.id, e.target.value)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      {draft.reviewing && (
        <Card className="auna-surface border-brand-orange/40">
          <CardHeader>
            <CardTitle>3. Revisa antes de confirmar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Registrarás <strong>{money(draft.amount)}</strong> a{" "}
              <strong>{draft.selected[0]?.supplierName}</strong> en{" "}
              {draft.selected[0]?.branchName}.
            </p>
            <p>
              {methods.data?.find((m) => String(m.id) === draft.method)?.name} ·{" "}
              {new Date(draft.paidAt).toLocaleString("es-GT", {
                timeZone: context.timezone,
              })}
              {draft.reference ? " · Ref. " + draft.reference : ""}
            </p>
            <p>
              Se emitirá un solo comprobante con la distribución indicada.
              Podrás anularlo completo indicando el motivo.
            </p>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="submit" variant="outline" disabled={draft.locked}>
          Revisar pago
        </Button>
        <Button
          type="button"
          disabled={draft.busy || (!draft.canConfirm && !draft.ambiguous)}
          onClick={() => draft.confirm()}
        >
          {draft.busy
            ? "Registrando…"
            : draft.ambiguous
              ? "Recuperar / reintentar mismo pago"
              : "Confirmar y registrar pago"}
        </Button>
      </div>
    </form>
  );
}
export default function SupplierPaymentPage({
  source = "cartera",
}: { source?: "cartera" | "merchandise" } = {}) {
  const context = useCarteraAccess(),
    [params] = useSearchParams(),
    { user } = useAuth(),
    settings = useSystemSettings(),
    ids = (params.get("entradas") || "").split(",").filter(Boolean),
    available =
      source === "merchandise" ? context.merchandisePayable : context.payable;
  const query = useQuery({
    queryKey: ["payables", ...context.key, "selection", ids],
    queryFn: () => fetchPayableSelection(ids),
    enabled:
      context.ready &&
      available &&
      ids.length > 0 &&
      !context.tenant.isConsolidated,
  });
  if (!context.ready)
    return (
      <p role="status" className="p-6">
        Comprobando disponibilidad…
      </p>
    );
  if (
    !available ||
    !context.hasPermission("merchandise.mark_paid") ||
    context.tenant.isConsolidated ||
    !context.tenant.branch
  )
    return (
      <p role="alert" className="p-6">
        Selecciona una sucursal autorizada para registrar pagos.
      </p>
    );
  if (!ids.length)
    return (
      <div className="p-6">
        <p>Selecciona las entradas del proveedor en Cuentas por pagar.</p>
        <Button asChild>
          <a
            href={
              source === "merchandise" ? "/mercancia" : "/cartera?seccion=pagar"
            }
          >
            Seleccionar entradas
          </a>
        </Button>
      </div>
    );
  if (query.isLoading)
    return (
      <p role="status" className="p-6">
        Revisando selección y saldos vigentes…
      </p>
    );
  if (query.isError || !query.data)
    return (
      <div role="alert" className="p-6">
        <p>{query.error?.message || "No se pudo revisar la selección"}</p>
        <Button onClick={() => query.refetch()}>Reintentar</Button>
      </div>
    );
  return (
    <main className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6">
      <SupplierPaymentForm
        source={source}
        key={context.key.join(":")}
        context={{
          companyId: context.tenant.company!.id,
          branchId: context.tenant.branch.id,
          userId: user!.id,
          currencyCode: settings.currencyCode || "GTQ",
          timezone: settings.timezone || "America/Guatemala",
          entries: query.data,
        }}
      />
    </main>
  );
}
