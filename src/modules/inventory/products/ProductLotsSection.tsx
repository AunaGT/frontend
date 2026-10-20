/**
 * Sección de lotes con existencia (FEFO) en el detalle de producto.
 * Permite corregir un lote mal ingresado (cantidad / caducidad / código) o eliminarlo.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CompactFilterPanel } from "@/components/shared/CompactFilterPanel";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog } from "@/components/shared/FormDialog";
import { Pagination } from "@/components/shared/Pagination";
import { CollectionEmptyState } from "@/components/shared/CollectionEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingIndicator, LoadingState } from "@/components/shared/LoadingState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Search, Trash2 } from "lucide-react";
import { apiFetch } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { usePersistedListUiState } from "@/hooks/usePersistedListUiState";

import {normalizeUnitDecimal,compareUnitQuantities,remainingUnitQuantity} from '@/modules/inventory/units/public';
type ProductLot = {
  id: string;
  lot_code: string | null;
  expiry_date: string | null;
  qty_received: number|string;
  qty_remaining: number|string;
  received_at: string;
  /** Anaquel donde está; null = lote heredado sin ubicación conocida. */
  location: { id: string; code: string; warehouse: { id: string; name: string } } | null;
};

/** Físico vs. lotificado. Antes la página mostraba las dos sumas por separado. */
type Reconciliation = {
  physical: number|string;
  lotted: number|string;
  unlotted: number|string;
  tracks_expiry: boolean;
  balanced: boolean;
};

type LotsResponse = { lots: ProductLot[]; reconciliation: Reconciliation };

type Props = {
  productId: string;
  baseDecimals?:number;
  baseLabel?:string;
  tracksExpiry: boolean;
  /** Se llama tras editar/eliminar un lote, para refrescar el stock mostrado en la página. */
  onMutated?: () => void;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-GT", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });

// yyyy-mm-dd para <input type="date"> desde una fecha ISO (que viene como día UTC)
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function ProductLotsSection({ productId, tracksExpiry, onMutated,baseDecimals=0,baseLabel='unidades' }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuthPermissions();
  const canManage = hasPermission("products.register_incoming");
  const { timezone } = useSystemSettings();
  const queryClient = useQueryClient();
  const query = useQuery<LotsResponse>({
    queryKey: ["product-lots", productId],
    queryFn: () => apiFetch<LotsResponse>(`/api/products/${productId}/lots`),
  });
  const lots = query.data?.lots ?? [];
  const recon = query.data?.reconciliation;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const { page, pageSize, setPage, setPageSize } = usePersistedListUiState('inventario/producto/lotes', {defaultPageSize:10});

  // expiry_date es DATE: se compara con el día del negocio, no con la hora UTC actual.
  const todayParts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const today = Date.UTC(Number(todayParts.year), Number(todayParts.month) - 1, Number(todayParts.day));
  const daysToExpiry = (lot: ProductLot) => lot.expiry_date ? Math.round((Date.parse(lot.expiry_date.slice(0, 10)) - today) / 86400000) : null;
  const locations = [...new Map(lots.flatMap(lot => lot.location ? [[lot.location.id, lot.location] as const] : [])).values()];
  const term = search.trim().toLocaleLowerCase("es-GT");
  const filteredLots = lots.filter(lot => {
    const days = daysToExpiry(lot);
    return (locationId === "all" || lot.location?.id === locationId) &&
      (!term || [lot.lot_code, lot.location?.code, lot.location?.warehouse.name].some(value => value?.toLocaleLowerCase("es-GT").includes(term))) &&
      (status === "all" || (status === "expired" && days != null && days < 0) || (status === "expiring" && days != null && days >= 0 && days <= 30) || (status === "current" && days != null && days > 30) || (status === "undated" && days == null));
  });
  const totalPages = Math.max(1, Math.ceil(filteredLots.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleLots = filteredLots.slice((safePage - 1) * pageSize, safePage * pageSize);

  const [editing, setEditing] = useState<ProductLot | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [editQty, setEditQty] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<ProductLot | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const loadLots = async () => {
    await query.refetch();
    for (const key of ["lots-expiring", "products", "stock-by-location"]) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  const openEdit = (lot: ProductLot) => {
    setEditing(lot);
    setEditCode(lot.lot_code ?? "");
    setEditExpiry(toDateInput(lot.expiry_date));
    setEditQty(String(lot.qty_received));
  };

  const saveEdit = async () => {
    if (!editing || !canManage || saving || !validEdit) return;
    setSaving(true);
    try {
      await apiFetch(`/api/products/lots/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          lot_code: editCode.trim() || null,
          expiry_date: editExpiry || null,
          qty_received: normalizeUnitDecimal(editQty,{decimals:baseDecimals,allowZero:false}),
        }),
      });
      toast({ title: "Lote actualizado" });
      setEditing(null);
      await loadLots();
      onMutated?.();
    } catch (e) {
      toast({
        title: "No se pudo actualizar el lote",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || !canManage || deletingBusy) return;
    setDeletingBusy(true);
    try {
      await apiFetch(`/api/products/lots/${deleting.id}`, { method: "DELETE" });
      toast({ title: "Lote eliminado", description: "Se ajustó el stock del producto." });
      setDeleting(null);
      await loadLots();
      onMutated?.();
    } catch (e) {
      toast({
        title: "No se pudo eliminar el lote",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setDeletingBusy(false);
    }
  };

  const minQuantity=editing?remainingUnitQuantity(String(editing.qty_received),String(editing.qty_remaining)):'0';
  let validEdit=false;try{validEdit=compareUnitQuantities(normalizeUnitDecimal(editQty,{decimals:baseDecimals,allowZero:false}),minQuantity)>=0&&(!tracksExpiry||Boolean(editExpiry))}catch{/* Keep the invalid draft available for correction. */}

  const statusLabels: Record<string, string> = { all: "Todos", expired: "Vencidos", expiring: "Por vencer (≤ 30 días)", current: "Vigentes", undated: "Sin caducidad" };
  const appliedFilters = [
    ...(search.trim() ? [{ label: `Búsqueda: ${search}`, onRemove: () => { setSearch(""); setPage(1); } }] : []),
    ...(status !== "all" ? [{ label: `Estado: ${statusLabels[status]}`, onRemove: () => { setStatus("all"); setPage(1); } }] : []),
    ...(locationId !== "all" ? [{ label: `Ubicación: ${locations.find(location => location.id === locationId)?.code || "Seleccionada"}`, onRemove: () => { setLocationId("all"); setPage(1); } }] : []),
  ];

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="product-lots-heading">
      <div className="auna-surface rounded-xl border p-4 sm:p-5 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="product-lots-heading" className="text-xl font-semibold tracking-tight">Lotes y caducidades</h2>
          <p className="mt-1 text-sm text-muted-foreground">Consulta las cantidades y atiende primero los lotes que vencen antes.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/inventario/lotes")}>Ver listado general</Button>
      </header>

      {recon && !query.isLoading && !query.isError && <>
        <dl aria-label="Reconciliación de existencias" className="flex flex-wrap gap-x-6 gap-y-2 border-b pb-3 text-sm">
          {[["Existencia física", recon.physical], ["Con lote", recon.lotted], ["Sin lote", recon.unlotted]].map(([label, value]) => <div key={label} className="flex gap-2"><dt className="text-muted-foreground">{label}:</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}
        </dl>
        {!recon.balanced && <p className="border-l-2 border-amber-500 pl-3 text-sm text-muted-foreground">
          {compareUnitQuantities(String(recon.unlotted),'0')<0
            ? "La existencia atribuida a los lotes supera la existencia física. Revisa los ingresos y ajustes antes de corregirla."
            : recon.tracks_expiry
              ? "Hay unidades sin lote en un producto que controla caducidad. Revisa sus ingresos y ajustes para reconciliar la diferencia."
              : "Las unidades sin lote pueden corresponder a saldos iniciales o ajustes de un producto que no controla caducidad."}
        </p>}
      </>}

      <CompactFilterPanel
        title="Filtros de lotes del producto"
        activeCount={appliedFilters.length}
        appliedFilters={appliedFilters}
        onClear={() => { setSearch(""); setStatus("all"); setLocationId("all"); setPage(1); }}
        search={<div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Buscar lotes del producto" className="pl-9" placeholder="Buscar lote, almacén o ubicación…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
        </div>}
      >
        <div className="space-y-1">
          <Label htmlFor="product-lot-status">Estado</Label>
          <Select value={status} onValueChange={value => { setStatus(value); setPage(1); }}>
            <SelectTrigger id="product-lot-status"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="product-lot-location">Ubicación</Label>
          <Select value={locationId} onValueChange={value => { setLocationId(value); setPage(1); }}>
            <SelectTrigger id="product-lot-location"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
              {locations.map(location => <SelectItem key={location.id} value={location.id}>{location.warehouse.name} · {location.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CompactFilterPanel>

      <div className="auna-data-table-shell auna-table-embedded overflow-x-auto" aria-busy={query.isFetching}>
        {query.isFetching && !query.isLoading && <LoadingIndicator message="Actualizando lotes…" className="px-4 py-2" />}
        {query.isLoading ? <LoadingState columns={['Lote', 'Almacén / ubicación', 'Vencimiento', 'Existencia', 'Estado', ...(canManage ? ['Acciones'] : [])]} message="Cargando lotes…" /> : query.isError ? <div role="alert" className="p-8 text-center">
          <p>No se pudieron cargar los lotes del producto.</p>
          <Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>Reintentar</Button>
        </div> : filteredLots.length === 0 ? <CollectionEmptyState compact
          title="Cada lote tendrá su lugar aquí"
          description="Este producto todavía no tiene lotes con existencia. Se crean al registrar un ingreso de mercancía con sus datos de caducidad."
          filtered={Boolean(search.trim()) || status !== "all" || locationId !== "all"}
          onReset={() => { setSearch(""); setStatus("all"); setLocationId("all"); setPage(1); }}
        /> : <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Almacén / ubicación</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Existencia</TableHead>
                <TableHead>Estado</TableHead>
                {canManage && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow></TableHeader>
              <TableBody>{visibleLots.map(lot => {
                const days = daysToExpiry(lot);
                const expired = days != null && days < 0;
                const expiringSoon = days != null && days >= 0 && days <= 30;
                return <TableRow key={lot.id}>
                  <TableCell className="font-semibold">{lot.lot_code || "Sin código"}</TableCell>
                  <TableCell>{lot.location?.warehouse.name || "Sin ubicación"}{lot.location && <p className="mt-1 text-xs text-muted-foreground">{lot.location.code}</p>}</TableCell>
                  <TableCell className={expired ? "whitespace-nowrap text-red-600 dark:text-red-400" : "whitespace-nowrap"}>{lot.expiry_date ? formatDate(lot.expiry_date) : "Sin caducidad"}<p className="mt-1 text-xs tabular-nums">{days == null ? "—" : days === 0 ? "Vence hoy" : days < 0 ? `Hace ${Math.abs(days)} días` : `${days} días`}</p></TableCell>
                  <TableCell className="text-right tabular-nums"><strong>{lot.qty_remaining} {baseLabel}</strong><p className="mt-1 text-xs text-muted-foreground">Recibido: {lot.qty_received} {baseLabel}</p></TableCell>
                  <TableCell><Badge className={expired ? "border-0 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/10" : expiringSoon ? "border-0 bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/15" : days != null ? "border-0 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10" : "border-0 bg-muted text-muted-foreground hover:bg-muted"}>{expired ? "Vencido" : expiringSoon ? "Por vencer" : days == null ? "Sin caducidad" : "Vigente"}</Badge></TableCell>
                  {canManage && <TableCell className="text-right"><div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" disabled={query.isFetching || saving || deletingBusy} onClick={() => openEdit(lot)} aria-label={`Editar lote ${lot.lot_code || lot.id}`}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>
                    <Button variant="outline" size="icon" disabled={query.isFetching || saving || deletingBusy} className="text-destructive" onClick={() => setDeleting(lot)} aria-label={`Eliminar lote ${lot.lot_code || lot.id}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                  </div></TableCell>}
                </TableRow>;
              })}</TableBody>
            </Table>
          </div>

        </>}
      </div>
      </div>
      {!query.isLoading && !query.isError && filteredLots.length > 0 && <div className="auna-pagination-outside"><Pagination currentPage={safePage} totalPages={totalPages} totalItems={filteredLots.length} pageSize={pageSize} count={visibleLots.length} itemLabel="lotes" onPageChange={setPage} onPageSizeChange={setPageSize} loading={query.isFetching} /></div>}

      <FormDialog
        appearance="auna"
        open={editing !== null}
        onOpenChange={open => { if (!open && !saving) setEditing(null); }}
        title="Corregir lote"
        description="Corrige el código, la caducidad o la cantidad recibida. Cambiar la cantidad ajusta la existencia del producto."
        onSubmit={saveEdit}
        loading={saving}
        submitDisabled={!canManage || !validEdit}
      >
        <div className="space-y-2">
          <Label htmlFor="lot-code">Código de lote</Label>
          <Input id="lot-code" value={editCode} onChange={event => setEditCode(event.target.value)} placeholder="Opcional" maxLength={60} disabled={saving} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lot-expiry">Caducidad{tracksExpiry ? " *" : ""}</Label>
          <Input id="lot-expiry" type="date" value={editExpiry} onChange={event => setEditExpiry(event.target.value)} required={tracksExpiry} disabled={saving} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lot-qty">Cantidad recibida *</Label>
          <Input id="lot-qty" type="number" min={minQuantity} step="any" required value={editQty} onChange={event => setEditQty(event.target.value)} disabled={saving} aria-describedby="lot-qty-help" />
          <p id="lot-qty-help" className="text-xs text-muted-foreground">Ya consumido: {minQuantity} {baseLabel}. La cantidad recibida no puede ser menor.</p>
        </div>
      </FormDialog>

      <ConfirmDialog
        appearance="auna"
        variant="destructive"
        open={deleting !== null}
        onOpenChange={open => { if (!open && !deletingBusy) setDeleting(null); }}
        title="¿Eliminar este lote?"
        description={`Se descontarán del stock las ${deleting?.qty_remaining ?? 0} unidades restantes de este lote. Usa esta corrección si se registró en el producto equivocado; después deberás ingresarlo en el correcto.`}
        confirmText="Eliminar lote"
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

export default ProductLotsSection;
