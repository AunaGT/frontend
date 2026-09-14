/**
 * Diálogo reutilizable: tras guardar el BOM de un kit por primera vez,
 * ofrece armar unidades ahora (descuenta materiales de una vez) o dejarlo
 * en modo virtual (descuenta al vender, comportamiento de siempre).
 */
import { useState } from "react";
import { X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchProductsAvailability, assembleKitStock } from "@/services/productService";

type PromptState = { productId: string; productName: string; maxQty: number } | null;

export function useKitAssemblePrompt(onResolved: () => void) {
  const { toast } = useToast();
  const [state, setState] = useState<PromptState>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [busy, setBusy] = useState(false);

  const offerAssemble = async (productId: string, productName: string): Promise<boolean> => {
    try {
      const availability = await fetchProductsAvailability([productId]);
      const maxQty = availability[productId]?.available ?? 0;
      if (maxQty > 0) {
        setState({ productId, productName, maxQty });
        setQtyInput(String(maxQty));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const dismiss = () => {
    if (!state) return;
    setState(null);
    onResolved();
  };

  const parsedQty = Number(qtyInput);
  const qtyValid = state != null && Number.isInteger(parsedQty) && parsedQty >= 1 && parsedQty <= state.maxQty;

  const confirmAssemble = async () => {
    if (!state || !qtyValid) return;
    setBusy(true);
    try {
      const { qty } = await assembleKitStock(state.productId, parsedQty);
      toast({
        title: `${qty} unidades armadas`,
        description: `Se descontaron los materiales de "${state.productName}" de una vez.`,
      });
      setState(null);
      onResolved();
    } catch (e) {
      toast({
        title: "No se pudo armar el kit",
        description: e instanceof Error ? e.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const promptDialog = (
    <AlertDialog open={state != null} onOpenChange={(o) => !o && dismiss()}>
      <AlertDialogContent>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
        </button>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Armar el kit ahora?</AlertDialogTitle>
          <AlertDialogDescription>
            Puedes armar hasta {state?.maxQty} unidades de &quot;{state?.productName}&quot; con el
            stock de componentes disponible. Los materiales se descuentan de una vez del inventario.
            Si prefieres, cierra este diálogo y se descontarán automáticamente cada vez que vendas el kit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="assemble-qty">Cantidad a armar</Label>
          <Input
            id="assemble-qty"
            type="number"
            min={1}
            max={state?.maxQty}
            step={1}
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            disabled={busy}
          />
          {state != null && !qtyValid && (
            <p className="text-xs text-destructive">Ingresa un número entre 1 y {state.maxQty}.</p>
          )}
        </div>
        <AlertDialogFooter>
          <Button disabled={busy || !qtyValid} onClick={() => void confirmAssemble()}>
            {busy ? "Armando…" : `Armar ${qtyInput || ""} ahora`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { promptDialog, offerAssemble };
}
