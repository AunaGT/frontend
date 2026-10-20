import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
import { TABLE_PAGE_SIZES } from '@/utils/pagination'
import { useCarteraField } from "../carteraViewState";
import { useState } from "react";
import { usePageTrail } from "@/components/layout/PageNavigation";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ModuleTabBar } from "@/components/shared/ModuleTabs";
import { CompactFilterPanel } from "@/components/shared/CompactFilterPanel";
import { Pagination } from "@/components/shared/Pagination";
import { usePayables } from "../hooks/usePayables";
import { PayableMetrics } from "../components/PayableMetrics";
import { PayableEntries, usePayableFormat } from "../components/PayableEntries";
import { togglePayableSelection } from "../payableSelection";
import { fetchPayableSuppliers } from "../api/payablesService";
import type { PayableEntry, PayableFilters } from "../api/payablesTypes";
import { PayablesExportButton } from "../components/PayablesExportButton";
const tabs = [
  { value: "OPEN", label: "Entradas abiertas" },
  { value: "OVERDUE", label: "Vencidas" },
  { value: "UPCOMING", label: "Próximas" },
  { value: "PAID", label: "Pagadas" },
  { value: "REVIEW", label: "Por revisar" },
  { value: "suppliers", label: "Por proveedor" },
  { value: "aging", label: "Antigüedad" },
];
export default function PayablesManagement() {
  const navigate = useNavigate(),
    { money, date } = usePayableFormat(),
    [tab, setTab] = useCarteraField("pagar", "tab", "OPEN"),
    { page, setPage, pageSize, setPageSize } = usePersistedListUiState('cartera/pagar'),
    [search, setSearch] = useCarteraField("pagar", "search", ""),
    [supplierId, setSupplierId] = useCarteraField("pagar", "supplierId", ""),
    [dateFrom, setFrom] = useCarteraField("pagar", "dateFrom", ""),
    [dateTo, setTo] = useCarteraField("pagar", "dateTo", ""),
    [dueFrom, setDueFrom] = useCarteraField("pagar", "dueFrom", ""),
    [dueTo, setDueTo] = useCarteraField("pagar", "dueTo", ""),
    [filter, setFilter] = useCarteraField<PayableFilters>(
      "pagar",
      "filter",
      {},
    ),
    [selected, setSelected] = useState<PayableEntry[]>([]),
    [error, setError] = useState("");
  const view = ["suppliers", "aging"].includes(tab) ? tab : "entries",
    filters = {
      ...filter,
      state: view === "entries" ? tab : "ALL",
      page,
      pageSize,
    },
    data = usePayables(filters, view),
    { context } = data,
    query =
      view === "entries"
        ? data.entries
        : view === "suppliers"
          ? data.suppliers
          : data.aging;
  const suppliers = useQuery({
    queryKey: ["payables", ...context.key, "supplier-picker"],
    queryFn: () => fetchPayableSuppliers({ pageSize: 100, state: "ALL" }),
    enabled: context.ready && context.payable,
  });
  usePageTrail([{ label: "Cartera", to: "/cartera" }, { label: "Por pagar" }]);
  const writable =
    context.hasPermission("merchandise.mark_paid") &&
    !context.tenant.isConsolidated &&
    !!context.tenant.branch;
  const choose = (r: PayableEntry) => {
    try {
      setSelected(togglePayableSelection(selected, r));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const apply = () => {
    setFilter({
      search: search.trim(),
      supplierId,
      dateFrom,
      dateTo,
      dueFrom,
      dueTo,
    });
    setPage(1);
  };
  if (!context.ready)
    return (
      <p role="status" className="p-6">
        Comprobando disponibilidad…
      </p>
    );
  if (!context.payable)
    return (
      <p role="alert" className="p-6">
        Cuentas por pagar no está disponible.
      </p>
    );
  return (
    <div className="auna-page-fluid mx-auto space-y-5 px-4 py-6 sm:px-6">
      <header>
      </header>
      <PayableMetrics
        data={data.summary.data}
        loading={data.summary.isLoading}
        money={money}
      />
      {data.summary.isError && (
        <p role="alert">
          No se pudo cargar el resumen.{" "}
          <Button variant="outline" onClick={() => data.summary.refetch()}>
            Reintentar
          </Button>
        </p>
      )}
      <CompactFilterPanel
        title="Filtros de cuentas por pagar"
        summary="Proveedor, emisión y vencimiento"
        activeCount={Object.values(filter).filter(Boolean).length}
        onClear={() => {
          setSearch("");
          setSupplierId("");
          setFrom("");
          setTo("");
          setDueFrom("");
          setDueTo("");
          setFilter({});
          setPage(1);
        }}
        onApply={apply}
        applyDisabled={
          !!(
            (dateFrom && dateTo && dateFrom > dateTo) ||
            (dueFrom && dueTo && dueFrom > dueTo)
          )
        }
        contentClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        search={
          <div className="relative max-w-[640px]">
            <Search
              size={16}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              aria-label="Buscar cuentas por pagar"
              placeholder="Buscar proveedor, entrada o referencia…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
            />
          </div>
        }
        actions={
          writable && (
            <Button
              disabled={!selected.length}
              onClick={() =>
                navigate(
                  "/cartera/pagos/nuevo?entradas=" +
                    selected.map((r) => r.id).join(","),
                )
              }
            >
              Registrar pago
              {selected.length ? " · " + selected.length + " entradas" : ""}
            </Button>
          )
        }
      >
        <label className="space-y-2 text-sm font-medium">
          Proveedor
          <select
            className="auna-control auna-control-select"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Todos los proveedores</option>
            {suppliers.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {[
          ["Emisión desde", dateFrom, setFrom],
          ["Emisión hasta", dateTo, setTo],
          ["Vencimiento desde", dueFrom, setDueFrom],
          ["Vencimiento hasta", dueTo, setDueTo],
        ].map(([label, value, set]) => (
          <label
            key={label as string}
            className="space-y-2 text-sm font-medium"
          >
            {label as string}
            <Input
              type="date"
              value={value as string}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
            />
          </label>
        ))}
      </CompactFilterPanel>
      {context.tenant.isConsolidated && (
        <p className="text-sm text-muted-foreground">
          Vista consolidada de consulta. Selecciona una sucursal para registrar
          o anular pagos.
        </p>
      )}
      {writable && view === "entries" && (
        <p className="text-sm text-muted-foreground">
          Selecciona las entradas de un mismo proveedor para registrar un pago
          agrupado.
          {selected.length > 0 && (
            <>
              {" "}
              {selected.length} seleccionadas, incluso en otras páginas.{" "}
              <button
                className="text-brand-orange underline"
                onClick={() => setSelected([])}
              >
                Limpiar selección
              </button>
            </>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ModuleTabBar
          items={tabs}
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          ariaLabel="Vista de cuentas por pagar"
        />
        {context.hasPermission("merchandise.reports") && (
          <PayablesExportButton
            filters={{ ...filter, state: view === "entries" ? tab : "ALL" }}
          />
        )}
      </div>
      <section
        className="auna-data-table-shell"
        aria-busy={query.isFetching}
        aria-label="Cuentas por pagar"
      >
        {query.isLoading ? (
          <p role="status" className="p-6">
            Cargando cuentas…
          </p>
        ) : query.isError ? (
          <div role="alert" className="p-6">
            No se pudo cargar la información.{" "}
            <Button variant="outline" onClick={() => query.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : view === "entries" ? (
          <PayableEntries
            rows={data.entries.data?.items || []}
            filtered={Object.values(filter).some(Boolean)}
            onReset={() => { setSearch(""); setSupplierId(""); setFrom(""); setTo(""); setDueFrom(""); setDueTo(""); setFilter({}); setPage(1); }}
            selected={selected}
            onSelect={writable ? choose : undefined}
          />
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                {(view === "suppliers"
                  ? [
                      "Proveedor",
                      "Saldo",
                      "Vencido",
                      "Entradas",
                      "Próximo vencimiento",
                      "Por revisar",
                      "Acciones",
                    ]
                  : [
                      "Proveedor",
                      "Vigente",
                      "1–30 días",
                      "31–60 días",
                      "61–90 días",
                      "Más de 90 días",
                      "Sin fecha",
                      "Por revisar",
                      "Acciones",
                    ]
                ).map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {view === "suppliers"
                ? data.suppliers.data?.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold">{r.name}</TableCell>
                      <TableCell>{money(r.pending)}</TableCell>
                      <TableCell>{money(r.overdue)}</TableCell>
                      <TableCell>{r.entries}</TableCell>
                      <TableCell>{date(r.nextDue)}</TableCell>
                      <TableCell>{r.reviewCount}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={"Ver proveedor " + r.name}
                          onClick={() =>
                            navigate("/cartera/proveedores/" + r.id)
                          }
                        >
                          <Eye size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                : data.aging.data?.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold">{r.name}</TableCell>
                      {[
                        r.current,
                        r.d1_30,
                        r.d31_60,
                        r.d61_90,
                        r.d90_plus,
                        r.undated,
                      ].map((v, i) => (
                        <TableCell key={i}>{money(v)}</TableCell>
                      ))}
                      <TableCell>{r.review_count}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={"Ver proveedor " + r.name}
                          onClick={() =>
                            navigate("/cartera/proveedores/" + r.id)
                          }
                        >
                          <Eye size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              {query.data?.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    <CollectionEmptyState title="Las cuentas del negocio, en un solo lugar" description="Aquí aparecerán las compras a proveedores que correspondan a esta consulta." filtered={Object.values(filter).some(Boolean)} onReset={() => { setSearch(""); setSupplierId(""); setFrom(""); setTo(""); setDueFrom(""); setDueTo(""); setFilter({}); setPage(1); }} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>
      <div className="auna-pagination-outside">
        <Pagination
          currentPage={query.data?.page || page}
          totalPages={query.data?.totalPages || 1}
          totalItems={query.data?.totalItems || 0}
          count={query.data?.items.length || 0}
          pageSize={pageSize}
          loading={query.isFetching}
          onPageChange={setPage}
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <Label htmlFor="payables-size">Filas por página</Label>
        <select
          id="payables-size"
          className="auna-control auna-control-select w-auto"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
        >
          {TABLE_PAGE_SIZES.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
