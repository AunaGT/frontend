/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Detalle de sesión: conteo, envío a revisión, aprobación, informes.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Package,
  Check,
  AlertTriangle,
  Download,
  Send,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountStatusBadge } from "../components/CountStatusBadge";
import { Pagination } from "@/components/shared/Pagination";
import { ExportDialog } from "@/components/shared/ExportDialog";
import { Skeleton } from "@/components/ui/skeleton";
import "../inventoryCount.css";
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
  const pageSize = 10;
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPending, setExportPending] = useState(false);
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
    enabled: Boolean(sessionId) && Boolean(sessionQuery.data) && sessionQuery.data?.status !== "DRAFT",
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
        qty_counted: qty,
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
        qty_counted_secondary: qty,
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
  useEffect(() => { if (linesQuery.data && page >= totalPages) setPage(totalPages - 1) }, [linesQuery.data, page, totalPages]);

  if (sessionQuery.isLoading || !session) {
    return <div className="inventory-count-page"><div className="inventory-count-content"><Button variant="ghost" className="justify-self-start" onClick={() => navigate("/inventario/inventariado")}><ArrowLeft className="mr-2 h-4 w-4" />Sesiones de conteo</Button>{sessionQuery.isError ? <div role="alert" className="rounded-2xl border bg-card p-8 text-center"><p>No se pudo cargar esta sesión.</p><Button variant="outline" className="mt-3" onClick={() => sessionQuery.refetch()}>Reintentar</Button></div> : <div role="status"><span className="sr-only">Cargando sesión…</span><Skeleton className="h-28 mb-5" /><Skeleton className="h-80" /></div>}</div></div>;
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
    <div className="inventory-count-page"><div className="inventory-count-content">
      <Button variant="ghost" size="sm" className="justify-self-start -ml-3" onClick={() => navigate("/inventario/inventariado")}><ArrowLeft className="h-4 w-4 mr-2" />Sesiones de conteo</Button>
      <header className="auna-module-heading"><div><p className="auna-module-eyebrow">Inventario</p><h1>{session.name?.trim() || "Sesión de conteo"}</h1><p className="auna-module-description">Registra el conteo físico y revisa las diferencias por ubicación.</p></div></header>
      <Card><CardContent className="p-5 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div className="min-w-0"><div className="flex flex-wrap gap-3 items-center"><strong className="text-lg">Conteo {session.id.slice(0, 8).toUpperCase()}</strong><CountStatusBadge status={session.status} /></div><dl className="grid gap-4 mt-5 sm:grid-cols-3 text-sm"><div><dt className="text-muted-foreground">Almacén</dt><dd className="font-medium mt-1">{session.warehouse?.name || "Todos los almacenes"}</dd></div><div><dt className="text-muted-foreground">Iniciada por</dt><dd className="font-medium mt-1">{session.createdBy.name}</dd></div><div><dt className="text-muted-foreground">Fecha de inicio</dt><dd className="font-medium mt-1">{session.started_at ? new Date(session.started_at).toLocaleString(locale) : "Pendiente"}</dd></div></dl></div>
        <div className="lg:border-l lg:pl-6"><div className="flex justify-between gap-4 mb-3"><span className="text-sm text-muted-foreground">Progreso del conteo</span><strong>{session.progress?.pct ?? 0}%</strong></div><div role="progressbar" aria-label="Progreso total del conteo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={session.progress?.pct ?? 0} className="h-3 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${session.progress?.pct ?? 0}%` }} /></div><p className="text-xs text-muted-foreground mt-3">{session.progress?.countedLines ?? 0} de {session.progress?.totalLines ?? 0} líneas completas{doubleCount ? " · Dos lecturas por línea" : ""}</p></div>
      </CardContent></Card>
      {!isDraft && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Líneas completas", value: session.progress?.countedLines ?? 0, Icon: Package, color: "text-blue-500 bg-blue-500/10" }, { label: "Sin diferencias", value: session.totals?.unchangedLines ?? 0, Icon: Check, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" }, { label: "Con diferencias", value: session.totals?.differenceLines ?? 0, Icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400 bg-amber-500/10" }, { label: "No encontrados", value: session.totals?.notFoundLines ?? 0, Icon: XCircle, color: "text-rose-600 dark:text-rose-400 bg-rose-500/10" }].map(({ label, value, Icon, color }) => <Card key={label}><CardContent className="p-4 flex items-center gap-4"><span className={`rounded-xl p-3 ${color}`}><Icon className="h-5 w-5" /></span><div><strong className="text-2xl">{value}</strong><p className="text-sm text-muted-foreground">{label}</p></div></CardContent></Card>)}
      </div>}
      {session.totals && (inReview || pendingSecond || session.status === "APPROVED") && <div className="rounded-xl border bg-card p-4 flex flex-wrap justify-between gap-3 text-sm"><span className="text-muted-foreground">Valor aproximado de las diferencias (a costo)</span><strong>{fmt(session.totals.valueDeltaApprox)}</strong></div>}
      {Boolean(session.totals?.mismatchLines) && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">Hay {session.totals?.mismatchLines} líneas con lecturas distintas. Corrígelas antes de enviar a revisión.</p>}
      <div className="flex flex-wrap justify-end gap-2">
          {isDraft && session._count?.lines === 0 && canStart && (
            <Button onClick={() => startMut.mutate()} disabled={startMut.isPending}>
              Armar lista y contar
            </Button>
          )}
          {canExport && !isDraft && <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="h-4 w-4 mr-2" />Exportar avance</Button>}
          {inProgress && canSubmit && (
            <Button onClick={() => setSubmitOpen(true)} disabled={submitMut.isPending || (session.progress?.countedLines ?? 0) < (session.progress?.totalLines ?? 0) || Boolean(session.totals?.mismatchLines)}>
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
      <details className="rounded-2xl border bg-card"><summary className="cursor-pointer p-4 text-sm font-medium">Configuración y historial del conteo</summary><Card className="border-0 shadow-none">
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
          {session.notes && <p><span className="font-medium text-foreground">Notas: </span>{session.notes}</p>}
          {session.cancel_reason && <p><span className="font-medium text-foreground">Motivo de cancelación: </span>{session.cancel_reason}</p>}
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

      </details>
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
            <CardTitle className="text-base flex flex-col sm:flex-row sm:items-center gap-3">
              <span>Productos a contar</span>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:ml-auto w-full sm:w-auto">
                <Input
                  aria-label="Escanear o buscar producto"
                  placeholder="Escanea o busca por producto / código…"
                  className="w-full sm:w-72"
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
                {inProgress && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap cursor-pointer shrink-0">
                    <Checkbox
                      checked={pendingOnly}
                      onCheckedChange={(c) => setPendingOnly(c === true)}
                    />
                    Solo pendientes
                  </label>
                )}
              </div>
            </CardTitle>
            {inProgress && (
              <p className="text-xs text-muted-foreground">
                La columna «En sistema» es la cantidad que tenías al empezar; «Contado» es lo que encontraste.
                La diferencia es contado menos lo del sistema.
                {doubleCount
                  ? " Registra y guarda ambas lecturas de forma independiente; deben coincidir para enviar a revisión."
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
                  completo en el sistema (revisa las dos columnas o usa «Solo pendientes» arriba).
                </p>
              )}
            {pendingOnly && !linesQuery.isLoading && inProgress && (
              <p className="text-xs text-muted-foreground">
                Mostrando {linesTotal} fila(s) que aún no tienen guardado todo lo necesario.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {linesQuery.isLoading && <div role="status"><span className="sr-only">Cargando productos…</span><Skeleton className="h-40" /></div>}
            {linesQuery.isError && <div role="alert" className="p-6 text-center"><p>No se pudieron cargar los productos.</p><Button variant="outline" className="mt-3" onClick={() => linesQuery.refetch()}>Reintentar</Button></div>}
            {!linesQuery.isLoading && !linesQuery.isError && pendingOnly && lines.length === 0 && inProgress && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400 py-4 text-center">
                No quedan filas sin guardar: el conteo completo ya está en el sistema.
              </p>
            )}
            {!linesQuery.isLoading && !linesQuery.isError && !(pendingOnly && lines.length === 0) && (
              <div className="auna-data-table-shell overflow-x-auto">
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
                    {!lines.length && <TableRow><TableCell colSpan={doubleCount ? 9 : 8} className="h-28 text-center text-muted-foreground">No hay productos para estos filtros.</TableCell></TableRow>}
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
            {linesQuery.data && !linesQuery.isError && <Pagination currentPage={page + 1} totalPages={totalPages} onPageChange={value => setPage(value - 1)} totalItems={linesTotal} pageSize={pageSize} count={lines.length} itemLabel="líneas" loading={linesQuery.isFetching} />}
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
        <AlertDialogContent variant="auna">
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
        <AlertDialogContent variant="auna">
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
        <AlertDialogContent variant="auna">
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
      <ExportDialog open={exportOpen} onOpenChange={value => { if (!exportPending) setExportOpen(value) }} title="Exportar conteo" summary="Descarga todas las líneas de esta sesión, con cantidades, ubicaciones y diferencias. Los filtros de la tabla no limitan este informe." formats={["pdf", "csv"]} pending={exportPending} onExport={async ({ format }) => { if (format !== "pdf" && format !== "csv") return; setExportPending(true); try { await downloadInventorySessionReport(sessionId, format); setExportOpen(false) } catch (error) { toast({ title: "No se pudo exportar", description: error instanceof Error ? error.message : "Reintenta la descarga.", variant: "destructive" }) } finally { setExportPending(false) } }} />
    </div></div>
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
  const savingRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    setVal(row.qty_counted != null ? String(row.qty_counted) : "");
  }, [row.qty_counted, row.id]);
  useEffect(() => { setVal2(row.qty_counted_secondary != null ? String(row.qty_counted_secondary) : "") }, [row.qty_counted_secondary, row.id]);

  const diff = row.difference;
  const vd = row.valueDifference;
  const mismatch = row.countMismatch;

  const commit = async (secondary = false) => {
    if (locked || savingRef.current) return;
    const raw = secondary ? val2 : val;
    const n = raw.trim() === "" ? NaN : Number(raw);
    if (!Number.isSafeInteger(n) || n < 0) {
      if (raw.trim()) toast({ title: "Cantidad inválida", description: "Usa un número entero igual o mayor a cero.", variant: "destructive" });
      return;
    }
    if (n === (secondary ? row.qty_counted_secondary : row.qty_counted)) return;
    savingRef.current = true;
    setSaving(true);
    try { await (secondary ? onSaveSecondary(n) : onSavePrimary(n)) }
    catch (error) { toast({ title: "No se guardó el conteo", description: error instanceof Error ? error.message : "Reintenta guardar esta línea.", variant: "destructive" }) }
    finally { savingRef.current = false; setSaving(false) }
  };

  return (
    <TableRow className={mismatch ? "bg-amber-500/10" : undefined}>
      <TableCell className="font-medium min-w-52" title={row.product.name}><div className="flex items-center gap-3">{row.product.image_url ? <img src={row.product.image_url} alt="" loading="lazy" className="h-10 w-10 rounded-lg border object-cover shrink-0" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0"><Package className="h-5 w-5 text-primary" /></span>}<span>{row.product.name}</span></div></TableCell>
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
            step={1}
            aria-label={`Cantidad contada de ${row.product.name}`}
            className="w-20 h-8 text-right"
            disabled={locked || saving}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
          {!locked && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-2"
              disabled={saving}
              onClick={() => commit()}
            >
              {saving ? "Guardando…" : "Guardar"}
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
              step={1}
              aria-label={`Comprobación de ${row.product.name}`}
              className="w-20 h-8 text-right"
              disabled={locked || saving}
              value={val2}
              onChange={(e) => setVal2(e.target.value)}
              onBlur={() => commit(true)}
              onKeyDown={(e) => e.key === "Enter" && commit(true)}
            />
            {!locked && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 px-2"
                disabled={saving}
                onClick={() => commit(true)}
              >
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            )}
          </div>
        </TableCell>
      )}
      <TableCell
        className={`text-right tabular-nums ${diff != null && diff < 0 ? "text-amber-700 dark:text-amber-400" : ""} ${diff != null && diff > 0 ? "text-emerald-700 dark:text-emerald-400" : ""}`}
      >
        {diff != null ? (diff > 0 ? `+${diff}` : diff) : "—"}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {vd != null ? fmt(Number(vd)) : "—"}
      </TableCell>
    </TableRow>
  );
}
