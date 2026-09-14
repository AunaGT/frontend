/**
 * Dónde está el producto dentro de la sucursal y cuánto debe haber en cada
 * anaquel. El mínimo de aquí no pide comprar: pide bajar de la bodega.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoveRight, Warehouse } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { useTenant } from "@/context/useTenant";
import { fetchStockByLocation, setLocationMin } from "@/services/stockMoveService";

export const ProductLocationsSection = ({ productId }: { productId: string }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { branch } = useTenant();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthPermissions();
  const canMove = hasPermission("stock_moves.create");
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: rows = [] } = useQuery({
    queryKey: ["stock-by-location", productId, branch?.id],
    queryFn: () => fetchStockByLocation(productId),
    enabled: Boolean(branch && productId),
  });

  const minMutation = useMutation({
    mutationFn: setLocationMin,
    onSuccess: () => {
      toast({ title: "Mínimo guardado" });
      void queryClient.invalidateQueries({ queryKey: ["stock-by-location", productId] });
      void queryClient.invalidateQueries({ queryKey: ["stock-replenishment"] });
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" }),
  });

  if (!branch || rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Warehouse className="h-4 w-4" /> Existencias por ubicación
        </CardTitle>
        <CardDescription>
          Suman el stock de {branch.name}. El mínimo es del anaquel: cuando baja de ahí, se repone
          desde otra ubicación en vez de comprar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ubicación</TableHead>
                <TableHead className="text-right">Existencia</TableHead>
                <TableHead className="text-right">Mínimo interno</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const key = r.location.id;
                const value = edits[key] ?? String(r.min_stock);
                const dirty = Number(value) !== r.min_stock;
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <span className="text-muted-foreground">{r.location.warehouse.name} · </span>
                      <span className="font-mono">{r.location.code}</span>
                      {!r.location.pickable && (
                        <Badge variant="outline" className="ml-2">No despacha</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{r.stock}</TableCell>
                    <TableCell className="text-right">
                      {canMove ? (
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-20 text-right"
                            value={value}
                            onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))}
                          />
                          {dirty && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={minMutation.isPending}
                              onClick={() =>
                                minMutation.mutate({
                                  product_id: productId,
                                  location_id: key,
                                  min_stock: Math.max(0, Math.floor(Number(value) || 0)),
                                })
                              }
                            >
                              Guardar
                            </Button>
                          )}
                        </div>
                      ) : (
                        r.min_stock
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.stock < r.min_stock && (
                        <Badge variant="destructive">Faltan {r.min_stock - r.stock}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {canMove && (
          <Button variant="outline" size="sm" onClick={() => navigate("/inventario/movimientos")}>
            <MoveRight className="mr-2 h-4 w-4" /> Mover entre ubicaciones
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductLocationsSection;
