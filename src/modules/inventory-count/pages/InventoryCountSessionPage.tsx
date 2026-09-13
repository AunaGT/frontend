/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Detalle de sesión: conteo, envío a revisión, aprobación, informes.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Send,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { PRODUCTS_QUERY_KEY } from "@/hooks/useProducts";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { formatMoney } from "@/utils";
import {
  getInventorySession,
  startInventorySession,
  listInventorySessionLines,
  updateInventoryLine,
  submitInventorySession,
  approveInventorySession,
  cancelInventorySession,
  downloadInventorySessionReport,
  statusLabel,
} from "../api/inventoryCountService";
import type { InventoryCountScope } from "../api/inventoryCountService";
import { fetchWarehouses } from "@/services/warehouseService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function InventoryCountSessionPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthPermissions();
  const { locale, currencyCode } = useSystemSettings();
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);

  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  // Se cuenta parado frente a un anaquel: se filtra por ubicación.
  const [locationId, setLocationId] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 30;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveReason, setApproveReason] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitReason, setSubmitReason] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQ, pendingOnly, locationId]);

  const canCount = hasPermission("inventory_count.count");
  const canSubmit = hasPermission("inventory_count.submit");
  const canApprove = hasPermission("inventory_count.approve");
  const canCancel = hasPermission("inventory_count.cancel");
  const canExport = hasPermission("inventory_count.export", "reports.view");
  const canStart = hasPermission("inventory_count.create");

  const sessionQuery = useQuery({
    queryKey: ["inventory-session", sessionId],
    queryFn: () => getInventorySession(sessionId),
    enabled: Boolean(sessionId),
  });

  const linesQuery = useQuery({
    queryKey: ["inventory-lines", sessionId, debouncedQ, page, pendingOnly, locationId],
    queryFn: () =>
      listInventorySessionLines(sessionId, {
        q: debouncedQ || undefined,
        offset: page * pageSize,
        limit: pageSize,
        pendingOnly: pendingOnly || undefined,
        locationId: locationId === "all" ? undefined : locationId,
      }),
    enabled: Boolean(sessionId) && sessionQuery.data?.status !== "DRAFT",
  });

  // Solo las ubicaciones del alcance: si la sesión es de un almacén, las suyas.
  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: () => fetchWarehouses() });
  const sessionWarehouseId = sessionQuery.data?.warehouse?.id;
  const countLocations = (warehousesQuery.data ?? [])
    .filter((w) => !sessionWarehouseId || w.id === sessionWarehouseId)
    .flatMap((w) => w.locations.map((l) => ({ id: l.id, label: `${w.name} · ${l.code}` })));

  const startMut = useMutation({
    mutationFn: () => startInventorySession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-lines", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
      toast({ title: "Lista preparada", description: "Ya puedes ir anotando cantidades." });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error al iniciar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const savePrimary = useCallback(
    async (lineId: string, qty: number) => {
      await updateInventoryLine(sessionId, lineId, {
        qty_counted: Math.max(0, Math.floor(qty)),
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-lines", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
    },
    [sessionId, queryClient]
  );

  const saveSecondary = useCallback(
    async (lineId: string, qty: number) => {
      await updateInventoryLine(sessionId, lineId, {
        qty_counted_secondary: Math.max(0, Math.floor(qty)),
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-lines", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
    },
    [sessionId, queryClient]
  );

  const submitMut = useMutation({
    mutationFn: (reason: string) => submitInventorySession(sessionId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
      toast({ title: "Enviado", description: "Otra persona puede revisarlo cuando pueda." });
      setSubmitOpen(false);
      setSubmitReason("");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "No se pudo enviar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const approveMut = useMutation({
    mutationFn: (reason: string) => approveInventorySession(sessionId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      setApproveOpen(false);
      setApproveReason("");
      toast({
        title: "Listo",
        description: "Si era el último paso, las existencias ya quedaron actualizadas.",
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "No se pudo aprobar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelInventorySession(sessionId, cancelReason.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-sessions"] });
      toast({ title: "Sesión cancelada" });
      setCancelOpen(false);
      setCancelReason("");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "No se pudo cancelar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const session = sessionQuery.data;
  const lines = linesQuery.data?.data ?? [];
  const linesTotal = linesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(linesTotal / pageSize));

  if (sessionQuery.isLoading || !session) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {sessionQuery.isError ? "Sesión no encontrada." : "Cargando…"}
      </div>
    );
  }

  const isDraft = session.status === "DRAFT";
  const inProgress = session.status === "IN_PROGRESS";
  const inReview = session.status === "IN_REVIEW";
  const pendingSecond = session.status === "PENDING_SECOND_APPROVAL";
  const locked = !inProgress || !canCount;
  const scope = (session.scope_json || {}) as InventoryCountScope;
  const doubleCount = Boolean(scope.doubleCount);
  const cannotSecondApprove =
    pendingSecond && user?.id && session.firstApprovedBy?.id === user.id;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/inventario/inventariado")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Listado
      </Button>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <ClipboardList className="h-7 w-7 text-primary shrink-0 mt-0.5" />
          <div>
            <h1 className="text-lg sm:text-2xl font-bold truncate">
              {session.name?.trim() || `Sesión ${session.id.slice(0, 8)}`}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="secondary">{statusLabel(session.status)}</Badge>
              {session.progress && (
                <span className="text-xs text-muted-foreground">
                  {session.progress.countedLines}/{session.progress.totalLines} con conteo completo (
                  {session.progress.pct}%)
                  {doubleCount ? (
                    <span className="text-amber-800 dark:text-amber-400">
                      {" "}
                      — aquí «completo» = columna Contado y Comprobación con número (las dos).
                    </span>
                  ) : null}
                </span>
              )}
              {session.totals && (inReview || pendingSecond) && (
                <span className="text-xs text-muted-foreground">
                  Valor aprox. diferencias: {fmt(Number(session.totals.valueDeltaApprox) || 0)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft && session._count?.lines === 0 && canStart && (
            <Button onClick={() => startMut.mutate()} disabled={startMut.isPending}>
              Armar lista y contar
            </Button>
          )}
          {canExport && session.status !== "DRAFT" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await downloadInventorySessionReport(sessionId, "pdf");
                  } catch (e) {
                    toast({
                      title: "Error",
                      description: e instanceof Error ? e.message : "PDF",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await downloadInventorySessionReport(sessionId, "csv");
                  } catch (e) {
                    toast({
                      title: "Error",
                      description: e instanceof Error ? e.message : "CSV",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </>
          )}
          {inProgress && canSubmit && (
            <Button onClick={() => setSubmitOpen(true)} disabled={submitMut.isPending}>
              <Send className="h-4 w-4 mr-2" />
              Enviar a revisión
            </Button>
          )}
          {inReview && canApprove && session.dual_approval && (
            <Button onClick={() => setApproveOpen(true)} disabled={approveMut.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Revisar conteo (paso 1 de 2)
            </Button>
          )}
          {inReview && canApprove && !session.dual_approval && (
            <Button onClick={() => setApproveOpen(true)} disabled={approveMut.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Aplicar al inventario del sistema
            </Button>
          )}
          {pendingSecond && canApprove && (
            <Button
              onClick={() => setApproveOpen(true)}
              disabled={approveMut.isPending || cannotSecondApprove}
              title={
                cannotSecondApprove
                  ? "Tiene que confirmarlo otra persona distinta a quien hizo el paso 1"
                  : undefined
              }
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar y guardar en stock (paso 2)
            </Button>
          )}
          {(isDraft || inProgress || inReview || pendingSecond) && canCancel && (
            <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <Card className="border-dashed">
        <CardHeader className="py-3 pb-0">
          <CardTitle className="text-sm font-medium">Cómo se configuró este inventario</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2 py-3">
          <p>
            {[
              scope.categoryIds?.length
                ? `${scope.categoryIds.length} categoría(s)`
                : null,
              scope.supplierIds?.length
                ? `${scope.supplierIds.length} proveedor(es)`
                : null,
              scope.abcClasses?.length
                ? `Solo grupos por valor: ${scope.abcClasses.map((x) => (x === "A" ? "A (lo más importante)" : x === "B" ? "B (intermedio)" : "C (el resto)")).join(", ")}`
                : null,
              scope.samplePercent
                ? `Contar aprox. el ${scope.samplePercent} % de la lista (elegidos al azar)`
                : null,
              doubleCount ? "Dos cantidades por producto (deben coincidir)" : null,
              session.dual_approval ? "Dos personas deben autorizar antes de cambiar el stock" : "Una sola persona puede autorizar el cambio de stock",
            ]
              .filter(Boolean)
              .join(" · ") || "Se contaron todos los productos que aplicaban, sin filtros extra."}
          </p>
          {session.submit_reason && (
            <p>
              <span className="font-medium text-foreground">Por qué se mandó a revisión: </span>
              {session.submit_reason}
            </p>
          )}
          {session.first_approved_at && (
            <p>
              <span className="font-medium text-foreground">Primera revisión (paso 1): </span>
              {session.firstApprovedBy?.name || "—"}
              {session.first_approval_reason ? ` — ${session.first_approval_reason}` : ""}
            </p>
          )}
          {session.final_approval_reason && session.approved_at && (
            <p>
              <span className="font-medium text-foreground">Nota de la confirmación final: </span>
              {session.final_approval_reason}
            </p>
          )}
        </CardContent>
      </Card>

      {isDraft && session._count?.lines === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aún no hay lista de productos. Pulsa «Armar lista y contar» para generarla según lo que elegiste al crear
            el inventario.
          </CardContent>
        </Card>
      )}

      {!isDraft && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex flex-col sm:flex-row sm:items-center gap-2">
              <span>Productos a contar</span>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:ml-auto w-full sm:w-auto">
                <Input
                  placeholder="Buscar producto o código…"
                  className="max-w-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {countLocations.length > 1 && (
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue placeholder="Ubicación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las ubicaciones</SelectItem>
                      {countLocations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {inProgress && doubleCount && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap cursor-pointer shrink-0">
                    <Checkbox
                      checked={pendingOnly}
                      onCheckedChange={(c) => setPendingOnly(c === true)}
                    />
                    Solo lo que falta guardar
                  </label>
                )}
              </div>
            </CardTitle>
            {inProgress && (
              <p className="text-xs text-muted-foreground">
                La columna «En sistema» es la cantidad que tenías al empezar; «Contado» es lo que encontraste.
                La diferencia es contado menos lo del sistema.
                {doubleCount
                  ? " Si ves dos casillas de cantidad, las dos deben guardarse (botón Guardar en cada una, o se copia sola la segunda al guardar la primera si la dejaste vacía)."
                  : ""}
              </p>
            )}
            {inProgress &&
              doubleCount &&
              session.progress &&
              session.progress.countedLines < session.progress.totalLines &&
              !pendingOnly && (
                <p className="text-xs text-amber-800 dark:text-amber-400">
                  Aún faltan {session.progress.totalLines - session.progress.countedLines} producto(s) sin conteo
                  completo en el sistema (revisa las dos columnas o usa «Solo lo que falta guardar» arriba).
                </p>
              )}
            {pendingOnly && !linesQuery.isLoading && inProgress && (
              <p className="text-xs text-muted-foreground">
                Mostrando {linesTotal} fila(s) que aún no tienen guardado todo lo necesario.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {linesQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando lista…</p>}
            {!linesQuery.isLoading && pendingOnly && lines.length === 0 && inProgress && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400 py-4 text-center">
                No quedan filas sin guardar: el conteo completo ya está en el sistema.
              </p>
            )}
            {!linesQuery.isLoading && !(pendingOnly && lines.length === 0) && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">En sistema</TableHead>
                      <TableHead className="text-right w-28">Contado</TableHead>
                      {doubleCount && <TableHead className="text-right w-28">Comprobación</TableHead>}
                      <TableHead className="text-right">Diferencia</TableHead>
                      <TableHead className="text-right">Valor aprox.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((row) => (
                      <LineRow
                        key={row.id}
                        row={row}
                        locked={locked}
                        doubleCount={doubleCount}
                        fmt={fmt}
                        onSavePrimary={(qty) => savePrimary(row.id, qty)}
                        onSaveSecondary={(qty) => saveSecondary(row.id, qty)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-3 space-y-2">
                {inProgress && (
                  <p className="text-xs text-amber-800 dark:text-amber-400">
                    Hay {linesTotal} filas en {totalPages} páginas; el porcentaje del encabezado y del listado cuenta
                    todas, no solo las que ves ahora.
                  </p>
                )}
                <div className="flex justify-between items-center text-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-muted-foreground">
                    Página {page + 1} de {totalPages} ({linesTotal} líneas)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={submitOpen}
        onOpenChange={(o) => {
          setSubmitOpen(o);
          if (!o) setSubmitReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Listo para enviar a revisión</AlertDialogTitle>
            <AlertDialogDescription>
              Escribe en pocas palabras por qué das por terminado el conteo (mínimo 5 caracteres). Quedará
              guardado por si más adelante alguien pregunta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="submit-reason">Comentario</Label>
            <Textarea
              id="submit-reason"
              className="mt-1"
              value={submitReason}
              onChange={(e) => setSubmitReason(e.target.value)}
              placeholder="Ej. Ya contamos todo el pasillo, cuadra con lo esperado"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (submitReason.trim().length < 5) {
                  toast({ title: "Un poco más largo", description: "Escribe al menos 5 letras o números.", variant: "destructive" });
                  return;
                }
                submitMut.mutate(submitReason.trim());
              }}
              disabled={submitMut.isPending}
            >
              Enviar a revisión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={approveOpen}
        onOpenChange={(o) => {
          setApproveOpen(o);
          if (!o) setApproveReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSecond
                ? "Último paso: guardar cantidades en el sistema"
                : session.dual_approval
                  ? "Primera revisión (el stock aún no cambia)"
                  : "Guardar cantidades en el sistema"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSecond
                ? "Se actualizarán las existencias con lo que se contó. Debe hacerlo alguien distinto a quien hizo la primera revisión."
                : session.dual_approval
                  ? "Solo confirmas que el conteo se ve bien; las existencias en el sistema se actualizan cuando otra persona haga el segundo paso."
                  : "Las existencias en el sistema pasarán a ser las cantidades que contaron. Desde aquí no se deshace automáticamente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="approve-reason">Comentario (por qué das el visto bueno)</Label>
            <Textarea
              id="approve-reason"
              className="mt-1"
              value={approveReason}
              onChange={(e) => setApproveReason(e.target.value)}
              placeholder="Ej. Cuadra con lo visto en tienda y con el último ingreso"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (approveReason.trim().length < 5) {
                  toast({ title: "Un poco más largo", description: "Escribe al menos 5 letras o números.", variant: "destructive" });
                  return;
                }
                approveMut.mutate(approveReason.trim());
              }}
              disabled={approveMut.isPending}
            >
              Listo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar sesión</AlertDialogTitle>
            <AlertDialogDescription>
              No se aplicarán cambios al stock. Indique el motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="cancel-reason">Motivo</Label>
            <Textarea
              id="cancel-reason"
              className="mt-1"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej. Conteo incompleto, reagendar…"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason("")}>Cerrar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!cancelReason.trim()) {
                  toast({ title: "Indique un motivo", variant: "destructive" });
                  return;
                }
                cancelMut.mutate();
              }}
              disabled={cancelMut.isPending}
            >
              Cancelar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LineRow({
  row,
  locked,
  doubleCount,
  fmt,
  onSavePrimary,
  onSaveSecondary,
}: {
  row: import("../api/inventoryCountService").InventoryCountLineRow;
  locked: boolean;
  doubleCount: boolean;
  fmt: (n: number) => string;
  onSavePrimary: (qty: number) => Promise<void>;
  onSaveSecondary: (qty: number) => Promise<void>;
}) {
  const [val, setVal] = useState<string>(
    row.qty_counted != null ? String(row.qty_counted) : ""
  );
  const [val2, setVal2] = useState<string>(
    row.qty_counted_secondary != null ? String(row.qty_counted_secondary) : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVal(row.qty_counted != null ? String(row.qty_counted) : "");
    setVal2(row.qty_counted_secondary != null ? String(row.qty_counted_secondary) : "");
  }, [row.qty_counted, row.qty_counted_secondary, row.id]);

  const diff = row.difference;
  const vd = row.valueDifference;
  const mismatch = row.countMismatch;

  const commitPrimary = async () => {
    const n = val === "" ? NaN : Number(val);
    if (!Number.isFinite(n) || n < 0) {
      return;
    }
    setSaving(true);
    try {
      await onSavePrimary(n);
      if (doubleCount && val2.trim() === "" && row.qty_counted_secondary == null) {
        setVal2(String(n));
        await onSaveSecondary(n);
      }
    } finally {
      setSaving(false);
    }
  };

  const commitSecondary = async () => {
    const n = val2 === "" ? NaN : Number(val2);
    if (!Number.isFinite(n) || n < 0) {
      return;
    }
    setSaving(true);
    try {
      await onSaveSecondary(n);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow className={mismatch ? "bg-amber-500/10" : undefined}>
      <TableCell className="font-medium max-w-[180px] truncate" title={row.product.name}>
        {row.product.name}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{row.product.barcode || "—"}</TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        <span className="text-muted-foreground">{row.location.warehouse.name} · </span>
        <span className="font-mono">{row.location.code}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.stock_snapshot}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Input
            type="number"
            min={0}
            className="w-20 h-8 text-right"
            disabled={locked}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => commitPrimary()}
            onKeyDown={(e) => e.key === "Enter" && commitPrimary()}
          />
          {!locked && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-2"
              disabled={saving}
              onClick={() => commitPrimary()}
            >
              Guardar
            </Button>
          )}
        </div>
      </TableCell>
      {doubleCount && (
        <TableCell
          className={`text-right ${row.qty_counted != null && row.qty_counted_secondary == null ? "bg-amber-500/15 ring-1 ring-amber-500/40 rounded-md" : ""}`}
        >
          <div className="flex justify-end gap-1">
            <Input
              type="number"
              min={0}
              className="w-20 h-8 text-right"
              disabled={locked}
              value={val2}
              onChange={(e) => setVal2(e.target.value)}
              onBlur={() => commitSecondary()}
              onKeyDown={(e) => e.key === "Enter" && commitSecondary()}
            />
            {!locked && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 px-2"
                disabled={saving}
                onClick={() => commitSecondary()}
              >
                Guardar
              </Button>
            )}
          </div>
        </TableCell>
      )}
      <TableCell
        className={`text-right tabular-nums ${diff != null && diff < 0 ? "text-amber-700 dark:text-amber-400" : ""} ${diff != null && diff > 0 ? "text-emerald-700 dark:text-emerald-400" : ""}`}
      >
        {diff != null ? diff : "—"}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {vd != null ? fmt(Number(vd)) : "—"}
      </TableCell>
    </TableRow>
  );
}
