/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Crear sesión de inventariado e iniciar conteo.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Play, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useProductCategories } from "@/hooks/useProductCategories";
import { Pagination } from "@/components/shared/Pagination";
import { SupplierPicker } from "@/components/shared/SupplierPicker";
import type { Supplier } from "@/types";
import { useTenant } from "@/context/useTenant";
import { Textarea } from "@/components/ui/textarea";
import "../inventoryCount.css";
import { createInventorySession, startInventorySession } from "../api/inventoryCountService";
import type { InventoryCountScope } from "../api/inventoryCountService";
import { fetchWarehouses } from "@/services/warehouseService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScopeMode = "full" | "filtered";

export default function InventoryCountNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { branch: currentBranch } = useTenant();
  const [supplierNames, setSupplierNames] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [warehouseId, setWarehouseId] = useState("all");
  const { data: warehousesData, isError: warehouseError, isLoading: warehouseLoading, refetch: reloadWarehouses } = useQuery({ queryKey: ["warehouses"], queryFn: () => fetchWarehouses() });
  const warehouses = (warehousesData ?? []).filter((w) => w.active);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("full");
  const [selCategories, setSelCategories] = useState<Set<number>>(new Set());
  const [selSuppliers, setSelSuppliers] = useState<Set<string>>(new Set());
  const [selAbc, setSelAbc] = useState<Set<"A" | "B" | "C">>(new Set());
  const [samplePercentStr, setSamplePercentStr] = useState("");
  const [doubleCount, setDoubleCount] = useState(false);
  const [dualApproval, setDualApproval] = useState(true);

  const [categorySearch, setCategorySearch] = useState("");
  const [categoryQ, setCategoryQ] = useState("");
  const [categoryPage, setCategoryPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => { setCategoryQ(categorySearch.trim()); setCategoryPage(1) }, 300);
    return () => window.clearTimeout(timer);
  }, [categorySearch]);
  const categoryQuery = useProductCategories({ page: categoryPage, pageSize: 10, search: categoryQ });
  const { data: categoriesData, isLoading: catLoading, isError: catError, refetch: reloadCategories } = categoryQuery;
  const categories = categoriesData?.items ?? [];


  useEffect(() => {
    if (scopeMode === "full") {
      setSelCategories(new Set());
      setSelSuppliers(new Set());
    }
  }, [scopeMode]);

  const sampleNum = samplePercentStr.trim() === "" ? NaN : Number(samplePercentStr);
  const sampleOk =
    samplePercentStr.trim() === "" ||
    (Number.isInteger(sampleNum) && sampleNum >= 1 && sampleNum <= 99);

  const filteredReady =
    scopeMode === "full" || selCategories.size > 0 || selSuppliers.size > 0;

  const createMut = useMutation({
    mutationFn: async () => {
      if (scopeMode === "filtered" && !selCategories.size && !selSuppliers.size) {
        throw new Error("Elija al menos una categoría o un proveedor, o cambie a «Todo el inventario».");
      }
      if (!sampleOk) {
        throw new Error("En «Cuántos productos» use un número entre 1 y 99, o deje el campo vacío para contar todos.");
      }
      const scope: InventoryCountScope = {};
      if (scopeMode === "filtered") {
        if (selCategories.size) scope.categoryIds = [...selCategories];
        if (selSuppliers.size) scope.supplierIds = [...selSuppliers];
      }
      if (selAbc.size) scope.abcClasses = [...selAbc];
      if (Number.isFinite(sampleNum) && sampleNum > 0 && sampleNum < 100) {
        scope.samplePercent = Math.round(sampleNum);
      }
      if (doubleCount) scope.doubleCount = true;

      const session = await createInventorySession({
        name: name.trim() || undefined,
        warehouse_id: warehouseId === "all" ? undefined : warehouseId,
        scope,
        notes: notes.trim() || undefined,
        dual_approval: dualApproval,
      });
      // Una vez creada la sesión ya no debe quedar huérfana en este formulario:
      // si arrancarla falla (o tarda), el detalle tiene su propio botón
      // "Armar lista y contar" para reintentar, en vez de invitar a otro click
      // acá que crearía una sesión DRAFT nueva por encima de la anterior.
      let startError: string | null = null;
      try {
        await startInventorySession(session.id);
      } catch (e) {
        startError = e instanceof Error ? e.message : "No se pudo armar la lista automáticamente";
      }
      return { id: session.id, startError };
    },
    onSuccess: ({ id, startError }) => {
      if (startError) {
        toast({
          title: "Sesión creada",
          description: `${startError} Usa «Armar lista y contar» en el detalle para reintentar.`,
        });
      } else {
        toast({ title: "Todo listo", description: "Te llevamos a la pantalla para contar." });
      }
      navigate(`/inventario/inventariado/${id}`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "No se pudo crear la sesión";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });


  return <div className="inventory-count-page inventory-count-new"><div className="inventory-count-content">
    <Button variant="ghost" size="sm" className="justify-self-start -ml-3" onClick={() => navigate("/inventario/inventariado")} disabled={createMut.isPending}><ArrowLeft className="mr-2 h-4 w-4" />Sesiones de conteo</Button>
    <header className="auna-module-heading"><div><p className="auna-module-eyebrow">Inventario</p><h1>Nuevo conteo</h1><p className="auna-module-description">Define qué vas a contar y revisa los parámetros antes de comenzar.</p></div></header>
    <form onSubmit={e => { e.preventDefault(); createMut.mutate() }}>
      <fieldset disabled={createMut.isPending} className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0">
          <Card><CardHeader className="p-4"><CardTitle className="flex items-center gap-3 text-base"><ClipboardList className="h-5 w-5 text-brand-orange" />Información del conteo</CardTitle></CardHeader><CardContent className="space-y-4 p-4 pt-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2"><Label>Sucursal</Label><Input value={currentBranch?.name || "Selecciona una sucursal en el encabezado"} readOnly aria-label="Sucursal del conteo" /></div>
              <div className="space-y-2"><Label htmlFor="count-warehouse">Almacén</Label><Select value={warehouseId} onValueChange={setWarehouseId} disabled={warehouseLoading || warehouseError}><SelectTrigger id="count-warehouse"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los almacenes</SelectItem>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>{warehouseError && <p role="alert" className="text-xs text-destructive">No se cargaron los almacenes. <button type="button" className="underline" onClick={() => reloadWarehouses()}>Reintentar</button></p>}</div>
              <div className="space-y-2 sm:col-span-2 xl:col-span-1"><Label htmlFor="count-name">Nombre / referencia (opcional)</Label><Input id="count-name" value={name} maxLength={200} onChange={e => setName(e.target.value)} placeholder="Ej. Conteo por cierre de mes" /></div>
            </div>
            <div className="space-y-3"><Label>Alcance de productos</Label><RadioGroup value={scopeMode} onValueChange={v => setScopeMode(v as ScopeMode)} className="grid gap-3 sm:grid-cols-2">{[{ value: "full", title: "Todo el inventario", text: "Todos los productos activos del catálogo." }, { value: "filtered", title: "Categorías y proveedores", text: "Cuenta solo los productos que coincidan." }].map(item => <label key={item.value} htmlFor={`scope-${item.value}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"><RadioGroupItem id={`scope-${item.value}`} value={item.value} className="mt-1" /><span><strong className="text-sm">{item.title}</strong><span className="block text-xs text-muted-foreground mt-1">{item.text}</span></span></label>)}</RadioGroup></div>
            {scopeMode === "filtered" && <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Categorías ({selCategories.size})</Label><Input aria-label="Buscar categorías" placeholder="Buscar categoría…" value={categorySearch} onChange={e => setCategorySearch(e.target.value)} /><ScrollArea className="h-40 rounded-xl border p-3">{catLoading ? <p role="status" className="text-sm text-muted-foreground">Cargando categorías…</p> : catError ? <p role="alert" className="text-sm text-destructive">No se cargaron. <button type="button" className="underline" onClick={() => reloadCategories()}>Reintentar</button></p> : categories.length ? <div className="space-y-3">{categories.map(c => <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={selCategories.has(Number(c.id))} onCheckedChange={checked => { const values = new Set(selCategories); if (checked) values.add(Number(c.id)); else values.delete(Number(c.id)); setSelCategories(values) }} />{c.name}</label>)}</div> : <p className="text-sm text-muted-foreground">Sin categorías.</p>}</ScrollArea>{categoriesData && <Pagination currentPage={categoriesData.page} totalPages={categoriesData.totalPages} onPageChange={setCategoryPage} loading={categoryQuery.isFetching} itemLabel="categorías" />}</div>
              <div className="space-y-2"><Label>Proveedores ({selSuppliers.size})</Label><SupplierPicker label="Buscar y agregar proveedor…" onSelect={(supplier: Supplier | null) => { if (!supplier) return; setSelSuppliers(previous => new Set([...previous, supplier.id])); setSupplierNames(previous => ({ ...previous, [supplier.id]: supplier.name })) }} /><div className="flex flex-wrap gap-2">{[...selSuppliers].map(id => <span key={id} className="inline-flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1 text-xs">{supplierNames[id]}<button type="button" aria-label={`Quitar proveedor ${supplierNames[id]}`} onClick={() => setSelSuppliers(previous => { const values = new Set(previous); values.delete(id); return values })}><X className="h-3 w-3" /></button></span>)}</div><p className="text-xs text-muted-foreground">La búsqueda carga resultados por páginas, no todo el catálogo.</p></div>
              {!filteredReady && <p role="status" className="sm:col-span-2 text-sm text-amber-700 dark:text-amber-300">Selecciona al menos una categoría o un proveedor.</p>}
              <p className="sm:col-span-2 text-xs text-muted-foreground">Si eliges ambos, el producto debe pertenecer a una categoría y a un proveedor seleccionados.</p>
            </div>}
            <section className="space-y-3 border-t pt-4" aria-labelledby="count-controls-title"><h2 id="count-controls-title" className="text-base font-semibold">Controles del conteo</h2>
            <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>Prioridad por valor de inventario</Label><div className="flex flex-wrap gap-4">{(["A", "B", "C"] as const).map(k => <label key={k} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={selAbc.has(k)} onCheckedChange={checked => { const values = new Set(selAbc); if (checked) values.add(k); else values.delete(k); setSelAbc(values) }} />Grupo {k}</label>)}</div><p className="text-xs text-muted-foreground">A: mayor valor · B: intermedio · C: resto. Vacío incluye todos.</p></div><div className="space-y-2"><Label htmlFor="ic-sample">Muestra del catálogo (%)</Label><Input id="ic-sample" type="number" min={1} max={99} step={1} value={samplePercentStr} aria-invalid={!sampleOk} aria-describedby="sample-help" onChange={e => setSamplePercentStr(e.target.value)} placeholder="Vacío = contar el 100%" /><p id="sample-help" className={`text-xs ${sampleOk ? "text-muted-foreground" : "text-destructive"}`}>{sampleOk ? "Opcional. Selección aleatoria reproducible del alcance." : "Usa un número entero del 1 al 99."}</p></div></div>
            <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer"><Checkbox checked={doubleCount} onCheckedChange={v => setDoubleCount(v === true)} className="mt-1" /><span><strong className="text-sm">Doble conteo independiente</strong><span className="block text-xs text-muted-foreground mt-1">Registra dos lecturas por línea. Ambas deben coincidir para enviar a revisión.</span></span></label>
            <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer"><Checkbox checked={dualApproval} onCheckedChange={v => setDualApproval(v === true)} className="mt-1" /><span><strong className="text-sm">Requerir dos aprobaciones</strong><span className="block text-xs text-muted-foreground mt-1">Dos personas distintas autorizan. Solo la aprobación final actualiza el stock.</span></span></label>
            </div></section>
            <div className="space-y-2"><Label htmlFor="count-notes">Notas (opcional)</Label><Textarea id="count-notes" value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} placeholder="Indicaciones para el conteo…" rows={2} className="min-h-16" /></div>
          </CardContent></Card>
        </div>
        <Card className="auna-count-summary self-start lg:sticky lg:top-4"><CardHeader className="p-4"><CardTitle className="text-base">Resumen del conteo</CardTitle></CardHeader><CardContent className="p-4 pt-0"><dl>
          <div><dt>Sucursal</dt><dd>{currentBranch?.name || "Sin seleccionar"}</dd></div><div><dt>Almacén</dt><dd>{warehouses.find(w => w.id === warehouseId)?.name || "Todos los almacenes"}</dd></div>
          <div><dt>Alcance</dt><dd>{scopeMode === "full" ? "Todo el inventario" : `${selCategories.size} categorías / ${selSuppliers.size} proveedores`}</dd></div>
          <div><dt>Grupos por valor</dt><dd>{[...selAbc].join(", ") || "Todos"}</dd></div><div><dt>Muestra</dt><dd>{samplePercentStr || "100"}%</dd></div><div><dt>Doble conteo</dt><dd>{doubleCount ? "Sí" : "No"}</dd></div><div><dt>Aprobaciones</dt><dd>{dualApproval ? "Dos personas" : "Una persona"}</dd></div>
        </dl><p className="mt-3 flex gap-2 rounded-xl border bg-blue-500/5 p-3 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0 text-blue-500" />Al comenzar se preparará la lista y se guardará la cantidad del sistema como referencia. El stock no cambia hasta aprobar.</p>
        <footer className="mt-4 grid gap-2 border-t pt-4"><Button type="submit" className="bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={createMut.isPending || !filteredReady || !sampleOk || warehouseLoading || warehouseError || !currentBranch}><Play className="h-4 w-4 mr-2" />{createMut.isPending ? "Preparando conteo…" : "Comenzar conteo"}</Button><Button type="button" variant="outline" onClick={() => navigate("/inventario/inventariado")} disabled={createMut.isPending}>Cancelar</Button></footer>
        </CardContent></Card>
      </fieldset>
    </form>
  </div></div>;
}
