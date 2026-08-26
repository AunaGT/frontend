/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Crear sesión de inventariado e iniciar conteo.
 */

import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/useCategories";
import { useAllSuppliers } from "@/hooks/useSuppliers";
import { createInventorySession, startInventorySession } from "@/services/inventoryCountService";
import type { InventoryCountScope } from "@/services/inventoryCountService";
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
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [warehouseId, setWarehouseId] = useState("all");
  const { data: warehousesData } = useQuery({ queryKey: ["warehouses"], queryFn: () => fetchWarehouses() });
  const warehouses = (warehousesData ?? []).filter((w) => w.active);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("full");
  const [selCategories, setSelCategories] = useState<Set<number>>(new Set());
  const [selSuppliers, setSelSuppliers] = useState<Set<string>>(new Set());
  const [selAbc, setSelAbc] = useState<Set<"A" | "B" | "C">>(new Set());
  const [samplePercentStr, setSamplePercentStr] = useState("");
  const [doubleCount, setDoubleCount] = useState(false);
  const [dualApproval, setDualApproval] = useState(true);

  const { data: categoriesRaw, isLoading: catLoading } = useCategories();
  const { data: suppliersRaw, isLoading: supLoading } = useAllSuppliers();

  const categories = useMemo(() => {
    const list = categoriesRaw ?? [];
    return [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [categoriesRaw]);

  const suppliers = useMemo(() => {
    const list = suppliersRaw ?? [];
    return [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [suppliersRaw]);

  useEffect(() => {
    if (scopeMode === "full") {
      setSelCategories(new Set());
      setSelSuppliers(new Set());
    }
  }, [scopeMode]);

  const sampleNum = samplePercentStr.trim() === "" ? NaN : Number(samplePercentStr);
  const sampleOk =
    samplePercentStr.trim() === "" ||
    (Number.isFinite(sampleNum) && sampleNum > 0 && sampleNum < 100);

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

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/inventario/inventariado")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver al listado
      </Button>

      <div className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Nuevo inventariado</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Qué vamos a contar?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Puedes contar todo, solo una parte de tu catálogo, o ir por etapas. Las opciones de abajo son
            opcionales: úsalas si te sirven; si no, déjalas en blanco y listo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">¿Incluimos todos los productos o solo una parte?</Label>
            <RadioGroup
              value={scopeMode}
              onValueChange={(v) => setScopeMode(v as ScopeMode)}
              className="grid gap-3"
            >
              <label
                htmlFor="scope-full"
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value="full" id="scope-full" className="mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-sm font-medium leading-none">Todo lo que tengo en el sistema</span>
                  <p className="text-xs text-muted-foreground">
                    Todos los productos activos (los que no están borrados). Más abajo puedes acotar aún más si
                    quieres.
                  </p>
                </div>
              </label>
              <label
                htmlFor="scope-filtered"
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value="filtered" id="scope-filtered" className="mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-sm font-medium leading-none">Solo algunas categorías o proveedores</span>
                  <p className="text-xs text-muted-foreground">
                    Marca las casillas que quieras: solo se listarán productos que coincidan con lo elegido.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {warehouses.length > 1 && (
            <div className="space-y-2">
              <Label>¿Qué almacén vamos a recorrer?</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda la sucursal</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Elegir un almacén deja fuera las ubicaciones de los demás: se cuenta solo lo que hay ahí.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ic-name">Nombre para reconocer este inventario (opcional)</Label>
            <Input
              id="ic-name"
              placeholder="Ej. Conteo de marzo — bebidas"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ic-notes">Mensaje para quien va a contar (opcional)</Label>
            <Input
              id="ic-notes"
              placeholder="Ej. Revisar solo pasillo 2 hoy"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {scopeMode === "filtered" && (
            <div className="space-y-2">
              {!filteredReady && (
                <p className="text-sm text-amber-700 dark:text-amber-500">
                  Elige al menos una categoría o un proveedor, o vuelve a «Todo lo que tengo» arriba.
                </p>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categorías</Label>
                  {catLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando…</p>
                  ) : (
                    <ScrollArea className="h-48 rounded border p-2">
                      <div className="space-y-2 pr-2">
                        {categories.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={selCategories.has(Number(c.id))}
                              onCheckedChange={(v) => {
                                const next = new Set(selCategories);
                                if (v) next.add(Number(c.id));
                                else next.delete(Number(c.id));
                                setSelCategories(next);
                              }}
                            />
                            <span className="truncate">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Proveedores</Label>
                  {supLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando…</p>
                  ) : (
                    <ScrollArea className="h-48 rounded border p-2">
                      <div className="space-y-2 pr-2">
                        {suppliers.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={selSuppliers.has(String(s.id))}
                              onCheckedChange={(v) => {
                                const next = new Set(selSuppliers);
                                if (v) next.add(String(s.id));
                                else next.delete(String(s.id));
                                setSelSuppliers(next);
                              }}
                            />
                            <span className="truncate">{s.name}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">¿Ir por lo que más “pesa” en dinero? (opcional)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              El sistema ordena tus productos según cuánto valen juntos en bodega (cantidad × costo). Así puedes
              contar por partes sin tener que revisar todo de golpe. Si no marcas nada aquí, no se usa este
              filtro.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(
                [
                  { k: "A" as const, label: "Lo más importante (grupo A)" },
                  { k: "B" as const, label: "Intermedio (grupo B)" },
                  { k: "C" as const, label: "El resto (grupo C)" },
                ] as const
              ).map(({ k, label }) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer max-w-[220px]">
                  <Checkbox
                    checked={selAbc.has(k)}
                    onCheckedChange={(v) => {
                      const next = new Set(selAbc);
                      if (v) next.add(k);
                      else next.delete(k);
                      setSelAbc(next);
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <Label htmlFor="ic-sample">¿Cuántos productos de la lista vamos a contar? (opcional)</Label>
            <Input
              id="ic-sample"
              type="number"
              min={1}
              max={99}
              placeholder="Vacío = todos los que salgan en la lista"
              value={samplePercentStr}
              onChange={(e) => setSamplePercentStr(e.target.value)}
              className="max-w-xs"
            />
            {!sampleOk && (
              <p className="text-xs text-destructive">Escribe un número del 1 al 99, o deja vacío para contar todos.</p>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed">
              Si pones por ejemplo 30, el sistema escoge al azar aproximadamente el 30 % de los productos que
              cumplan lo de arriba. Sirve cuando la lista es muy larga y quieres una muestra. Si lo dejas vacío,
              se cuentan todos.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={doubleCount}
                onCheckedChange={(v) => setDoubleCount(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">Pedir dos cantidades por producto y que coincidan</span>
                <span className="text-muted-foreground block text-xs leading-relaxed mt-0.5">
                  Cada producto se anota dos veces; los números deben ser iguales antes de mandar el inventario a
                  revisión. Ayuda a pillar errores al escribir.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={dualApproval}
                onCheckedChange={(v) => setDualApproval(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">Que dos personas distintas autoricen el cambio en el stock</span>
                <span className="text-muted-foreground block text-xs leading-relaxed mt-0.5">
                  Primero alguien revisa el conteo; después otra persona da el sí final y recién ahí se
                  actualizan las existencias en el sistema. En cada paso se pide una nota corta del porqué.
                </span>
              </span>
            </label>
          </div>

          <Button
            className="w-full sm:w-auto"
            disabled={createMut.isPending || !filteredReady || !sampleOk}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Preparando…" : "Empezar inventario ahora"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
