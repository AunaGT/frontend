/**
 * Editor de componentes para productos tipo kit/combo.
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductCombobox } from "@/components/shared/ProductCombobox";
import type { ProductBomComponentDraft } from "@/types/product";

type Props = {
  value: ProductBomComponentDraft[];
  onChange: (next: ProductBomComponentDraft[]) => void;
  excludeProductId?: string;
  disabled?: boolean;
};

export function ProductKitComponentsEditor({ value, onChange, excludeProductId, disabled }: Props) {
  const addRow = () => {
    onChange([...value, { component_product_id: "", qty_per_unit: 1 }]);
  };

  const updateRow = (index: number, patch: Partial<ProductBomComponentDraft>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Componentes del kit</Label>
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={disabled}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </div>
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Agrega los productos del inventario que forman este combo (cantidad por unidad vendida).
        </p>
      )}
      {value.map((row, index) => (
        <div key={index} className="grid sm:grid-cols-[1fr_120px_auto] gap-2 items-end border rounded-md p-3">
          <ProductCombobox
            label="Producto"
            value={row.component_product_id || undefined}
            onChange={(id) => updateRow(index, { component_product_id: id })}
            placeholder="Buscar producto…"
          />
          <div className="space-y-1">
            <Label htmlFor={`kit-qty-${index}`}>Cant.</Label>
            <Input
              id={`kit-qty-${index}`}
              type="number"
              min={1}
              step={1}
              value={row.qty_per_unit}
              disabled={disabled}
              onChange={(e) =>
                updateRow(index, { qty_per_unit: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
              }
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={disabled}
            onClick={() => removeRow(index)}
            aria-label="Quitar componente"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {excludeProductId && (
        <p className="text-xs text-muted-foreground">No incluyas el mismo producto kit como componente.</p>
      )}
    </div>
  );
}
