/**
 * Sección de componentes BOM en detalle de producto kit.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/context/useTenant';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from '@/components/ui/alert-dialog';
import { Pagination } from '@/components/shared/Pagination';
import { normalizeUnitDecimal,formatUnitDecimal,formatUnitMoney } from '../units/public';
import { CollectionEmptyState } from "@/components/shared/CollectionEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import type { ProductBomComponentDraft } from "@/types/product";
import { updateProductBom,fetchKitAssemblies,reverseKitAssembly,type KitAssembly } from "@/services/productService";
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
  const {company,branch}=useTenant();
  const {locale,currencyCode}=useSystemSettings();
  const context=`${company?.id}:${branch?.id}:${productId}`;
  const current=useRef(context);current.current=context;
  const [eventPage,setEventPage]=useState(1);
  const [reversing,setReversing]=useState(false);
  const selectedOwner=useRef(context);
  const [selectedEvent,setSelectedEvent]=useState<KitAssembly|null>(null);
  const events=useQuery({queryKey:['kit-assemblies',company?.id,branch?.id,productId,eventPage],queryFn:({signal})=>fetchKitAssemblies(productId,{page:eventPage,signal,scope:{companyId:company!.id,branchId:branch!.id}}),enabled:product.kind==='KIT'&&!!company&&!!branch});
  useEffect(()=>{setSelectedEvent(null);setReversing(false);setEventPage(1)},[context]);
  const reverse=async()=>{
    if(!canEdit||!branch||!selectedEvent?.assembly_group_id||selectedEvent.status!=='READY'||reversing||current.current!==context||selectedOwner.current!==context)return;
    setReversing(true);
    try{await reverseKitAssembly(productId,selectedEvent.assembly_group_id,{companyId:company!.id,branchId:branch.id});if(current.current!==context||selectedOwner.current!==context)return;setSelectedEvent(null);await events.refetch();onUpdated?.();toast({title:'Armado completo revertido'})}
    catch(error){if(current.current===context)toast({title:'No se pudo revertir el armado',description:error instanceof Error?error.message:'Revisa el evento y sus existencias originales.',variant:'destructive'})}
    finally{if(current.current===context)setReversing(false)}
  };
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
        unit_label:line.component_product?.base_unit?.label??'unidades',
        quantity_decimals:line.component_product?.quantity_decimals??0,
      }))
    );
  }, [product, isKit]);

  const handleSave = async () => {
    let valid:ProductBomComponentDraft[];
    try{valid=draft.map(c=>({...c,qty_per_unit:normalizeUnitDecimal(String(c.qty_per_unit),{decimals:c.quantity_decimals??0,allowZero:false})}));if(valid.some(c=>!c.component_product_id))throw Error('Selecciona cada componente')}
    catch(error){toast({title:'Revisa los componentes',description:error instanceof Error?error.message:undefined,variant:'destructive'});return}
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
    <Card className="auna-surface">
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
              <li><CollectionEmptyState compact title="Las piezas del kit aún están por definir" description="Este kit no tiene componentes configurados. Aquí aparecerán sus productos y la cantidad necesaria de cada uno." /></li>
            )}
            {(product.kitComponents ?? []).map((line) => (
              <li key={line.id} className="flex justify-between gap-2 border-b pb-2 last:border-0">
                <span>{line.component_product?.name ?? line.component_product_id}</span>
                <span className="text-muted-foreground">× {line.qty_per_unit} {line.component_product?.base_unit?.label??'unidades'}</span>
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
        {isKit&&branch&&<section aria-label="Historial de armados" className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-semibold">Armados registrados</h3>
          {events.isLoading?<p role="status" className="text-sm text-muted-foreground">Cargando armados…</p>:events.isError?<div role="alert" className="text-sm">No se pudieron consultar los armados.<Button size="sm" variant="ghost" onClick={()=>void events.refetch()}>Reintentar</Button></div>:!events.data?.items.length?<p className="text-sm text-muted-foreground">Sin armados registrados.</p>:events.data.items.map((event,index)=><div key={event.assembly_group_id??`legacy-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
            <div><p>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.created_at))} · {formatUnitDecimal(event.qty,locale)} kits · {event.value==null?'Valor histórico no disponible':formatUnitMoney(event.value,locale,currencyCode)}</p><p className="text-xs text-muted-foreground">{event.status==='REVERSED'?'Revertido':event.status==='SNAPSHOT_REQUIRED'?'Requiere revisión del historial: faltan datos congelados.':'Armado completo disponible para revisión'}</p></div>
            {canEdit&&event.status==='READY'&&event.assembly_group_id&&<Button size="sm" variant="outline" aria-label={`Revertir armado completo ${event.assembly_group_id}`} disabled={reversing} onClick={()=>{selectedOwner.current=context;setSelectedEvent(event)}}>Revertir armado completo</Button>}
          </div>)}
          {events.data&&events.data.totalPages>1&&<Pagination currentPage={eventPage} totalPages={events.data.totalPages} onPageChange={setEventPage} totalItems={events.data.totalItems} pageSize={events.data.pageSize} count={events.data.items.length} itemLabel="armados"/>}
        </section>}
      </CardContent>
      <AlertDialog open={!!selectedEvent} onOpenChange={open=>{if(!open&&!reversing)setSelectedEvent(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revertir armado completo</AlertDialogTitle><AlertDialogDescription>Se revertirá el evento original completo de {selectedEvent?.qty} kits, conservando sus componentes, ubicaciones, lotes y valor histórico. Se comprobará que todos los kits sigan disponibles.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={reversing}>Cancelar</AlertDialogCancel><AlertDialogAction data-confirm-kit-reversal disabled={reversing} onClick={event=>{event.preventDefault();void reverse()}}>{reversing?'Revirtiendo…':'Revertir armado completo'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      {promptDialog}
    </Card>
  );
}
