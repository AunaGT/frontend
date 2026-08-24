/**
 * Sección de lotes con existencia (FEFO) en el detalle de producto.
 * Permite corregir un lote mal ingresado (cantidad / caducidad / código) o eliminarlo.
 */
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, PackageOpen, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import type { LotReconciliation, ProductLotApi, ProductLotsResponse } from "@/types/product";

type Props = {
  productId: string;
  tracksExpiry: boolean;
  /** Se llama tras editar/eliminar un lote, para refrescar el stock mostrado en la página. */
  onMutated?: () => void;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-GT", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });

const daysToExpiry = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 86400000);

// yyyy-mm-dd para <input type="date"> desde una fecha ISO (que viene como día UTC)
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function ProductLotsSection({ productId, tracksExpiry, onMutated }: Props) {
  const { toast } = useToast();
  const [lots, setLots] = useState<ProductLotApi[] | null>(null);
  const [reconciliation, setReconciliation] = useState<LotReconciliation | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<ProductLotApi | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [editQty, setEditQty] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<ProductLotApi | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const loadLots = useCallback(() => {
    setLoading(true);
    return apiFetch<ProductLotsResponse>(`/api/products/${productId}/lots`)
      .then((data) => { setLots(data.lots); setReconciliation(data.reconciliation); })
      .catch(() => { setLots([]); setReconciliation(null); })
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ProductLotsResponse>(`/api/products/${productId}/lots`)
      .then((data) => { if (!cancelled) { setLots(data.lots); setReconciliation(data.reconciliation); } })
      .catch(() => { if (!cancelled) { setLots([]); setReconciliation(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId]);

  const openEdit = (lot: ProductLotApi) => {
    setEditing(lot);
    setEditCode(lot.lot_code ?? "");
    setEditExpiry(toDateInput(lot.expiry_date));
    setEditQty(String(lot.qty_received));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiFetch(`/api/products/lots/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          lot_code: editCode.trim() || null,
          expiry_date: editExpiry || null,
          qty_received: Number(editQty),
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
    if (!deleting) return;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="w-5 h-5 text-liquor-amber" />
          Lotes y caducidad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {reconciliation && (
          <div className="space-y-2">
            <p className="text-sm font-medium tabular-nums">
              Físico {reconciliation.physical} <span className="text-muted-foreground">|</span>{" "}
              Trazado {reconciliation.traced} <span className="text-muted-foreground">|</span>{" "}
              Diferencia {reconciliation.difference}
            </p>
            {!reconciliation.consistent && (
              <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                El inventario físico y sus partidas no coinciden. No realices movimientos hasta reconciliar la diferencia.
              </div>
            )}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando lotes…</p>
        ) : !lots || lots.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <PackageOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin lotes con existencia registrados.</p>
            <p className="text-xs mt-1">Se crean al registrar un ingreso de mercancía para este producto.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Caducidad</TableHead>
                  <TableHead className="text-right">Existencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot) => {
                  const days = lot.expiry_date ? daysToExpiry(lot.expiry_date) : null;
                  const expired = days != null && days < 0;
                  const expiringSoon = days != null && days >= 0 && days <= 30;
                  return (
                    <TableRow key={lot.id}>
                      <TableCell>{lot.lot_code || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {lot.location ? `${lot.location.warehouse.code} · ${lot.location.code}` : "Sin ubicación"}
                      </TableCell>
                      <TableCell>
                        {lot.is_system_generated ? <Badge variant="secondary">Partida automática</Badge> : "Proveedor"}
                      </TableCell>
                      <TableCell>{lot.expiry_date ? formatDate(lot.expiry_date) : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{lot.qty_remaining}</TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge variant="destructive">Vencido</Badge>
                        ) : expiringSoon ? (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15">
                            Por vencer
                          </Badge>
                        ) : (
                          <Badge variant="outline">Vigente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(lot)} aria-label="Editar lote">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(lot)} aria-label="Eliminar lote">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Editar lote */}
      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corregir lote</DialogTitle>
            <DialogDescription>
              Ajusta la cantidad recibida, la caducidad o el código. Cambiar la cantidad ajusta el stock del producto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lot-code">Código de lote</Label>
              <Input id="lot-code" value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="Opcional" maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lot-expiry">Caducidad{tracksExpiry ? " *" : ""}</Label>
              <Input id="lot-expiry" type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lot-qty">Cantidad recibida</Label>
              <Input id="lot-qty" type="number" min={1} step={1} value={editQty} onChange={(e) => setEditQty(e.target.value)} />
              {editing && (
                <p className="text-xs text-muted-foreground">
                  Vendido de este lote: {editing.qty_received - editing.qty_remaining}. No puede recibir menos que eso.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar lote */}
      <AlertDialog open={deleting != null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Se descontará del stock del producto la existencia restante del lote
              {deleting ? ` (${deleting.qty_remaining})` : ""}. Útil si lo ingresaste en el producto equivocado; luego regístralo en el correcto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmDelete(); }} disabled={deletingBusy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingBusy ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default ProductLotsSection;
