/**
 * Sección de componentes BOM en detalle de producto kit.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import type { ProductBomComponentDraft } from "@/types/product";
import { updateProductBom } from "@/services/productService";
import { ProductKitComponentsEditor } from "./ProductKitComponentsEditor";
import { useKitAssemblePrompt } from "./hooks/useKitAssemblePrompt";

type Props = {
  product: Product;
  productId: string;
  canEdit: boolean;
  onUpdated?: () => void;
};

export function ProductKitSection({ product, productId, canEdit, onUpdated }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ProductBomComponentDraft[]>([]);

  const isKit = product.kind === "KIT";
  const [assembling, setAssembling] = useState(false);
  const { promptDialog, offerAssemble } = useKitAssemblePrompt(() => onUpdated?.());

  useEffect(() => {
    if (!isKit) return;
    setDraft(
      (product.kitComponents ?? []).map((line) => ({
        component_product_id: line.component_product_id,
        qty_per_unit: line.qty_per_unit,
        component_name: line.component_product?.name,
      }))
    );
  }, [product, isKit]);

  const handleSave = async () => {
    const valid = draft.filter((c) => c.component_product_id && c.qty_per_unit > 0);
    if (valid.length === 0) {
      toast({ title: "Agrega al menos un componente", variant: "destructive" });
      return;
    }
    const wasKit = isKit;
    setSaving(true);
    try {
      await updateProductBom(productId, valid);
      toast({ title: "Componentes actualizados" });
      setEditing(false);
      if (!wasKit) {
        const opened = await offerAssemble(productId, product.name);
        if (!opened) onUpdated?.();
      } else {
        onUpdated?.();
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo guardar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateKit = async () => {
    setDraft([{ component_product_id: "", qty_per_unit: 1 }]);
    setEditing(true);
  };

  const handleAssembleMore = async () => {
    setAssembling(true);
    try {
      const opened = await offerAssemble(productId, product.name);
      if (!opened) {
        toast({
          title: "Sin stock suficiente",
          description: "No hay suficiente stock de componentes para armar otra unidad.",
          variant: "destructive",
        });
      }
    } finally {
      setAssembling(false);
    }
  };

  if (!isKit && !canEdit) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          Kit / combo
          {isKit && <Badge variant="secondary">Ensamblado</Badge>}
        </CardTitle>
        {canEdit && !editing && isKit && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Editar componentes
          </Button>
        )}
        {canEdit && !isKit && (
          <Button variant="outline" size="sm" onClick={() => void handleCreateKit()}>
            Convertir a kit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!isKit && !editing && (
          <p className="text-sm text-muted-foreground">
            Puedes armar un combo vendible que descuenta stock de otros productos del inventario.
          </p>
        )}
        {editing ? (
          <>
            <ProductKitComponentsEditor
              value={draft}
              onChange={setDraft}
              excludeProductId={productId}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Guardando…" : "Guardar componentes"}
              </Button>
            </div>
          </>
        ) : isKit ? (
          <ul className="text-sm space-y-2">
            {(product.kitComponents ?? []).length === 0 && (
              <li className="text-muted-foreground">Sin componentes configurados.</li>
            )}
            {(product.kitComponents ?? []).map((line) => (
              <li key={line.id} className="flex justify-between gap-2 border-b pb-2 last:border-0">
                <span>{line.component_product?.name ?? line.component_product_id}</span>
                <span className="text-muted-foreground">× {line.qty_per_unit}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {isKit && product.stockAssembled && (
          <div className="flex items-center justify-between text-sm border-t pt-3">
            <span>
              Stock propio (armado): <strong>{product.stock}</strong> unidades
            </span>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => void handleAssembleMore()} disabled={assembling}>
                {assembling ? "Armando…" : "Armar más"}
              </Button>
            )}
          </div>
        )}
        {isKit && !product.stockAssembled && (
          <p className="text-xs text-muted-foreground">
            Disponible según componentes. Al vender este SKU se descuenta el inventario de cada componente.
          </p>
        )}
      </CardContent>
      {promptDialog}
    </Card>
  );
}
