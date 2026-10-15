import { useEffect, useState } from "react";
import { usePageTrail } from "@/components/layout/PageNavigation";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ModuleTabBar } from "@/components/shared/ModuleTabs";
import { Pagination } from "@/components/shared/Pagination";
import { useCarteraAccess, useSupplierStatement } from "../hooks/usePayables";
import { PayableEntries, usePayableFormat } from "../components/PayableEntries";
import { PayableMetrics } from "../components/PayableMetrics";
import { togglePayableSelection } from "../payableSelection";
import type { PayableEntry } from "../api/payablesTypes";
import { PayablesExportButton } from "../components/PayablesExportButton";
export default function SupplierStatementPage() {
  const { id = "" } = useParams(),
    access = useCarteraAccess(),
    navigate = useNavigate(),
    { money, date } = usePayableFormat(),
    [tab, setTab] = useState("entries"),
    [entryPage, setEntryPage] = useState(1),
    [paymentPage, setPaymentPage] = useState(1),
    [auditPage, setAuditPage] = useState(1),
    [selected, setSelected] = useState<PayableEntry[]>([]),
    [error, setError] = useState("");
  const query = useSupplierStatement(id, {
      state: "ALL",
      entryPage,
      paymentPage,
      auditPage,
      pageSize: 10,
    }),
    data = query.data,
    writable =
      access.hasPermission("merchandise.mark_paid") &&
      !access.tenant.isConsolidated;
  usePageTrail([
    { label: "Cartera", to: "/cartera?seccion=pagar" },
    { label: "Proveedores", to: "/cartera?seccion=pagar" },
    { label: data?.supplier.name || "Estado de cuenta" },
  ]);
  useEffect(() => {
    setSelected([]);
    setEntryPage(1);
    setPaymentPage(1);
    setAuditPage(1);
    setError("");
  }, [
    id,
    access.tenant.company?.id,
    access.tenant.branch?.id,
    access.tenant.isConsolidated,
  ]);
  if (query.isLoading)
    return (
      <p role="status" className="p-6">
        Cargando estado de cuenta…
      </p>
    );
  if (query.isError || !data)
    return (
      <div role="alert" className="p-6">
        {query.error?.message || "No se pudo cargar el estado de cuenta."}
        <Button variant="outline" onClick={() => query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  const page =
      tab === "entries"
        ? data.entries
        : tab === "payments"
          ? data.payments
          : data.audit,
    setPage =
      tab === "entries"
        ? setEntryPage
        : tab === "payments"
          ? setPaymentPage
          : setAuditPage;
  return (
    <div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="sr-only">{data.supplier.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.supplier.tax_id
              ? "NIT: " + data.supplier.tax_id
              : "NIT no registrado"}{" "}
            · {data.supplier.address || "Dirección no registrada"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/cartera?seccion=pagar")}
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver
        </Button>
      </header>
      <PayableMetrics data={data.summary} money={money} />
      <div className="flex flex-wrap justify-between gap-3">
        <ModuleTabBar
          items={[
            { value: "entries", label: "Entradas" },
            { value: "payments", label: "Pagos y anulaciones" },
            { value: "audit", label: "Auditoría" },
          ]}
          value={tab}
          onValueChange={setTab}
          ariaLabel="Estado de proveedor"
        />
        <div className="flex gap-2">
          {access.hasPermission("merchandise.reports") && (
            <PayablesExportButton filters={{ supplierId: id, state: "ALL" }} />
          )}
          {writable && (
            <Button
              disabled={!selected.length}
              onClick={() =>
                navigate(
                  "/cartera/pagos/nuevo?entradas=" +
                    selected.map((r) => r.id).join(","),
                )
              }
            >
              Pagar selección ({selected.length})
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {selected.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {selected.length} entradas seleccionadas entre páginas.{" "}
          <button
            className="text-brand-orange underline"
            onClick={() => setSelected([])}
          >
            Limpiar
          </button>
        </p>
      )}
      <section className="auna-data-table-shell" aria-busy={query.isFetching}>
        {tab === "entries" ? (
          <PayableEntries
            rows={data.entries.items}
            selected={selected}
            onSelect={
              writable
                ? (r) => {
                    try {
                      setSelected(togglePayableSelection(selected, r));
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }
                : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {(tab === "payments"
                  ? [
                      "Fecha",
                      "Comprobante",
                      "Monto",
                      "Medio / referencia",
                      "Estado",
                      "Registró",
                      "Acciones",
                    ]
                  : ["Fecha", "Acción", "Usuario", "Motivo", "Cambio de saldo"]
                ).map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tab === "payments"
                ? data.payments.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{date(r.paidAt)}</TableCell>
                      <TableCell>{r.id.slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell className="font-semibold">
                        {money(r.amount)}
                      </TableCell>
                      <TableCell>
                        {r.paymentMethod?.name || "No registrado"}
                        <small className="block text-muted-foreground">
                          {r.reference || "Sin referencia"}
                        </small>
                      </TableCell>
                      <TableCell>
                        {r.status === "CANCELLED" ? "Anulado" : "Registrado"}
                      </TableCell>
                      <TableCell>{r.registeredBy.name}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Ver comprobante de proveedor"
                          onClick={() => navigate("/cartera/pagos/" + r.id)}
                        >
                          <Eye size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                : data.audit.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{date(r.created_at)}</TableCell>
                      <TableCell>
                        {(
                          {
                            PAYMENT_POSTED: "Pago registrado",
                            PAYMENT_CANCELLED: "Pago anulado",
                            LEGACY_ENTRY_CANCELLED: "Abono anterior anulado",
                            HISTORICAL_CORRECTED:
                              "Liquidación histórica corregida",
                            CONDITIONS_UPDATED: "Condiciones actualizadas",
                          } as Record<string, string>
                        )[r.action] || r.action}
                      </TableCell>
                      <TableCell>{r.actor.name}</TableCell>
                      <TableCell>{r.reason || "—"}</TableCell>
                      <TableCell>
                        {String(
                          (r.before as { balance?: string | null }).balance ??
                            "Por revisar",
                        )}{" "}
                        →{" "}
                        {String(
                          (r.after as { balance?: string | null }).balance ??
                            "Por revisar",
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              {!page.items.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    Sin registros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>
      <div className="auna-pagination-outside">
        <Pagination
          currentPage={page.page}
          totalPages={page.totalPages}
          totalItems={page.totalItems}
          pageSize={page.pageSize}
          count={page.items.length}
          onPageChange={setPage}
          loading={query.isFetching}
        />
      </div>
    </div>
  );
}
