import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { MetricStrip } from "@/components/shared/MetricStrip";
import { Pagination } from "@/components/shared/Pagination";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { useTenant } from "@/context/useTenant";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { apiFetch } from "@/services/api";
import { correctHistoricalSettlement } from "@/modules/receivables/api/payablesService";
import {
  useCarteraAccess,
  useInvalidatePayables,
} from "@/modules/receivables/hooks/usePayables";
import { usePatchIncomingMerchandisePayment } from "../hooks/useIncomingMerchandise";
import type { IncomingMerchandise } from "../api/incomingMerchandiseService";
export function MerchandisePaymentsPanel({
  record,
}: {
  record: IncomingMerchandise;
}) {
  const navigate = useNavigate(),
    { hasPermission } = useAuthPermissions(),
    { isConsolidated } = useTenant(),
    settings = useSystemSettings(),
    invalidate = useInvalidatePayables(),
    access = useCarteraAccess(),
    patch = usePatchIncomingMerchandisePayment(),
    [page, setPage] = useState(1),
    [due, setDue] = useState(record.due_date?.slice(0, 10) || ""),
    [term, setTerm] = useState(
      record.payment_term ? String(record.payment_term.id) : "",
    ),
    [reference, setReference] = useState(record.payment_reference || ""),
    [historical, setHistorical] = useState(
      String(record.legacy_settled_amount || 0),
    ),
    [reason, setReason] = useState(""),
    [correction, setCorrection] = useState(false),
    [oldEntry, setOldEntry] = useState<string | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const writable =
      hasPermission("merchandise.mark_paid") &&
      !isConsolidated &&
      record.source !== "INITIAL",
    entries = record.payment_entries || [],
    money = (v: number) =>
      new Intl.NumberFormat(settings.locale || "es-GT", {
        style: "currency",
        currency: settings.currencyCode || "GTQ",
      }).format(v),
    date = (v: string) =>
      new Date(v).toLocaleString(settings.locale || "es-GT", {
        timeZone: settings.timezone,
      });
  const execute = async (fn: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await fn();
      await invalidate();
      setCorrection(false);
      setOldEntry(null);
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="space-y-5">
      <MetricStrip
        items={[
          { label: "Total de la entrada", value: money(record.totalValue) },
          {
            label: "Abonos documentados",
            value: money(record.amount_paid_total || 0),
          },
          {
            label: "Liquidación histórica",
            value: money(record.legacy_settled_amount || 0),
            hint: "Saldo cerrado antes del nuevo libro de pagos",
          },
          {
            label: "Saldo pendiente",
            value:
              record.amount_pending === null
                ? "Por revisar"
                : money(record.amount_pending ?? record.totalValue),
            alert: record.payment_balance_review_required,
          },
        ]}
      />
      {record.source === "INITIAL" && (
        <p className="text-sm text-muted-foreground">
          Esta es una carga inicial de inventario; no genera una cuenta por
          pagar.
        </p>
      )}
      {record.payment_balance_review_required && (
        <p role="alert" className="text-sm text-destructive">
          El saldo histórico requiere revisión antes de registrar pagos.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {writable &&
          !record.payment_balance_review_required &&
          Number(record.amount_pending) > 0 && (
            <Button
              onClick={() =>
                navigate("/mercancia/pagos/nuevo?entradas=" + record.id)
              }
            >
              Registrar pago / abono
            </Button>
          )}
        {writable &&
          (record.payment_balance_review_required ||
            Number(record.legacy_settled_amount) > 0) && (
            <Button
              variant="outline"
              onClick={() => {
                setCorrection(true);
                setOldEntry(null);
                setReason("");
              }}
            >
              Corregir liquidación histórica
            </Button>
          )}
        {access.payable && (
          <Button
            variant="outline"
            onClick={() =>
              navigate("/cartera/proveedores/" + record.supplier.id)
            }
          >
            Estado de cuenta del proveedor
          </Button>
        )}
      </div>
      <Card className="auna-surface">
        <CardHeader>
          <CardTitle>Condiciones del acuerdo</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              void execute(() =>
                patch.mutateAsync({
                  id: record.id,
                  payload: {
                    due_date: due ? due + "T12:00:00Z" : null,
                    payment_reference: reference.trim() || null,
                    ...(term !==
                    (record.payment_term ? String(record.payment_term.id) : "")
                      ? { payment_term_id: term ? Number(term) : null }
                      : {}),
                  },
                }),
              );
            }}
          >
            <div>
              <Label htmlFor="merch-term">Término de pago</Label>
              <select
                id="merch-term"
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={!writable || pending}
              >
                <option value="">Sin término de pago</option>
                {record.payment_term &&
                  !record.payment_terms?.some(
                    (t) => t.id === record.payment_term!.id,
                  ) && (
                    <option value={record.payment_term.id}>
                      {record.payment_term.name} (actual)
                    </option>
                  )}
                {record.payment_terms?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="merch-due">Vencimiento</Label>
              <Input
                id="merch-due"
                type="date"
                value={due}
                disabled={!writable || pending}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="merch-ref">Referencia general</Label>
              <Input
                id="merch-ref"
                maxLength={255}
                value={reference}
                disabled={!writable || pending}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            {writable && (
              <Button type="submit" variant="outline" disabled={pending}>
                Guardar condiciones
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
      {(correction || oldEntry) && (
        <Card className="auna-surface">
          <CardHeader>
            <CardTitle>
              {correction
                ? "Corregir liquidación histórica"
                : "Anular abono anterior"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              La corrección queda auditada. No registra dinero nuevo ni borra el
              historial.
            </p>
            {correction && (
              <>
                <Label htmlFor="legacy-amount">Monto histórico liquidado</Label>
                <Input
                  id="legacy-amount"
                  inputMode="decimal"
                  value={historical}
                  onChange={(e) => setHistorical(e.target.value)}
                  disabled={pending}
                />
              </>
            )}
            <Label htmlFor="legacy-reason">Motivo de corrección</Label>
            <Input
              id="legacy-reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setCorrection(false);
                  setOldEntry(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={pending || reason.trim().length < 3}
                onClick={() =>
                  void execute(() =>
                    correction
                      ? correctHistoricalSettlement(
                          record.id,
                          historical,
                          record.payment_revision || 0,
                          reason,
                        )
                      : apiFetch(
                          "/api/incoming-merchandise/" +
                            record.id +
                            "/payments/" +
                            oldEntry,
                          {
                            method: "DELETE",
                            body: JSON.stringify({ reason }),
                          },
                        ),
                  )
                }
              >
                Confirmar corrección
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historial de abonos</h2>
        <div className="auna-data-table-shell">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Fecha",
                  "Monto",
                  "Referencia",
                  "Registró",
                  "Estado",
                  "Acciones",
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.slice((page - 1) * 10, page * 10).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{date(r.paid_at)}</TableCell>
                  <TableCell>{money(r.amount)}</TableCell>
                  <TableCell>{r.reference || "—"}</TableCell>
                  <TableCell>{r.registered_by?.name || "—"}</TableCell>
                  <TableCell>
                    {r.cancelled_at ? "Anulado" : "Vigente"}
                    {r.cancelled_at && r.cancel_reason && (
                      <small className="block text-muted-foreground">
                        {r.cancel_reason}
                      </small>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.supplier_payment_id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate("/mercancia/pagos/" + r.supplier_payment_id)
                        }
                      >
                        Ver comprobante
                      </Button>
                    ) : writable && !r.cancelled_at ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOldEntry(r.id);
                          setCorrection(false);
                          setReason("");
                        }}
                      >
                        Anular abono anterior
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!entries.length && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No hay abonos documentados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="auna-pagination-outside">
          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(entries.length / 10))}
            totalItems={entries.length}
            count={entries.slice((page - 1) * 10, page * 10).length}
            pageSize={10}
            itemLabel="abonos"
            onPageChange={setPage}
          />
        </div>
      </section>
    </div>
  );
}
